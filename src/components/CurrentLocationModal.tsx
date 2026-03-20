import { useState, useEffect, useRef } from 'react'
import {
  getCurrentPositionWithDetails,
  getOsmLink,
  formatCoords,
  type GeoPositionWithDetails,
} from '../lib/geolocation'
import { updateMyCurrentLocation } from '../lib/locationService'
import { useToast } from '../ToastContext'
import { BetaBadge } from '../../shared/BetaBadge'

type CurrentLocationModalProps = {
  onClose: () => void
  /** Wenn true: Button „Standort senden“ anzeigen (an Admin/Teamleiter). */
  standortabfrageEnabled?: boolean
  /** Einwilligung erteilt – erforderlich zum Senden. */
  hasStandortabfrageConsent?: boolean
  /** Modal wurde durch Standortanfrage von Admin/Teamleiter geöffnet. */
  isRequestedByAdmin?: boolean
}

const CurrentLocationModal = ({ onClose, standortabfrageEnabled = false, hasStandortabfrageConsent = false, isRequestedByAdmin = false }: CurrentLocationModalProps) => {
  const { showToast, showError } = useToast()
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [position, setPosition] = useState<GeoPositionWithDetails | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const handleSendLocation = async () => {
    if (!position) return
    setSendStatus('sending')
    const { error } = await updateMyCurrentLocation(
      position.lat,
      position.lon,
      position.accuracy ?? 0
    )
    if (error) {
      setSendStatus('error')
      showError(error)
    } else {
      setSendStatus('success')
      showToast('Standort wurde an Admin/Teamleiter gesendet.')
    }
  }

  useEffect(() => {
    overlayRef.current?.focus()
  }, [])

  const hasAutoFetched = useRef(false)
  useEffect(() => {
    if (isRequestedByAdmin && status === 'idle' && !hasAutoFetched.current) {
      hasAutoFetched.current = true
      handleFetch()
    }
  }, [isRequestedByAdmin, status])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleFetch = async () => {
    setStatus('loading')
    setErrorMessage(null)
    setPosition(null)
    const pos = await getCurrentPositionWithDetails()
    if (pos) {
      setPosition(pos)
      setStatus('success')
    } else {
      setErrorMessage('Standort konnte nicht ermittelt werden. Prüfen Sie die Browser-Berechtigung und ob HTTPS verwendet wird.')
      setStatus('error')
    }
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal
      aria-labelledby="current-location-title"
      onClick={onClose}
      tabIndex={-1}
      >
        <div
          className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full min-w-0 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
        <p className="mx-3 mt-3 text-xs text-amber-900/90 dark:text-amber-200/90 rounded-md border border-amber-200/80 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 px-2 py-1.5">
          <strong className="font-semibold">Beta:</strong> Standortabfrage – vor produktivem Einsatz interne/rechtliche
          Prüfung (siehe Doku). Nach Live-Gang Verhalten ggf. erneut prüfen.
        </p>
        <div className="flex items-center justify-between gap-2 p-3 border-b border-slate-200 dark:border-slate-600">
          <h3
            id="current-location-title"
            className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex flex-wrap items-center gap-2 min-w-0"
          >
            <span>{isRequestedByAdmin ? 'Standortanfrage' : 'Standort abfragen'}</span>
            <BetaBadge className="shrink-0" aria-hidden="true" />
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label="Schließen"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 space-y-4">
          {status === 'idle' && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {isRequestedByAdmin
                ? 'Admin oder Teamleiter möchte Ihren aktuellen Standort wissen. Bitte ermitteln und senden Sie ihn.'
                : 'Klicken Sie auf „Standort abfragen“, um Ihren aktuellen Standort zu ermitteln. Der Browser fragt nach Ihrer Berechtigung.'}
            </p>
          )}
          {status === 'loading' && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Standort wird ermittelt…
            </p>
          )}
          {status === 'error' && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {errorMessage}
            </p>
          )}
          {status === 'success' && position && (
            <div className="space-y-2">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {formatCoords(position.lat, position.lon)}
              </p>
              {position.accuracy != null && (
                <p className="text-xs text-slate-500 dark:text-slate-500">
                  Genauigkeit: ca. {Math.round(position.accuracy)} m
                </p>
              )}
              <a
                href={getOsmLink(position.lat, position.lon)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-sm text-vico-primary hover:underline"
              >
                In OpenStreetMap öffnen
              </a>
              {standortabfrageEnabled && (
                <div className="pt-2">
                  {hasStandortabfrageConsent ? (
                    <button
                      type="button"
                      onClick={handleSendLocation}
                      disabled={sendStatus === 'sending'}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                      aria-label="Standort an Admin/Teamleiter senden"
                    >
                      {sendStatus === 'sending'
                        ? 'Wird gesendet…'
                        : sendStatus === 'success'
                          ? 'Gesendet'
                          : 'Standort senden'}
                    </button>
                  ) : (
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      Um Ihren Standort senden zu können, müssen Sie zuerst in den Einstellungen Ihre Einwilligung erteilen.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2">
            {status !== 'loading' && (
              <button
                type="button"
                onClick={handleFetch}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-vico-primary text-white hover:bg-vico-primary-hover disabled:opacity-50"
                aria-label="Standort abfragen"
              >
                {status === 'success' ? 'Erneut abfragen' : 'Standort abfragen'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Schließen
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CurrentLocationModal
