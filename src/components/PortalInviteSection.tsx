import { useState, useEffect, useCallback } from 'react'
import { fetchPortalUsers, invitePortalUser, deletePortalUser } from '../lib/dataService'
import type { PortalUser } from '../lib/dataService'
import { useToast } from '../ToastContext'
import { useSync } from '../SyncContext'
import ConfirmDialog from './ConfirmDialog'

type PortalInviteSectionProps = {
  customerId: string
  customerName: string
}

const PortalInviteSection = ({ customerId, customerName }: PortalInviteSectionProps) => {
  const { showError } = useToast()
  const { isOffline } = useSync()
  const [portalUsers, setPortalUsers] = useState<PortalUser[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    message: string
    onConfirm: () => void
  }>({ open: false, title: '', message: '', onConfirm: () => {} })

  const loadPortalUsers = useCallback(async () => {
    setIsLoading(true)
    const data = await fetchPortalUsers(customerId)
    setPortalUsers(data)
    setIsLoading(false)
  }, [customerId])

  useEffect(() => {
    if (isOpen) loadPortalUsers()
  }, [isOpen, loadPortalUsers])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setIsSending(true)
    const result = await invitePortalUser(customerId, email.trim())
    if (result.success) {
      setEmail('')
      loadPortalUsers()
    } else {
      showError(result.error ?? 'Einladung fehlgeschlagen.')
    }
    setIsSending(false)
  }

  const handleDelete = async (id: string) => {
    const { error } = await deletePortalUser(id)
    if (error) {
      showError(error.message)
    } else {
      loadPortalUsers()
    }
  }

  const handleToggle = () => {
    setIsOpen((prev) => !prev)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleToggle()
    }
  }

  return (
    <div className="border-t border-slate-200 dark:border-slate-600 mt-3 pt-3">
      <button
        type="button"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-200 hover:text-slate-800 dark:hover:text-white transition-colors"
        aria-expanded={isOpen}
        aria-label={`Portal-Zugang für ${customerName}`}
      >
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        Kundenportal
        {portalUsers.length > 0 && (
          <span className="text-xs bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-100 rounded-full px-2 py-0.5">
            {portalUsers.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="mt-2 space-y-2">
          {isOffline && (
            <p className="text-xs text-slate-500 dark:text-slate-400">Offline – Portal-Einladungen erst bei Verbindung möglich.</p>
          )}
          <form onSubmit={handleInvite} className="flex gap-2">
            <input
              type="email"
              placeholder="E-Mail-Adresse einladen…"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isOffline}
              className="flex-1 px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary disabled:opacity-60 disabled:bg-slate-50 dark:disabled:bg-slate-800/80"
              aria-label="E-Mail für Portal-Einladung"
              required
            />
            <button
              type="submit"
              disabled={isSending || !email.trim() || isOffline}
              title={isOffline ? 'Offline – erst bei Verbindung möglich' : undefined}
              className="px-3 py-1.5 text-sm bg-vico-button dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg hover:bg-vico-button-hover dark:hover:bg-slate-600 disabled:opacity-50 font-medium border border-slate-300 dark:border-slate-600"
            >
              {isSending ? 'Sende…' : 'Einladen'}
            </button>
          </form>

          {isLoading ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">Lade…</p>
          ) : portalUsers.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">Noch keine Portal-Benutzer eingeladen.</p>
          ) : (
            <ul className="space-y-1">
              {portalUsers.map((pu) => (
                <li
                  key={pu.id}
                  className="flex items-center justify-between gap-2 text-sm bg-white dark:bg-slate-800/80 rounded border border-slate-200 dark:border-slate-600 px-3 py-1.5"
                >
                  <div className="min-w-0">
                    <span className="text-slate-700 dark:text-slate-200 truncate block">{pu.email}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {pu.user_id ? 'Registriert' : 'Eingeladen'}{' '}
                      · {new Date(pu.invited_at).toLocaleDateString('de-DE')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      !isOffline &&
                      setConfirmDialog({
                        open: true,
                        title: 'Portal-Zugang entfernen',
                        message: 'Portal-Zugang wirklich entfernen?',
                        onConfirm: () => {
                          setConfirmDialog((c) => ({ ...c, open: false }))
                          handleDelete(pu.id)
                        },
                      })
                    }
                    disabled={isOffline}
                    title={isOffline ? 'Offline – erst bei Verbindung möglich' : undefined}
                    className="shrink-0 px-2 py-1 text-xs text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label={`${pu.email} entfernen`}
                  >
                    Entfernen
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel="Entfernen"
        variant="danger"
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((c) => ({ ...c, open: false }))}
      />
    </div>
  )
}

export default PortalInviteSection
