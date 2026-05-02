/**
 * Servertemplates für Mandanten-Mail: nur Platzhalter {{pfad.zu.wert}}, keine Logik / kein JS aus Templates.
 * Unbekannte Platzhalter werden durch leeren String ersetzt (sicherer Default).
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

export const MAIL_TEMPLATE_KEYS = [
  'maintenance_report',
  'portal_report_notification',
  'maintenance_reminder_digest',
  'generic',
] as const
export type MailTemplateKey = (typeof MAIL_TEMPLATE_KEYS)[number]

export type MailTemplateRow = {
  subject_template: string
  html_template: string
  text_template: string
}

export type TemplateRowDb = {
  subject_template: string | null
  html_template: string | null
  text_template: string | null
  enabled: boolean | null
}

type TemplateSource = 'tenant' | 'global' | 'code'

/** Regex: nur Buchstaben, Ziffern, Unterstrich und Punkt — keine Ausführung, keine Leerzeichen in Pfaden. */
const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g

export const getByPath = (obj: unknown, path: string): unknown => {
  const parts = path.split('.').filter(Boolean)
  let cur: unknown = obj
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined
    if (typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur
}

export const applyPlaceholders = (template: string, ctx: Record<string, unknown>): string =>
  template.replace(PLACEHOLDER_RE, (_full, key: string) => {
    const v = getByPath(ctx, key)
    if (v === null || v === undefined) return ''
    if (typeof v === 'string') return v
    if (typeof v === 'number' || typeof v === 'boolean') return String(v)
    return ''
  })

export const roughHtmlToText = (html: string): string => {
  const noScript = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
  const stripped = noScript.replace(/<[^>]+>/g, ' ')
  return stripped.replace(/\s+/g, ' ').trim()
}

export const CODE_FALLBACKS: Record<string, Record<string, MailTemplateRow>> = {
  maintenance_report: {
    de: {
      subject_template: 'Wartungsprotokoll {{bericht.datum}} – {{bauvorhaben.name}}',
      html_template:
        '<p>Guten Tag,</p><p>anbei erhalten Sie das Wartungsprotokoll für <strong>{{bauvorhaben.name}}</strong> vom <strong>{{bericht.datum}}</strong>.</p><p>Mit freundlichen Grüßen<br>{{app.name}}</p>',
      text_template: '',
    },
  },
  portal_report_notification: {
    de: {
      subject_template: 'Neuer Wartungsbericht: {{objekt.name}} – {{bericht.datum}}',
      html_template:
        '<p>Guten Tag,</p><p>es liegt ein neuer Wartungsbericht vor.</p><ul><li><strong>Objekt:</strong> {{objekt.name}}</li><li><strong>BV:</strong> {{bauvorhaben.name}}</li><li><strong>Datum:</strong> {{bericht.datum}}</li></ul><p><a href="{{portal.link}}">Zum Kundenportal</a></p><p>{{app.name}}</p>',
      text_template: '',
    },
  },
  maintenance_reminder_digest: {
    de: {
      subject_template:
        'Wartungserinnerung: {{digest.anzahl}} Objekt(e) — {{datum}} ({{mandant.name}})',
      html_template:
        '<p>Guten Tag,</p><p>folgende Wartungen sind <strong>überfällig</strong> oder stehen in den <strong>nächsten 30 Tagen</strong> an ({{datum}}, {{app.name}}):</p>{{digest.tabellen_html}}<p><a href="{{portal.link}}">Zur App</a></p><p class="text-xs" style="color:#64748b;font-size:12px;">Sie erhalten diese Nachricht, weil Sie E-Mail-Erinnerungen zur Wartungsplanung aktiviert haben.</p>',
      text_template: '',
    },
  },
  generic: {
    de: {
      subject_template: 'Nachricht von {{mandant.name}}',
      html_template: '<p>Guten Tag,</p><p>{{bericht.link}}</p><p>{{app.name}}</p>',
      text_template: '',
    },
  },
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  Boolean(v && typeof v === 'object' && !Array.isArray(v))

export const deepMerge = (base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = { ...base }
  for (const [k, v] of Object.entries(override)) {
    if (isPlainObject(v) && isPlainObject(out[k])) {
      out[k] = deepMerge(out[k] as Record<string, unknown>, v)
    } else {
      out[k] = v
    }
  }
  return out
}

export const buildDefaultTenantMailContext = (tenantDisplayName: string): Record<string, unknown> => ({
  mandant: { name: tenantDisplayName },
  empfaenger: { email: '' },
  kunde: { name: '' },
  bauvorhaben: { name: '' },
  auftrag: { titel: '', nummer: '' },
  bericht: { datum: '', link: '' },
  portal: { link: '' },
  kontakt: { email: '' },
  app: { name: 'ArioVan' },
  objekt: { name: '' },
  datum: '',
  reminderListe: '',
  digest: { anzahl: '', tabellen_html: '', datum: '', reminder_liste: '' },
})

export const enrichTenantMailContext = (
  tenantDisplayName: string,
  raw?: Record<string, unknown> | null
): Record<string, unknown> => deepMerge(buildDefaultTenantMailContext(tenantDisplayName), raw ?? {})

/** Beispieldaten für Admin-Vorschau / Testmail mit Vorlage (keine Secrets). */
export const MAIL_PREVIEW_SAMPLE_CONTEXT: Record<string, unknown> = {
  mandant: { name: 'Beispiel-Mandant GmbH' },
  empfaenger: { email: 'empfaenger@mail.example.de' },
  kunde: { name: 'Kunde GmbH' },
  bauvorhaben: { name: 'Muster-Bauvorhaben' },
  auftrag: { titel: 'Beispielauftrag', nummer: 'A-2026-0001' },
  bericht: { datum: '2026-04-30', link: 'https://app.example.de/berichte/demo' },
  portal: { link: 'https://portal.example.de/' },
  kontakt: { email: 'noreply@mail.example.de' },
  app: { name: 'ArioVan' },
  objekt: { name: 'Beispielobjekt Haupteingang' },
  datum: '30.04.2026',
  reminderListe: 'Beispielobjekt – Muster-Bauvorhaben – 01.05.2026 (bald fällig)',
  digest: {
    anzahl: '2',
    datum: '30.04.2026',
    reminder_liste: 'Beispielobjekt – Kunde GmbH – 01.05.2026',
    tabellen_html:
      '<table style="border-collapse:collapse;font-size:14px;max-width:640px;"><thead><tr><th align="left" style="padding:6px;border:1px solid #cbd5e1;">Objekt</th><th align="left" style="padding:6px;border:1px solid #cbd5e1;">Kunde</th></tr></thead><tbody><tr><td style="padding:6px;border:1px solid #e2e8f0;">Beispielobjekt</td><td style="padding:6px;border:1px solid #e2e8f0;">Kunde GmbH</td></tr></tbody></table>',
  },
}

export const pickEffectiveTemplateRow = (
  tenantRow: TemplateRowDb | null,
  globalRow: TemplateRowDb | null,
  templateKey: string,
  locale: string
): { row: MailTemplateRow; source: TemplateSource } => {
  const normalizeRow = (r: TemplateRowDb | null): MailTemplateRow | null => {
    if (!r || r.enabled === false) return null
    const s = String(r.subject_template ?? '').trim()
    const h = String(r.html_template ?? '').trim()
    if (!s || !h) return null
    return {
      subject_template: String(r.subject_template ?? ''),
      html_template: String(r.html_template ?? ''),
      text_template: String(r.text_template ?? ''),
    }
  }
  const t = normalizeRow(tenantRow)
  if (t) return { row: t, source: 'tenant' }
  const g = normalizeRow(globalRow)
  if (g) return { row: g, source: 'global' }
  const fb =
    CODE_FALLBACKS[templateKey]?.[locale] ??
    CODE_FALLBACKS[templateKey]?.['de'] ??
    CODE_FALLBACKS.generic['de']
  return { row: fb, source: 'code' }
}

export const fetchTenantAndGlobalTemplateRows = async (
  svc: SupabaseClient,
  tenantId: string,
  templateKey: string,
  locale: string
): Promise<{ tenantRow: TemplateRowDb | null; globalRow: TemplateRowDb | null }> => {
  const { data: tenantRow } = await svc
    .from('tenant_mail_templates')
    .select('subject_template, html_template, text_template, enabled')
    .eq('tenant_id', tenantId)
    .eq('template_key', templateKey)
    .eq('locale', locale)
    .maybeSingle()

  const { data: globalRow } = await svc
    .from('tenant_mail_templates')
    .select('subject_template, html_template, text_template, enabled')
    .is('tenant_id', null)
    .eq('template_key', templateKey)
    .eq('locale', locale)
    .maybeSingle()

  return {
    tenantRow: (tenantRow ?? null) as TemplateRowDb | null,
    globalRow: (globalRow ?? null) as TemplateRowDb | null,
  }
}

export type ResolvedMailTriple = { subject: string; html: string; text: string; source: TemplateSource }

export const mergeDraftOverlay = (row: MailTemplateRow, draft: Partial<MailTemplateRow> | null | undefined): MailTemplateRow => {
  if (!draft) return row
  return {
    subject_template: draft.subject_template !== undefined ? draft.subject_template : row.subject_template,
    html_template: draft.html_template !== undefined ? draft.html_template : row.html_template,
    text_template: draft.text_template !== undefined ? draft.text_template : row.text_template,
  }
}

export const renderFromTemplateRow = (row: MailTemplateRow, ctx: Record<string, unknown>): Omit<ResolvedMailTriple, 'source'> => {
  const subject = applyPlaceholders(row.subject_template, ctx).trim()
  const html = applyPlaceholders(row.html_template, ctx)
  let text = applyPlaceholders(row.text_template, ctx).trim()
  if (!text) text = roughHtmlToText(html)
  return { subject, html, text }
}

export const resolveRenderedMail = async (
  svc: SupabaseClient,
  tenantId: string,
  templateKey: string,
  locale: string,
  ctx: Record<string, unknown>,
  draftOverlay?: Partial<MailTemplateRow> | null
): Promise<ResolvedMailTriple> => {
  const { tenantRow, globalRow } = await fetchTenantAndGlobalTemplateRows(svc, tenantId, templateKey, locale)
  const { row: picked, source } = pickEffectiveTemplateRow(tenantRow, globalRow, templateKey, locale)
  const row = mergeDraftOverlay(picked, draftOverlay)
  const rendered = renderFromTemplateRow(row, ctx)
  return { ...rendered, source }
}

/** Nur globale Zeile (tenant_id IS NULL) + Code-Fallback — für Admin „Mailvorlagen global“. */
export const resolveRenderedMailGlobalOnly = async (
  svc: SupabaseClient,
  templateKey: string,
  locale: string,
  ctx: Record<string, unknown>,
  draftOverlay?: Partial<MailTemplateRow> | null
): Promise<ResolvedMailTriple> => {
  const { data: globalRow } = await svc
    .from('tenant_mail_templates')
    .select('subject_template, html_template, text_template, enabled')
    .is('tenant_id', null)
    .eq('template_key', templateKey)
    .eq('locale', locale)
    .maybeSingle()

  const { row: picked, source } = pickEffectiveTemplateRow(null, globalRow as TemplateRowDb | null, templateKey, locale)
  const row = mergeDraftOverlay(picked, draftOverlay)
  const rendered = renderFromTemplateRow(row, ctx)
  return { ...rendered, source }
}

export const mailTypeFromTemplateKey = (
  templateKey: string
): 'maintenance_report' | 'reminder' | 'generic' | 'portal_report_notification' => {
  if (templateKey === 'portal_report_notification') return 'portal_report_notification'
  if (templateKey === 'maintenance_reminder_digest') return 'reminder'
  if (templateKey === 'maintenance_report') return 'maintenance_report'
  return 'generic'
}

export const channelForMailType = (t: string): string => {
  if (t === 'maintenance_report') return 'maintenance_pdf'
  if (t === 'reminder') return 'maintenance_reminder'
  if (t === 'portal_report_notification') return 'portal_report_notification'
  return 'generic'
}
