import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { downloadWebAppChecklist } from '../lib/downloadChecklist'
import { downloadKomponentenPdf } from '../lib/downloadKomponentenPdf'
import AppVersionRowsEditor from '../components/AppVersionRowsEditor'
import {
  appVersionRowsFromJson,
  appVersionRowsToPayload,
  initialAppVersionRows,
  type AppVersionRowsState,
} from '../lib/appVersionFormUtils'
import { fetchDefaultAppVersionsJson, upsertDefaultAppVersions } from '../lib/portalConfigService'

const Einstellungen = () => {
  const [appVersionRows, setAppVersionRows] = useState<AppVersionRowsState>(initialAppVersionRows)
  const [isLoadingAppVersions, setIsLoadingAppVersions] = useState(true)
  const [isSavingAppVersions, setIsSavingAppVersions] = useState(false)
  const [appVersionsMessage, setAppVersionsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  )

  const loadGlobalAppVersions = useCallback(async () => {
    setIsLoadingAppVersions(true)
    setAppVersionsMessage(null)
    try {
      const raw = await fetchDefaultAppVersionsJson()
      setAppVersionRows(appVersionRowsFromJson(raw))
    } catch (e) {
      setAppVersionsMessage({
        type: 'error',
        text: e instanceof Error ? e.message : 'Globale App-Versionen konnten nicht geladen werden.',
      })
      setAppVersionRows(initialAppVersionRows())
    } finally {
      setIsLoadingAppVersions(false)
    }
  }, [])

  useEffect(() => {
    void loadGlobalAppVersions()
  }, [loadGlobalAppVersions])

  const handleSaveGlobalAppVersions = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingAppVersions(true)
    setAppVersionsMessage(null)
    try {
      const payload = appVersionRowsToPayload(appVersionRows) ?? {}
      await upsertDefaultAppVersions(payload)
      setAppVersionsMessage({ type: 'success', text: 'Globale Standard-App-Versionen gespeichert.' })
    } catch (err) {
      setAppVersionsMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Speichern fehlgeschlagen.',
      })
    } finally {
      setIsSavingAppVersions(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold text-slate-800 mb-6">Einstellungen</h2>

      {/* Hinweis: Mandanten-DB Sammel-Update wurde verschoben */}
      <section
        className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200"
        aria-labelledby="mandanten-rollout-moved-heading"
      >
        <h3
          id="mandanten-rollout-moved-heading"
          className="text-sm font-semibold text-blue-900 mb-1"
        >
          Mandantenupdates verschoben
        </h3>
        <p className="text-xs text-blue-900 leading-relaxed">
          Mandanten-Datenbank-Sammelupdates und alle weiteren Update-Themen (App-Releases,
          Versionsstände, Rollout-Historie) finden Sie jetzt im neuen Bereich{' '}
          <Link
            to="/mandanten-aktualisieren"
            className="font-medium underline hover:no-underline"
            aria-label="Zum Bereich Mandanten aktualisieren wechseln"
          >
            Mandanten aktualisieren
          </Link>
          .
        </p>
      </section>

      {/* Globale App-Versionen */}
      <section
        className="mb-6 p-4 bg-white rounded-xl border border-slate-200 shadow-sm"
        aria-labelledby="global-appv-heading"
      >
        <h3 id="global-appv-heading" className="text-sm font-semibold text-slate-700 mb-2">
          Globale App-Versionen (Standard)
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Gilt für <strong>alle Mandanten</strong>, sofern dort nichts Abweichendes gepflegt ist. Die Lizenz-API merged
          diese Werte mit den mandantenspezifischen Einträgen (Mandant überschreibt pro App/Feld).
        </p>
        {appVersionsMessage && (
          <p
            className={`mb-3 text-sm ${appVersionsMessage.type === 'success' ? 'text-green-700' : 'text-red-700'}`}
            role="status"
          >
            {appVersionsMessage.text}
          </p>
        )}
        {isLoadingAppVersions ? (
          <div className="flex items-center gap-3 py-6 text-slate-500 text-sm">
            <div className="w-6 h-6 border-2 border-vico-primary border-t-transparent rounded-full animate-spin" />
            Lade globale Vorgaben…
          </div>
        ) : (
          <form onSubmit={(e) => void handleSaveGlobalAppVersions(e)} className="space-y-4">
            <AppVersionRowsEditor rows={appVersionRows} setRows={setAppVersionRows} idPrefix="global" />
            <button
              type="submit"
              disabled={isSavingAppVersions}
              className="px-4 py-2 rounded-lg bg-vico-primary text-white font-medium hover:bg-vico-primary-hover disabled:opacity-50"
            >
              {isSavingAppVersions ? 'Speichern…' : 'Globale App-Versionen speichern'}
            </button>
          </form>
        )}
      </section>

      {/* Benutzeranleitung */}
      <section
        className="mb-6 p-4 bg-white rounded-xl border border-slate-200 shadow-sm"
        aria-labelledby="anleitung-heading"
      >
        <h3 id="anleitung-heading" className="text-sm font-semibold text-slate-700 mb-3">
          Benutzeranleitung
        </h3>
        <button
          type="button"
          onClick={() => window.open('/BENUTZERANLEITUNG.md', '_blank', 'noopener,noreferrer')}
          className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
          aria-label="Benutzeranleitung öffnen"
        >
          Benutzeranleitung öffnen
        </button>
      </section>

      {/* Dokumentation */}
      <section
        className="mb-6 p-4 bg-white rounded-xl border border-slate-200 shadow-sm"
        aria-labelledby="dokumentation-heading"
      >
        <h3 id="dokumentation-heading" className="text-sm font-semibold text-slate-700 mb-3">
          Dokumentation
        </h3>
        <p className="text-sm text-slate-600 mb-3">
          Projekt-Dokumentation mit Architektur, Features, Roadmap und technischen Details.
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href="/ArioVan-Dokumentation.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
            aria-label="Technische Produktdokumentation der Haupt-App ArioVan als PDF öffnen"
          >
            Haupt-App: Dokumentation (PDF, ArioVan)
          </a>
          <button
            type="button"
            onClick={downloadKomponentenPdf}
            className="inline-flex px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
            aria-label="Komponenten und Funktionen als PDF herunterladen"
          >
            Komponenten &amp; Funktionen (PDF)
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          „Komponenten &amp; Funktionen“ wird beim Klick als PDF erzeugt und heruntergeladen.
        </p>
      </section>

      {/* Checklisten */}
      <section
        className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm"
        aria-labelledby="checklisten-heading"
      >
        <h3 id="checklisten-heading" className="text-sm font-semibold text-slate-700 mb-3">
          Checklisten
        </h3>
        <p className="text-sm text-slate-600 mb-3">
          Web-App-Test-Checkliste als PDF erstellen und herunterladen (Client-seitig, kein Server-Build nötig).
        </p>
        <button
          type="button"
          onClick={downloadWebAppChecklist}
          className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
          aria-label="Web-App-Test-Checkliste herunterladen"
        >
          Web-App-Test-Checkliste
        </button>
      </section>
    </div>
  )
}

export default Einstellungen
