import { useState, useEffect } from 'react'
import { useToast } from '../ToastContext'
import { getSupabaseErrorMessage } from '../supabaseErrors'
import {
  createMaintenanceContract,
  updateMaintenanceContract,
} from '../lib/dataService'
import type { MaintenanceContract } from '../types'

type MaintenanceContractModalProps = {
  open: boolean
  customerId: string | null
  bvId: string | null
  contract: MaintenanceContract | null
  onClose: () => void
  onSuccess: () => void
}

const MaintenanceContractModal = ({
  open,
  customerId,
  bvId,
  contract,
  onClose,
  onSuccess,
}: MaintenanceContractModalProps) => {
  const { showError } = useToast()
  const isEdit = !!contract
  const [contractNumber, setContractNumber] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setContractNumber(contract?.contract_number ?? '')
    setStartDate(contract?.start_date?.slice(0, 10) ?? '')
    setEndDate(contract?.end_date?.slice(0, 10) ?? '')
    setFormError(null)
  }, [open, contract])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const num = contractNumber.trim()
    if (!num) {
      setFormError('Vertragsnummer ist erforderlich.')
      return
    }
    if (!startDate) {
      setFormError('Datum Beginn ist erforderlich.')
      return
    }
    if (!customerId && !bvId) {
      setFormError('Kunde oder BV fehlt.')
      return
    }
    setIsSaving(true)
    if (isEdit && contract) {
      const { error } = await updateMaintenanceContract(contract.id, {
        contract_number: num,
        start_date: startDate,
        end_date: endDate.trim() || null,
      })
      if (error) {
        setFormError(getSupabaseErrorMessage(error))
        showError(getSupabaseErrorMessage(error))
      } else {
        onClose()
        onSuccess()
      }
    } else {
      const { data, error } = await createMaintenanceContract({
        customer_id: bvId ? null : customerId,
        bv_id: bvId ?? null,
        contract_number: num,
        start_date: startDate,
        end_date: endDate.trim() || null,
      })
      if (error) {
        setFormError(getSupabaseErrorMessage(error))
        showError(getSupabaseErrorMessage(error))
      } else if (data) {
        onClose()
        onSuccess()
      }
    }
    setIsSaving(false)
  }

  if (!open) return null

  const title = isEdit ? 'Wartungsvertrag bearbeiten' : 'Wartungsvertrag anlegen'

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
      aria-label="Modal schließen"
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full min-w-0"
        role="dialog"
        aria-modal
        aria-labelledby="contract-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-200">
          <h3 id="contract-modal-title" className="text-lg font-bold text-slate-800">
            {title}
          </h3>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label htmlFor="contract-number" className="block text-sm font-medium text-slate-700 mb-1">
              Vertragsnummer (z. B. JJJJ/0000)
            </label>
            <input
              id="contract-number"
              type="text"
              value={contractNumber}
              onChange={(e) => setContractNumber(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              placeholder="2025/0001"
              aria-label="Vertragsnummer"
            />
          </div>
          <div>
            <label htmlFor="contract-start" className="block text-sm font-medium text-slate-700 mb-1">
              Datum Beginn
            </label>
            <input
              id="contract-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              aria-label="Datum Beginn"
            />
          </div>
          <div>
            <label htmlFor="contract-end" className="block text-sm font-medium text-slate-700 mb-1">
              Datum Ende (optional)
            </label>
            <input
              id="contract-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              aria-label="Datum Ende"
            />
          </div>
          {formError && (
            <p className="text-sm text-red-600">{formError}</p>
          )}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2 bg-vico-button text-slate-800 rounded-lg hover:bg-vico-button-hover disabled:opacity-50 border border-slate-300"
            >
              {isSaving ? 'Speichern…' : 'Speichern'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Abbrechen
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default MaintenanceContractModal
