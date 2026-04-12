import { bumpClientConfigVersionsForTenantLicenses } from './licensePortalService'
import { supabase } from './supabase'

export type ReleaseChannel = 'main' | 'kundenportal' | 'arbeitszeit_portal'
export type ReleaseType = 'bugfix' | 'feature' | 'major'
export type AppReleaseStatus = 'draft' | 'published'

export type AppReleaseRecord = {
  id: string
  channel: ReleaseChannel
  version_semver: string
  release_type: ReleaseType
  title: string | null
  notes: string | null
  module_tags: string[]
  incoming_enabled: boolean
  incoming_all_mandanten: boolean
  force_hard_reload: boolean
  ci_metadata: Record<string, unknown>
  /** Entwurf (z. B. GitHub-Import) – nicht in mandantenReleases, bis freigegeben */
  status: AppReleaseStatus
  created_at: string
  updated_at: string
  created_by: string | null
}

export type AppReleaseInsert = {
  channel: ReleaseChannel
  version_semver: string
  release_type: ReleaseType
  title?: string | null
  notes?: string | null
  module_tags?: string[]
  incoming_enabled?: boolean
  incoming_all_mandanten?: boolean
  force_hard_reload?: boolean
  ci_metadata?: Record<string, unknown>
  created_by?: string | null
  /** Default published (manuelle Anlage); GitHub-Action setzt draft */
  status?: AppReleaseStatus
}

const CHANNELS: ReleaseChannel[] = ['main', 'kundenportal', 'arbeitszeit_portal']

export const RELEASE_CHANNEL_LABELS: Record<ReleaseChannel, string> = {
  main: 'Haupt-App',
  kundenportal: 'Kundenportal',
  arbeitszeit_portal: 'Arbeitszeitenportal',
}

export const RELEASE_TYPE_LABELS: Record<ReleaseType, string> = {
  bugfix: 'Bugfix',
  feature: 'Funktionsupdate',
  major: 'Major',
}

export const listReleaseChannels = (): ReleaseChannel[] => [...CHANNELS]

const logAudit = async (
  actorId: string | null,
  action: string,
  opts: { releaseId?: string | null; tenantId?: string | null; channel?: string | null; metadata?: Record<string, unknown> }
) => {
  const { error } = await supabase.from('release_audit_log').insert({
    actor_id: actorId,
    action,
    release_id: opts.releaseId ?? null,
    tenant_id: opts.tenantId ?? null,
    channel: opts.channel ?? null,
    metadata: opts.metadata ?? {},
  })
  if (error) console.warn('release_audit_log', error.message)
}

export const fetchAppReleases = async (): Promise<AppReleaseRecord[]> => {
  const { data, error } = await supabase
    .from('app_releases')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return normalizeReleaseRows(data)
}

export const fetchAppReleasesByChannel = async (channel: ReleaseChannel): Promise<AppReleaseRecord[]> => {
  const { data, error } = await supabase
    .from('app_releases')
    .select('*')
    .eq('channel', channel)
    .order('version_semver', { ascending: false })
  if (error) throw new Error(error.message)
  return normalizeReleaseRows(data)
}

/** Nur freigegebene Releases (Go-Live / Zuweisung) */
export const fetchPublishedAppReleasesByChannel = async (channel: ReleaseChannel): Promise<AppReleaseRecord[]> => {
  const { data, error } = await supabase
    .from('app_releases')
    .select('*')
    .eq('channel', channel)
    .eq('status', 'published')
    .order('version_semver', { ascending: false })
  if (error) throw new Error(error.message)
  return normalizeReleaseRows(data)
}

const normalizeReleaseRows = (data: unknown[] | null): AppReleaseRecord[] =>
  (data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    const st = r.status === 'draft' ? 'draft' : 'published'
    return { ...r, status: st } as AppReleaseRecord
  })

export const fetchAppRelease = async (id: string): Promise<AppReleaseRecord | null> => {
  const { data, error } = await supabase.from('app_releases').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return normalizeReleaseRows([data])[0] ?? null
}

export const fetchIncomingTenantIdsForRelease = async (releaseId: string): Promise<string[]> => {
  const { data, error } = await supabase.from('release_incoming_tenants').select('tenant_id').eq('release_id', releaseId)
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => String(r.tenant_id))
}

export const createAppRelease = async (
  payload: AppReleaseInsert,
  incomingTenantIds: string[],
  actorId: string | null
): Promise<{ id: string } | { error: string }> => {
  const { data, error } = await supabase
    .from('app_releases')
    .insert({
      channel: payload.channel,
      version_semver: payload.version_semver.trim(),
      release_type: payload.release_type,
      title: payload.title?.trim() || null,
      notes: payload.notes ?? null,
      module_tags: payload.module_tags ?? [],
      incoming_enabled: payload.incoming_enabled ?? false,
      incoming_all_mandanten: payload.incoming_all_mandanten ?? false,
      force_hard_reload: payload.force_hard_reload ?? false,
      ci_metadata: payload.ci_metadata ?? {},
      status: payload.status ?? 'published',
      created_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error) return { error: error.message }
  const id = data.id as string
  if (incomingTenantIds.length > 0) {
    const rows = incomingTenantIds.map((tenant_id) => ({ release_id: id, tenant_id }))
    const { error: e2 } = await supabase.from('release_incoming_tenants').insert(rows)
    if (e2) return { error: e2.message }
  }
  void logAudit(actorId, 'release.create', { releaseId: id, metadata: { version: payload.version_semver } })
  return { id }
}

export const updateAppRelease = async (
  id: string,
  patch: Partial<
    Pick<
      AppReleaseInsert,
      | 'version_semver'
      | 'release_type'
      | 'title'
      | 'notes'
      | 'module_tags'
      | 'incoming_enabled'
      | 'incoming_all_mandanten'
      | 'force_hard_reload'
      | 'ci_metadata'
      | 'status'
    >
  >,
  incomingTenantIds: string[] | null,
  actorId: string | null
): Promise<{ ok: true } | { error: string }> => {
  const updateRow: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.version_semver !== undefined) updateRow.version_semver = patch.version_semver.trim()
  if (patch.release_type !== undefined) updateRow.release_type = patch.release_type
  if (patch.title !== undefined) updateRow.title = patch.title?.trim() || null
  if (patch.notes !== undefined) updateRow.notes = patch.notes
  if (patch.module_tags !== undefined) updateRow.module_tags = patch.module_tags
  if (patch.incoming_enabled !== undefined) updateRow.incoming_enabled = patch.incoming_enabled
  if (patch.incoming_all_mandanten !== undefined) updateRow.incoming_all_mandanten = patch.incoming_all_mandanten
  if (patch.force_hard_reload !== undefined) updateRow.force_hard_reload = patch.force_hard_reload
  if (patch.ci_metadata !== undefined) updateRow.ci_metadata = patch.ci_metadata
  if (patch.status !== undefined) updateRow.status = patch.status

  const { error } = await supabase.from('app_releases').update(updateRow).eq('id', id)
  if (error) return { error: error.message }

  if (incomingTenantIds !== null) {
    const { error: delErr } = await supabase.from('release_incoming_tenants').delete().eq('release_id', id)
    if (delErr) return { error: delErr.message }
    if (incomingTenantIds.length > 0) {
      const rows = incomingTenantIds.map((tenant_id) => ({ release_id: id, tenant_id }))
      const { error: insErr } = await supabase.from('release_incoming_tenants').insert(rows)
      if (insErr) return { error: insErr.message }
    }
  }
  void logAudit(actorId, 'release.update', { releaseId: id })
  return { ok: true }
}

export const deleteAppRelease = async (id: string, actorId: string | null): Promise<{ ok: true } | { error: string }> => {
  const { error } = await supabase.from('app_releases').delete().eq('id', id)
  if (error) return { error: error.message }
  void logAudit(actorId, 'release.delete', { releaseId: id })
  return { ok: true }
}

export const publishAppRelease = async (
  id: string,
  actorId: string | null
): Promise<{ ok: true } | { error: string }> => {
  const { data: row, error: selErr } = await supabase
    .from('app_releases')
    .select('status, version_semver')
    .eq('id', id)
    .maybeSingle()
  if (selErr) return { error: selErr.message }
  if (!row) return { error: 'Release nicht gefunden' }
  if ((row as { status?: string }).status === 'published') {
    void logAudit(actorId, 'release.publish', { releaseId: id, metadata: { noop: true } })
    return { ok: true }
  }
  const { error } = await supabase
    .from('app_releases')
    .update({ status: 'published', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }
  void logAudit(actorId, 'release.publish', {
    releaseId: id,
    metadata: { version: (row as { version_semver?: string }).version_semver },
  })
  return { ok: true }
}

export type TenantReleaseAssignmentRow = {
  tenant_id: string
  channel: ReleaseChannel
  active_release_id: string | null
  previous_release_id: string | null
}

/** Pro Mandant/Kanal: zugewiesenes Release (Lizenz-API), nicht gemessene „Installation“ im Browser. */
export type TenantChannelAssignedVersion = {
  channel: ReleaseChannel
  version_semver: string | null
  release_title: string | null
  assignment_updated_at: string | null
}

/**
 * Alle Zeilen `tenant_release_assignments` mit aufgelöster `version_semver` des aktiven Releases.
 * Für Mandantenübersicht (Go-Live / Rollout).
 */
export const fetchAllTenantsAssignedReleaseVersions = async (
  signal?: AbortSignal
): Promise<Map<string, TenantChannelAssignedVersion[]>> => {
  let q = supabase.from('tenant_release_assignments').select('tenant_id, channel, updated_at, active_release_id')
  if (signal) q = q.abortSignal(signal)
  const { data: rows, error } = await q
  if (error) throw new Error(error.message)
  const list = (rows ?? []) as {
    tenant_id: string
    channel: string
    updated_at: string
    active_release_id: string | null
  }[]
  const ids = [...new Set(list.map((r) => r.active_release_id).filter((x): x is string => Boolean(x)))]
  const relById = new Map<string, { version_semver: string; title: string | null }>()
  if (ids.length > 0) {
    let rq = supabase.from('app_releases').select('id, version_semver, title').in('id', ids)
    if (signal) rq = rq.abortSignal(signal)
    const { data: rels, error: e2 } = await rq
    if (e2) throw new Error(e2.message)
    for (const r of rels ?? []) {
      const row = r as { id: string; version_semver?: string | null; title?: string | null }
      relById.set(String(row.id), {
        version_semver: row.version_semver != null ? String(row.version_semver).trim() : '',
        title: row.title != null ? String(row.title) : null,
      })
    }
  }
  const map = new Map<string, TenantChannelAssignedVersion[]>()
  for (const r of list) {
    if (!CHANNELS.includes(r.channel as ReleaseChannel)) continue
    const ch = r.channel as ReleaseChannel
    const rel = r.active_release_id ? relById.get(r.active_release_id) : undefined
    const semver = rel?.version_semver?.trim() ? rel.version_semver.trim() : null
    const entry: TenantChannelAssignedVersion = {
      channel: ch,
      version_semver: semver,
      release_title: rel?.title?.trim() ? rel.title.trim() : null,
      assignment_updated_at: r.updated_at ?? null,
    }
    const arr = map.get(r.tenant_id) ?? []
    arr.push(entry)
    map.set(r.tenant_id, arr)
  }
  return map
}

/** Feste Reihenfolge für Anzeige in der Mandantenliste. */
export const getTenantAssignedVersionDisplayParts = (
  entries: TenantChannelAssignedVersion[] | undefined
): { label: string; version: string; title: string | null }[] => {
  const byCh = new Map((entries ?? []).map((e) => [e.channel, e]))
  return CHANNELS.map((ch) => {
    const e = byCh.get(ch)
    const v = e?.version_semver?.trim()
    return {
      label: RELEASE_CHANNEL_LABELS[ch],
      version: v || '–',
      title: e?.release_title?.trim() ? e.release_title.trim() : null,
    }
  })
}

export const fetchTenantReleaseAssignments = async (tenantId: string): Promise<TenantReleaseAssignmentRow[]> => {
  const { data, error } = await supabase.from('tenant_release_assignments').select('*').eq('tenant_id', tenantId)
  if (error) throw new Error(error.message)
  return (data ?? []) as TenantReleaseAssignmentRow[]
}

export const setTenantChannelActiveRelease = async (
  tenantId: string,
  channel: ReleaseChannel,
  newActiveReleaseId: string | null,
  actorId: string | null
): Promise<{ ok: true } | { error: string }> => {
  if (newActiveReleaseId) {
    const { data: rel, error: relErr } = await supabase
      .from('app_releases')
      .select('status')
      .eq('id', newActiveReleaseId)
      .maybeSingle()
    if (relErr) return { error: relErr.message }
    if (!rel) return { error: 'Release nicht gefunden' }
    if ((rel as { status?: string }).status === 'draft') {
      return {
        error:
          'Entwürfe können nicht als aktiver Release zugewiesen werden. Bitte im App-Release zuerst „Freigeben“.',
      }
    }
  }

  const { data: cur } = await supabase
    .from('tenant_release_assignments')
    .select('active_release_id')
    .eq('tenant_id', tenantId)
    .eq('channel', channel)
    .maybeSingle()

  const prevActive = cur?.active_release_id != null ? String(cur.active_release_id) : null
  const row = {
    tenant_id: tenantId,
    channel,
    active_release_id: newActiveReleaseId,
    previous_release_id: newActiveReleaseId ? prevActive : null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from('tenant_release_assignments').upsert(row, { onConflict: 'tenant_id,channel' })
  if (error) return { error: error.message }
  void logAudit(actorId, 'release.assign_active', {
    tenantId,
    channel,
    releaseId: newActiveReleaseId,
    metadata: { previous_active: prevActive },
  })
  void bumpClientConfigVersionsForTenantLicenses(tenantId).then((r) => {
    if (!r.ok) console.warn('bumpClientConfigVersionsForTenantLicenses', r.error)
  })
  return { ok: true }
}

export type AssignReleaseBulkResult = {
  ok: true
  channel: ReleaseChannel
  releaseId: string
  version_semver: string
  updated: number
  errors: { tenantId: string; error: string }[]
}

/**
 * Viele Mandanten: dasselbe **published** Release für den **Kanal dieses Releases** zuweisen.
 * Pro Mandant wie `setTenantChannelActiveRelease` (Audit + `client_config_version` der Lizenzen).
 */
export const assignPublishedReleaseToTenantIds = async (
  releaseId: string,
  tenantIds: string[],
  actorId: string | null
): Promise<AssignReleaseBulkResult | { error: string }> => {
  const rel = await fetchAppRelease(releaseId)
  if (!rel) return { error: 'Release nicht gefunden.' }
  if (rel.status !== 'published') {
    return { error: 'Nur freigegebene Releases (published) dürfen zugewiesen werden.' }
  }
  const channel = rel.channel
  const uniqueIds = [...new Set(tenantIds.map((id) => id.trim()).filter(Boolean))]
  if (uniqueIds.length === 0) return { error: 'Keine Mandanten ausgewählt.' }

  const errors: { tenantId: string; error: string }[] = []
  let updated = 0
  for (const tenantId of uniqueIds) {
    const res = await setTenantChannelActiveRelease(tenantId, channel, releaseId, actorId)
    if ('error' in res) {
      errors.push({ tenantId, error: res.error })
    } else {
      updated++
    }
  }
  return {
    ok: true,
    channel,
    releaseId,
    version_semver: rel.version_semver,
    updated,
    errors,
  }
}

export const rollbackTenantChannelRelease = async (
  tenantId: string,
  channel: ReleaseChannel,
  actorId: string | null
): Promise<{ ok: true } | { error: string }> => {
  const { data: cur, error: fErr } = await supabase
    .from('tenant_release_assignments')
    .select('active_release_id, previous_release_id')
    .eq('tenant_id', tenantId)
    .eq('channel', channel)
    .maybeSingle()
  if (fErr) return { error: fErr.message }
  const prev = cur?.previous_release_id != null ? String(cur.previous_release_id) : null
  if (!prev) return { error: 'Kein vorheriger Release gespeichert.' }

  const { error } = await supabase
    .from('tenant_release_assignments')
    .update({
      active_release_id: prev,
      previous_release_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('channel', channel)
  if (error) return { error: error.message }
  void logAudit(actorId, 'release.rollback', { tenantId, channel, releaseId: prev })
  void bumpClientConfigVersionsForTenantLicenses(tenantId).then((r) => {
    if (!r.ok) console.warn('bumpClientConfigVersionsForTenantLicenses', r.error)
  })
  return { ok: true }
}

export const fetchReleaseAuditLog = async (limit = 100) => {
  const { data, error } = await supabase
    .from('release_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return data ?? []
}
