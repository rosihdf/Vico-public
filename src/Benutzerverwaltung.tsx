import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { getSupabaseErrorMessage } from './supabaseErrors'
import { supabase } from './supabase'
import { fetchProfiles, updateProfileRole, updateProfileName, getProfileDisplayName } from './lib/userService'
import { LoadingSpinner } from './components/LoadingSpinner'
import PortalBadge from './components/PortalBadge'
import { subscribeToProfileChanges } from './lib/profileRealtime'
import { useLicense } from './LicenseContext'
import { checkCanInviteUser } from './lib/licenseService'
import type { Profile } from './lib/userService'

const ROLE_LABELS: Record<'admin' | 'mitarbeiter' | 'operator' | 'leser' | 'demo' | 'kunde', string> = {
  admin: 'Admin',
  mitarbeiter: 'Mitarbeiter',
  operator: 'Operator',
  leser: 'Leser',
  demo: 'Demo (24h-Löschung)',
  kunde: 'Kunde (Portal)',
}

const APP_ROLES = ['admin', 'mitarbeiter', 'operator', 'leser', 'demo'] as const
const PORTAL_ROLES = ['kunde'] as const

const isAppUser = (p: Profile) => APP_ROLES.includes(p.role as (typeof APP_ROLES)[number])

const Benutzerverwaltung = () => {
  const navigate = useNavigate()
  const { userRole, signUp, logout } = useAuth()
  useLicense()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newFirstName, setNewFirstName] = useState('')
  const [newLastName, setNewLastName] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [formMessage, setFormMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null)
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')

  const loadProfiles = useCallback(async () => {
    setIsLoading(true)
    const data = await fetchProfiles()
    setProfiles(data)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadProfiles()
  }, [loadProfiles])

  useEffect(() => {
    const unsub = subscribeToProfileChanges(loadProfiles)
    return unsub
  }, [loadProfiles])

  const handleOpenCreate = async () => {
    const allowed = await checkCanInviteUser()
    if (!allowed) {
      setFormError('Benutzer-Limit erreicht. Bitte Lizenz upgraden, um weitere Benutzer einzuladen.')
      return
    }
    setNewEmail('')
    setNewPassword('')
    setNewFirstName('')
    setNewLastName('')
    setFormError(null)
    setFormMessage(null)
    setShowForm(true)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setFormError(null)
    setFormMessage(null)
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setFormMessage(null)
    if (!newEmail.trim() || !newPassword.trim()) {
      setFormError('E-Mail und Passwort sind erforderlich.')
      return
    }
    if (newPassword.length < 6) {
      setFormError('Passwort muss mindestens 6 Zeichen haben.')
      return
    }
    setIsSaving(true)
    const { success, message, sessionCreated } = await signUp(newEmail.trim(), newPassword)
    if (success && sessionCreated && (newFirstName.trim() || newLastName.trim())) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await updateProfileName(user.id, newFirstName.trim() || null, newLastName.trim() || null)
      }
    }
    setIsSaving(false)
    if (success) {
      setFormMessage('Benutzer erstellt.')
      setNewEmail('')
      setNewPassword('')
      setNewFirstName('')
      setNewLastName('')
      loadProfiles()
      handleCloseForm()
      if (sessionCreated) {
        await logout()
        navigate('/login', { state: { message: 'Benutzer erstellt. Bitte erneut einloggen.' } })
      }
    } else {
      setFormError(getSupabaseErrorMessage({ message }))
    }
  }

  const handleOpenEditName = (profile: Profile) => {
    setEditingProfile(profile)
    setEditFirstName(profile.first_name ?? '')
    setEditLastName(profile.last_name ?? '')
  }

  const handleCloseEditName = () => {
    setEditingProfile(null)
  }

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProfile) return
    setUpdatingId(editingProfile.id)
    const { error } = await updateProfileName(
      editingProfile.id,
      editFirstName.trim() || null,
      editLastName.trim() || null
    )
    setUpdatingId(null)
    if (!error) {
      await loadProfiles()
      window.dispatchEvent(new CustomEvent('vico-profiles-changed'))
      handleCloseEditName()
    }
  }

  const isLastAdmin = (p: Profile) =>
    p.role === 'admin' && profiles.filter((x) => x.role === 'admin').length === 1

  const handleRoleChange = async (profile: Profile, newRole: 'admin' | 'mitarbeiter' | 'operator' | 'leser' | 'demo' | 'kunde') => {
    if (newRole === profile.role) return
    if (isLastAdmin(profile)) return
    setFormError(null)
    setUpdatingId(profile.id)
    const { error } = await updateProfileRole(profile.id, newRole)
    setUpdatingId(null)
    if (!error) {
      setFormError(null)
      await loadProfiles()
      window.dispatchEvent(new CustomEvent('vico-profiles-changed'))
    } else {
      setFormError(getSupabaseErrorMessage(error))
    }
  }

  if (userRole !== 'admin') {
    return (
      <div className="p-4">
        <h2 className="text-xl font-bold text-slate-800">Benutzerverwaltung</h2>
        <p className="mt-2 text-slate-600">Zugriff nur für Administratoren.</p>
        <Link to="/einstellungen" className="mt-4 inline-block text-vico-primary hover:underline">
          ← Zurück zu Einstellungen
        </Link>
      </div>
    )
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold text-slate-800">Benutzerverwaltung</h2>
      <p className="mt-1 text-sm text-slate-600">
        Benutzer anlegen und Rollen verwalten (nur Admin).
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleOpenCreate}
          className="px-4 py-2 rounded-lg font-medium bg-vico-primary text-white hover:bg-vico-primary-hover border border-slate-700"
          aria-label="Neuen Benutzer anlegen"
        >
          + Benutzer anlegen
        </button>
        <Link
          to="/einstellungen"
          className="px-4 py-2 rounded-lg font-medium border border-slate-300 text-slate-700 hover:bg-slate-50"
        >
          Einstellungen
        </Link>
      </div>

      {isLoading ? (
        <LoadingSpinner message="Lade Benutzer…" className="mt-4 py-8" />
      ) : (
        <>
          {formError && (
            <p className="mt-2 p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200" role="alert">
              {formError}
            </p>
          )}

          {(() => {
            const appProfiles = profiles.filter(isAppUser)
            const portalProfiles = profiles.filter((p) => !isAppUser(p))

            const renderUserList = (
              list: Profile[],
              availableRoles: readonly string[],
              canChangeRole: boolean
            ) => (
              <ul className="space-y-2" aria-label="Benutzerliste">
                {list.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white rounded-lg border border-slate-200"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-800">
                          {getProfileDisplayName(p)}
                          {(p.first_name || p.last_name) && p.email && (
                            <span className="text-slate-400 font-normal"> ({p.email})</span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenEditName(p)}
                          className="text-xs text-vico-primary hover:underline"
                          aria-label="Name bearbeiten"
                        >
                          bearbeiten
                        </button>
                      </div>
                      <span className="ml-2 text-sm text-slate-500 flex items-center gap-1.5">
                        {ROLE_LABELS[p.role]}
                        {!isAppUser(p) && <PortalBadge />}
                      </span>
                    </div>
                    {canChangeRole ? (
                      <select
                        value={p.role}
                        onChange={(e) => handleRoleChange(p, e.target.value as 'admin' | 'mitarbeiter' | 'operator' | 'leser' | 'demo' | 'kunde')}
                        disabled={updatingId === p.id || isLastAdmin(p)}
                        className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 text-slate-700 bg-white disabled:opacity-50 min-w-[140px]"
                        aria-label={`Rolle von ${getProfileDisplayName(p)} ändern`}
                        title={isLastAdmin(p) ? 'Letzter Admin – Rolle kann nicht geändert werden' : 'Rolle'}
                      >
                        {(Object.entries(ROLE_LABELS) as [keyof typeof ROLE_LABELS, string][])
                          .filter(([value]) => availableRoles.includes(value))
                          .map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                      </select>
                    ) : (
                      <span className="px-3 py-1.5 text-sm text-slate-600 min-w-[140px]">
                        {ROLE_LABELS[p.role]}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )

            return (
              <div className="mt-4 space-y-6">
                <section>
                  <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">
                    App-Benutzer ({appProfiles.length})
                  </h3>
                  <p className="text-xs text-slate-500 mb-2">
                    Zugriff auf die Vico Web-App (Admin, Mitarbeiter, Operator, Leser, Demo)
                  </p>
                  {renderUserList(appProfiles, APP_ROLES, true)}
                </section>
                <section>
                  <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">
                    Portal-Benutzer ({portalProfiles.length})
                  </h3>
                  <p className="text-xs text-slate-500 mb-2">
                    Zugriff auf das Kundenportal (Wartungsberichte). Rollen werden über die Kundenverwaltung gesetzt.
                  </p>
                  {renderUserList(portalProfiles, PORTAL_ROLES, false)}
                </section>
              </div>
            )
          })()}
        </>
      )}

      {showForm && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
          onClick={handleCloseForm}
          onKeyDown={(e) => e.key === 'Escape' && handleCloseForm()}
          role="dialog"
          aria-modal
          aria-labelledby="create-user-title"
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="create-user-title" className="text-lg font-bold text-slate-800">
              Neuen Benutzer anlegen
            </h3>
            <form onSubmit={handleCreateUser} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="user-first-name" className="block text-sm font-medium text-slate-700 mb-1">
                    Vorname
                  </label>
                  <input
                    id="user-first-name"
                    type="text"
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    placeholder="Vorname"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-vico-primary"
                    disabled={isSaving}
                  />
                </div>
                <div>
                  <label htmlFor="user-last-name" className="block text-sm font-medium text-slate-700 mb-1">
                    Nachname
                  </label>
                  <input
                    id="user-last-name"
                    type="text"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    placeholder="Nachname"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-vico-primary"
                    disabled={isSaving}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="user-email" className="block text-sm font-medium text-slate-700 mb-1">
                  E-Mail
                </label>
                <input
                  id="user-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="name@beispiel.de"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-vico-primary"
                  required
                  disabled={isSaving}
                />
              </div>
              <div>
                <label htmlFor="user-password" className="block text-sm font-medium text-slate-700 mb-1">
                  Passwort (min. 6 Zeichen)
                </label>
                <input
                  id="user-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-vico-primary"
                  minLength={6}
                  required
                  disabled={isSaving}
                />
              </div>
              {formError && (
                <p className="text-sm text-red-600" role="alert">
                  {formError}
                </p>
              )}
              {formMessage && (
                <p className="text-sm text-green-600">{formMessage}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg font-medium bg-vico-primary text-white hover:bg-vico-primary-hover disabled:opacity-50"
                >
                  {isSaving ? 'Erstelle…' : 'Anlegen'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="px-4 py-2 rounded-lg font-medium border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingProfile && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
          onClick={handleCloseEditName}
          onKeyDown={(e) => e.key === 'Escape' && handleCloseEditName()}
          role="dialog"
          aria-modal
          aria-labelledby="edit-name-title"
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="edit-name-title" className="text-lg font-bold text-slate-800">
              Name bearbeiten
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              {editingProfile.email || '(keine E-Mail)'}
            </p>
            <form onSubmit={handleSaveName} className="mt-4 space-y-4">
              <div>
                <label htmlFor="edit-first-name" className="block text-sm font-medium text-slate-700 mb-1">
                  Vorname
                </label>
                <input
                  id="edit-first-name"
                  type="text"
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  placeholder="Vorname"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-vico-primary"
                  disabled={updatingId === editingProfile.id}
                />
              </div>
              <div>
                <label htmlFor="edit-last-name" className="block text-sm font-medium text-slate-700 mb-1">
                  Nachname
                </label>
                <input
                  id="edit-last-name"
                  type="text"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  placeholder="Nachname"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-vico-primary"
                  disabled={updatingId === editingProfile.id}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={updatingId === editingProfile.id}
                  className="px-4 py-2 rounded-lg font-medium bg-vico-primary text-white hover:bg-vico-primary-hover disabled:opacity-50"
                >
                  {updatingId === editingProfile.id ? 'Speichern…' : 'Speichern'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseEditName}
                  className="px-4 py-2 rounded-lg font-medium border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Benutzerverwaltung
