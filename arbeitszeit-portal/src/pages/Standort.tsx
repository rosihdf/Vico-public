import { useState, useEffect, useCallback } from 'react'
import { useDesign } from '../DesignContext'
import { getEmployeeLocations, requestEmployeeLocation, type EmployeeLocation } from '../lib/locationService'
import { getMyRole } from '../lib/userService'
import { formatCoords } from '../../../shared/geolocationUtils'
import { formatDateTimeShort } from '../../../shared/format'
import { BetaBadge } from '../../../shared/BetaBadge'
import LocationMapModal from '../components/LocationMapModal'

const getDisplayName = (loc: EmployeeLocation): string => {
  const parts = [loc.first_name, loc.last_name].filter(Boolean)
  if (parts.length) return parts.join(' ')
  return loc.email ?? 'Unbekannt'
}

const hasLocation = (loc: EmployeeLocation): boolean =>
  loc.lat != null && loc.lon != null

const Standort = () => {
  const { features } = useDesign()
  const [role, setRole] = useState<string | null>(null)
  const [locations, setLocations] = useState<EmployeeLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mapModal, setMapModal] = useState<EmployeeLocation | null>(null)
  const [requestingUserId, setRequestingUserId] = useState<string | null>(null)

  const canAccess =
    (role === 'admin' && features.standortabfrage) ||
    (role === 'teamleiter' && features.standortabfrage)

  const load = useCallback(async () => {
    if (!canAccess) return
    setLoading(true)
    setError(null)
    try {
      const data = await getEmployeeLocations()
      setLocations(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Standorte konnten nicht geladen werden.')
      setLocations([])
    } finally {
      setLoading(false)
    }
  }, [canAccess])

  useEffect(() => {
    getMyRole().then(setRole)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (role === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-vico-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!canAccess) {
    return (
      <div className="p-4">
        <p className="text-slate-600 dark:text-slate-300">
          Sie haben keine Berechtigung für die Standortabfrage. Nur Admins (mit Lizenz-Feature „Standortabfrage“)
          bzw. Teamleiter (mit Lizenz-Feature und Admin-Freigabe) können Standorte einsehen.
        </p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Standortabfrage</h2>
        <BetaBadge aria-hidden="true" />
      </div>
      <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 dark:bg-amber-950/30 dark:text-amber-100 dark:border-amber-800">
        <strong className="font-semibold">Beta &amp; Recht:</strong> Vor produktivem Einsatz die interne Checkliste in{' '}
        <code className="text-[0.8rem] rounded px-1 py-0.5 bg-slate-100 dark:bg-slate-900/80 text-slate-800 dark:text-slate-200">
          docs/Noch-zu-erledigen.md
        </code> §3a abarbeiten; Lizenz-Feature{' '}
        <strong>standortabfrage</strong> nur bewusst aktivieren.
      </p>
      <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
        Mitarbeiter mit Einwilligung. Klicken Sie auf „Standort anfordern“, um die aktuelle Position zu ermitteln – der
        Mitarbeiter erhält die Anfrage per Push-Benachrichtigung oder beim nächsten Öffnen der App.
      </p>

      {error && (
        <div
          className="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200"
          role="alert"
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-vico-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : locations.length === 0 ? (
        <p className="text-slate-600 dark:text-slate-300">Keine Mitarbeiter mit Einwilligung vorhanden.</p>
      ) : (
        <div className="space-y-3">
          {locations.map((loc) => (
            <div
              key={loc.user_id}
              className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-100">{getDisplayName(loc)}</p>
                  {loc.email && (
                    <p className="text-sm text-slate-500 dark:text-slate-400">{loc.email}</p>
                  )}
                  {hasLocation(loc) ? (
                    <>
                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                        {formatCoords(loc.lat!, loc.lon!)}
                        {loc.accuracy != null && (
                          <span className="text-slate-500 dark:text-slate-400"> (ca. {Math.round(loc.accuracy)} m)</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                        Gesendet: {loc.updated_at ? formatDateTimeShort(loc.updated_at) : '–'}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      {loc.has_pending_request
                        ? 'Anforderung ausstehend – Mitarbeiter erhält Push oder Anfrage beim App-Öffnen'
                        : 'Noch kein Standort gesendet'}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={async () => {
                      setRequestingUserId(loc.user_id)
                      const { error: err } = await requestEmployeeLocation(loc.user_id)
                      setRequestingUserId(null)
                      if (err) setError(err)
                      else load()
                    }}
                    disabled={requestingUserId === loc.user_id || loc.has_pending_request}
                    className="px-3 py-1.5 text-sm font-medium text-vico-primary hover:bg-vico-primary/10 rounded-lg transition-colors disabled:opacity-50"
                    aria-label={`Standort von ${getDisplayName(loc)} anfordern`}
                  >
                    {requestingUserId === loc.user_id ? 'Wird gesendet…' : loc.has_pending_request ? 'Angefordert' : 'Standort anfordern'}
                  </button>
                  {hasLocation(loc) && (
                    <button
                      type="button"
                      onClick={() => setMapModal(loc)}
                      className="px-3 py-1.5 text-sm font-medium text-vico-primary hover:bg-vico-primary/10 rounded-lg transition-colors"
                      aria-label={`Karte für ${getDisplayName(loc)} anzeigen`}
                    >
                      Karte
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={load}
        disabled={loading}
        className="mt-4 px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
        aria-label="Standorte aktualisieren"
      >
        Aktualisieren
      </button>

      {mapModal && hasLocation(mapModal) && (
        <LocationMapModal
          lat={mapModal.lat!}
          lon={mapModal.lon!}
          label={getDisplayName(mapModal)}
          onClose={() => setMapModal(null)}
        />
      )}
    </div>
  )
}

export default Standort
