import { supabase } from './supabase'

export type BetaFeedbackRow = {
  id: string
  tenant_id: string
  license_number: string | null
  mandant_user_id: string
  source_app: string
  route_path: string
  route_query: string | null
  category: string
  severity: string | null
  title: string | null
  description: string
  app_version: string | null
  release_label: string | null
  status: string
  priority: string | null
  internal_note: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
  tenants: { name: string } | null
}

export type BetaFeedbackListView = 'active' | 'archived' | 'all'

export const fetchBetaFeedbackList = async (
  tenantId: string | 'all',
  view: BetaFeedbackListView = 'active'
): Promise<{ rows: BetaFeedbackRow[]; error?: string }> => {
  let q = supabase
    .from('beta_feedback')
    .select('*, tenants(name)')
    .order('created_at', { ascending: false })
    .limit(500)
  if (tenantId !== 'all') {
    q = q.eq('tenant_id', tenantId)
  }
  if (view === 'active') q = q.is('archived_at', null)
  if (view === 'archived') q = q.not('archived_at', 'is', null)
  const { data, error } = await q
  if (error) return { rows: [], error: error.message }
  return { rows: (data ?? []) as BetaFeedbackRow[] }
}

export const updateBetaFeedbackAdmin = async (
  id: string,
  payload: { status: string; priority: string | null; internal_note: string | null }
): Promise<{ ok: boolean; error?: string }> => {
  const { error } = await supabase
    .from('beta_feedback')
    .update({
      status: payload.status,
      priority: payload.priority,
      internal_note: payload.internal_note,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export const setBetaFeedbackArchived = async (
  id: string,
  archived: boolean
): Promise<{ ok: boolean; error?: string }> => {
  const nowIso = new Date().toISOString()
  const { error } = await supabase
    .from('beta_feedback')
    .update({
      archived_at: archived ? nowIso : null,
      updated_at: nowIso,
    })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
