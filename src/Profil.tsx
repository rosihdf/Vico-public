import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useTheme } from './ThemeContext'
import type { Theme } from './ThemeContext'
import { LoadingSpinner } from './components/LoadingSpinner'
import MfaSettings from './components/MfaSettings'
import { fetchMyProfile, updateProfileName, getProfileDisplayName } from './lib/userService'
import { getSupabaseErrorMessage } from './supabaseErrors'
import type { Profile } from './lib/userService'

const THEME_LABELS: Record<Theme, string> = {
  light: 'Hell',
  dark: 'Dunkel',
  system: 'System',
}

const ROLE_LABELS: Record<'admin' | 'teamleiter' | 'mitarbeiter' | 'operator' | 'leser' | 'demo' | 'kunde', string> = {
  admin: 'Admin',
  teamleiter: 'Teamleiter',
  mitarbeiter: 'Mitarbeiter',
  operator: 'Operator',
  leser: 'Leser',
  demo: 'Demo',
  kunde: 'Kunde (Portal)',
}

const Profil = () => {
  const { isAuthenticated, user, userEmail, userRole, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadProfile = useCallback(async () => {
    if (!user?.id) return
    setIsLoading(true)
    const data = await fetchMyProfile(user.id)
    setProfile(data)
    if (data) {
      setEditFirstName(data.first_name ?? '')
      setEditLastName(data.last_name ?? '')
    }
    setIsLoading(false)
  }, [user?.id])

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      loadProfile()
    } else {
      setProfile(null)
      setIsLoading(false)
    }
  }, [isAuthenticated, user?.id, loadProfile])

  const handleOpenEdit = () => {
    if (profile) {
      setEditFirstName(profile.first_name ?? '')
      setEditLastName(profile.last_name ?? '')
      setError(null)
      setIsEditing(true)
    }
  }

  const handleCloseEdit = () => {
    setIsEditing(false)
    setError(null)
  }

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setError(null)
    setIsSaving(true)
    const { error: updateError } = await updateProfileName(
      profile.id,
      editFirstName.trim() || null,
      editLastName.trim() || null
    )
    setIsSaving(false)
    if (updateError) {
      setError(getSupabaseErrorMessage(updateError))
      return
    }
    await loadProfile()
    window.dispatchEvent(new CustomEvent('vico-profiles-changed'))
    handleCloseEdit()
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  if (!isAuthenticated) {
    return (
      <div className="p-4">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Mein Profil</h2>
        <p className="mt-2 text-slate-600 dark:text-slate-400">Bitte zuerst anmelden.</p>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="mt-4 px-4 py-2 bg-vico-button dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg hover:bg-vico-button-hover dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600 font-medium focus:outline-none focus:ring-2 focus:ring-vico-primary"
          aria-label="Zum Login"
        >
          Zum Login
        </button>
      </div>
    )
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Mein Profil</h2>

      {isLoading ? (
        <LoadingSpinner message="Lade Profil…" className="mt-4 py-8" />
      ) : (
        <div className="mt-4 space-y-4 max-w-md">
          <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Name</p>
                <p className="font-medium text-slate-800 dark:text-slate-100">
                  {profile ? getProfileDisplayName(profile) : userEmail ?? '–'}
                </p>
              </div>
              {profile && (
                <button
                  type="button"
                  onClick={handleOpenEdit}
                  className="text-sm text-vico-primary hover:underline"
                  aria-label="Name bearbeiten"
                >
                  bearbeiten
                </button>
              )}
            </div>
          </div>

          <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600">
            <p className="text-sm text-slate-500 dark:text-slate-400">E-Mail</p>
            <p className="font-medium text-slate-800 dark:text-slate-100">{userEmail ?? '–'}</p>
          </div>

          {userRole && (
            <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600">
              <p className="text-sm text-slate-500 dark:text-slate-400">Rolle</p>
              <p className="font-medium text-slate-800 dark:text-slate-100">{ROLE_LABELS[userRole]}</p>
            </div>
          )}

          <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600">
            <h3 id="darstellung-heading" className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
              Darstellung
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
              Farbschema der App anpassen.
            </p>
            <div className="flex flex-wrap gap-2">
              {(['light', 'dark', 'system'] as Theme[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    theme === t
                      ? 'bg-vico-primary text-white'
                      : 'border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                  aria-pressed={theme === t}
                  aria-label={`${THEME_LABELS[t]} auswählen`}
                >
                  {THEME_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <MfaSettings />

          <button
            type="button"
            onClick={handleLogout}
            className="mt-6 w-full sm:w-auto px-4 py-2.5 rounded-lg font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-vico-primary focus:ring-offset-2 dark:focus:ring-offset-slate-900 transition-colors"
            aria-label="Ausloggen"
          >
            Ausloggen
          </button>
        </div>
      )}

      {isEditing && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
          onClick={handleCloseEdit}
          onKeyDown={(e) => e.key === 'Escape' && handleCloseEdit()}
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
            <form onSubmit={handleSaveName} className="mt-4 space-y-4">
              <div>
                <label htmlFor="profil-first-name" className="block text-sm font-medium text-slate-700 mb-1">
                  Vorname
                </label>
                <input
                  id="profil-first-name"
                  type="text"
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  placeholder="Vorname"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-vico-primary"
                  disabled={isSaving}
                />
              </div>
              <div>
                <label htmlFor="profil-last-name" className="block text-sm font-medium text-slate-700 mb-1">
                  Nachname
                </label>
                <input
                  id="profil-last-name"
                  type="text"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  placeholder="Nachname"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-vico-primary"
                  disabled={isSaving}
                />
              </div>
              {error && (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg font-medium bg-vico-primary text-white hover:bg-vico-primary-hover disabled:opacity-50"
                >
                  {isSaving ? 'Speichern…' : 'Speichern'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseEdit}
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

export default Profil
