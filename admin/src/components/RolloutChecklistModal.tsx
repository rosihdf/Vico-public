import { useState, useEffect, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import type { AppReleaseRecord } from '../lib/mandantenReleaseService'
import { RELEASE_CHANNEL_LABELS } from '../lib/mandantenReleaseService'

type RolloutChecklistModalProps = {
  open: boolean
  onClose: () => void
  release: AppReleaseRecord | null
  /** Nach erfolgreichem Deploy: Link zu GitHub Actions */
  githubActionsUrl: string | null
}

const stepClass = 'flex gap-3 items-start text-sm text-slate-700'

const RolloutChecklistModal = ({
  open,
  onClose,
  release,
  githubActionsUrl,
}: RolloutChecklistModalProps) => {
  const [checks, setChecks] = useState({
    notesReviewed: false,
    deployDone: false,
    buildGreen: false,
    incomingDone: false,
    goLiveDone: false,
  })

  useEffect(() => {
    if (!open) return
    setChecks({
      notesReviewed: false,
      deployDone: false,
      buildGreen: false,
      incomingDone: false,
      goLiveDone: false,
    })
  }, [open, release?.id])

  useEffect(() => {
    if (!open) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !release) return null

  const published = release.status === 'published'
  const editHref = `/app-releases/${release.id}`

  const handleBackdropKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Dialog schließen"
        onClick={onClose}
        onKeyDown={handleBackdropKeyDown}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rollout-checklist-title"
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl border border-slate-200"
      >
        <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between gap-2">
          <h2 id="rollout-checklist-title" className="text-base font-semibold text-slate-800">
            Rollout-Assistent
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-vico-primary"
            aria-label="Schließen"
          >
            <span aria-hidden>×</span>
          </button>
        </div>
        <div className="px-4 py-3 space-y-4 text-sm">
          <p className="text-xs text-slate-500">
            {RELEASE_CHANNEL_LABELS[release.channel]} ·{' '}
            <span className="font-mono">{release.version_semver}</span>
            {release.title ? ` · ${release.title}` : ''}
          </p>
          <p className="text-xs text-slate-600">
            Die Häkchen sind nur für dich zur Orientierung (lokal im Browser), nicht gespeichert.
          </p>
          <ol className="space-y-3 list-none pl-0">
            <li className={stepClass}>
              <input
                type="checkbox"
                checked={published}
                disabled
                className="mt-1 rounded border-slate-300"
                aria-label="Schritt 1 erledigt"
              />
              <div>
                <p className="font-medium text-slate-800">1. Release freigegeben</p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Nur <strong>published</strong> darf deployed und für Mandanten freigeschaltet werden.
                </p>
                {!published ? (
                  <Link to={editHref} className="text-vico-primary text-xs font-medium hover:underline mt-1 inline-block">
                    Zum Release bearbeiten → Freigeben
                  </Link>
                ) : null}
              </div>
            </li>
            <li className={stepClass}>
              <input
                type="checkbox"
                checked={checks.notesReviewed}
                onChange={(e) => setChecks((c) => ({ ...c, notesReviewed: e.target.checked }))}
                className="mt-1 rounded border-slate-300"
                id="chk-notes"
              />
              <label htmlFor="chk-notes" className="cursor-pointer">
                <span className="font-medium text-slate-800">2. Release Notes &amp; Metadaten geprüft</span>
                <p className="text-xs text-slate-600 mt-0.5">Texte, Modul-Tags, Incoming-Flags bewusst gesetzt.</p>
                <Link to={editHref} className="text-vico-primary text-xs font-medium hover:underline mt-1 inline-block">
                  Release bearbeiten
                </Link>
              </label>
            </li>
            <li className={stepClass}>
              <input
                type="checkbox"
                checked={checks.deployDone}
                onChange={(e) => setChecks((c) => ({ ...c, deployDone: e.target.checked }))}
                className="mt-1 rounded border-slate-300"
                id="chk-deploy"
              />
              <label htmlFor="chk-deploy" className="cursor-pointer">
                <span className="font-medium text-slate-800">3. Production-Deploy angestoßen</span>
                <p className="text-xs text-slate-600 mt-0.5">
                  Button „Build &amp; Deploy in GitHub starten“ auf dieser Seite oder im Release-Editor.
                </p>
              </label>
            </li>
            <li className={stepClass}>
              <input
                type="checkbox"
                checked={checks.buildGreen}
                onChange={(e) => setChecks((c) => ({ ...c, buildGreen: e.target.checked }))}
                className="mt-1 rounded border-slate-300"
                id="chk-gh"
              />
              <label htmlFor="chk-gh" className="cursor-pointer">
                <span className="font-medium text-slate-800">4. GitHub Actions: Build erfolgreich</span>
                <p className="text-xs text-slate-600 mt-0.5">Wrangler-Upload zu Cloudflare Pages ohne Fehler.</p>
                {githubActionsUrl ? (
                  <a
                    href={githubActionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-vico-primary text-xs font-medium hover:underline mt-1 inline-block"
                  >
                    Workflow in GitHub öffnen
                  </a>
                ) : (
                  <span className="text-xs text-slate-400 mt-1 block">Nach Deploy erscheint hier der Link.</span>
                )}
              </label>
            </li>
            <li className={stepClass}>
              <input
                type="checkbox"
                checked={checks.incomingDone}
                onChange={(e) => setChecks((c) => ({ ...c, incomingDone: e.target.checked }))}
                className="mt-1 rounded border-slate-300"
                id="chk-incoming"
              />
              <label htmlFor="chk-incoming" className="cursor-pointer">
                <span className="font-medium text-slate-800">5. Incoming / Pilot (optional)</span>
                <p className="text-xs text-slate-600 mt-0.5">Testmandanten sehen Hinweise, bevor Go-Live.</p>
                <Link to={editHref} className="text-vico-primary text-xs font-medium hover:underline mt-1 inline-block">
                  Incoming im Release setzen
                </Link>
              </label>
            </li>
            <li className={stepClass}>
              <input
                type="checkbox"
                checked={checks.goLiveDone}
                onChange={(e) => setChecks((c) => ({ ...c, goLiveDone: e.target.checked }))}
                className="mt-1 rounded border-slate-300"
                id="chk-golive"
              />
              <label htmlFor="chk-golive" className="cursor-pointer">
                <span className="font-medium text-slate-800">6. Go-Live pro Mandant</span>
                <p className="text-xs text-slate-600 mt-0.5">Gestaffelte Zuweisung je Kanal unter dem Mandanten.</p>
                <Link to="/mandanten" className="text-vico-primary text-xs font-medium hover:underline mt-1 inline-block">
                  Mandanten öffnen
                </Link>
              </label>
            </li>
          </ol>
        </div>
        <div className="border-t border-slate-100 px-4 py-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-slate-600"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  )
}

export default RolloutChecklistModal
