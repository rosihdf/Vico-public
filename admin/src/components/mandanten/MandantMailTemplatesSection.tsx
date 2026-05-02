import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  invokeAdminPreviewMailTemplate,
  invokeAdminSendTestEmail,
  MAIL_TEMPLATE_KEYS,
} from '../../lib/licensePortalService'

const LOCALE = 'de'

const PLACEHOLDER_HELP = [
  '{{mandant.name}}',
  '{{kunde.name}}',
  '{{bauvorhaben.name}}',
  '{{auftrag.titel}}',
  '{{auftrag.nummer}}',
  '{{bericht.datum}}',
  '{{bericht.link}}',
  '{{portal.link}}',
  '{{kontakt.email}}',
  '{{app.name}}',
  '{{objekt.name}} (Erweiterung für Portal-Hinweis)',
].join(', ')

export type TenantMailTemplateRow = {
  id: string
  tenant_id: string | null
  template_key: string
  name: string
  subject_template: string
  html_template: string
  text_template: string
  enabled: boolean
  locale: string
}

export type MandantMailTemplatesSectionProps = {
  tenantId: string | null
  tenantName: string
  testMailTo: string
  onTestMailToChange: (value: string) => void
}

export const MandantMailTemplatesSection = ({
  tenantId,
  tenantName,
  testMailTo,
  onTestMailToChange,
}: MandantMailTemplatesSectionProps) => {
  const [rows, setRows] = useState<TenantMailTemplateRow[]>([])
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string>(MAIL_TEMPLATE_KEYS[0]!.key)
  const [editTenantOverride, setEditTenantOverride] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftSubject, setDraftSubject] = useState('')
  const [draftHtml, setDraftHtml] = useState('')
  const [draftText, setDraftText] = useState('')
  const [draftEnabled, setDraftEnabled] = useState(true)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [previewSubject, setPreviewSubject] = useState<string | null>(null)
  const [previewSource, setPreviewSource] = useState<string | null>(null)
  const [previewErr, setPreviewErr] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [templateTestLoading, setTemplateTestLoading] = useState(false)
  const [templateTestOk, setTemplateTestOk] = useState<string | null>(null)
  const [templateTestErr, setTemplateTestErr] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    setLoadErr(null)
    try {
      const { data, error } = await supabase
        .from('tenant_mail_templates')
        .select(
          'id, tenant_id, template_key, name, subject_template, html_template, text_template, enabled, locale'
        )
        .eq('locale', LOCALE)
        .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
      if (error) throw new Error(error.message)
      setRows((data ?? []) as TenantMailTemplateRow[])
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : String(e))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    void reload()
  }, [reload])

  const globalRow = useMemo(
    () => rows.find((r) => r.tenant_id === null && r.template_key === selectedKey) ?? null,
    [rows, selectedKey]
  )
  const tenantRow = useMemo(
    () => rows.find((r) => r.tenant_id === tenantId && r.template_key === selectedKey) ?? null,
    [rows, selectedKey, tenantId]
  )

  const activeSource: 'tenant' | 'global' | null = tenantRow && tenantRow.enabled !== false ? 'tenant' : 'global'

  useEffect(() => {
    const base = tenantRow && tenantRow.enabled !== false ? tenantRow : globalRow
    if (!base) {
      setDraftName('')
      setDraftSubject('')
      setDraftHtml('')
      setDraftText('')
      setDraftEnabled(true)
      return
    }
    setDraftName(base.name ?? '')
    setDraftSubject(base.subject_template ?? '')
    setDraftHtml(base.html_template ?? '')
    setDraftText(base.text_template ?? '')
    setDraftEnabled(base.enabled !== false)
  }, [selectedKey, globalRow, tenantRow, tenantId])

  const handleUseStandard = async () => {
    if (!tenantId) return
    setSaveErr(null)
    setSaveMsg(null)
    const { error } = await supabase
      .from('tenant_mail_templates')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('template_key', selectedKey)
      .eq('locale', LOCALE)
    if (error) {
      setSaveErr(error.message)
      return
    }
    setEditTenantOverride(false)
    setSaveMsg('Mandanten-Override entfernt — es gilt wieder die globale Vorlage.')
    await reload()
  }

  const handleStartTenantEdit = () => {
    setEditTenantOverride(true)
    const base = globalRow
    if (!tenantRow && base) {
      setDraftName(`${base.name} (${tenantName})`)
      setDraftSubject(base.subject_template)
      setDraftHtml(base.html_template)
      setDraftText(base.text_template)
      setDraftEnabled(true)
    }
  }

  const handleSaveTenantTemplate = async () => {
    if (!tenantId) return
    setSaveErr(null)
    setSaveMsg(null)
    const payload = {
      tenant_id: tenantId,
      template_key: selectedKey,
      locale: LOCALE,
      name: draftName.trim() || MAIL_TEMPLATE_KEYS.find((k) => k.key === selectedKey)?.label || selectedKey,
      subject_template: draftSubject,
      html_template: draftHtml,
      text_template: draftText,
      enabled: draftEnabled,
      updated_at: new Date().toISOString(),
    }
    const { data: existing, error: selErr } = await supabase
      .from('tenant_mail_templates')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('template_key', selectedKey)
      .eq('locale', LOCALE)
      .maybeSingle()
    if (selErr) {
      setSaveErr(selErr.message)
      return
    }
    const rowId = (existing as { id?: string } | null)?.id
    const writeReq = rowId
      ? supabase.from('tenant_mail_templates').update(payload).eq('id', rowId)
      : supabase.from('tenant_mail_templates').insert(payload)
    const { error } = await writeReq
    if (error) {
      setSaveErr(error.message)
      return
    }
    setSaveMsg('Mandanten-Vorlage gespeichert.')
    await reload()
  }

  const handlePreview = async () => {
    if (!tenantId) return
    setPreviewLoading(true)
    setPreviewErr(null)
    setPreviewHtml(null)
    setPreviewSubject(null)
    setPreviewSource(null)
    try {
      const r = await invokeAdminPreviewMailTemplate({
        tenantId,
        templateKey: selectedKey,
        locale: LOCALE,
        draft: editTenantOverride
          ? {
              subject_template: draftSubject,
              html_template: draftHtml,
              text_template: draftText,
            }
          : undefined,
      })
      if (!r.ok) {
        setPreviewErr(r.error)
        return
      }
      setPreviewSubject(r.data.subject)
      setPreviewHtml(r.data.html)
      setPreviewSource(r.data.templateSource ?? null)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleSendTemplateTestMail = async () => {
    if (!tenantId) return
    const to = testMailTo.trim()
    if (!to) return
    setTemplateTestLoading(true)
    setTemplateTestOk(null)
    setTemplateTestErr(null)
    try {
      const r = await invokeAdminSendTestEmail({
        tenantId,
        toEmail: to,
        templateKey: selectedKey,
        locale: LOCALE,
      })
      if (!r.ok) {
        setTemplateTestErr(r.error)
        return
      }
      setTemplateTestOk(
        r.data.messageId
          ? `Gesendet (${r.data.provider}, Id: ${r.data.messageId}).`
          : `Gesendet (${r.data.provider}).`
      )
    } finally {
      setTemplateTestLoading(false)
    }
  }

  if (!tenantId) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/80 p-4 text-sm text-slate-600">
        Mailvorlagen sind verfügbar, sobald der Mandant gespeichert wurde.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Mailvorlagen</h3>
        <p className="text-xs text-slate-600 mt-1">
          Texte zentral im Lizenzportal; Mandanten-Apps können Vorlagen nicht bearbeiten. Platzhalter werden serverseitig
          ersetzt — unbekannte Keys werden leer gelassen (kein Skript). Unterstützte Muster: {PLACEHOLDER_HELP}
        </p>
      </div>

      {loadErr ? <p className="text-sm text-red-700 m-0">{loadErr}</p> : null}
      {loading ? <p className="text-xs text-slate-500 m-0">Laden…</p> : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="mail_tpl_key" className="block text-sm font-medium text-slate-700 mb-1">
            Vorlagentyp
          </label>
          <select
            id="mail_tpl_key"
            value={selectedKey}
            onChange={(e) => {
              setSelectedKey(e.target.value)
              setEditTenantOverride(false)
              setPreviewHtml(null)
              setSaveMsg(null)
              setSaveErr(null)
            }}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
          >
            {MAIL_TEMPLATE_KEYS.map((k) => (
              <option key={k.key} value={k.key}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div className="text-sm text-slate-700 flex flex-col justify-end">
          <p className="m-0">
            <strong>Aktiv:</strong>{' '}
            {activeSource === 'tenant'
              ? 'Mandanten-Override'
              : globalRow
                ? 'Globale Standardvorlage'
                : 'Code-Fallback (noch keine globale Zeile)'}
          </p>
          {tenantRow ? (
            <p className="text-xs text-slate-500 m-0 mt-1">Override-Zeile vorhanden (ggf. deaktiviert).</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          onClick={() => void handleUseStandard()}
          disabled={!tenantRow}
        >
          Standard verwenden
        </button>
        <button
          type="button"
          className="rounded-lg bg-slate-800 text-white px-3 py-2 text-sm font-medium hover:bg-slate-900"
          onClick={handleStartTenantEdit}
        >
          Mandanten-Vorlage anpassen
        </button>
      </div>

      {editTenantOverride ? (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-2 py-1 m-0">
          Bearbeitungsmodus: Entwurf gilt für diesen Mandanten. Speichern legt ein Override an oder aktualisiert es.
        </p>
      ) : (
        <p className="text-xs text-slate-500 m-0">
          Nur-Lesen-Ansicht der effektiven Vorlage (Override oder global). „Anpassen“ zum Überschreiben.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3">
        <div>
          <label htmlFor="mail_tpl_name" className="block text-sm font-medium text-slate-700 mb-1">
            interner Name
          </label>
          <input
            id="mail_tpl_name"
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            disabled={!editTenantOverride}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 disabled:bg-slate-100"
          />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={draftEnabled}
            onChange={(e) => setDraftEnabled(e.target.checked)}
            disabled={!editTenantOverride}
            className="rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
          />
          <span>Vorlage aktiv (bei Override)</span>
        </label>
        <div>
          <label htmlFor="mail_tpl_subject" className="block text-sm font-medium text-slate-700 mb-1">
            Betreff (Plaintext)
          </label>
          <input
            id="mail_tpl_subject"
            type="text"
            value={draftSubject}
            onChange={(e) => setDraftSubject(e.target.value)}
            disabled={!editTenantOverride}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 disabled:bg-slate-100 font-mono text-sm"
          />
        </div>
        <div>
          <label htmlFor="mail_tpl_html" className="block text-sm font-medium text-slate-700 mb-1">
            HTML
          </label>
          <textarea
            id="mail_tpl_html"
            value={draftHtml}
            onChange={(e) => setDraftHtml(e.target.value)}
            disabled={!editTenantOverride}
            rows={10}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 disabled:bg-slate-100 font-mono text-xs"
          />
        </div>
        <div>
          <label htmlFor="mail_tpl_text" className="block text-sm font-medium text-slate-700 mb-1">
            Text (optional)
          </label>
          <textarea
            id="mail_tpl_text"
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            disabled={!editTenantOverride}
            rows={4}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 disabled:bg-slate-100 font-mono text-xs"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!editTenantOverride}
          onClick={() => void handleSaveTenantTemplate()}
          className="rounded-lg bg-emerald-700 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-800 disabled:opacity-50"
        >
          Override speichern
        </button>
        <button
          type="button"
          onClick={() => void handlePreview()}
          disabled={previewLoading}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          {previewLoading ? 'Vorschau…' : 'Vorschau (Beispieldaten)'}
        </button>
      </div>
      {saveMsg ? <p className="text-sm text-emerald-700 m-0">{saveMsg}</p> : null}
      {saveErr ? <p className="text-sm text-red-700 m-0">{saveErr}</p> : null}
      {previewErr ? <p className="text-sm text-red-700 m-0">{previewErr}</p> : null}
      {previewSubject ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2">
          <p className="text-xs text-slate-600 m-0">
            <strong>Betreff:</strong> {previewSubject}
            {previewSource ? (
              <span className="ml-2">
                (Quelle: <code>{previewSource}</code>)
              </span>
            ) : null}
          </p>
          {previewHtml ? (
            <iframe
              title="Mail-Vorschau"
              srcDoc={previewHtml}
              sandbox=""
              className="w-full min-h-[220px] rounded border border-slate-200 bg-white"
            />
          ) : null}
        </div>
      ) : null}

      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50/80 p-3 space-y-2">
        <p className="text-sm font-medium text-slate-800 m-0">Testmail mit dieser Vorlage</p>
        <p className="text-xs text-slate-600 m-0">
          Nutzt dieselbe Empfänger-Adresse wie bei „Testmail“ oben (oder hier ergänzen).
        </p>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <label className="flex-1 block text-sm">
            <span className="block text-slate-600 mb-1">Empfänger</span>
            <input
              type="email"
              value={testMailTo}
              onChange={(e) => onTestMailToChange(e.target.value)}
              placeholder="empfaenger@example.com"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
            />
          </label>
          <button
            type="button"
            disabled={templateTestLoading || !testMailTo.trim()}
            onClick={() => void handleSendTemplateTestMail()}
            className="rounded-lg bg-slate-800 text-white px-4 py-2 text-sm font-medium hover:bg-slate-900 disabled:opacity-50 shrink-0"
          >
            {templateTestLoading ? 'Senden…' : 'Testmail (Vorlage)'}
          </button>
        </div>
        {templateTestOk ? <p className="text-sm text-emerald-700 m-0">{templateTestOk}</p> : null}
        {templateTestErr ? <p className="text-sm text-red-700 m-0">{templateTestErr}</p> : null}
      </div>
    </div>
  )
}
