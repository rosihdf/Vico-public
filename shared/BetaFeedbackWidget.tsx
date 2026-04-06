import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useLocation } from 'react-router-dom'
import type { SupabaseClient } from '@supabase/supabase-js'

export type BetaFeedbackSourceApp = 'main' | 'kundenportal' | 'arbeitszeit_portal'

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'ui_layout', label: 'Darstellung / Layout' },
  { value: 'flow_logic', label: 'Ablauf / Logik' },
  { value: 'missing_feature', label: 'Funktion fehlt' },
  { value: 'remove_feature', label: 'Funktion überflüssig / kann weg' },
  { value: 'bug', label: 'Fehler / Bug' },
  { value: 'other', label: 'Sonstiges' },
]

const SEVERITIES: { value: string; label: string }[] = [
  { value: '', label: 'Keine Angabe' },
  { value: 'blocker', label: 'Kann nicht sinnvoll arbeiten' },
  { value: 'annoyance', label: 'Stört / erschwert die Arbeit' },
  { value: 'wish', label: 'Verbesserungswunsch' },
]

export type BetaFeedbackWidgetProps = {
  supabase: SupabaseClient
  licenseApiUrl: string
  /** Optional; bei leerem String Host-Lookup am Edge (wie GET /license) */
  licenseNumber: string
  licenseApiKey?: string
  sourceApp: BetaFeedbackSourceApp
  features: Record<string, boolean>
  appVersion: string
  releaseLabel: string
}

const BetaFeedbackWidget = ({
  supabase,
  licenseApiUrl,
  licenseNumber,
  licenseApiKey,
  sourceApp,
  features,
  appVersion,
  releaseLabel,
}: BetaFeedbackWidgetProps) => {
  const location = useLocation()
  const panelId = useId()
  const titleId = useId()
  const openBtnRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null)
  const [category, setCategory] = useState('ui_layout')
  const [severity, setSeverity] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const enabled = features.beta_feedback === true

  const handleClose = useCallback(() => {
    setOpen(false)
    setFeedbackMsg(null)
    openBtnRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, handleClose])

  const handleSubmit = useCallback(async () => {
    setFeedbackMsg(null)
    const desc = description.trim()
    if (!desc) {
      setFeedbackMsg('Bitte Beschreibung ausfüllen.')
      return
    }
    const { data: sess } = await supabase.auth.getSession()
    const token = sess.session?.access_token
    if (!token) {
      setFeedbackMsg('Nur angemeldete Nutzer können Feedback senden.')
      return
    }
    const base = licenseApiUrl.replace(/\/$/, '')
    const url = `${base}/submit-beta-feedback`
    const routeQuery = location.search.startsWith('?') ? location.search.slice(1) : location.search
    setSubmitting(true)
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      }
      if (licenseApiKey) headers.apikey = licenseApiKey
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...(licenseNumber.trim() ? { license_number: licenseNumber.trim() } : {}),
          source_app: sourceApp,
          route_path: location.pathname,
          route_query: routeQuery,
          category,
          ...(severity ? { severity } : {}),
          ...(title.trim() ? { title: title.trim() } : {}),
          description: desc,
          ...(appVersion.trim() ? { app_version: appVersion.trim() } : {}),
          ...(releaseLabel.trim() ? { release_label: releaseLabel.trim() } : {}),
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; message?: string }
      if (!res.ok || data.ok !== true) {
        setFeedbackMsg(typeof data.error === 'string' ? data.error : 'Senden fehlgeschlagen.')
        return
      }
      setFeedbackMsg(typeof data.message === 'string' ? data.message : 'Gesendet.')
      setDescription('')
      setTitle('')
      setTimeout(() => handleClose(), 1800)
    } catch {
      setFeedbackMsg('Netzwerkfehler.')
    } finally {
      setSubmitting(false)
    }
  }, [
    supabase,
    licenseApiUrl,
    licenseNumber,
    licenseApiKey,
    sourceApp,
    location.pathname,
    location.search,
    category,
    severity,
    title,
    description,
    appVersion,
    releaseLabel,
    handleClose,
  ])

  const handlePanelKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      handleClose()
    }
  }, [handleClose])

  if (!enabled) return null

  return (
    <>
      <button
        ref={openBtnRef}
        type="button"
        onClick={() => {
          setOpen(true)
          setFeedbackMsg(null)
        }}
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] right-4 z-[200] flex h-12 w-12 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900 sm:bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))]"
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        title="Beta-Feedback"
      >
        <span className="sr-only">Beta-Feedback zu dieser Seite</span>
        <span className="text-xl font-bold" aria-hidden>
          β
        </span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[210] flex items-end justify-center sm:items-center sm:p-4 bg-black/40"
          role="presentation"
          onClick={handleClose}
          onKeyDown={(e) => e.key === 'Escape' && handleClose()}
        >
          <div
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-600 p-4 sm:p-6"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handlePanelKeyDown}
          >
            <h2 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Beta-Feedback
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Seite:{' '}
              <span className="font-mono break-all">
                {location.pathname}
                {location.search ? `?${location.search.slice(1)}` : ''}
              </span>
            </p>
            <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
              Beschreiben Sie, was sich ändern soll, was fehlt oder weg kann. Ihre Meldung wird im Lizenzportal
              ausgewertet.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor={`${panelId}-cat`} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Kategorie
                </label>
                <select
                  id={`${panelId}-cat`}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`${panelId}-sev`} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Schweregrad
                </label>
                <select
                  id={`${panelId}-sev`}
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                >
                  {SEVERITIES.map((c) => (
                    <option key={c.value || 'none'} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`${panelId}-title`} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Kurztitel (optional)
                </label>
                <input
                  id={`${panelId}-title`}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor={`${panelId}-desc`} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Beschreibung
                </label>
                <textarea
                  id={`${panelId}-desc`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  maxLength={8000}
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                  placeholder="Was erwarten Sie, was passiert stattdessen, welche Funktion fehlt …"
                />
              </div>
            </div>

            {feedbackMsg ? (
              <p
                className={`mt-3 text-sm ${feedbackMsg.includes('fehl') || feedbackMsg.includes('fehlgeschlagen') || feedbackMsg.includes('Netzwerk') ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}
                role="status"
              >
                {feedbackMsg}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Schließen
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                {submitting ? 'Senden…' : 'Absenden'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default BetaFeedbackWidget
