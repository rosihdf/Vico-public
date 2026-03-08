import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { getSupabaseErrorMessage } from './supabaseErrors'
import {
  fetchCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  fetchBvs,
  createBv,
  updateBv,
  deleteBv,
  fetchObjects,
  subscribeToDataChange,
} from './lib/dataService'
import { useComponentSettings } from './ComponentSettingsContext'
import { getObjectDisplayName } from './lib/objectUtils'
import { AddressLookupFields } from './components/AddressLookupFields'
import type { Customer, CustomerFormData, BV, BVFormData } from './types'
import type { Object as Obj } from './types'

const INITIAL_CUSTOMER_FORM: CustomerFormData = {
  name: '',
  street: '',
  house_number: '',
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

const INITIAL_BV_FORM: BVFormData = {
  name: '',
  street: '',
  house_number: '',
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

const Kunden = () => {
  const { userRole } = useAuth()
  const { isEnabled } = useComponentSettings()
  const canEdit = userRole !== 'leser'
  const canCreateBv = userRole === 'admin'

  const [customers, setCustomers] = useState<Customer[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<CustomerFormData>(INITIAL_CUSTOMER_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null)
  const [expandedBvs, setExpandedBvs] = useState<BV[]>([])
  const [isBvsLoading, setIsBvsLoading] = useState(false)

  const [expandedBvId, setExpandedBvId] = useState<string | null>(null)
  const [expandedObjects, setExpandedObjects] = useState<Obj[]>([])
  const [isObjectsLoading, setIsObjectsLoading] = useState(false)

  const [showBvForm, setShowBvForm] = useState(false)
  const [bvEditingId, setBvEditingId] = useState<string | null>(null)
  const [bvFormData, setBvFormData] = useState<BVFormData>(INITIAL_BV_FORM)
  const [bvFormError, setBvFormError] = useState<string | null>(null)
  const [isBvSaving, setIsBvSaving] = useState(false)

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
    if (!showForm && !showBvForm) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showBvForm) handleCloseBvForm()
        else if (showForm) handleCloseForm()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [showForm, showBvForm])

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  // --- Customer CRUD ---

  const handleOpenCreate = () => {
    setFormData(INITIAL_CUSTOMER_FORM)
    setEditingId(null)
    setFormError(null)
    setShowForm(true)
  }

  const handleOpenEdit = (customer: Customer) => {
    setFormData({
      name: customer.name,
      street: customer.street ?? '',
      house_number: customer.house_number ?? '',
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
      house_number: formData.house_number.trim() || null,
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
      if (expandedCustomerId === id) {
        setExpandedCustomerId(null)
        setExpandedBvs([])
      }
      loadCustomers()
    }
  }

  // --- BV Accordion ---

  const handleToggleBvs = async (customerId: string) => {
    if (expandedCustomerId === customerId) {
      setExpandedCustomerId(null)
      setExpandedBvs([])
      setExpandedBvId(null)
      setExpandedObjects([])
      return
    }
    setExpandedCustomerId(customerId)
    setExpandedBvId(null)
    setExpandedObjects([])
    setIsBvsLoading(true)
    const data = await fetchBvs(customerId)
    setExpandedBvs(data ?? [])
    setIsBvsLoading(false)
  }

  const reloadExpandedBvs = async () => {
    if (!expandedCustomerId) return
    const data = await fetchBvs(expandedCustomerId)
    setExpandedBvs(data ?? [])
  }

  // --- BV CRUD ---

  const handleOpenBvCreate = () => {
    setBvFormData({ ...INITIAL_BV_FORM, copy_from_customer: false })
    setBvEditingId(null)
    setBvFormError(null)
    setShowBvForm(true)
  }

  const handleOpenBvEdit = (bv: BV) => {
    setBvFormData({
      name: bv.name,
      street: bv.street ?? '',
      house_number: bv.house_number ?? '',
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
    setBvEditingId(bv.id)
    setBvFormError(null)
    setShowBvForm(true)
  }

  const handleCloseBvForm = () => {
    setShowBvForm(false)
    setBvEditingId(null)
    setBvFormError(null)
  }

  const handleBvFormChange = (field: keyof BVFormData, value: string | boolean) => {
    setBvFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleCopyFromCustomer = () => {
    const customer = customers.find((c) => c.id === expandedCustomerId)
    if (!customer) return
    setBvFormData((prev) => ({
      ...prev,
      street: customer.street ?? '',
      house_number: customer.house_number ?? '',
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

  const handleBvSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBvFormError(null)
    if (!bvFormData.name.trim() || !expandedCustomerId) {
      setBvFormError('Name ist erforderlich.')
      return
    }

    const customer = customers.find((c) => c.id === expandedCustomerId)
    const data = bvFormData.copy_from_customer && customer
      ? {
          ...bvFormData,
          street: customer.street ?? '',
          house_number: customer.house_number ?? '',
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
      : bvFormData

    setIsBvSaving(true)
    const payload = {
      customer_id: expandedCustomerId,
      name: data.name.trim(),
      street: data.street.trim() || null,
      house_number: data.house_number.trim() || null,
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

    if (bvEditingId) {
      const { error } = await updateBv(bvEditingId, payload)
      if (error) {
        setBvFormError(getSupabaseErrorMessage(error))
      } else {
        handleCloseBvForm()
        reloadExpandedBvs()
      }
    } else {
      const { error } = await createBv(payload)
      if (error) {
        setBvFormError(getSupabaseErrorMessage(error))
      } else {
        handleCloseBvForm()
        reloadExpandedBvs()
      }
    }
    setIsBvSaving(false)
  }

  const handleBvDelete = async (id: string) => {
    if (!window.confirm('BV wirklich löschen?')) return
    const { error } = await deleteBv(id)
    if (!error) {
      if (expandedBvId === id) {
        setExpandedBvId(null)
        setExpandedObjects([])
      }
      reloadExpandedBvs()
    }
  }

  const handleToggleObjects = async (bvId: string) => {
    if (expandedBvId === bvId) {
      setExpandedBvId(null)
      setExpandedObjects([])
      return
    }
    setExpandedBvId(bvId)
    setIsObjectsLoading(true)
    const data = await fetchObjects(bvId)
    setExpandedObjects(data ?? [])
    setIsObjectsLoading(false)
  }

  const reloadExpandedObjects = async () => {
    if (!expandedBvId) return
    const data = await fetchObjects(expandedBvId)
    setExpandedObjects(data ?? [])
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
              className="px-4 py-2.5 min-h-[40px] bg-vico-button text-slate-800 rounded-lg hover:bg-vico-button-hover font-medium border border-slate-300"
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
          {filteredCustomers.map((customer) => {
            const isExpanded = expandedCustomerId === customer.id
            return (
              <li
                key={customer.id}
                className="bg-white rounded-lg border border-slate-200 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => handleToggleBvs(customer.id)}
                  className="w-full p-4 flex items-center justify-between gap-2 text-left hover:bg-slate-50 transition-colors cursor-pointer"
                  aria-expanded={isExpanded}
                  aria-label={`BVs für ${customer.name} ${isExpanded ? 'einklappen' : 'ausklappen'}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <svg
                      className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800">{customer.name}</p>
                      {(customer.street || customer.house_number || customer.postal_code || customer.city) && (
                        <p className="text-sm text-slate-500">
                          {[
                            [customer.street, customer.house_number].filter(Boolean).join(' '),
                            [customer.postal_code, customer.city].filter(Boolean).join(' '),
                          ]
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {canEdit && (
                      <>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); handleOpenEdit(customer) }}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); handleOpenEdit(customer) } }}
                          className="px-3 py-2 text-sm min-h-[36px] inline-flex items-center border border-slate-300 rounded-lg hover:bg-slate-100"
                          aria-label={`${customer.name} bearbeiten`}
                        >
                          Bearbeiten
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); handleDelete(customer.id) }}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); handleDelete(customer.id) } }}
                          className="px-3 py-2 text-sm min-h-[36px] inline-flex items-center text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                          aria-label={`${customer.name} löschen`}
                        >
                          Löschen
                        </span>
                      </>
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
                    {isBvsLoading ? (
                      <p className="text-sm text-slate-500 py-2">Lade BVs...</p>
                    ) : expandedBvs.length === 0 ? (
                      <div className="py-4 flex flex-col items-start gap-3">
                        <p className="text-sm text-slate-500">Noch keine BVs angelegt.</p>
                        {canCreateBv && (
                          <button
                            type="button"
                            onClick={handleOpenBvCreate}
                            className="px-3 py-2 text-sm bg-vico-button text-slate-800 rounded-lg hover:bg-vico-button-hover font-medium border border-slate-300"
                          >
                            + BV anlegen
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        <ul className="space-y-2">
                          {expandedBvs.map((bv) => {
                            const isBvExpanded = expandedBvId === bv.id
                            return (
                              <li
                                key={bv.id}
                                className="bg-white rounded-lg border border-slate-200 overflow-hidden"
                              >
                                <button
                                  type="button"
                                  onClick={() => handleToggleObjects(bv.id)}
                                  className="w-full p-3 flex items-center justify-between gap-2 text-left hover:bg-slate-50 transition-colors cursor-pointer"
                                  aria-expanded={isBvExpanded}
                                  aria-label={`Objekte für ${bv.name} ${isBvExpanded ? 'einklappen' : 'ausklappen'}`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <svg
                                      className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${isBvExpanded ? 'rotate-180' : ''}`}
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                    <div className="min-w-0">
                                      <p className="font-medium text-slate-700 text-sm">{bv.name}</p>
                                      {(bv.street || bv.house_number || bv.postal_code || bv.city) && (
                                        <p className="text-xs text-slate-500">
                                          {[
                                            [bv.street, bv.house_number].filter(Boolean).join(' '),
                                            [bv.postal_code, bv.city].filter(Boolean).join(' '),
                                          ]
                                            .filter(Boolean)
                                            .join(', ')}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {canEdit && (
                                      <>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          onClick={(e) => { e.stopPropagation(); handleOpenBvEdit(bv) }}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); handleOpenBvEdit(bv) } }}
                                          className="px-3 py-1.5 text-sm min-h-[32px] inline-flex items-center border border-slate-300 rounded-lg hover:bg-slate-100"
                                          aria-label={`${bv.name} bearbeiten`}
                                        >
                                          Bearbeiten
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          onClick={(e) => { e.stopPropagation(); handleBvDelete(bv.id) }}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); handleBvDelete(bv.id) } }}
                                          className="px-3 py-1.5 text-sm min-h-[32px] inline-flex items-center text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                                          aria-label={`${bv.name} löschen`}
                                        >
                                          Löschen
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </button>

                                {isBvExpanded && (
                                  <div className="border-t border-slate-200 bg-slate-50 px-3 py-2">
                                    {isObjectsLoading ? (
                                      <p className="text-xs text-slate-500 py-2">Lade Objekte...</p>
                                    ) : expandedObjects.length === 0 ? (
                                      <div className="py-3 flex flex-col items-start gap-3">
                                        <p className="text-xs text-slate-500">Noch keine Objekte angelegt.</p>
                                        {canEdit && (
                                          <Link
                                            to={`/kunden/${customer.id}/bvs/${bv.id}/objekte`}
                                            className="px-4 py-2.5 min-h-[40px] inline-flex items-center text-sm bg-vico-button text-slate-800 rounded-lg hover:bg-vico-button-hover font-medium border border-slate-300"
                                          >
                                            + Objekt anlegen
                                          </Link>
                                        )}
                                      </div>
                                    ) : (
                                      <>
                                        <ul className="space-y-1.5">
                                          {expandedObjects.map((obj) => (
                                            <li
                                              key={obj.id}
                                              className="bg-white rounded border border-slate-200 p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                                            >
                                              <div className="min-w-0">
                                                <p className="font-medium text-slate-600 text-xs">{getObjectDisplayName(obj)}</p>
                                                <p className="text-[11px] text-slate-500">
                                                  {[obj.room, obj.floor].filter(Boolean).join(' · ') || obj.manufacturer || '–'}
                                                </p>
                                              </div>
                                              <div className="flex flex-wrap gap-1">
                                                {isEnabled('wartungsprotokolle') && (
                                                  <Link
                                                    to={`/kunden/${customer.id}/bvs/${bv.id}/objekte/${obj.id}/wartung`}
                                                    className="px-2.5 py-1.5 min-h-[32px] inline-flex items-center text-xs border border-slate-300 rounded-lg hover:bg-slate-50"
                                                  >
                                                    Wartung
                                                  </Link>
                                                )}
                                                <Link
                                                  to={`/kunden/${customer.id}/bvs/${bv.id}/objekte?objectId=${obj.id}`}
                                                  className="px-2.5 py-1.5 min-h-[32px] inline-flex items-center text-xs border border-slate-300 rounded-lg hover:bg-slate-50"
                                                >
                                                  Details
                                                </Link>
                                              </div>
                                            </li>
                                          ))}
                                        </ul>
                                        {canEdit && (
                                          <Link
                                            to={`/kunden/${customer.id}/bvs/${bv.id}/objekte`}
                                            className="mt-2 inline-flex items-center px-4 py-2.5 min-h-[40px] text-sm bg-vico-button text-slate-800 rounded-lg hover:bg-vico-button-hover font-medium border border-slate-300"
                                          >
                                            + Objekt anlegen
                                          </Link>
                                        )}
                                      </>
                                    )}
                                  </div>
                                )}
                              </li>
                            )
                          })}
                        </ul>
                        {canCreateBv && (
                          <button
                            type="button"
                            onClick={handleOpenBvCreate}
                            className="mt-2 px-3 py-2 text-sm bg-vico-button text-slate-800 rounded-lg hover:bg-vico-button-hover font-medium border border-slate-300"
                          >
                            + BV anlegen
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Kunde Formular Modal */}
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
              <AddressLookupFields
                street={formData.street}
                houseNumber={formData.house_number}
                postalCode={formData.postal_code}
                city={formData.city}
                onStreetChange={(v) => handleFormChange('street', v)}
                onHouseNumberChange={(v) => handleFormChange('house_number', v)}
                onPostalCodeChange={(v) => handleFormChange('postal_code', v)}
                onCityChange={(v) => handleFormChange('city', v)}
                streetId="street"
                houseNumberId="house_number"
                postalCodeId="postal_code"
                cityId="city"
              />
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

      {/* BV Formular Modal */}
      {showBvForm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={handleCloseBvForm}
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
                {bvEditingId ? 'BV bearbeiten' : 'BV anlegen'}
              </h3>
            </div>
            <form onSubmit={handleBvSubmit} className="p-4 space-y-4">
              {!bvEditingId && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bvFormData.copy_from_customer}
                    onChange={(e) => {
                      handleBvFormChange('copy_from_customer', e.target.checked)
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
                  value={bvFormData.name}
                  onChange={(e) => handleBvFormChange('name', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-vico-primary"
                  required
                />
              </div>
              <AddressLookupFields
                street={bvFormData.street}
                houseNumber={bvFormData.house_number}
                postalCode={bvFormData.postal_code}
                city={bvFormData.city}
                onStreetChange={(v) => handleBvFormChange('street', v)}
                onHouseNumberChange={(v) => handleBvFormChange('house_number', v)}
                onPostalCodeChange={(v) => handleBvFormChange('postal_code', v)}
                onCityChange={(v) => handleBvFormChange('city', v)}
                streetId="bv-street"
                houseNumberId="bv-house_number"
                postalCodeId="bv-postal_code"
                cityId="bv-city"
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="bv-email" className="block text-sm font-medium text-slate-700 mb-1">
                    E-Mail
                  </label>
                  <input
                    id="bv-email"
                    type="email"
                    value={bvFormData.email}
                    onChange={(e) => handleBvFormChange('email', e.target.value)}
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
                    value={bvFormData.phone}
                    onChange={(e) => handleBvFormChange('phone', e.target.value)}
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
                    value={bvFormData.contact_name}
                    onChange={(e) => handleBvFormChange('contact_name', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-vico-primary"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="email"
                      placeholder="E-Mail"
                      value={bvFormData.contact_email}
                      onChange={(e) => handleBvFormChange('contact_email', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-vico-primary"
                    />
                    <input
                      type="tel"
                      placeholder="Telefon"
                      value={bvFormData.contact_phone}
                      onChange={(e) => handleBvFormChange('contact_phone', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-vico-primary"
                    />
                  </div>
                </div>
              </div>
              <div className="border-t border-slate-200 pt-4 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bvFormData.maintenance_report_email}
                    onChange={(e) => handleBvFormChange('maintenance_report_email', e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    Wartungsbericht per E-Mail
                  </span>
                </label>
                {bvFormData.maintenance_report_email && (
                  <input
                    type="email"
                    placeholder="Wartungsbericht E-Mail-Adresse"
                    value={bvFormData.maintenance_report_email_address}
                    onChange={(e) => handleBvFormChange('maintenance_report_email_address', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-vico-primary"
                  />
                )}
              </div>
              {bvFormError && (
                <div className="text-sm text-red-600" role="alert">
                  <p>{bvFormError}</p>
                  {bvFormError.startsWith('RLS-Fehler') && (
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
                  disabled={isBvSaving}
                  className="flex-1 py-2 bg-vico-button text-slate-800 rounded-lg hover:bg-vico-button-hover disabled:opacity-50 border border-slate-300"
                >
                  {isBvSaving ? 'Speichern...' : 'Speichern'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseBvForm}
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
