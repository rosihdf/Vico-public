import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { invokeAdminPreviewMailTemplate, MAIL_TEMPLATE_KEYS } from '../lib/licensePortalService'
import type { TenantMailTemplateRow } from '../components/mandanten/MandantMailTemplatesSection'

const LOCALE = 'de'

const PLACEHOLDER_HINT =
  'Unbekannte Platzhalter werden leer gesetzt. Basis-Felder wie {{mandant.name}}, {{portal.link}}, {{app.name}}; für den Wartungs-Digest zusätzlich z. B. {{datum}}, {{reminderListe}}, {{digest.anzahl}}, {{digest.tabellen_html}}, {{digest.reminder_liste}}, {{empfaenger.email}}.'

const GlobalMailTemplatesPage = () => {
  const [rows, setRows] = useState<TenantMailTemplateRow[]>([])
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string>(MAIL_TEMPLATE_KEYS[0]!.key)
  const [draftName, setDraftName] = useState('')
  const [draftSubject, setDraftSubject] = useState('')
  const [draftHtml, setDraftHtml] = useState('')
  const [draftText, setDraftText] = useState('')
  const [draftEnabled, setDraftEnabled] = useState(true)
  const [previewMandantName, setPreviewMandantName] = useState('Beispiel-Mandant GmbH')
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [previewSubject, setPreviewSubject] = useState<string | null>(null)
  const [previewSource, setPreviewSource] = useState<string | null>(null)
  const [previewErr, setPreviewErr] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    setLoadErr(null)
    try {
      const { data, error } = await supabase
        .from('tenant_mail_templates')
        .select(
          'id, tenant_id, template_key, name, subject_template, html_template, text_template, enabled, locale'
        )
        .eq('locale', LOCALE)
        .is('tenant_id', null)
      if (error) throw new Error(error.message)
      setRows((data ?? []) as TenantMailTemplateRow[])
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : String(e))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const rowForKey = useMemo(
    () => rows.find((r) => r.template_key === selectedKey) ?? null,
    [rows, selectedKey]
  )

  useEffect(() => {
    if (!rowForKey) {
      setDraftName('')
      setDraftSubject('')
      setDraftHtml('')
      setDraftText('')
      setDraftEnabled(true)
      return
    }
    setDraftName(rowForKey.name ?? '')
    setDraftSubject(rowForKey.subject_template ?? '')
    setDraftHtml(rowForKey.html_template ?? '')
    setDraftText(rowForKey.text_template ?? '')
    setDraftEnabled(rowForKey.enabled !== false)
  }, [rowForKey, selectedKey])

  const handleSaveGlobalTemplate = async () => {
    setSaveErr(null)
    setSaveMsg(null)
    const label = MAIL_TEMPLATE_KEYS.find((k) => k.key === selectedKey)?.label ?? selectedKey
    const payload = {
      tenant_id: null as string | null,
      template_key: selectedKey,
      locale: LOCALE,
      name: draftName.trim() || label,
      subject_template: draftSubject,
      html_template: draftHtml,
      text_template: draftText,
      enabled: draftEnabled,
      updated_at: new Date().toISOString(),
    }
    const { data: existing, error: selErr } = await supabase
      .from('tenant_mail_templates')
      .select('id')
      .is('tenant_id', null)
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
    setSaveMsg('Globale Vorlage gespeichert. Gilt für alle Mandanten ohne eigenes Override.')
    await reload()
  }

  const handlePreview = async () => {
    setPreviewLoading(true)
    setPreviewErr(null)
    setPreviewHtml(null)
    setPreviewSubject(null)
    setPreviewSource(null)
    try {
      const r = await invokeAdminPreviewMailTemplate({
        globalOnly: true,
        templateKey: selectedKey,
        locale: LOCALE,
        tenantDisplayName: previewMandantName.trim() || 'Beispiel-Mandant GmbH',
        draft: {
          subject_template: draftSubject,
          html_template: draftHtml,
          text_template: draftText,
        },
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

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900 m-0">Mailvorlagen global</h2>
        <p className="text-sm text-slate-600 mt-2 mb-0">
          Standardvorlagen für alle Mandanten ({LOCALE}). Mandanten-spezifische Overrides werden unter{' '}
          <Link className="text-vico-primary font-medium underline" to="/mandanten">
            Mandanten → Bearbeiten → Mailvorlagen
          </Link>{' '}
          gepflegt und haben Vorrang.
        </p>
        <p className="text-xs text-slate-500 mt-2 mb-0 leading-relaxed">
          Vorlagen sind aktuell <strong className="font-medium text-slate-700">portalweit</strong> (nicht pro Produkt in
          der Datenbank getrennt). Platzhalter wie <code className="text-[11px]">{`{{app.name}}`}</code> beziehen sich auf
          den konfigurierten App-Namen des Mandanten (Standard oft das erste Produkt, z. B. ArioVan). Leitlinie:{' '}
          <code className="text-[11px]">docs/Lizenzportal-Multi-App-Leitlinie.md</code>.
        </p>
        <p className="text-xs text-amber-900 bg-amber-50 border border-amber-100 rounded-md px-3 py-2 mt-3 mb-0">
          Änderungen wirken für alle Mandanten ohne Override. Testversand mit echter Mandanten-Mail-Konfiguration weiterhin
          über die Mandanten-Ansicht (Testmail).
        </p>
      </div>

      {loadErr ? <p className="text-sm text-red-700 m-0">{loadErr}</p> : null}
      {loading ? <p className="text-xs text-slate-500 m-0">Laden…</p> : null}

      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
        <p className="text-xs text-slate-600 m-0">{PLACEHOLDER_HINT}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="global_mail_tpl_key" className="block text-sm font-medium text-slate-700 mb-1">
              Vorlagentyp
            </label>
            <select
              id="global_mail_tpl_key"
              value={selectedKey}
              onChange={(e) => {
                setSelectedKey(e.target.value)
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
              <strong>Datensatz:</strong>{' '}
              {rowForKey ? 'globale Zeile vorhanden' : 'noch keine Zeile — Speichern legt sie an'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div>
            <label htmlFor="global_mail_tpl_name" className="block text-sm font-medium text-slate-700 mb-1">
              Interner Name
            </label>
            <input
              id="global_mail_tpl_name"
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={draftEnabled}
              onChange={(e) => setDraftEnabled(e.target.checked)}
              className="rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
            />
            <span>Vorlage aktiv</span>
          </label>
          <div>
            <label htmlFor="global_mail_tpl_subject" className="block text-sm font-medium text-slate-700 mb-1">
              Betreff (Plaintext)
            </label>
            <input
              id="global_mail_tpl_subject"
              type="text"
              value={draftSubject}
              onChange={(e) => setDraftSubject(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 font-mono text-sm"
            />
          </div>
          <div>
            <label htmlFor="global_mail_tpl_html" className="block text-sm font-medium text-slate-700 mb-1">
              HTML
            </label>
            <textarea
              id="global_mail_tpl_html"
              value={draftHtml}
              onChange={(e) => setDraftHtml(e.target.value)}
              rows={12}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 font-mono text-xs"
            />
          </div>
          <div>
            <label htmlFor="global_mail_tpl_text" className="block text-sm font-medium text-slate-700 mb-1">
              Text (optional)
            </label>
            <textarea
              id="global_mail_tpl_text"
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 font-mono text-xs"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-end">
          <button
            type="button"
            onClick={() => void handleSaveGlobalTemplate()}
            className="rounded-lg bg-emerald-700 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-800"
          >
            Speichern
          </button>
          <button
            type="button"
            onClick={() => void handlePreview()}
            disabled={previewLoading}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            {previewLoading ? 'Vorschau…' : 'Vorschau (Beispieldaten)'}
          </button>
          <label className="flex flex-col text-xs text-slate-600 min-w-[200px] flex-1">
            <span className="mb-1">Beispiel-Mandantenname (Vorschau)</span>
            <input
              type="text"
              value={previewMandantName}
              onChange={(e) => setPreviewMandantName(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-slate-800 text-sm"
            />
          </label>
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
                title="Mail-Vorschau global"
                srcDoc={previewHtml}
                sandbox=""
                className="w-full min-h-[240px] rounded border border-slate-200 bg-white"
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default GlobalMailTemplatesPage
