import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'
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
  fetchMaintenanceReminders,
  subscribeToDataChange,
} from './lib/dataService'
import { useComponentSettings } from './ComponentSettingsContext'
import { useLicense } from './LicenseContext'
import { checkCanCreateCustomer, getUsageLevel, getUsageMessage } from './lib/licenseService'
import { getStoredLicenseNumber, reportLimitExceeded, isLicenseApiConfigured } from './lib/licensePortalApi'
import { getObjectDisplayName, formatObjectRoomFloor } from './lib/objectUtils'
import { AddressLookupFields } from './components/AddressLookupFields'
import ObjectFormModal from './components/ObjectFormModal'
import { LoadingSpinner } from './components/LoadingSpinner'
import PortalInviteSection from './components/PortalInviteSection'
import ConfirmDialog from './components/ConfirmDialog'
import EmptyState from './components/EmptyState'
import type { Customer, CustomerFormData, BV, BVFormData } from './types'
import type { MaintenanceReminder } from './types'

const ObjectQRCodeModal = lazy(() => import('./ObjectQRCodeModal'))
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
  const [searchParams, setSearchParams] = useSearchParams()
  const { userRole } = useAuth()
  const { showError } = useToast()
  const { isEnabled } = useComponentSettings()
  const { license } = useLicense()
  const canEdit = userRole === 'admin' || userRole === 'mitarbeiter' || userRole === 'demo'
  const canDelete = userRole === 'admin' || userRole === 'demo'
  const canCreateBv = userRole === 'admin' || userRole === 'demo'

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
  const [editingObject, setEditingObject] = useState<Obj | null>(null)
  const [editingObjectBvId, setEditingObjectBvId] = useState<string | null>(null)
  const [qrObject, setQrObject] = useState<{ obj: Obj; customerId: string; bvId: string; customerName: string; bvName: string } | null>(null)
  const [showNeuDropdown, setShowNeuDropdown] = useState(false)
  const [maintenanceReminders, setMaintenanceReminders] = useState<MaintenanceReminder[]>([])
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    message: string
    onConfirm: () => void
  }>({ open: false, title: '', message: '', onConfirm: () => {} })

  const remindersByObjectId = useMemo(() => {
    const map = new Map<string, MaintenanceReminder>()
    maintenanceReminders.forEach((r) => map.set(r.object_id, r))
    return map
  }, [maintenanceReminders])

  const loadCustomers = useCallback(async () => {
    setIsLoading(true)
    const [customerData, reminderData] = await Promise.all([
      fetchCustomers(),
      fetchMaintenanceReminders(),
    ])
    setCustomers(customerData ?? [])
    setMaintenanceReminders(reminderData ?? [])
    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  useEffect(() => {
    return subscribeToDataChange(loadCustomers)
  }, [loadCustomers])

  const urlCustomerId = searchParams.get('customerId')
  const urlBvId = searchParams.get('bvId')
  const urlObjectId = searchParams.get('objectId')

  useEffect(() => {
    if (!urlCustomerId || !customers.length) return
    let cancelled = false
    const expandAndOpen = async () => {
      setExpandedCustomerId(urlCustomerId)
      setExpandedBvId(null)
      setExpandedObjects([])
      setIsBvsLoading(true)
      const bvsData = await fetchBvs(urlCustomerId)
      if (cancelled) return
      setExpandedBvs(bvsData ?? [])
      setIsBvsLoading(false)
      if (!urlBvId) return
      const bv = (bvsData ?? []).find((b) => b.id === urlBvId)
      if (!bv) return
      setExpandedBvId(urlBvId)
      setIsObjectsLoading(true)
      const objData = await fetchObjects(urlBvId)
      if (cancelled) return
      setExpandedObjects(objData ?? [])
      setIsObjectsLoading(false)
      if (urlObjectId) {
        const obj = (objData ?? []).find((o) => o.id === urlObjectId)
        if (obj) {
          setEditingObject(obj)
          setEditingObjectBvId(urlBvId)
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev)
            next.delete('customerId')
            next.delete('bvId')
            next.delete('objectId')
            return next
          }, { replace: true })
        }
      }
    }
    expandAndOpen()
    return () => { cancelled = true }
  }, [urlCustomerId, urlBvId, urlObjectId, customers.length, setSearchParams])

  useEffect(() => {
    if (!showNeuDropdown) return
    const handleClickOutside = () => setShowNeuDropdown(false)
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showNeuDropdown])

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

  const searchLower = searchQuery.trim().toLowerCase()
  const matchStr = (v: string | null | undefined) =>
    (v ?? '').toLowerCase().includes(searchLower)
  const filteredCustomers = searchLower
    ? customers.filter((c) =>
        matchStr(c.name) ||
        matchStr(c.street) ||
        matchStr(c.house_number) ||
        matchStr(c.postal_code) ||
        matchStr(c.city) ||
        matchStr(c.email) ||
        matchStr(c.phone) ||
        matchStr(c.contact_name) ||
        matchStr(c.contact_email) ||
        matchStr(c.contact_phone)
      )
    : customers

  const filteredBvs = searchLower && expandedBvs.length > 0
    ? expandedBvs.filter((b) =>
        matchStr(b.name) ||
        matchStr(b.street) ||
        matchStr(b.house_number) ||
        matchStr(b.postal_code) ||
        matchStr(b.city) ||
        matchStr(b.email) ||
        matchStr(b.phone) ||
        matchStr(b.contact_name)
      )
    : expandedBvs

  const filteredObjects = searchLower && expandedObjects.length > 0
    ? expandedObjects.filter((o) =>
        matchStr(o.name) ||
        matchStr(o.internal_id) ||
        matchStr(o.room) ||
        matchStr(o.floor) ||
        matchStr(o.manufacturer)
      )
    : expandedObjects

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  // --- Customer CRUD ---

  const handleOpenCreate = async () => {
    const allowed = await checkCanCreateCustomer()
    if (!allowed) {
      if (isLicenseApiConfigured() && license) {
        const licenseNumber = getStoredLicenseNumber()
        if (licenseNumber && license.max_customers != null) {
          const count = customers.filter((c) => !c.demo_user_id).length
          reportLimitExceeded({
            licenseNumber,
            limit_type: 'customers',
            current_value: count,
            max_value: license.max_customers,
          })
        }
      }
      showError('Kunden-Limit erreicht. Bitte Lizenz upgraden, um weitere Kunden anzulegen.')
      return
    }
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
        const msg = getSupabaseErrorMessage(error)
        setFormError(msg)
        showError(msg)
      } else {
        handleCloseForm()
        loadCustomers()
      }
    } else {
      const { data, error } = await createCustomer(payload)
      if (error) {
        const msg = getSupabaseErrorMessage(error)
        setFormError(msg)
        showError(msg)
      } else if (data) {
        handleCloseForm()
        loadCustomers()
      }
    }
    setIsSaving(false)
  }

  const handleDelete = async (id: string) => {
    const { error } = await deleteCustomer(id)
    if (error) {
      showError(getSupabaseErrorMessage(error))
    } else {
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
        const msg = getSupabaseErrorMessage(error)
        setBvFormError(msg)
        showError(msg)
      } else {
        handleCloseBvForm()
        reloadExpandedBvs()
      }
    } else {
      const { error } = await createBv(payload)
      if (error) {
        const msg = getSupabaseErrorMessage(error)
        setBvFormError(msg)
        showError(msg)
      } else {
        handleCloseBvForm()
        reloadExpandedBvs()
      }
    }
    setIsBvSaving(false)
  }

  const handleBvDelete = async (id: string) => {
    const { error } = await deleteBv(id)
    if (error) {
      showError(getSupabaseErrorMessage(error))
    } else {
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

  const customerCountForLicense = customers.filter((c) => !c.demo_user_id).length

  return (
    <div className="p-4">
      {license?.max_customers != null && (() => {
        const msg = getUsageMessage(customerCountForLicense, license.max_customers, 'Kunden')
        const level = getUsageLevel(customerCountForLicense, license.max_customers)
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

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <h2 className="text-xl font-bold text-slate-800">Kunden</h2>
        <div className="flex gap-2">
          <input
            type="search"
            placeholder="Name, Ort, Adresse, Kontakt…"
            value={searchQuery}
            onChange={handleSearchChange}
            className="flex-1 sm:w-48 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vico-primary"
            aria-label="Kunden suchen"
          />
          {canEdit && (
            <div className="relative">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowNeuDropdown((v) => !v) }}
                className="px-4 py-2.5 min-h-[40px] bg-vico-button text-slate-800 rounded-lg hover:bg-vico-button-hover font-medium border border-slate-300 flex items-center gap-1"
                aria-expanded={showNeuDropdown}
                aria-haspopup="true"
                aria-label="Neu anlegen"
              >
                + Neu
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showNeuDropdown && (
                <div
                  className="absolute right-0 mt-1 w-48 bg-white rounded-lg border border-slate-200 shadow-lg py-1 z-40"
                  role="menu"
                >
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setShowNeuDropdown(false); handleOpenCreate() }}
                    className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    role="menuitem"
                  >
                    Neuer Kunde
                  </button>
                  {canCreateBv && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowNeuDropdown(false)
                        if (expandedCustomerId) handleOpenBvCreate()
                      }}
                      disabled={!expandedCustomerId}
                      className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      role="menuitem"
                      title={!expandedCustomerId ? 'Kunde zuerst ausklappen' : undefined}
                    >
                      Neues BV
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowNeuDropdown(false)
                      if (expandedCustomerId && expandedBvId) {
                        setEditingObject(null)
                        setEditingObjectBvId(expandedBvId)
                      }
                    }}
                    disabled={!expandedCustomerId || !expandedBvId}
                    className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    role="menuitem"
                    title={!expandedCustomerId || !expandedBvId ? 'Kunde und BV zuerst ausklappen' : undefined}
                  >
                    Neues Objekt
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner message="Lade Kunden…" className="py-8" />
      ) : filteredCustomers.length === 0 ? (
        <EmptyState
          title={searchQuery ? 'Keine Kunden gefunden.' : 'Noch keine Kunden angelegt.'}
          description={!searchQuery ? 'Klicken Sie auf „+ Neu“ → „Neuer Kunde“, um zu starten.' : undefined}
          className="py-8"
        />
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
                    )}
                    {canDelete && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation()
                            setConfirmDialog({
                              open: true,
                              title: 'Kunde löschen',
                              message: 'Kunden wirklich löschen?',
                              onConfirm: () => {
                                setConfirmDialog((c) => ({ ...c, open: false }))
                                handleDelete(customer.id)
                              },
                            })
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.stopPropagation()
                              e.preventDefault()
                              setConfirmDialog({
                                open: true,
                                title: 'Kunde löschen',
                                message: 'Kunden wirklich löschen?',
                                onConfirm: () => {
                                  setConfirmDialog((c) => ({ ...c, open: false }))
                                  handleDelete(customer.id)
                                },
                              })
                            }
                          }}
                          className="px-3 py-2 text-sm min-h-[36px] inline-flex items-center text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                          aria-label={`${customer.name} löschen`}
                        >
                          Löschen
                        </span>
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
                    {isBvsLoading ? (
                      <LoadingSpinner message="Lade BVs…" size="sm" className="py-2" />
                    ) : filteredBvs.length === 0 ? (
                      <div className="py-4 flex flex-col items-start gap-3">
                        <EmptyState
                          title={searchLower && expandedBvs.length > 0 ? 'Keine BVs gefunden.' : 'Noch keine BVs angelegt.'}
                          className="py-2 items-start"
                        />
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
                          {filteredBvs.map((bv) => {
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
                                    )}
                                    {canDelete && (
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setConfirmDialog({
                                              open: true,
                                              title: 'BV löschen',
                                              message: 'BV wirklich löschen?',
                                              onConfirm: () => {
                                                setConfirmDialog((c) => ({ ...c, open: false }))
                                                handleBvDelete(bv.id)
                                              },
                                            })
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                              e.stopPropagation()
                                              e.preventDefault()
                                              setConfirmDialog({
                                                open: true,
                                                title: 'BV löschen',
                                                message: 'BV wirklich löschen?',
                                                onConfirm: () => {
                                                  setConfirmDialog((c) => ({ ...c, open: false }))
                                                  handleBvDelete(bv.id)
                                                },
                                              })
                                            }
                                          }}
                                          className="px-3 py-1.5 text-sm min-h-[32px] inline-flex items-center text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                                          aria-label={`${bv.name} löschen`}
                                        >
                                          Löschen
                                        </span>
                                    )}
                                  </div>
                                </button>

                                {isBvExpanded && (
                                  <div className="border-t border-slate-200 bg-slate-50 px-3 py-2">
                                    {isObjectsLoading ? (
                                      <LoadingSpinner message="Lade Objekte…" size="sm" className="py-2" />
                                    ) : filteredObjects.length === 0 ? (
                                      <div className="py-3 flex flex-col items-start gap-3">
                                        <EmptyState
                                          title={searchLower && expandedObjects.length > 0 ? 'Keine Objekte gefunden.' : 'Noch keine Objekte angelegt.'}
                                          className="py-2 items-start"
                                        />
                                        {canEdit && (
                                          <button
                                            type="button"
                                            onClick={() => { setEditingObject(null); setEditingObjectBvId(bv.id) }}
                                            className="px-4 py-2.5 min-h-[40px] inline-flex items-center text-sm bg-vico-button text-slate-800 rounded-lg hover:bg-vico-button-hover font-medium border border-slate-300"
                                          >
                                            + Objekt anlegen
                                          </button>
                                        )}
                                      </div>
                                    ) : (
                                      <>
                                        <ul className="space-y-1.5">
                                          {filteredObjects.map((obj) => (
                                            <li
                                              key={obj.id}
                                              className="bg-white rounded border border-slate-200 p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                                            >
                                              <div className="min-w-0 flex items-center gap-2">
                                                {(() => {
                                                  const reminder = remindersByObjectId.get(obj.id)
                                                  const status = reminder?.status
                                                  const title = reminder
                                                    ? status === 'overdue'
                                                      ? `Überfällig (seit ${reminder.days_until_due != null ? Math.abs(reminder.days_until_due) : '?'} Tagen)`
                                                      : status === 'due_soon'
                                                        ? `Bald fällig (in ${reminder.days_until_due ?? '?'} Tagen)`
                                                        : 'Wartung in Ordnung'
                                                    : 'Kein Wartungsintervall'
                                                  const dotClass = status
                                                    ? status === 'overdue'
                                                      ? 'bg-red-500'
                                                      : status === 'due_soon'
                                                        ? 'bg-amber-500'
                                                        : 'bg-green-500'
                                                    : 'bg-slate-200 border border-slate-300'
                                                  return (
                                                    <span
                                                      className={`shrink-0 w-2.5 h-2.5 rounded-full ${dotClass}`}
                                                      title={title}
                                                      aria-label={title}
                                                    />
                                                  )
                                                })()}
                                                <div>
                                                  <p className="font-medium text-slate-600 text-xs">{getObjectDisplayName(obj)}</p>
                                                  <p className="text-[11px] text-slate-500">
                                                    {formatObjectRoomFloor(obj)}
                                                  </p>
                                                </div>
                                              </div>
                                              <div className="flex flex-wrap gap-1">
                                                {canEdit && (
                                                  <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); setEditingObject(obj); setEditingObjectBvId(bv.id) }}
                                                    className="px-2.5 py-1.5 min-h-[32px] inline-flex items-center text-xs border border-slate-300 rounded-lg hover:bg-slate-50"
                                                    aria-label={`${getObjectDisplayName(obj)} bearbeiten`}
                                                  >
                                                    Bearbeiten
                                                  </button>
                                                )}
                                                {isEnabled('wartungsprotokolle') && (
                                                  <Link
                                                    to={`/kunden/${customer.id}/bvs/${bv.id}/objekte/${obj.id}/wartung`}
                                                    className="px-2.5 py-1.5 min-h-[32px] inline-flex items-center text-xs border border-slate-300 rounded-lg hover:bg-slate-50"
                                                  >
                                                    Wartung
                                                  </Link>
                                                )}
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    setQrObject({ obj, customerId: customer.id, bvId: bv.id, customerName: customer.name, bvName: bv.name })
                                                  }}
                                                  className="px-2.5 py-1.5 min-h-[32px] inline-flex items-center text-xs border border-slate-300 rounded-lg hover:bg-slate-50"
                                                  aria-label="QR-Code anzeigen"
                                                >
                                                  QR-Code
                                                </button>
                                              </div>
                                            </li>
                                          ))}
                                        </ul>
                                        {canEdit && (
                                          <button
                                            type="button"
                                            onClick={() => { setEditingObject(null); setEditingObjectBvId(bv.id) }}
                                            className="mt-2 inline-flex items-center px-4 py-2.5 min-h-[40px] text-sm bg-vico-button text-slate-800 rounded-lg hover:bg-vico-button-hover font-medium border border-slate-300"
                                          >
                                            + Objekt anlegen
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
                    {userRole === 'admin' && (
                      <PortalInviteSection customerId={customer.id} customerName={customer.name} />
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel="Löschen"
        variant="danger"
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((c) => ({ ...c, open: false }))}
      />

      {qrObject && (
        <Suspense fallback={null}>
          <ObjectQRCodeModal
            object={qrObject.obj}
            customerName={qrObject.customerName}
            bvName={qrObject.bvName}
            customerId={qrObject.customerId}
            bvId={qrObject.bvId}
            onClose={() => setQrObject(null)}
          />
        </Suspense>
      )}

      {editingObjectBvId && (
        <ObjectFormModal
          bvId={editingObjectBvId}
          object={editingObject}
          canEdit={canEdit}
          canDelete={canDelete}
          onClose={() => { setEditingObject(null); setEditingObjectBvId(null) }}
          onSuccess={() => {
            reloadExpandedObjects()
            setEditingObject(null)
            setEditingObjectBvId(null)
          }}
        />
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
