import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { fetchMyProfile, updateProfileName, getProfileDisplayName } from './lib/userService'
import { getSupabaseErrorMessage } from './supabaseErrors'
import type { Profile } from './lib/userService'

const ROLE_LABELS: Record<'admin' | 'mitarbeiter' | 'operator' | 'leser', string> = {
  admin: 'Admin',
  mitarbeiter: 'Mitarbeiter',
  operator: 'Operator',
  leser: 'Leser',
}

const Profil = () => {
  const { isAuthenticated, user, userEmail, userRole, logout } = useAuth()
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
        <h2 className="text-xl font-bold text-slate-800">Mein Profil</h2>
        <p className="mt-2 text-slate-600">Bitte zuerst anmelden.</p>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="mt-4 px-4 py-2 bg-vico-button text-slate-800 rounded-lg hover:bg-vico-button-hover border border-slate-300"
        >
          Zum Login
        </button>
      </div>
    )
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold text-slate-800">Mein Profil</h2>

      {isLoading ? (
        <p className="mt-4 text-slate-600">Lade Profil…</p>
      ) : (
        <div className="mt-4 space-y-4 max-w-md">
          <div className="p-4 bg-white rounded-lg border border-slate-200">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <p className="text-sm text-slate-500">Name</p>
                <p className="font-medium text-slate-800">
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

          <div className="p-4 bg-white rounded-lg border border-slate-200">
            <p className="text-sm text-slate-500">E-Mail</p>
            <p className="font-medium text-slate-800">{userEmail ?? '–'}</p>
          </div>

          {userRole && (
            <div className="p-4 bg-white rounded-lg border border-slate-200">
              <p className="text-sm text-slate-500">Rolle</p>
              <p className="font-medium text-slate-800">{ROLE_LABELS[userRole]}</p>
            </div>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="mt-4 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
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
