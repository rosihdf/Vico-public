import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { getSupabaseErrorMessage } from './supabaseErrors'
import {
  fetchCustomer,
  fetchBvs,
  createBv,
  updateBv,
  deleteBv,
  subscribeToDataChange,
} from './lib/dataService'
import type { BV, BVFormData, Customer } from './types'

const INITIAL_FORM: BVFormData = {
  name: '',
  street: '',
  postal_code: '',
  city: '',
  email: '',
  phone: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  maintenance_report_email: true,
  maintenance_report_email_address: '',
  copy_from_customer: false,
}

const BVs = () => {
  const { customerId } = useParams<{ customerId: string }>()
  const { userRole } = useAuth()
  const canEdit = userRole !== 'leser'
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [bvs, setBvs] = useState<BV[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<BVFormData>(INITIAL_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const loadData = useCallback(async () => {
    if (!customerId) return
    const [cust, bvData] = await Promise.all([
      fetchCustomer(customerId),
      fetchBvs(customerId),
    ])
    setCustomer(cust)
    setBvs(bvData ?? [])
    setIsLoading(false)
  }, [customerId])

  useEffect(() => {
    if (!customerId) return
    setIsLoading(true)
    loadData()
  }, [customerId, loadData])

  useEffect(() => {
    return subscribeToDataChange(loadData)
  }, [loadData])

  useEffect(() => {
    if (!showForm) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCloseForm()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [showForm])

  const filteredBVs = bvs.filter((b) =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  const handleCopyFromCustomer = () => {
    if (!customer) return
    setFormData((prev) => ({
      ...prev,
      street: customer.street ?? '',
      postal_code: customer.postal_code ?? '',
      city: customer.city ?? '',
      email: customer.email ?? '',
      phone: customer.phone ?? '',
      contact_name: customer.contact_name ?? '',
      contact_email: customer.contact_email ?? '',
      contact_phone: customer.contact_phone ?? '',
      maintenance_report_email: customer.maintenance_report_email ?? true,
      maintenance_report_email_address:
        customer.maintenance_report_email_address ?? '',
    }))
  }

  const handleOpenCreate = () => {
    setFormData({ ...INITIAL_FORM, copy_from_customer: false })
    setEditingId(null)
    setFormError(null)
    setShowForm(true)
  }

  const handleOpenEdit = (bv: BV) => {
    setFormData({
      name: bv.name,
      street: bv.street ?? '',
      postal_code: bv.postal_code ?? '',
      city: bv.city ?? '',
      email: bv.email ?? '',
      phone: bv.phone ?? '',
      contact_name: bv.contact_name ?? '',
      contact_email: bv.contact_email ?? '',
      contact_phone: bv.contact_phone ?? '',
      maintenance_report_email: bv.maintenance_report_email ?? true,
      maintenance_report_email_address:
        bv.maintenance_report_email_address ?? '',
      copy_from_customer: false,
    })
    setEditingId(bv.id)
    setFormError(null)
    setShowForm(true)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormError(null)
  }

  const handleFormChange = (field: keyof BVFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!formData.name.trim() || !customerId) {
      setFormError('Name ist erforderlich.')
      return
    }

    const data = formData.copy_from_customer && customer
      ? {
          ...formData,
          street: customer.street ?? '',
          postal_code: customer.postal_code ?? '',
          city: customer.city ?? '',
          email: customer.email ?? '',
          phone: customer.phone ?? '',
          contact_name: customer.contact_name ?? '',
          contact_email: customer.contact_email ?? '',
          contact_phone: customer.contact_phone ?? '',
          maintenance_report_email: customer.maintenance_report_email ?? true,
          maintenance_report_email_address: customer.maintenance_report_email_address ?? '',
        }
      : formData

    setIsSaving(true)
    const payload = {
      customer_id: customerId,
      name: data.name.trim(),
      street: data.street.trim() || null,
      postal_code: data.postal_code.trim() || null,
      city: data.city.trim() || null,
      email: data.email.trim() || null,
      phone: data.phone.trim() || null,
      contact_name: data.contact_name.trim() || null,
      contact_email: data.contact_email.trim() || null,
      contact_phone: data.contact_phone.trim() || null,
      maintenance_report_email: data.maintenance_report_email,
      maintenance_report_email_address:
        data.maintenance_report_email_address.trim() || null,
    }

    if (editingId) {
      const { error } = await updateBv(editingId, payload)
      if (error) {
        setFormError(getSupabaseErrorMessage(error))
      } else {
        handleCloseForm()
        loadData()
      }
    } else {
      const { error } = await createBv(payload)
      if (error) {
        setFormError(getSupabaseErrorMessage(error))
      } else {
        handleCloseForm()
        loadData()
      }
    }
    setIsSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('BV wirklich löschen?')) return
    const { error } = await deleteBv(id)
    if (!error) loadData()
  }

  if (!customerId) {
    return (
      <div className="p-4">
        <p className="text-slate-600">Kein Kunde ausgewählt.</p>
        <Link to="/kunden" className="text-vico-primary hover:underline mt-2 inline-block">
          ← Zurück zu Kunden
        </Link>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="p-4">
        <p className="text-slate-600">Kunde wird geladen...</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center gap-2 text-sm text-slate-600">
        <Link to="/kunden" className="hover:text-slate-800">
          Kunden
        </Link>
        <span>/</span>
        <span className="font-medium text-slate-800">{customer.name}</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <h2 className="text-xl font-bold text-slate-800">BVs</h2>
        <div className="flex gap-2">
          <input
            type="search"
            placeholder="BVs suchen..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="flex-1 sm:w-48 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vico-primary"
            aria-label="BVs suchen"
          />
          {canEdit && (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="px-4 py-2 bg-vico-button text-slate-800 rounded-lg hover:bg-vico-button-hover font-medium border border-slate-300"
            >
              + Neu
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-slate-600">Lade BVs...</p>
      ) : filteredBVs.length === 0 ? (
        <p className="text-slate-600 py-8 text-center">
          {searchQuery ? 'Keine BVs gefunden.' : 'Noch keine BVs angelegt.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {filteredBVs.map((bv) => (
            <li
              key={bv.id}
              className="bg-white rounded-lg border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div>
                <p className="font-medium text-slate-800">{bv.name}</p>
                {(bv.city || bv.postal_code) && (
                  <p className="text-sm text-slate-500">
                    {[bv.postal_code, bv.city].filter(Boolean).join(' ')}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  to={`/kunden/${customerId}/bvs/${bv.id}/objekte`}
                  className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Objekte
                </Link>
                {canEdit && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(bv)}
                      className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
                      aria-label={`${bv.name} bearbeiten`}
                    >
                      Bearbeiten
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(bv.id)}
                      className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                      aria-label={`${bv.name} löschen`}
                    >
                      Löschen
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {showForm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={handleCloseForm}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal
            onClick={(e) => e.stopPropagation()}
            aria-labelledby="bv-form-title"
          >
            <div className="p-4 sticky top-0 bg-white border-b border-slate-200">
              <h3 id="bv-form-title" className="text-lg font-bold text-slate-800">
                {editingId ? 'BV bearbeiten' : 'BV anlegen'}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {!editingId && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.copy_from_customer}
                    onChange={(e) => {
                      handleFormChange('copy_from_customer', e.target.checked)
                      if (e.target.checked) handleCopyFromCustomer()
                    }}
                    className="rounded border-slate-300"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    Daten aus Kundenverwaltung übernehmen
                  </span>
                </label>
              )}
              <div>
                <label htmlFor="bv-name" className="block text-sm font-medium text-slate-700 mb-1">
                  Name *
                </label>
                <input
                  id="bv-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-vico-primary"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="bv-street" className="block text-sm font-medium text-slate-700 mb-1">
                    Straße
                  </label>
                  <input
                    id="bv-street"
                    type="text"
                    value={formData.street}
                    onChange={(e) => handleFormChange('street', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-vico-primary"
                  />
                </div>
                <div>
                  <label htmlFor="bv-postal_code" className="block text-sm font-medium text-slate-700 mb-1">
                    PLZ
                  </label>
                  <input
                    id="bv-postal_code"
                    type="text"
                    value={formData.postal_code}
                    onChange={(e) => handleFormChange('postal_code', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-vico-primary"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="bv-city" className="block text-sm font-medium text-slate-700 mb-1">
                  Ort
                </label>
                <input
                  id="bv-city"
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleFormChange('city', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-vico-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="bv-email" className="block text-sm font-medium text-slate-700 mb-1">
                    E-Mail
                  </label>
                  <input
                    id="bv-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleFormChange('email', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-vico-primary"
                  />
                </div>
                <div>
                  <label htmlFor="bv-phone" className="block text-sm font-medium text-slate-700 mb-1">
                    Telefon
                  </label>
                  <input
                    id="bv-phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleFormChange('phone', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-vico-primary"
                  />
                </div>
              </div>
              <div className="border-t border-slate-200 pt-4">
                <p className="text-sm font-medium text-slate-700 mb-2">Ansprechpartner</p>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Name"
                    value={formData.contact_name}
                    onChange={(e) => handleFormChange('contact_name', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-vico-primary"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="email"
                      placeholder="E-Mail"
                      value={formData.contact_email}
                      onChange={(e) => handleFormChange('contact_email', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-vico-primary"
                    />
                    <input
                      type="tel"
                      placeholder="Telefon"
                      value={formData.contact_phone}
                      onChange={(e) => handleFormChange('contact_phone', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-vico-primary"
                    />
                  </div>
                </div>
              </div>
              <div className="border-t border-slate-200 pt-4 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.maintenance_report_email}
                    onChange={(e) => handleFormChange('maintenance_report_email', e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    Wartungsbericht per E-Mail
                  </span>
                </label>
                {formData.maintenance_report_email && (
                  <input
                    type="email"
                    placeholder="Wartungsbericht E-Mail-Adresse"
                    value={formData.maintenance_report_email_address}
                    onChange={(e) => handleFormChange('maintenance_report_email_address', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-vico-primary"
                  />
                )}
              </div>
              {formError && (
                <div className="text-sm text-red-600" role="alert">
                  <p>{formError}</p>
                  {formError.startsWith('RLS-Fehler') && (
                    <Link
                      to="/einstellungen"
                      className="mt-2 inline-block px-3 py-1.5 bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 text-xs font-medium"
                    >
                      → Zu Einstellungen (RLS-Fix)
                    </Link>
                  )}
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2 bg-vico-button text-slate-800 rounded-lg hover:bg-vico-button-hover disabled:opacity-50 border border-slate-300"
                >
                  {isSaving ? 'Speichern...' : 'Speichern'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
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

export default BVs
