import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { getSupabaseErrorMessage } from './supabaseErrors'
import {
  fetchCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  subscribeToDataChange,
} from './lib/dataService'
import type { Customer, CustomerFormData } from './types'

const INITIAL_FORM: CustomerFormData = {
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
}

const Kunden = () => {
  const { userRole } = useAuth()
  const canEdit = userRole !== 'leser'
  const [customers, setCustomers] = useState<Customer[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<CustomerFormData>(INITIAL_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const loadCustomers = useCallback(async () => {
    setIsLoading(true)
    const data = await fetchCustomers()
    setCustomers(data ?? [])
    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  useEffect(() => {
    return subscribeToDataChange(loadCustomers)
  }, [loadCustomers])

  useEffect(() => {
    if (!showForm) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCloseForm()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [showForm])

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  const handleOpenCreate = () => {
    setFormData(INITIAL_FORM)
    setEditingId(null)
    setFormError(null)
    setShowForm(true)
  }

  const handleOpenEdit = (customer: Customer) => {
    setFormData({
      name: customer.name,
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
    })
    setEditingId(customer.id)
    setFormError(null)
    setShowForm(true)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormError(null)
  }

  const handleFormChange = (field: keyof CustomerFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!formData.name.trim()) {
      setFormError('Name ist erforderlich.')
      return
    }

    setIsSaving(true)
    const payload = {
      name: formData.name.trim(),
      street: formData.street.trim() || null,
      postal_code: formData.postal_code.trim() || null,
      city: formData.city.trim() || null,
      email: formData.email.trim() || null,
      phone: formData.phone.trim() || null,
      contact_name: formData.contact_name.trim() || null,
      contact_email: formData.contact_email.trim() || null,
      contact_phone: formData.contact_phone.trim() || null,
      maintenance_report_email: formData.maintenance_report_email,
      maintenance_report_email_address:
        formData.maintenance_report_email_address.trim() || null,
    }

    if (editingId) {
      const { error } = await updateCustomer(editingId, payload)
      if (error) {
        setFormError(getSupabaseErrorMessage(error))
      } else {
        handleCloseForm()
        loadCustomers()
      }
    } else {
      const { data, error } = await createCustomer(payload)
      if (error) {
        setFormError(getSupabaseErrorMessage(error))
      } else if (data) {
        handleCloseForm()
        loadCustomers()
      }
    }
    setIsSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Kunden wirklich löschen?')) return
    const { error } = await deleteCustomer(id)
    if (!error) {
      loadCustomers()
    }
  }

  return (
    <div className="p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <h2 className="text-xl font-bold text-slate-800">Kunden</h2>
        <div className="flex gap-2">
          <input
            type="search"
            placeholder="Kunden suchen..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="flex-1 sm:w-48 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vico-primary"
            aria-label="Kunden suchen"
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
        <p className="text-slate-600">Lade Kunden...</p>
      ) : filteredCustomers.length === 0 ? (
        <p className="text-slate-600 py-8 text-center">
          {searchQuery ? 'Keine Kunden gefunden.' : 'Noch keine Kunden angelegt.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {filteredCustomers.map((customer) => (
            <li
              key={customer.id}
              className="bg-white rounded-lg border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div>
                <p className="font-medium text-slate-800">{customer.name}</p>
                {(customer.city || customer.postal_code) && (
                  <p className="text-sm text-slate-500">
                    {[customer.postal_code, customer.city].filter(Boolean).join(' ')}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  to={`/kunden/${customer.id}/bvs`}
                  className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  BVs
                </Link>
                {canEdit && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(customer)}
                      className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
                      aria-label={`${customer.name} bearbeiten`}
                    >
                      Bearbeiten
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(customer.id)}
                      className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                      aria-label={`${customer.name} löschen`}
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
            aria-labelledby="form-title"
          >
            <div className="p-4 sticky top-0 bg-white border-b border-slate-200">
              <h3 id="form-title" className="text-lg font-bold text-slate-800">
                {editingId ? 'Kunde bearbeiten' : 'Kunde anlegen'}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
                  Name *
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-vico-primary"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="street" className="block text-sm font-medium text-slate-700 mb-1">
                    Straße
                  </label>
                  <input
                    id="street"
                    type="text"
                    value={formData.street}
                    onChange={(e) => handleFormChange('street', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-vico-primary"
                  />
                </div>
                <div>
                  <label htmlFor="postal_code" className="block text-sm font-medium text-slate-700 mb-1">
                    PLZ
                  </label>
                  <input
                    id="postal_code"
                    type="text"
                    value={formData.postal_code}
                    onChange={(e) => handleFormChange('postal_code', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-vico-primary"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="city" className="block text-sm font-medium text-slate-700 mb-1">
                  Ort
                </label>
                <input
                  id="city"
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleFormChange('city', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-vico-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                    E-Mail
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleFormChange('email', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-vico-primary"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1">
                    Telefon
                  </label>
                  <input
                    id="phone"
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

export default Kunden
