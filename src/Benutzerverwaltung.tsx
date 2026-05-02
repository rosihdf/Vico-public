import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { getSupabaseErrorMessage } from './supabaseErrors'
import { supabase } from './supabase'
import { fetchProfiles, updateProfileRole, updateProfileName, getProfileDisplayName, updateProfileRoleByEmail, fetchTeams, updateProfileTeam, createTeam, deleteTeam } from './lib/userService'
import { LoadingSpinner } from './components/LoadingSpinner'
import PortalBadge from './components/PortalBadge'
import { subscribeToProfileChanges } from './lib/profileRealtime'
import { useLicense } from './LicenseContext'
import { useSync } from './SyncContext'
import { checkCanInviteUser, getUsageLevel, getUsageMessage, hasFeature } from './lib/licenseService'
import { getStoredLicenseNumber, reportLimitExceeded, isLicenseApiConfigured } from './lib/licensePortalApi'
import {
  fetchCustomers,
  fetchAllPortalUserAssignments,
  linkPortalUserToCustomer,
  deletePortalUser,
  fetchPortalVisibility,
  setPortalVisibilityForCustomer,
  fetchBvs,
} from './lib/dataService'
import type { Profile, Team } from './lib/userService'
import type { PortalUserAssignment } from './lib/dataService'
import type { Customer } from './types'
import type { BV } from './types'

const ROLE_LABELS: Record<'admin' | 'teamleiter' | 'mitarbeiter' | 'operator' | 'leser' | 'demo' | 'kunde', string> = {
  admin: 'Admin',
  teamleiter: 'Teamleiter',
  mitarbeiter: 'Mitarbeiter',
  operator: 'Operator',
  leser: 'Leser',
  demo: 'Demo (24h-Löschung)',
  kunde: 'Kunde (Portal)',
}

const APP_ROLES = ['admin', 'teamleiter', 'mitarbeiter', 'operator', 'leser', 'demo'] as const

const isAppUser = (p: Profile) => APP_ROLES.includes(p.role as (typeof APP_ROLES)[number])

const Benutzerverwaltung = () => {
  const navigate = useNavigate()
  const { userRole, signUp, logout } = useAuth()
  const { license } = useLicense()
  const { isOffline } = useSync()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showTeamForm, setShowTeamForm] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newFirstName, setNewFirstName] = useState('')
  const [newLastName, setNewLastName] = useState('')
  const [newRole, setNewRole] = useState<'admin' | 'teamleiter' | 'mitarbeiter' | 'operator' | 'leser' | 'demo' | 'kunde'>('mitarbeiter')
  const [formError, setFormError] = useState<string | null>(null)
  const [formMessage, setFormMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null)
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [portalAssignments, setPortalAssignments] = useState<PortalUserAssignment[]>([])
  const [expandedPortalUserId, setExpandedPortalUserId] = useState<string | null>(null)
  const [visibilityExpandedUserId, setVisibilityExpandedUserId] = useState<string | null>(null)
  const [visibilityByUser, setVisibilityByUser] = useState<Record<string, Record<string, string[]>>>({})
  const [bvsByCustomer, setBvsByCustomer] = useState<Record<string, BV[]>>({})
  const [savingVisibilityUserId, setSavingVisibilityUserId] = useState<string | null>(null)
  const [linkingUserId, setLinkingUserId] = useState<string | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [savingTeamId, setSavingTeamId] = useState<string | null>(null)
  const [newTeamName, setNewTeamName] = useState('')
  const [isCreatingTeam, setIsCreatingTeam] = useState(false)
  const [deletingTeamId, setDeletingTeamId] = useState<string | null>(null)
  const teamFeatureEnabled = !!license && hasFeature(license, 'teamfunktion')

  const handleTeamChange = async (profileId: string, teamId: string | null) => {
    setSavingTeamId(profileId)
    const { error } = await updateProfileTeam(profileId, teamId)
    setSavingTeamId(null)
    if (!error) await loadProfiles()
    else setFormError(getSupabaseErrorMessage(error.message))
  }

  const handleCreateTeam = async (providedName?: string): Promise<boolean> => {
    const name = (providedName ?? newTeamName).trim()
    if (!name) return false
    setIsCreatingTeam(true)
    setFormError(null)
    const { error } = await createTeam(name)
    setIsCreatingTeam(false)
    if (!error) {
      setNewTeamName('')
      await loadTeams()
      await loadProfiles()
      setFormMessage(`Team „${name}" wurde angelegt.`)
      setTimeout(() => setFormMessage(null), 3000)
      return true
    } else {
      setFormError(getSupabaseErrorMessage(error.message))
      return false
    }
  }

  const handleOpenTeamForm = () => {
    if (!teamFeatureEnabled) return
    setNewTeamName('')
    setFormError(null)
    setFormMessage(null)
    setShowTeamForm(true)
  }

  const handleCloseTeamForm = () => {
    setShowTeamForm(false)
    setFormError(null)
    setFormMessage(null)
  }

  const handleCreateTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const ok = await handleCreateTeam()
    if (ok) {
      setShowTeamForm(false)
    }
  }

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    if (!confirm(`Team „${teamName}" wirklich löschen? Zugewiesene Mitglieder werden dem Team entzogen.`)) return
    setDeletingTeamId(teamId)
    setFormError(null)
    const { error } = await deleteTeam(teamId)
    setDeletingTeamId(null)
    if (!error) {
      await loadTeams()
      await loadProfiles()
      setFormMessage(`Team „${teamName}" wurde gelöscht.`)
      setTimeout(() => setFormMessage(null), 3000)
    } else {
      setFormError(getSupabaseErrorMessage(error.message))
    }
  }

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

  const loadCustomersAndAssignments = useCallback(async () => {
    const [custs, assigns] = await Promise.all([fetchCustomers(), fetchAllPortalUserAssignments()])
    setCustomers(custs)
    setPortalAssignments(assigns)
  }, [])

  const loadTeams = useCallback(async () => {
    const data = await fetchTeams()
    setTeams(data)
  }, [])

  useEffect(() => {
    if (userRole !== 'admin') return
    loadCustomersAndAssignments()
    if (teamFeatureEnabled) {
      loadTeams()
      return
    }
    setTeams([])
  }, [userRole, teamFeatureEnabled, loadCustomersAndAssignments, loadTeams])

  const handleOpenCreate = async () => {
    const allowed = await checkCanInviteUser()
    if (!allowed) {
      if (isLicenseApiConfigured() && license) {
        const licenseNumber = getStoredLicenseNumber()
        if (licenseNumber && license.max_users != null) {
          const currentUsers = profiles.filter((p) => !['demo', 'kunde'].includes(p.role)).length
          reportLimitExceeded({
            licenseNumber,
            limit_type: 'users',
            current_value: currentUsers,
            max_value: license.max_users,
            reported_from: typeof window !== 'undefined' ? window.location.origin : undefined,
          })
        }
      }
      setFormError('Benutzer-Limit erreicht. Bitte Lizenz upgraden, um weitere Benutzer einzuladen.')
      return
    }
    setNewEmail('')
    setNewPassword('')
    setNewFirstName('')
    setNewLastName('')
    setNewRole('mitarbeiter')
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
    if (newRole === 'kunde' && (!license || !hasFeature(license, 'kundenportal'))) {
      setFormError('Portalbenutzer können nur angelegt werden, wenn das Kundenportal in der Lizenz enthalten ist.')
      return
    }
    setIsSaving(true)
    const { success, message, sessionCreated } = await signUp(newEmail.trim(), newPassword)
    if (success && sessionCreated && (newFirstName.trim() || newLastName.trim())) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user && (newFirstName.trim() || newLastName.trim())) {
        await updateProfileName(user.id, newFirstName.trim() || null, newLastName.trim() || null)
      }
    }
    if (success && newRole && newRole !== 'mitarbeiter') {
      await updateProfileRoleByEmail(newEmail.trim(), newRole)
    }
    setIsSaving(false)
    if (success) {
      setFormMessage('Benutzer erstellt.')
      setNewEmail('')
      setNewPassword('')
      setNewFirstName('')
      setNewLastName('')
      setNewRole('mitarbeiter')
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

  const assignmentsForUser = (userId: string) =>
    portalAssignments.filter((a) => a.user_id === userId)
  const customerName = (customerId: string) =>
    customers.find((c) => c.id === customerId)?.name ?? customerId

  const handleLinkPortalUserToCustomer = async (profile: Profile, customerId: string) => {
    if (!profile.email) return
    setLinkingUserId(profile.id)
    setFormError(null)
    const { error } = await linkPortalUserToCustomer(profile.id, profile.email, customerId)
    setLinkingUserId(null)
    if (error) {
      setFormError(error)
      return
    }
    await loadCustomersAndAssignments()
  }

  const handleUnlinkPortalUser = async (assignmentId: string) => {
    setFormError(null)
    const res = await deletePortalUser(assignmentId)
    if (res.error) {
      setFormError(res.error.message)
      return
    }
    await loadCustomersAndAssignments()
  }

  const handleOpenVisibility = async (userId: string) => {
    if (visibilityExpandedUserId === userId) {
      setVisibilityExpandedUserId(null)
      return
    }
    setVisibilityExpandedUserId(userId)
    const assignments = portalAssignments.filter((a) => a.user_id === userId)
    const [vis, ...bvsResults] = await Promise.all([
      fetchPortalVisibility(userId),
      ...assignments.map((a) => fetchBvs(a.customer_id)),
    ])
    const bvsMap: Record<string, BV[]> = {}
    assignments.forEach((a, i) => {
      bvsMap[a.customer_id] = bvsResults[i] ?? []
    })
    setBvsByCustomer((prev) => ({ ...prev, ...bvsMap }))
    const visMap: Record<string, string[]> = {}
    vis.forEach((r) => {
      if (!visMap[r.customer_id]) visMap[r.customer_id] = []
      visMap[r.customer_id].push(r.bv_id)
    })
    setVisibilityByUser((prev) => ({ ...prev, [userId]: visMap }))
  }

  const handleVisibilityCheck = (userId: string, customerId: string, bvId: string, checked: boolean) => {
    setVisibilityByUser((prev) => {
      const userVis = prev[userId] ?? {}
      const bvIds = userVis[customerId] ?? []
      const allBvIds = (bvsByCustomer[customerId] ?? []).map((b) => b.id)
      let next: string[]
      if (checked) {
        if (bvIds.length === 0) next = [...allBvIds]
        else next = [...bvIds]
        if (!next.includes(bvId)) next.push(bvId)
      } else {
        if (bvIds.length === 0) next = allBvIds.filter((id) => id !== bvId)
        else next = bvIds.filter((id) => id !== bvId)
      }
      return { ...prev, [userId]: { ...userVis, [customerId]: next } }
    })
  }

  const handleSaveVisibility = async (userId: string, customerId: string) => {
    setSavingVisibilityUserId(userId)
    const userVis = visibilityByUser[userId] ?? {}
    const bvIds = userVis[customerId] ?? []
    const allBvIds = (bvsByCustomer[customerId] ?? []).map((b) => b.id)
    const toSave = allBvIds.length === bvIds.length ? [] : bvIds
    const { error } = await setPortalVisibilityForCustomer(userId, customerId, toSave)
    setSavingVisibilityUserId(null)
    if (error) setFormError(error)
  }

  const handleRoleChange = async (profile: Profile, newRole: 'admin' | 'teamleiter' | 'mitarbeiter' | 'operator' | 'leser' | 'demo' | 'kunde') => {
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
      <div className="p-4 min-w-0">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Benutzerverwaltung</h2>
        <p className="mt-2 text-slate-600 dark:text-slate-400">Zugriff nur für Administratoren.</p>
      </div>
    )
  }

  return (
    <div className="p-4 min-w-0">
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Benutzerverwaltung</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Benutzer anlegen und Rollen verwalten (nur Admin).
      </p>

      {license && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Verfügbare Rollen können je nach Lizenz und aktivierten Modulen eingeschränkt sein (z.B. Portalbenutzer nur bei aktivem Kundenportal).
        </p>
      )}

      {license?.max_users != null && (() => {
        const currentUsers = profiles.filter((p) => !['demo', 'kunde'].includes(p.role)).length
        const msg = getUsageMessage(currentUsers, license.max_users, 'Benutzer')
        const level = getUsageLevel(currentUsers, license.max_users)
        if (!msg) return null
        return (
          <div
            className={`mb-4 p-4 rounded-xl border ${
              level === 'blocked'
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-800 dark:text-red-300'
                : level === 'critical'
                  ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300'
                  : 'bg-amber-50/80 dark:bg-amber-900/10 border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300'
            }`}
            role="status"
          >
            <p className="text-sm font-medium">{msg}</p>
          </div>
        )
      })()}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleOpenCreate}
          disabled={isOffline}
          title={isOffline ? 'Offline – erst bei Verbindung möglich' : undefined}
          className={`px-4 py-2 rounded-lg font-medium border border-slate-700 ${
            isOffline ? 'bg-slate-300 dark:bg-slate-600 text-slate-500 cursor-not-allowed' : 'bg-vico-primary text-white hover:bg-vico-primary-hover'
          }`}
          aria-label="Neuen Benutzer anlegen"
        >
          + Benutzer
        </button>
        {teamFeatureEnabled && (
          <button
            type="button"
            onClick={handleOpenTeamForm}
            disabled={isOffline || isCreatingTeam}
            title={isOffline ? 'Offline – erst bei Verbindung möglich' : undefined}
            className={`px-4 py-2 rounded-lg font-medium border border-slate-700 ${
              isOffline || isCreatingTeam
                ? 'bg-slate-300 dark:bg-slate-600 text-slate-500 cursor-not-allowed'
                : 'bg-vico-primary text-white hover:bg-vico-primary-hover'
            }`}
            aria-label="Neues Team anlegen"
          >
            + Team
          </button>
        )}
      </div>

      {isLoading ? (
        <LoadingSpinner message="Lade Benutzer…" className="mt-4 py-8" />
      ) : (
        <>
          {formError && (
            <p className="mt-2 p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800" role="alert">
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
                    className="flex min-w-0 flex-col gap-2 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600"
                  >
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="min-w-0 max-w-full truncate font-medium text-slate-800 dark:text-slate-100">
                        {getProfileDisplayName(p)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenEditName(p)}
                        className="shrink-0 text-xs text-vico-primary hover:underline"
                        aria-label="Name bearbeiten"
                      >
                        bearbeiten
                      </button>
                    </div>
                    <div className="flex w-full min-w-0 items-center gap-2">
                      {p.email ? (
                        <p
                          className="min-w-0 flex-1 truncate text-sm text-slate-500 dark:text-slate-400"
                          title={p.email}
                        >
                          {p.email}
                        </p>
                      ) : (
                        <span className="min-w-0 flex-1" aria-hidden />
                      )}
                      {canChangeRole ? (
                        <select
                          value={p.role}
                          onChange={(e) =>
                            handleRoleChange(
                              p,
                              e.target.value as 'admin' | 'mitarbeiter' | 'operator' | 'leser' | 'demo' | 'kunde'
                            )
                          }
                          disabled={updatingId === p.id || isLastAdmin(p)}
                          className="shrink-0 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 disabled:opacity-50 min-w-[8.75rem] max-w-[min(100%,12rem)]"
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
                        <span className="shrink-0 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 min-w-[8.75rem]">
                          {ROLE_LABELS[p.role]}
                          {!isAppUser(p) && <PortalBadge />}
                        </span>
                      )}
                    </div>
                    {canChangeRole && teamFeatureEnabled && (
                      <div className="flex items-center gap-1">
                        <label htmlFor={`team-${p.id}`} className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          Team
                        </label>
                        <select
                          id={`team-${p.id}`}
                          value={p.team_id ?? ''}
                          onChange={(e) => handleTeamChange(p.id, e.target.value || null)}
                          disabled={savingTeamId === p.id}
                          className="px-2 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 disabled:opacity-50 min-w-[120px]"
                          aria-label={`Team für ${getProfileDisplayName(p)}`}
                          title="Team (für Teamleiter-Zuordnung)"
                        >
                          <option value="">– Kein Team –</option>
                          {teams.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )

            return (
              <div className="mt-4 space-y-6">
                {teamFeatureEnabled && (
                <section aria-labelledby="teams-heading">
                  {teams.length === 0 ? (
                    <>
                      <h3 id="teams-heading" className="text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-2">
                        Teams
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                        Noch keine Teams. Neues Team über „+ Team“ erstellen.
                      </p>
                    </>
                  ) : (
                    <>
                      <h3 id="teams-heading" className="text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-2">
                        Teams ({teams.length})
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                        Teamleiter sehen nur Zeiten ihres Teams. Mitglieder pro Team zuweisen.
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                        Neues Team über den Button „+ Team“ oben anlegen.
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {teams.map((team) => {
                          const members = appProfiles.filter((p) => p.team_id === team.id)
                          const teamleiter = members.filter((p) => p.role === 'teamleiter')
                          const isDeleting = deletingTeamId === team.id
                          return (
                            <div
                              key={team.id}
                              className="p-4 rounded-xl border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-600"
                            >
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <h4 className="font-medium text-slate-800 dark:text-slate-100">{team.name}</h4>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTeam(team.id, team.name)}
                                  disabled={isDeleting || isOffline}
                                  title={isOffline ? 'Offline – erst bei Verbindung möglich' : 'Team löschen'}
                                  className="shrink-0 p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:pointer-events-none"
                                  aria-label={`Team „${team.name}" löschen`}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                                {members.length} {members.length === 1 ? 'Mitglied' : 'Mitglieder'}
                                {teamleiter.length > 0 && (
                                  <span className="ml-1">
                                    ({teamleiter.length} {teamleiter.length === 1 ? 'Teamleiter' : 'Teamleiter'})
                                  </span>
                                )}
                              </p>
                              {members.length === 0 ? (
                                <p className="text-sm text-slate-400 dark:text-slate-500 italic">Keine Mitglieder</p>
                              ) : (
                                <ul className="space-y-1 text-sm">
                                  {members.map((p) => (
                                    <li
                                      key={p.id}
                                      className="flex items-center justify-between gap-2 text-slate-700 dark:text-slate-300"
                                    >
                                      <span className="truncate">{getProfileDisplayName(p)}</span>
                                      <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                                        {ROLE_LABELS[p.role]}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </section>
                )}
                <section>
                  <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-2">
                    App-Benutzer ({appProfiles.length})
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                    Zugriff auf die ArioVan Web-App (Admin, Mitarbeiter, Operator, Leser, Demo).
                    {teamFeatureEnabled ? ' Team-Zuordnung für Teamleiter und Mitarbeiter.' : ''}
                  </p>
                  {renderUserList(appProfiles, APP_ROLES, true)}
                </section>
                <section aria-labelledby="portal-zugaenge">
                  <h3
                    id="portal-zugaenge"
                    className="text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-2"
                  >
                    Kundenportal-Zugänge & Sichtbarkeit ({portalProfiles.length})
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                    Zugriff auf das Kundenportal (Wartungsberichte). Hier verwalten Sie zentral Kundenportal-Zugänge &
                    Sichtbarkeit (Kundenzuordnung und Objekt/BV-Freigaben).
                  </p>
                  <ul className="space-y-2" aria-label="Kundenportal-Zugänge und Sichtbarkeit">
                    {portalProfiles.map((p) => {
                      const assignments = assignmentsForUser(p.id)
                      const assignedCustomerIds = assignments.map((a) => a.customer_id)
                      const availableCustomers = customers.filter((c) => !assignedCustomerIds.includes(c.id))
                      const isExpanded = expandedPortalUserId === p.id
                      const userVis = visibilityByUser[p.id] ?? {}
                      return (
                        <li
                          key={p.id}
                          className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => setExpandedPortalUserId((prev) => (prev === p.id ? null : p.id))}
                            className="w-full flex flex-wrap items-center justify-between gap-2 p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                            aria-expanded={isExpanded}
                            aria-label={isExpanded ? `${getProfileDisplayName(p)} Details ausblenden` : `${getProfileDisplayName(p)} Details anzeigen`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 min-w-0 flex-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`inline-block transition-transform shrink-0 ${isExpanded ? 'rotate-90' : ''}`} aria-hidden="true">
                                  ▶
                                </span>
                                <span className="font-medium text-slate-800 dark:text-slate-100 truncate">
                                  {getProfileDisplayName(p)}
                                </span>
                                {p.email && (
                                  <span className="text-slate-400 dark:text-slate-500 text-sm truncate hidden sm:inline">
                                    {p.email}
                                  </span>
                                )}
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 shrink-0">
                                  {assignments.length} {assignments.length === 1 ? 'Kunde' : 'Kunden'}
                                </span>
                              </div>
                              {assignments.length > 0 && (
                                <span className="text-xs text-slate-500 dark:text-slate-400 truncate pl-5 sm:pl-0">
                                  {assignments.map((a) => customerName(a.customer_id)).join(', ')}
                                </span>
                              )}
                            </div>
                          </button>
                          {isExpanded && (
                            <div className="flex flex-col gap-3 p-3 pt-0 border-t border-slate-100 dark:border-slate-600">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditName(p)}
                                  className="text-xs text-vico-primary hover:underline"
                                  aria-label="Name bearbeiten"
                                >
                                  Name bearbeiten
                                </button>
                                <span className="text-slate-500 dark:text-slate-400">·</span>
                                <span className="text-sm text-slate-500 dark:text-slate-400">
                                  {ROLE_LABELS[p.role]}
                                  <PortalBadge />
                                </span>
                              </div>
                              <div className="text-sm text-slate-600 dark:text-slate-300">
                                <span className="font-medium">Zuordnung: </span>
                                {assignments.length === 0 ? (
                                  <span className="text-slate-400">Kein Kunde zugewiesen</span>
                                ) : (
                                  <span className="flex flex-wrap gap-1.5 items-center">
                                    {assignments.map((a) => (
                                      <span
                                        key={a.id}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                                      >
                                        {customerName(a.customer_id)}
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleUnlinkPortalUser(a.id)
                                          }}
                                          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium"
                                          aria-label={`${customerName(a.customer_id)} entfernen`}
                                        >
                                          ×
                                        </button>
                                      </span>
                                    ))}
                                  </span>
                                )}
                                {availableCustomers.length > 0 && (
                                  <span className="inline-flex items-center gap-2 mt-1.5">
                                    <label htmlFor={`portal-add-${p.id}`} className="sr-only">
                                      Kunde zuweisen
                                    </label>
                                    <select
                                      id={`portal-add-${p.id}`}
                                      value=""
                                      onChange={(e) => {
                                        const cid = e.target.value
                                        if (cid) {
                                          handleLinkPortalUserToCustomer(p, cid)
                                          e.target.value = ''
                                        }
                                      }}
                                      disabled={linkingUserId === p.id}
                                      className="text-sm rounded border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 disabled:opacity-50"
                                      aria-label="Kunde zuweisen"
                                    >
                                      <option value="">+ Kunde zuweisen</option>
                                      {availableCustomers.map((c) => (
                                        <option key={c.id} value={c.id}>
                                          {c.name}
                                        </option>
                                      ))}
                                    </select>
                                  </span>
                                )}
                              </div>
                              {assignments.length > 0 && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenVisibility(p.id)}
                                    className="text-sm text-vico-primary hover:underline text-left"
                                    aria-expanded={visibilityExpandedUserId === p.id}
                                  >
                                    {visibilityExpandedUserId === p.id ? '▼ Sichtbare Objekte/BV ausblenden' : '▶ Sichtbare Objekte/BV bearbeiten'}
                                  </button>
                                  {visibilityExpandedUserId === p.id && (
                                <div className="pl-2 border-l-2 border-slate-200 dark:border-slate-600 space-y-3">
                                  {assignments.map((a) => {
                                    const bvs = bvsByCustomer[a.customer_id] ?? []
                                    const selectedBvIds = userVis[a.customer_id] ?? []
                                    const allSelected = bvs.length > 0 && selectedBvIds.length === bvs.length
                                    return (
                                      <div key={a.customer_id} className="space-y-1.5">
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="font-medium text-slate-700 dark:text-slate-200">{customerName(a.customer_id)}</span>
                                          <button
                                            type="button"
                                            onClick={() => handleSaveVisibility(p.id, a.customer_id)}
                                            disabled={savingVisibilityUserId === p.id || bvs.length === 0}
                                            className="text-xs px-2 py-1 rounded bg-vico-primary text-white hover:bg-vico-primary-hover disabled:opacity-50"
                                          >
                                            {savingVisibilityUserId === p.id ? 'Speichern…' : 'Sichtbarkeit speichern'}
                                          </button>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                          {bvs.length === 0
                                            ? 'Keine BV angelegt.'
                                            : allSelected || selectedBvIds.length === 0
                                              ? 'Alle BV sichtbar (Standard).'
                                              : `Nur ${selectedBvIds.length} von ${bvs.length} BV sichtbar.`}
                                        </p>
                                        {bvs.length > 0 && (
                                          <ul className="space-y-1 max-h-40 overflow-y-auto">
                                            {bvs.map((bv) => {
                                              const isChecked =
                                                selectedBvIds.length === 0 || selectedBvIds.includes(bv.id)
                                              return (
                                                <li key={bv.id} className="flex items-center gap-2">
                                                  <input
                                                    type="checkbox"
                                                    id={`vis-${p.id}-${a.customer_id}-${bv.id}`}
                                                    checked={isChecked}
                                                    onChange={(e) =>
                                                      handleVisibilityCheck(p.id, a.customer_id, bv.id, e.target.checked)
                                                    }
                                                    className="rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-vico-primary focus:ring-vico-primary"
                                                  />
                                                  <label
                                                    htmlFor={`vis-${p.id}-${a.customer_id}-${bv.id}`}
                                                    className="text-sm text-slate-700 dark:text-slate-200 cursor-pointer"
                                                  >
                                                    {bv.name}
                                                  </label>
                                                </li>
                                              )
                                            })}
                                          </ul>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </>
                          )}
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </section>
              </div>
            )
          })()}
        </>
      )}

      {showTeamForm && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto overscroll-contain"
          style={{ padding: 'max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left))' }}
          onClick={handleCloseTeamForm}
          onKeyDown={(e) => e.key === 'Escape' && handleCloseTeamForm()}
          role="dialog"
          aria-modal
          aria-labelledby="create-team-title"
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full min-w-0 max-h-[min(90vh,90dvh)] overflow-y-auto overflow-x-hidden p-6 border border-slate-200 dark:border-slate-600"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="create-team-title" className="text-lg font-bold text-slate-800 dark:text-slate-100">
              Neues Team anlegen
            </h3>
            <form onSubmit={handleCreateTeamSubmit} className="mt-4 flex min-w-0 flex-col gap-4">
              <div className="min-w-0">
                <label htmlFor="team-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Team-Name
                </label>
                <input
                  id="team-name"
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="z. B. Nord"
                  className="box-border w-full min-w-0 max-w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
                  disabled={isCreatingTeam}
                  autoFocus
                />
              </div>
              {formError && (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {formError}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isCreatingTeam || !newTeamName.trim()}
                  className="px-4 py-2 rounded-lg font-medium bg-vico-primary text-white hover:bg-vico-primary-hover disabled:opacity-50"
                >
                  {isCreatingTeam ? 'Erstelle…' : 'Anlegen'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseTeamForm}
                  className="px-4 py-2 rounded-lg font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showForm && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto overscroll-contain"
          style={{ padding: 'max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left))' }}
          onClick={handleCloseForm}
          onKeyDown={(e) => e.key === 'Escape' && handleCloseForm()}
          role="dialog"
          aria-modal
          aria-labelledby="create-user-title"
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full min-w-0 max-h-[min(90vh,90dvh)] overflow-y-auto overflow-x-hidden p-6 border border-slate-200 dark:border-slate-600"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="create-user-title" className="text-lg font-bold text-slate-800 dark:text-slate-100">
              Neuen Benutzer anlegen
            </h3>
            <form onSubmit={handleCreateUser} className="mt-4 flex min-w-0 flex-col gap-4">
              <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <label htmlFor="user-first-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Vorname
                  </label>
                  <input
                    id="user-first-name"
                    type="text"
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    placeholder="Vorname"
                    className="box-border w-full min-w-0 max-w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
                    disabled={isSaving}
                    autoComplete="given-name"
                  />
                </div>
                <div className="min-w-0">
                  <label htmlFor="user-last-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Nachname
                  </label>
                  <input
                    id="user-last-name"
                    type="text"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    placeholder="Nachname"
                    className="box-border w-full min-w-0 max-w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
                    disabled={isSaving}
                    autoComplete="family-name"
                  />
                </div>
              </div>
              <div className="min-w-0 shrink-0">
                <label htmlFor="user-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  E-Mail
                </label>
                <input
                  id="user-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="name@beispiel.de"
                  className="box-border w-full min-w-0 max-w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
                  required
                  disabled={isSaving}
                  autoComplete="email"
                />
              </div>
              <div className="min-w-0 shrink-0">
                <label htmlFor="user-password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Passwort (min. 6 Zeichen)
                </label>
                <input
                  id="user-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="box-border w-full min-w-0 max-w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
                  minLength={6}
                  required
                  disabled={isSaving}
                  autoComplete="new-password"
                />
              </div>
              <div className="min-w-0 shrink-0">
                <label htmlFor="user-role" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Rolle
                </label>
                <select
                  id="user-role"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as typeof newRole)}
                  disabled={isSaving}
                  className="box-border w-full min-w-0 max-w-full appearance-auto rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-vico-primary"
                  aria-label="Rolle auswählen"
                >
                  {(Object.entries(ROLE_LABELS) as [keyof typeof ROLE_LABELS, string][])
                    .filter(([role]) => {
                      if (role === 'kunde') return license ? hasFeature(license, 'kundenportal') : false
                      return APP_ROLES.includes(role)
                    })
                    .map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                </select>
              </div>
              {formError && (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {formError}
                </p>
              )}
              {formMessage && (
                <p className="text-sm text-green-600 dark:text-green-400">{formMessage}</p>
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
                  className="px-4 py-2 rounded-lg font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50"
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
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto overscroll-contain"
          style={{ padding: 'max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left))' }}
          onClick={handleCloseEditName}
          onKeyDown={(e) => e.key === 'Escape' && handleCloseEditName()}
          role="dialog"
          aria-modal
          aria-labelledby="edit-name-title"
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full min-w-0 max-h-[min(90vh,90dvh)] overflow-y-auto overflow-x-hidden p-6 border border-slate-200 dark:border-slate-600"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="edit-name-title" className="text-lg font-bold text-slate-800 dark:text-slate-100">
              Name bearbeiten
            </h3>
            <p className="mt-1 min-w-0 break-words text-sm text-slate-600 dark:text-slate-400">
              {editingProfile.email || '(keine E-Mail)'}
            </p>
            <form onSubmit={handleSaveName} className="mt-4 flex min-w-0 flex-col gap-4">
              <div className="min-w-0">
                <label htmlFor="edit-first-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Vorname
                </label>
                <input
                  id="edit-first-name"
                  type="text"
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  placeholder="Vorname"
                  className="box-border w-full min-w-0 max-w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
                  disabled={updatingId === editingProfile.id}
                  autoComplete="given-name"
                />
              </div>
              <div className="min-w-0">
                <label htmlFor="edit-last-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nachname
                </label>
                <input
                  id="edit-last-name"
                  type="text"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  placeholder="Nachname"
                  className="box-border w-full min-w-0 max-w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
                  disabled={updatingId === editingProfile.id}
                  autoComplete="family-name"
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
                  className="px-4 py-2 rounded-lg font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50"
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
