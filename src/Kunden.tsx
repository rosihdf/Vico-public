import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'
import { getSupabaseErrorMessage } from './supabaseErrors'
import {
  fetchCustomers,
  createCustomer,
  updateCustomer,
  archiveCustomer,
  fetchBvs,
  fetchAllBvs,
  createBv,
  updateBv,
  archiveBv,
  fetchObjects,
  fetchObjectsDirectUnderCustomer,
  duplicateObjectFromSource,
  getObjectPhotoUrl,
  fetchMaintenanceReminders,
  fetchMaintenanceContractsByCustomer,
  fetchMaintenanceContractsByBv,
  deleteMaintenanceContract,
  subscribeToDataChange,
} from './lib/dataService'
import { useComponentSettings } from './ComponentSettingsContext'
import { useLicense } from './LicenseContext'
import { checkCanCreateCustomer, getUsageLevel, getUsageMessage, hasFeature } from './lib/licenseService'
import {
  generateQrBatchA4Pdf,
  type QrBatchPdfItem,
  type QrBatchPreset,
} from './lib/generateQrBatchA4Pdf'
import { getStoredLicenseNumber, reportLimitExceeded, isLicenseApiConfigured } from './lib/licensePortalApi'
import { getObjectDisplayName, formatObjectRoomFloor } from './lib/objectUtils'
import { AddressLookupFields } from './components/AddressLookupFields'
import ObjectFormModal from './components/ObjectFormModal'
import { LoadingSpinner } from './components/LoadingSpinner'
import PortalInviteSection from './components/PortalInviteSection'
import ConfirmDialog from './components/ConfirmDialog'
import EmptyState from '../shared/EmptyState'
import MaintenanceContractModal from './components/MaintenanceContractModal'
import type { Customer, CustomerFormData, BV, BVFormData } from './types'
import type { MaintenanceReminder, MaintenanceContract } from './types'

const ObjectQRCodeModal = lazy(() => import('./ObjectQRCodeModal'))
import type { Object as Obj } from './types'

const makeQrBatchKey = (customerId: string, bvId: string | null, objectId: string) =>
  `${customerId}|${bvId ?? ''}|${objectId}`

const ObjectProfileThumbInline = ({ path }: { path?: string | null }) => {
  const p = path?.trim()
  if (!p) return null
  return (
    <img
      src={getObjectPhotoUrl(p)}
      alt=""
      className="w-10 h-10 rounded-md object-cover shrink-0 border border-slate-200 dark:border-slate-600"
      loading="lazy"
    />
  )
}

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
  monteur_report_internal_only: false,
  monteur_report_portal: true,
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
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { userRole } = useAuth()
  const { showError, showToast } = useToast()
  const { isEnabled } = useComponentSettings()
  const { license, design } = useLicense()
  const canEdit = userRole === 'admin' || userRole === 'mitarbeiter' || userRole === 'demo'
  const canDelete = userRole === 'admin' || userRole === 'demo'
  const canCreateBv = userRole === 'admin' || userRole === 'demo'
  const canUseQrBatch =
    !!license &&
    hasFeature(license, 'qr_batch_a4') &&
    (userRole === 'admin' ||
      userRole === 'teamleiter' ||
      userRole === 'mitarbeiter' ||
      userRole === 'operator' ||
      userRole === 'demo')

  const showMonteurCustomerZustellung =
    Boolean(license && hasFeature(license, 'wartungsprotokolle'))

  const [customers, setCustomers] = useState<Customer[]>([])
  const [allBvs, setAllBvs] = useState<BV[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPlz, setFilterPlz] = useState('')
  const [filterWartungsstatus, setFilterWartungsstatus] = useState<'all' | 'overdue' | 'due_soon' | 'ok' | 'none'>('all')
  const [filterBvMin, setFilterBvMin] = useState<string>('')
  const [filterBvMax, setFilterBvMax] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)
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
  const [editingObjectCustomerId, setEditingObjectCustomerId] = useState<string | null>(null)
  const [directObjectsUnderCustomer, setDirectObjectsUnderCustomer] = useState<Obj[]>([])
  const [isDirectObjectsLoading, setIsDirectObjectsLoading] = useState(false)
  const [qrObject, setQrObject] = useState<{ obj: Obj; customerId: string; bvId: string | null; customerName: string; bvName: string } | null>(null)
  const [qrBatchSelection, setQrBatchSelection] = useState<Map<string, QrBatchPdfItem>>(() => new Map())
  const [qrBatchPreset, setQrBatchPreset] = useState<QrBatchPreset>('mid')
  const [qrBatchPdfLoading, setQrBatchPdfLoading] = useState(false)
  const [showNeuDropdown, setShowNeuDropdown] = useState(false)
  const [maintenanceReminders, setMaintenanceReminders] = useState<MaintenanceReminder[]>([])
  const [maintenanceContractsCustomer, setMaintenanceContractsCustomer] = useState<MaintenanceContract[]>([])
  const [maintenanceContractsBv, setMaintenanceContractsBv] = useState<MaintenanceContract[]>([])
  const [isContractsCustomerLoading, setIsContractsCustomerLoading] = useState(false)
  const [isContractsBvLoading, setIsContractsBvLoading] = useState(false)
  const [contractModal, setContractModal] = useState<{
    open: boolean
    customerId: string | null
    bvId: string | null
    contract: MaintenanceContract | null
  }>({ open: false, customerId: null, bvId: null, contract: null })
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    message: string
    onConfirm: () => void
  }>({ open: false, title: '', message: '', onConfirm: () => {} })

  const [duplicateObjectDialog, setDuplicateObjectDialog] = useState<{
    open: boolean
    source: Obj | null
    copyPhotos: boolean
    copyProfilePhoto: boolean
    copyDocuments: boolean
    busy: boolean
  }>({ open: false, source: null, copyPhotos: false, copyProfilePhoto: true, copyDocuments: false, busy: false })

  /** Nach Deep-Link (z. B. aus Aufträge) hierhin nach Schließen des Tür/Tor-Modals navigieren */
  const [objectModalReturnTo, setObjectModalReturnTo] = useState<string | null>(null)

  const remindersByObjectId = useMemo(() => {
    const map = new Map<string, MaintenanceReminder>()
    maintenanceReminders.forEach((r) => map.set(r.object_id, r))
    return map
  }, [maintenanceReminders])

  const bvCountByCustomerId = useMemo(() => {
    const map = new Map<string, number>()
    allBvs.forEach((bv) => {
      const cid = bv.customer_id
      map.set(cid, (map.get(cid) ?? 0) + 1)
    })
    return map
  }, [allBvs])

  const customerWartungsstatus = useMemo(() => {
    const map = new Map<string, 'overdue' | 'due_soon' | 'ok' | 'none'>()
    const priority = { overdue: 3, due_soon: 2, ok: 1 }
    maintenanceReminders.forEach((r) => {
      const cid = r.customer_id
      const current = map.get(cid)
      const status = r.status
      const currentP = current && current !== 'none' ? priority[current as keyof typeof priority] : 0
      const newP = priority[status as keyof typeof priority] ?? 0
      if (newP > currentP) map.set(cid, status)
      else if (!current) map.set(cid, status)
    })
    customers.forEach((c) => {
      if (!map.has(c.id)) map.set(c.id, 'none')
    })
    return map
  }, [maintenanceReminders, customers])

  const loadCustomers = useCallback(async () => {
    setIsLoading(true)
    const [customerData, reminderData, bvsData] = await Promise.all([
      fetchCustomers(),
      fetchMaintenanceReminders(),
      fetchAllBvs(),
    ])
    setCustomers(customerData ?? [])
    setMaintenanceReminders(reminderData ?? [])
    setAllBvs(bvsData ?? [])
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
  const urlReturnTo = searchParams.get('returnTo')

  const handleObjectModalFinished = () => {
    setEditingObject(null)
    setEditingObjectBvId(null)
    setEditingObjectCustomerId(null)
    const go = objectModalReturnTo
    setObjectModalReturnTo(null)
    if (go) navigate(go)
  }

  useEffect(() => {
    if (!urlCustomerId || !customers.length) return
    let cancelled = false
    const expandAndOpen = async () => {
      if (urlReturnTo) {
        const raw = decodeURIComponent(urlReturnTo.trim())
        const path = raw.startsWith('/') ? raw : `/${raw}`
        setObjectModalReturnTo(path)
      } else {
        setObjectModalReturnTo(null)
      }
      setExpandedCustomerId(urlCustomerId)
      setExpandedBvId(null)
      setExpandedObjects([])
      setIsBvsLoading(true)
      const bvsData = await fetchBvs(urlCustomerId)
      if (cancelled) return
      setExpandedBvs(bvsData ?? [])
      setIsBvsLoading(false)
      const [direct, contracts] = await Promise.all([
        fetchObjectsDirectUnderCustomer(urlCustomerId),
        fetchMaintenanceContractsByCustomer(urlCustomerId),
      ])
      if (!cancelled) {
        setDirectObjectsUnderCustomer(direct ?? [])
        setMaintenanceContractsCustomer(contracts ?? [])
      }
      if ((bvsData ?? []).length === 0 && urlObjectId && direct?.length) {
        const obj = direct.find((o) => o.id === urlObjectId)
        if (obj) {
          setEditingObject(obj)
          setEditingObjectBvId(null)
          setEditingObjectCustomerId(urlCustomerId)
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev)
            next.delete('customerId')
            next.delete('bvId')
            next.delete('objectId')
            next.delete('returnTo')
            return next
          }, { replace: true })
        }
      }
      if (!urlBvId) return
      const bv = (bvsData ?? []).find((b) => b.id === urlBvId)
      if (!bv) return
      setExpandedBvId(urlBvId)
      setIsObjectsLoading(true)
      setIsContractsBvLoading(true)
      const [objData, contractData] = await Promise.all([
        fetchObjects(urlBvId),
        fetchMaintenanceContractsByBv(urlBvId),
      ])
      if (cancelled) return
      setExpandedObjects(objData ?? [])
      setMaintenanceContractsBv(contractData ?? [])
      setIsObjectsLoading(false)
      setIsContractsBvLoading(false)
      if (urlObjectId) {
        const obj = (objData ?? []).find((o) => o.id === urlObjectId)
        if (obj) {
          setEditingObject(obj)
          setEditingObjectBvId(urlBvId)
          setEditingObjectCustomerId(urlCustomerId)
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev)
            next.delete('customerId')
            next.delete('bvId')
            next.delete('objectId')
            next.delete('returnTo')
            return next
          }, { replace: true })
        }
      }
    }
    expandAndOpen()
    return () => { cancelled = true }
  }, [urlCustomerId, urlBvId, urlObjectId, urlReturnTo, customers.length, setSearchParams])

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
  const matchStr = useCallback(
    (v: string | null | undefined) => (v ?? '').toLowerCase().includes(searchLower),
    [searchLower]
  )
  const filteredCustomers = useMemo(() => {
    let list = customers
    if (searchLower) {
      list = list.filter((c) =>
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
    }
    if (filterPlz.trim()) {
      const plzLower = filterPlz.trim().toLowerCase()
      list = list.filter((c) => (c.postal_code ?? '').toLowerCase().includes(plzLower))
    }
    if (filterWartungsstatus !== 'all') {
      list = list.filter((c) => customerWartungsstatus.get(c.id) === filterWartungsstatus)
    }
    const bvMin = filterBvMin.trim() ? parseInt(filterBvMin, 10) : null
    const bvMax = filterBvMax.trim() ? parseInt(filterBvMax, 10) : null
    if (bvMin != null && !Number.isNaN(bvMin)) {
      list = list.filter((c) => (bvCountByCustomerId.get(c.id) ?? 0) >= bvMin)
    }
    if (bvMax != null && !Number.isNaN(bvMax)) {
      list = list.filter((c) => (bvCountByCustomerId.get(c.id) ?? 0) <= bvMax)
    }
    return list
  }, [
    customers,
    searchLower,
    filterPlz,
    filterWartungsstatus,
    filterBvMin,
    filterBvMax,
    customerWartungsstatus,
    bvCountByCustomerId,
    matchStr,
  ])

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

  const handleResetFilters = () => {
    setFilterPlz('')
    setFilterWartungsstatus('all')
    setFilterBvMin('')
    setFilterBvMax('')
  }

  const hasActiveFilters =
    filterPlz.trim() !== '' ||
    filterWartungsstatus !== 'all' ||
    filterBvMin.trim() !== '' ||
    filterBvMax.trim() !== ''

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
            reported_from: typeof window !== 'undefined' ? window.location.origin : undefined,
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
      monteur_report_internal_only: customer.monteur_report_internal_only ?? false,
      monteur_report_portal: customer.monteur_report_portal !== false,
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
    setFormData((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'monteur_report_internal_only' && value === true) {
        next.monteur_report_portal = false
      }
      return next
    })
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
      monteur_report_internal_only: formData.monteur_report_internal_only,
      monteur_report_portal: formData.monteur_report_internal_only ? false : formData.monteur_report_portal,
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

  const handleArchiveCustomer = async (id: string) => {
    const { error } = await archiveCustomer(id)
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
      setDirectObjectsUnderCustomer([])
      setMaintenanceContractsCustomer([])
      setMaintenanceContractsBv([])
      return
    }
    setExpandedCustomerId(customerId)
    setExpandedBvId(null)
    setExpandedObjects([])
    setIsBvsLoading(true)
    setIsDirectObjectsLoading(true)
    setIsContractsCustomerLoading(true)
    const [bvsData, directData, contractsData] = await Promise.all([
      fetchBvs(customerId),
      fetchObjectsDirectUnderCustomer(customerId),
      fetchMaintenanceContractsByCustomer(customerId),
    ])
    setExpandedBvs(bvsData ?? [])
    setDirectObjectsUnderCustomer(directData ?? [])
    setMaintenanceContractsCustomer(contractsData ?? [])
    setIsBvsLoading(false)
    setIsDirectObjectsLoading(false)
    setIsContractsCustomerLoading(false)
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

  const handleArchiveBv = async (id: string) => {
    const { error } = await archiveBv(id)
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
      setMaintenanceContractsBv([])
      return
    }
    setExpandedBvId(bvId)
    setIsObjectsLoading(true)
    setIsContractsBvLoading(true)
    const [objData, contractData] = await Promise.all([
      fetchObjects(bvId),
      fetchMaintenanceContractsByBv(bvId),
    ])
    setExpandedObjects(objData ?? [])
    setMaintenanceContractsBv(contractData ?? [])
    setIsObjectsLoading(false)
    setIsContractsBvLoading(false)
  }

  const reloadExpandedObjects = async () => {
    if (!expandedBvId) return
    const data = await fetchObjects(expandedBvId)
    setExpandedObjects(data ?? [])
  }

  const handleOpenDuplicateObjectDialog = (obj: Obj) => {
    setDuplicateObjectDialog({
      open: true,
      source: obj,
      copyPhotos: false,
      copyProfilePhoto: true,
      copyDocuments: false,
      busy: false,
    })
  }

  const handleDuplicateObjectDialogClose = () => {
    if (duplicateObjectDialog.busy) return
    setDuplicateObjectDialog({
      open: false,
      source: null,
      copyPhotos: false,
      copyProfilePhoto: true,
      copyDocuments: false,
      busy: false,
    })
  }

  const handleDuplicateObjectConfirm = async () => {
    const src = duplicateObjectDialog.source
    const copyGallery = duplicateObjectDialog.copyPhotos
    const copyProfile = duplicateObjectDialog.copyProfilePhoto
    const copyDocs = duplicateObjectDialog.copyDocuments
    if (!src || duplicateObjectDialog.busy) return
    setDuplicateObjectDialog((d) => ({ ...d, busy: true }))
    const { data, error } = await duplicateObjectFromSource(src.id, {
      copyGalleryPhotos: copyGallery,
      copyProfilePhoto: copyProfile,
      copyDocuments: copyDocs,
    })
    setDuplicateObjectDialog({
      open: false,
      source: null,
      copyPhotos: false,
      copyProfilePhoto: true,
      copyDocuments: false,
      busy: false,
    })
    if (error) {
      showError(error.message)
      return
    }
    if (data) {
      showToast('Kopie angelegt.', 'success')
    }
    if (!expandedCustomerId) return
    if (src.bv_id && expandedBvId === src.bv_id) {
      await reloadExpandedObjects()
    }
    const direct = await fetchObjectsDirectUnderCustomer(expandedCustomerId)
    setDirectObjectsUnderCustomer(direct ?? [])
  }

  const toggleQrBatchItem = useCallback((item: QrBatchPdfItem) => {
    const key = makeQrBatchKey(item.customerId, item.bvId, item.objectId)
    setQrBatchSelection((prev) => {
      const next = new Map(prev)
      if (next.has(key)) next.delete(key)
      else next.set(key, item)
      return next
    })
  }, [])

  const handleDownloadQrBatchPdf = useCallback(async () => {
    if (qrBatchSelection.size === 0) return
    setQrBatchPdfLoading(true)
    try {
      const blob = await generateQrBatchA4Pdf({
        items: Array.from(qrBatchSelection.values()),
        preset: qrBatchPreset,
        brandLine: design?.app_name ?? undefined,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `QR-Etiketten-${new Date().toISOString().slice(0, 10)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'PDF konnte nicht erzeugt werden.')
    } finally {
      setQrBatchPdfLoading(false)
    }
  }, [qrBatchSelection, qrBatchPreset, design?.app_name, showError])

  const customerCountForLicense = customers.filter((c) => !c.demo_user_id).length

  return (
    <div className="p-4 min-w-0">
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
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Kunden</h2>
          {canUseQrBatch && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
              A4-PDF: Türen/Tore ankreuzen, Etikettgröße wählen und PDF herunterladen (Lizenz „A4-QR-Etiketten“).
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <input
            type="search"
            placeholder="Name, Ort, Adresse, Kontakt…"
            value={searchQuery}
            onChange={handleSearchChange}
            className="flex-1 sm:w-48 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
            aria-label="Kunden suchen"
          />
          {canEdit && (
            <div className="relative">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowNeuDropdown((v) => !v) }}
                className="px-4 py-2.5 min-h-[40px] bg-vico-button dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg hover:bg-vico-button-hover dark:hover:bg-slate-600 font-medium border border-slate-300 dark:border-slate-600 flex items-center gap-1"
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
                  className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 shadow-lg py-1 z-40"
                  role="menu"
                >
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setShowNeuDropdown(false); handleOpenCreate() }}
                    className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50"
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
                      className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
                      role="menuitem"
                      title={!expandedCustomerId ? 'Kunde zuerst ausklappen' : undefined}
                    >
                      Neues Objekt/BV
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowNeuDropdown(false)
                      if (!expandedCustomerId) return
                      setEditingObject(null)
                      if (expandedBvId) {
                        setEditingObjectBvId(expandedBvId)
                        setEditingObjectCustomerId(null)
                      } else {
                        setEditingObjectBvId(null)
                        setEditingObjectCustomerId(expandedCustomerId)
                      }
                    }}
                    disabled={!expandedCustomerId || ((expandedBvs?.length ?? 0) > 0 && !expandedBvId)}
                    className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    role="menuitem"
                    title={
                      !expandedCustomerId
                        ? 'Kunde zuerst ausklappen'
                        : (expandedBvs?.length ?? 0) > 0 && !expandedBvId
                          ? 'Objekt/BV ausklappen oder Kunde ohne Objekte/BV wählen'
                          : undefined
                    }
                  >
                    Neues Tür/Tor
                  </button>
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`px-3 py-2 rounded-lg border text-sm font-medium flex items-center gap-1.5 ${
              hasActiveFilters
                ? 'bg-vico-primary/20 border-vico-primary text-slate-800 dark:text-slate-100'
                : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200'
            }`}
            aria-expanded={showFilters}
            aria-label="Filter anzeigen"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filter
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-vico-primary" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="mb-4 p-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex flex-wrap gap-4 items-end">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">PLZ</span>
              <input
                type="text"
                placeholder="z.B. 10115"
                value={filterPlz}
                onChange={(e) => setFilterPlz(e.target.value)}
                className="w-28 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
                aria-label="PLZ filtern"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Wartungsstatus</span>
              <select
                value={filterWartungsstatus}
                onChange={(e) => setFilterWartungsstatus(e.target.value as typeof filterWartungsstatus)}
                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vico-primary bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 min-w-[140px]"
                aria-label="Wartungsstatus filtern"
              >
                <option value="all">Alle</option>
                <option value="overdue">Überfällig</option>
                <option value="due_soon">Demnächst fällig</option>
                <option value="ok">In Ordnung</option>
                <option value="none">Keine Wartung</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">BV-Anzahl</span>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  min={0}
                  placeholder="Min"
                  value={filterBvMin}
                  onChange={(e) => setFilterBvMin(e.target.value)}
                  className="w-20 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
                  aria-label="Mindestanzahl BVs"
                />
                <span className="text-slate-500">–</span>
                <input
                  type="number"
                  min={0}
                  placeholder="Max"
                  value={filterBvMax}
                  onChange={(e) => setFilterBvMax(e.target.value)}
                  className="w-20 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
                  aria-label="Maximalanzahl BVs"
                />
              </div>
            </label>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 underline"
                aria-label="Filter zurücksetzen"
              >
                Filter zurücksetzen
              </button>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <LoadingSpinner message="Lade Kunden…" className="py-8" />
      ) : filteredCustomers.length === 0 ? (
        <EmptyState
          title={
            searchQuery
              ? 'Keine Kunden gefunden.'
              : hasActiveFilters
                ? 'Keine Kunden entsprechen den Filtern.'
                : 'Noch keine Kunden angelegt.'
          }
          description={
            !searchQuery && !hasActiveFilters
              ? 'Klicken Sie auf „+ Neu" → „Neuer Kunde“, um zu starten.'
              : hasActiveFilters
                ? 'Filter anpassen oder zurücksetzen.'
                : undefined
          }
          className="py-8"
        />
      ) : (
        <ul className="space-y-2">
          {filteredCustomers.map((customer) => {
            const isExpanded = expandedCustomerId === customer.id
            return (
              <li
                key={customer.id}
                className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => handleToggleBvs(customer.id)}
                  className="w-full p-4 flex items-center justify-between gap-2 text-left text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                  aria-expanded={isExpanded}
                  aria-label={`Objekt/BV für ${customer.name} ${isExpanded ? 'einklappen' : 'ausklappen'}`}
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
                      <p className="font-medium text-slate-800 dark:text-slate-100">
                        {customer.name}
                        <span className="ml-2 text-slate-400 dark:text-slate-500 font-normal text-sm">
                          ({bvCountByCustomerId.get(customer.id) ?? 0} BV{bvCountByCustomerId.get(customer.id) !== 1 ? 's' : ''})
                        </span>
                      </p>
                      {(customer.street || customer.house_number || customer.postal_code || customer.city) && (
                        <p className="text-sm text-slate-500 dark:text-slate-400">
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
                          className="px-3 py-2 text-sm min-h-[36px] inline-flex items-center text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/40"
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
                              title: 'Kunde archivieren',
                              message:
                                'Kunden inkl. aller Objekte/BV und Türen/Tore archivieren? Stammdaten verschwinden aus den Listen; Aufträge und Wartungsprotokolle bleiben erhalten. Nur online möglich.',
                              onConfirm: () => {
                                setConfirmDialog((c) => ({ ...c, open: false }))
                                handleArchiveCustomer(customer.id)
                              },
                            })
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.stopPropagation()
                              e.preventDefault()
                              setConfirmDialog({
                                open: true,
                                title: 'Kunde archivieren',
                                message:
                                  'Kunden inkl. aller Objekte/BV und Türen/Tore archivieren? Stammdaten verschwinden aus den Listen; Aufträge und Wartungsprotokolle bleiben erhalten. Nur online möglich.',
                                onConfirm: () => {
                                  setConfirmDialog((c) => ({ ...c, open: false }))
                                  handleArchiveCustomer(customer.id)
                                },
                              })
                            }
                          }}
                          className="px-3 py-2 text-sm min-h-[36px] inline-flex items-center text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                          aria-label={`${customer.name} archivieren`}
                        >
                          Archivieren
                        </span>
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/40 px-4 py-3">
                    {isBvsLoading ? (
                      <LoadingSpinner message="Lade BVs…" size="sm" className="py-2" />
                    ) : filteredBvs.length === 0 ? (
                      <div className="py-4 space-y-4">
                        <div className="flex flex-col items-start gap-3">
                          <EmptyState
                            title={searchLower ? 'Keine Objekte/BV gefunden.' : 'Noch keine Objekte/BV angelegt.'}
                            className="py-2 items-start"
                          />
                          {canCreateBv && (
                            <button
                              type="button"
                              onClick={handleOpenBvCreate}
                              className="px-3 py-2 text-sm bg-vico-button dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg hover:bg-vico-button-hover dark:hover:bg-slate-600 font-medium border border-slate-300 dark:border-slate-600"
                            >
                              + Objekt/BV anlegen
                            </button>
                          )}
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Türen/Tore direkt unter Kunde</h4>
                          {isDirectObjectsLoading ? (
                            <LoadingSpinner message="Lade Türen/Tore…" size="sm" className="py-2" />
                          ) : directObjectsUnderCustomer.length === 0 ? (
                            <p className="text-sm text-slate-500 py-2">Noch keine Türen/Tore direkt unter diesem Kunden.</p>
                          ) : (
                            <ul className="space-y-1.5">
                              {directObjectsUnderCustomer.map((obj) => (
                                <li
                                  key={obj.id}
                                  className="bg-white dark:bg-slate-900/80 rounded border border-slate-200 dark:border-slate-600 p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                                >
                                  <div className="min-w-0 flex items-center gap-2">
                                    {canUseQrBatch && (
                                      <label className="shrink-0 flex items-center cursor-pointer" title="Für A4-Sammel-PDF auswählen">
                                        <input
                                          type="checkbox"
                                          checked={qrBatchSelection.has(makeQrBatchKey(customer.id, null, obj.id))}
                                          onChange={() =>
                                            toggleQrBatchItem({
                                              customerId: customer.id,
                                              bvId: null,
                                              objectId: obj.id,
                                              objectName: getObjectDisplayName(obj),
                                              customerName: customer.name,
                                              bvName: '',
                                            })
                                          }
                                          className="rounded border-slate-400 text-vico-primary focus:ring-vico-primary"
                                          aria-label={`${getObjectDisplayName(obj)} für A4-PDF auswählen`}
                                        />
                                      </label>
                                    )}
                                    <ObjectProfileThumbInline path={obj.profile_photo_path} />
                                    {(() => {
                                      const reminder = remindersByObjectId.get(obj.id)
                                      const status = reminder?.status
                                      const title = reminder
                                        ? status === 'overdue'
                                          ? `Überfällig`
                                          : status === 'due_soon'
                                            ? `Bald fällig`
                                            : 'Wartung in Ordnung'
                                        : 'Kein Wartungsintervall'
                                      const dotClass = status === 'overdue' ? 'bg-red-500' : status === 'due_soon' ? 'bg-amber-500' : 'bg-green-500'
                                      return (
                                        <span className={`shrink-0 w-2.5 h-2.5 rounded-full ${reminder ? dotClass : 'bg-slate-200'}`} title={title} aria-label={title} />
                                      )
                                    })()}
                                    <div>
                                      <p className="font-medium text-slate-600 dark:text-slate-300 text-xs">{getObjectDisplayName(obj)}</p>
                                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{formatObjectRoomFloor(obj)}</p>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {canEdit && (
                                      <button
                                        type="button"
                                        onClick={() => { setEditingObject(obj); setEditingObjectBvId(null); setEditingObjectCustomerId(customer.id) }}
                                        className="px-2.5 py-1.5 min-h-[32px] inline-flex items-center text-xs text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                        aria-label={`${getObjectDisplayName(obj)} bearbeiten`}
                                      >
                                        Bearbeiten
                                      </button>
                                    )}
                                    {canEdit && (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenDuplicateObjectDialog(obj)}
                                        className="px-2.5 py-1.5 min-h-[32px] inline-flex items-center text-xs text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                        aria-label={`${getObjectDisplayName(obj)} kopieren`}
                                      >
                                        Kopie
                                      </button>
                                    )}
                                    {isEnabled('auftrag') && (
                                      <Link
                                        to={`/auftrag/neu-aus-qr?customerId=${customer.id}&objectId=${obj.id}`}
                                        className="px-2.5 py-1.5 min-h-[32px] inline-flex items-center text-xs text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                      >
                                        Wartung / Reparatur
                                      </Link>
                                    )}
                                    {isEnabled('wartungsprotokolle') && (
                                      <Link
                                        to={`/kunden/${customer.id}/objekte/${obj.id}/wartung`}
                                        className="px-2.5 py-1.5 min-h-[32px] inline-flex items-center text-xs text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                      >
                                        Protokoll
                                      </Link>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => setQrObject({ obj, customerId: customer.id, bvId: null, customerName: customer.name, bvName: '' })}
                                      className="px-2.5 py-1.5 min-h-[32px] inline-flex items-center text-xs text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                      aria-label="QR-Code anzeigen"
                                    >
                                      QR-Code
                                    </button>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => { setEditingObject(null); setEditingObjectBvId(null); setEditingObjectCustomerId(customer.id) }}
                              className="mt-2 inline-flex items-center px-4 py-2.5 min-h-[40px] text-sm bg-vico-button dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg hover:bg-vico-button-hover dark:hover:bg-slate-600 font-medium border border-slate-300 dark:border-slate-600"
                            >
                              + Tür/Tor anlegen
                            </button>
                          )}
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Wartungsverträge</h4>
                          {isContractsCustomerLoading ? (
                            <LoadingSpinner message="Lade Verträge…" size="sm" className="py-2" />
                          ) : maintenanceContractsCustomer.length === 0 ? (
                            <p className="text-sm text-slate-500 py-2">Noch keine Wartungsverträge.</p>
                          ) : (
                            <ul className="space-y-1.5">
                              {maintenanceContractsCustomer.map((c) => (
                                <li
                                  key={c.id}
                                  className="bg-white dark:bg-slate-900/80 rounded border border-slate-200 dark:border-slate-600 p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                                >
                                  <div>
                                    <p className="font-medium text-slate-600 dark:text-slate-300 text-xs">{c.contract_number}</p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                      {c.start_date}{c.end_date ? ` – ${c.end_date}` : ''}
                                    </p>
                                  </div>
                                  <div className="flex gap-1">
                                    {canEdit && (
                                      <button
                                        type="button"
                                        onClick={() => setContractModal({ open: true, customerId: customer.id, bvId: null, contract: c })}
                                        className="px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                        aria-label="Vertrag bearbeiten"
                                      >
                                        Bearbeiten
                                      </button>
                                    )}
                                    {canDelete && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setConfirmDialog({
                                            open: true,
                                            title: 'Wartungsvertrag löschen',
                                            message: `Vertrag ${c.contract_number} wirklich löschen?`,
                                            onConfirm: async () => {
                                              setConfirmDialog((d) => ({ ...d, open: false }))
                                              await deleteMaintenanceContract(c.id)
                                              const list = await fetchMaintenanceContractsByCustomer(customer.id)
                                              setMaintenanceContractsCustomer(list ?? [])
                                            },
                                          })
                                        }
                                        className="px-2.5 py-1.5 text-xs text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                                        aria-label="Vertrag löschen"
                                      >
                                        Löschen
                                      </button>
                                    )}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => setContractModal({ open: true, customerId: customer.id, bvId: null, contract: null })}
                              className="mt-2 inline-flex items-center px-4 py-2.5 min-h-[40px] text-sm bg-vico-button dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg hover:bg-vico-button-hover dark:hover:bg-slate-600 font-medium border border-slate-300 dark:border-slate-600"
                            >
                              + Wartungsvertrag anlegen
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        {directObjectsUnderCustomer.length > 0 && (
                          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                            <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2">
                              Türen/Tore direkt unter Kunde (noch keinem Objekt/BV zugeordnet)
                            </h4>
                            <p className="text-xs text-amber-700 dark:text-amber-300/90 mb-2">
                              Diese Türen einem Objekt/BV zuordnen: Bearbeiten → Zuordnung auswählen → Speichern.
                            </p>
                            {isDirectObjectsLoading ? (
                              <LoadingSpinner message="Lade…" size="sm" className="py-2" />
                            ) : (
                              <ul className="space-y-1.5">
                                {directObjectsUnderCustomer.map((obj) => (
                                  <li
                                    key={obj.id}
                                    className="bg-white dark:bg-slate-900/80 rounded border border-amber-200 dark:border-amber-800 p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                                  >
                                    <div className="min-w-0 flex items-center gap-2">
                                      {canUseQrBatch && (
                                        <label className="shrink-0 flex items-center cursor-pointer" title="Für A4-Sammel-PDF auswählen">
                                          <input
                                            type="checkbox"
                                            checked={qrBatchSelection.has(makeQrBatchKey(customer.id, null, obj.id))}
                                            onChange={() =>
                                              toggleQrBatchItem({
                                                customerId: customer.id,
                                                bvId: null,
                                                objectId: obj.id,
                                                objectName: getObjectDisplayName(obj),
                                                customerName: customer.name,
                                                bvName: '',
                                              })
                                            }
                                            className="rounded border-slate-400 text-vico-primary focus:ring-vico-primary"
                                            aria-label={`${getObjectDisplayName(obj)} für A4-PDF auswählen`}
                                          />
                                        </label>
                                      )}
                                      <ObjectProfileThumbInline path={obj.profile_photo_path} />
                                      {(() => {
                                        const reminder = remindersByObjectId.get(obj.id)
                                        const status = reminder?.status
                                        const title = reminder
                                          ? status === 'overdue'
                                            ? 'Überfällig'
                                            : status === 'due_soon'
                                              ? 'Bald fällig'
                                              : 'Wartung in Ordnung'
                                          : 'Kein Wartungsintervall'
                                        const dotClass = status === 'overdue' ? 'bg-red-500' : status === 'due_soon' ? 'bg-amber-500' : 'bg-green-500'
                                        return (
                                          <span className={`shrink-0 w-2.5 h-2.5 rounded-full ${reminder ? dotClass : 'bg-slate-200'}`} title={title} aria-label={title} />
                                        )
                                      })()}
                                      <div>
                                        <p className="font-medium text-slate-600 dark:text-slate-300 text-xs">{getObjectDisplayName(obj)}</p>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{formatObjectRoomFloor(obj)}</p>
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {canEdit && (
                                        <button
                                          type="button"
                                          onClick={() => { setEditingObject(obj); setEditingObjectBvId(null); setEditingObjectCustomerId(customer.id) }}
                                          className="px-2.5 py-1.5 min-h-[32px] inline-flex items-center text-xs text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                          aria-label={`${getObjectDisplayName(obj)} bearbeiten`}
                                        >
                                          Bearbeiten (Objekt/BV zuordnen)
                                        </button>
                                      )}
                                      {canEdit && (
                                        <button
                                          type="button"
                                          onClick={() => handleOpenDuplicateObjectDialog(obj)}
                                          className="px-2.5 py-1.5 min-h-[32px] inline-flex items-center text-xs text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                          aria-label={`${getObjectDisplayName(obj)} kopieren`}
                                        >
                                          Kopie
                                        </button>
                                      )}
                                      {isEnabled('auftrag') && (
                                        <Link
                                          to={`/auftrag/neu-aus-qr?customerId=${customer.id}&objectId=${obj.id}`}
                                          className="px-2.5 py-1.5 min-h-[32px] inline-flex items-center text-xs text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                        >
                                          Wartung / Reparatur
                                        </Link>
                                      )}
                                      {isEnabled('wartungsprotokolle') && (
                                        <Link
                                          to={`/kunden/${customer.id}/objekte/${obj.id}/wartung`}
                                          className="px-2.5 py-1.5 min-h-[32px] inline-flex items-center text-xs text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                        >
                                          Protokoll
                                        </Link>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => setQrObject({ obj, customerId: customer.id, bvId: null, customerName: customer.name, bvName: '' })}
                                        className="px-2.5 py-1.5 min-h-[32px] inline-flex items-center text-xs text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                        aria-label="QR-Code anzeigen"
                                      >
                                        QR-Code
                                      </button>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                        <ul className="space-y-2">
                          {filteredBvs.map((bv) => {
                            const isBvExpanded = expandedBvId === bv.id
                            return (
                              <li
                                key={bv.id}
                                className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden"
                              >
                                <button
                                  type="button"
                                  onClick={() => handleToggleObjects(bv.id)}
                                  className="w-full p-3 flex items-center justify-between gap-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                                  aria-expanded={isBvExpanded}
                                  aria-label={`Türen/Tore für ${bv.name} ${isBvExpanded ? 'einklappen' : 'ausklappen'}`}
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
                                      <p className="font-medium text-slate-700 dark:text-slate-200 text-sm">{bv.name}</p>
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
                                          className="px-3 py-1.5 text-sm min-h-[32px] inline-flex items-center text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/40"
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
                                              title: 'Objekt/BV archivieren',
                                              message:
                                                'Objekt/BV und alle zugehörigen Türen/Tore archivieren? Listen werden bereinigt; Historie bleibt. Nur online möglich.',
                                              onConfirm: () => {
                                                setConfirmDialog((c) => ({ ...c, open: false }))
                                                handleArchiveBv(bv.id)
                                              },
                                            })
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                              e.stopPropagation()
                                              e.preventDefault()
                                              setConfirmDialog({
                                                open: true,
                                                title: 'Objekt/BV archivieren',
                                                message:
                                                  'Objekt/BV und alle zugehörigen Türen/Tore archivieren? Listen werden bereinigt; Historie bleibt. Nur online möglich.',
                                                onConfirm: () => {
                                                  setConfirmDialog((c) => ({ ...c, open: false }))
                                                  handleArchiveBv(bv.id)
                                                },
                                              })
                                            }
                                          }}
                                          className="px-3 py-1.5 text-sm min-h-[32px] inline-flex items-center text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                                          aria-label={`${bv.name} archivieren`}
                                        >
                                          Archivieren
                                        </span>
                                    )}
                                  </div>
                                </button>

                                {isBvExpanded && (
                                  <div className="border-t border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/40 px-3 py-2">
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
                                            className="px-4 py-2.5 min-h-[40px] inline-flex items-center text-sm bg-vico-button dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg hover:bg-vico-button-hover dark:hover:bg-slate-600 font-medium border border-slate-300 dark:border-slate-600"
                                          >
                                            + Tür/Tor anlegen
                                          </button>
                                        )}
                                      </div>
                                    ) : (
                                      <>
                                        <ul className="space-y-1.5">
                                          {filteredObjects.map((obj) => (
                                            <li
                                              key={obj.id}
                                              className="bg-white dark:bg-slate-900/80 rounded border border-slate-200 dark:border-slate-600 p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                                            >
                                              <div className="min-w-0 flex items-center gap-2">
                                                {canUseQrBatch && (
                                                  <label className="shrink-0 flex items-center cursor-pointer" title="Für A4-Sammel-PDF auswählen">
                                                    <input
                                                      type="checkbox"
                                                      checked={qrBatchSelection.has(makeQrBatchKey(customer.id, bv.id, obj.id))}
                                                      onChange={() =>
                                                        toggleQrBatchItem({
                                                          customerId: customer.id,
                                                          bvId: bv.id,
                                                          objectId: obj.id,
                                                          objectName: getObjectDisplayName(obj),
                                                          customerName: customer.name,
                                                          bvName: bv.name,
                                                        })
                                                      }
                                                      className="rounded border-slate-400 text-vico-primary focus:ring-vico-primary"
                                                      aria-label={`${getObjectDisplayName(obj)} für A4-PDF auswählen`}
                                                    />
                                                  </label>
                                                )}
                                                <ObjectProfileThumbInline path={obj.profile_photo_path} />
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
                                                  <p className="font-medium text-slate-600 dark:text-slate-300 text-xs">{getObjectDisplayName(obj)}</p>
                                                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                    {formatObjectRoomFloor(obj)}
                                                  </p>
                                                </div>
                                              </div>
                                              <div className="flex flex-wrap gap-1">
                                                {canEdit && (
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      setEditingObject(obj)
                                                      setEditingObjectBvId(bv.id)
                                                      setEditingObjectCustomerId(customer.id)
                                                    }}
                                                    className="px-2.5 py-1.5 min-h-[32px] inline-flex items-center text-xs text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                                    aria-label={`${getObjectDisplayName(obj)} bearbeiten`}
                                                  >
                                                    Bearbeiten
                                                  </button>
                                                )}
                                                {canEdit && (
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      handleOpenDuplicateObjectDialog(obj)
                                                    }}
                                                    className="px-2.5 py-1.5 min-h-[32px] inline-flex items-center text-xs text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                                    aria-label={`${getObjectDisplayName(obj)} kopieren`}
                                                  >
                                                    Kopie
                                                  </button>
                                                )}
                                                {isEnabled('auftrag') && (
                                                  <Link
                                                    to={`/auftrag/neu-aus-qr?customerId=${customer.id}&bvId=${bv.id}&objectId=${obj.id}`}
                                                    className="px-2.5 py-1.5 min-h-[32px] inline-flex items-center text-xs text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                                  >
                                                    Wartung / Reparatur
                                                  </Link>
                                                )}
                                                {isEnabled('wartungsprotokolle') && (
                                                  <Link
                                                    to={`/kunden/${customer.id}/bvs/${bv.id}/objekte/${obj.id}/wartung`}
                                                    className="px-2.5 py-1.5 min-h-[32px] inline-flex items-center text-xs text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                                  >
                                                    Protokoll
                                                  </Link>
                                                )}
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    setQrObject({ obj, customerId: customer.id, bvId: bv.id, customerName: customer.name, bvName: bv.name })
                                                  }}
                                                  className="px-2.5 py-1.5 min-h-[32px] inline-flex items-center text-xs text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50"
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
                                            onClick={() => {
                                              setEditingObject(null)
                                              setEditingObjectBvId(bv.id)
                                              setEditingObjectCustomerId(customer.id)
                                            }}
                                            className="mt-2 inline-flex items-center px-4 py-2.5 min-h-[40px] text-sm bg-vico-button dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg hover:bg-vico-button-hover dark:hover:bg-slate-600 font-medium border border-slate-300 dark:border-slate-600"
                                          >
                                            + Tür/Tor anlegen
                                          </button>
                                        )}
                                      </>
                                    )}
                                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600">
                                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Wartungsverträge</h4>
                                      {isContractsBvLoading ? (
                                        <LoadingSpinner message="Lade Verträge…" size="sm" className="py-2" />
                                      ) : maintenanceContractsBv.length === 0 ? (
                                        <p className="text-sm text-slate-500 py-2">Noch keine Wartungsverträge.</p>
                                      ) : (
                                        <ul className="space-y-1.5">
                                          {maintenanceContractsBv.map((c) => (
                                            <li
                                              key={c.id}
                                              className="bg-white dark:bg-slate-900/80 rounded border border-slate-200 dark:border-slate-600 p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                                            >
                                              <div>
                                                <p className="font-medium text-slate-600 dark:text-slate-300 text-xs">{c.contract_number}</p>
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                  {c.start_date}{c.end_date ? ` – ${c.end_date}` : ''}
                                                </p>
                                              </div>
                                              <div className="flex gap-1">
                                                {canEdit && (
                                                  <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); setContractModal({ open: true, customerId: null, bvId: bv.id, contract: c }) }}
                                                    className="px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                                    aria-label="Vertrag bearbeiten"
                                                  >
                                                    Bearbeiten
                                                  </button>
                                                )}
                                                {canDelete && (
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      setConfirmDialog({
                                                        open: true,
                                                        title: 'Wartungsvertrag löschen',
                                                        message: `Vertrag ${c.contract_number} wirklich löschen?`,
                                                        onConfirm: async () => {
                                                          setConfirmDialog((d) => ({ ...d, open: false }))
                                                          await deleteMaintenanceContract(c.id)
                                                          const list = await fetchMaintenanceContractsByBv(bv.id)
                                                          setMaintenanceContractsBv(list ?? [])
                                                        },
                                                      })
                                                    }}
                                                    className="px-2.5 py-1.5 text-xs text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                                                    aria-label="Vertrag löschen"
                                                  >
                                                    Löschen
                                                  </button>
                                                )}
                                              </div>
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                      {canEdit && (
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); setContractModal({ open: true, customerId: null, bvId: bv.id, contract: null }) }}
                                          className="mt-2 inline-flex items-center px-4 py-2.5 min-h-[40px] text-sm bg-vico-button dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg hover:bg-vico-button-hover dark:hover:bg-slate-600 font-medium border border-slate-300 dark:border-slate-600"
                                        >
                                          + Wartungsvertrag anlegen
                                        </button>
                                      )}
                                    </div>
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
                            className="mt-2 px-3 py-2 text-sm bg-vico-button dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg hover:bg-vico-button-hover dark:hover:bg-slate-600 font-medium border border-slate-300 dark:border-slate-600"
                          >
                            + Objekt/BV anlegen
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

      {duplicateObjectDialog.open && duplicateObjectDialog.source ? (
        <div
          className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 p-4"
          role="button"
          tabIndex={0}
          onClick={() => handleDuplicateObjectDialogClose()}
          onKeyDown={(e) => {
            if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleDuplicateObjectDialogClose()
            }
          }}
          aria-label="Dialog schließen"
        >
          <div
            role="dialog"
            aria-modal
            aria-labelledby="dup-object-title"
            className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full min-w-0 p-4 border border-slate-200 dark:border-slate-600"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="dup-object-title" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              Tür/Tor kopieren
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Es wird eine neue Tür/Tor mit eigener ID angelegt; die Stammdaten werden übernommen. Die Bezeichnung
              erhält den Zusatz „(Duplikat)“, die interne ID einen eindeutigen Suffix. Wählen Sie unten, was zusätzlich
              kopiert werden soll (jeweils eigene Dateien im Speicher).
            </p>
            <div className="mt-4 space-y-3">
              <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-slate-400 text-vico-primary focus:ring-vico-primary"
                  checked={duplicateObjectDialog.copyProfilePhoto}
                  disabled={duplicateObjectDialog.busy}
                  onChange={(e) =>
                    setDuplicateObjectDialog((d) =>
                      d.source ? { ...d, copyProfilePhoto: e.target.checked } : d
                    )
                  }
                  aria-describedby="dup-profile-hint"
                />
                <span>
                  Profilfoto übernehmen
                  <span id="dup-profile-hint" className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Nur sinnvoll, wenn an der Quelle ein Profilbild hinterlegt ist.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-slate-400 text-vico-primary focus:ring-vico-primary"
                  checked={duplicateObjectDialog.copyPhotos}
                  disabled={duplicateObjectDialog.busy}
                  onChange={(e) =>
                    setDuplicateObjectDialog((d) =>
                      d.source ? { ...d, copyPhotos: e.target.checked } : d
                    )
                  }
                  aria-describedby="dup-gallery-hint"
                />
                <span>
                  Galerie-Fotos übernehmen
                  <span id="dup-gallery-hint" className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Normale Objekt-Fotos (Galerie), nicht Profilfoto und nicht Dokumente.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-slate-400 text-vico-primary focus:ring-vico-primary"
                  checked={duplicateObjectDialog.copyDocuments}
                  disabled={duplicateObjectDialog.busy}
                  onChange={(e) =>
                    setDuplicateObjectDialog((d) =>
                      d.source ? { ...d, copyDocuments: e.target.checked } : d
                    )
                  }
                  aria-describedby="dup-docs-hint"
                />
                <span>
                  Dokumente übernehmen (Zeichnungen, Zertifikate, …)
                  <span id="dup-docs-hint" className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Einträge unter „Dokumente zur Tür“ inkl. Datei im Dokumenten-Speicher.
                  </span>
                </span>
              </label>
            </div>
            <div className="mt-6 flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={() => handleDuplicateObjectDialogClose()}
                disabled={duplicateObjectDialog.busy}
                className="px-4 py-2 min-h-[40px] rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => void handleDuplicateObjectConfirm()}
                disabled={duplicateObjectDialog.busy}
                className="px-4 py-2 min-h-[40px] rounded-lg bg-vico-button dark:bg-vico-primary text-slate-800 dark:text-white font-medium border border-slate-300 dark:border-slate-600 hover:bg-vico-button-hover dark:hover:opacity-90 disabled:opacity-50"
              >
                {duplicateObjectDialog.busy ? 'Wird angelegt…' : 'Kopie anlegen'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel="Löschen"
        variant="danger"
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((c) => ({ ...c, open: false }))}
      />

      <MaintenanceContractModal
        open={contractModal.open}
        customerId={contractModal.customerId}
        bvId={contractModal.bvId}
        contract={contractModal.contract}
        onClose={() => setContractModal({ open: false, customerId: null, bvId: null, contract: null })}
        onSuccess={async () => {
          if (contractModal.bvId) {
            const list = await fetchMaintenanceContractsByBv(contractModal.bvId)
            setMaintenanceContractsBv(list ?? [])
          } else if (contractModal.customerId) {
            const list = await fetchMaintenanceContractsByCustomer(contractModal.customerId)
            setMaintenanceContractsCustomer(list ?? [])
          }
        }}
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

      {(editingObjectBvId || editingObjectCustomerId) && (
        <ObjectFormModal
          bvId={editingObjectBvId}
          customerId={editingObjectCustomerId ?? expandedCustomerId}
          customerBvs={expandedBvs}
          object={editingObject}
          canEdit={canEdit}
          canDelete={canDelete}
          onClose={handleObjectModalFinished}
          onSuccess={async () => {
            if (expandedCustomerId) {
              reloadExpandedObjects()
              const direct = await fetchObjectsDirectUnderCustomer(expandedCustomerId)
              setDirectObjectsUnderCustomer(direct ?? [])
            }
            handleObjectModalFinished()
          }}
        />
      )}

      {/* Kunde Formular Modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto overscroll-contain"
          style={{ padding: 'max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left))' }}
          onClick={handleCloseForm}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg min-w-0 my-auto max-h-[min(90vh,90dvh)] overflow-y-auto flex flex-col border border-slate-200 dark:border-slate-600"
            role="dialog"
            aria-modal
            onClick={(e) => e.stopPropagation()}
            aria-labelledby="form-title"
          >
            <div className="p-4 sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-600">
              <h3 id="form-title" className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {editingId ? 'Kunde bearbeiten' : 'Kunde anlegen'}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4 min-w-0">
              <div className="min-w-0">
                <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Name *
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  className="w-full min-w-0 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="min-w-0">
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    E-Mail
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleFormChange('email', e.target.value)}
                    className="w-full min-w-0 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
                  />
                </div>
                <div className="min-w-0">
                  <label htmlFor="phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Telefon
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleFormChange('phone', e.target.value)}
                    className="w-full min-w-0 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
                  />
                </div>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-600 pt-4">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Ansprechpartner</p>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Name"
                    value={formData.contact_name}
                    onChange={(e) => handleFormChange('contact_name', e.target.value)}
                    className="w-full min-w-0 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="email"
                      placeholder="E-Mail"
                      value={formData.contact_email}
                      onChange={(e) => handleFormChange('contact_email', e.target.value)}
                      className="w-full min-w-0 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
                    />
                    <input
                      type="tel"
                      placeholder="Telefon"
                      value={formData.contact_phone}
                      onChange={(e) => handleFormChange('contact_phone', e.target.value)}
                      className="w-full min-w-0 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
                    />
                  </div>
                </div>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-600 pt-4 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.maintenance_report_email}
                    onChange={(e) => handleFormChange('maintenance_report_email', e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800"
                  />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Wartungsbericht per E-Mail
                  </span>
                </label>
                {formData.maintenance_report_email && (
                  <input
                    type="email"
                    placeholder="Wartungsbericht E-Mail-Adresse"
                    value={formData.maintenance_report_email_address}
                    onChange={(e) => handleFormChange('maintenance_report_email_address', e.target.value)}
                    className="w-full min-w-0 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
                  />
                )}
              </div>
              {showMonteurCustomerZustellung && (
                <div className="border-t border-slate-200 dark:border-slate-600 pt-4 space-y-3">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Monteursbericht (Auftrag)</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Steuert die Zustellung zusätzlich zu den Firmen-Einstellungen (E-Mail automatisch/manuell,
                    Kundenportal). Das PDF wird am Auftrag immer gespeichert.
                  </p>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.monteur_report_internal_only}
                      onChange={(e) => handleFormChange('monteur_report_internal_only', e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800"
                      aria-describedby="monteur-internal-hint"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      Nur intern ablegen (PDF am Auftrag/Tür-Tor)
                      <span id="monteur-internal-hint" className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Kein automatischer oder manueller E-Mail-Versand des Monteursberichts an den Kunden, kein
                        Kundenportal.
                      </span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.monteur_report_portal}
                      disabled={formData.monteur_report_internal_only}
                      onChange={(e) => handleFormChange('monteur_report_portal', e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 disabled:opacity-50"
                      aria-describedby="monteur-portal-hint"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      Im Kundenportal bereitstellen (wenn in den Firmen-Einstellungen vorgesehen)
                      <span id="monteur-portal-hint" className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Wenn die Firma „Kundenportal + Benachrichtigung“ nutzt und das Objekt portal-fähig ist, kann der
                        Bericht ins Portal übernommen werden. Deaktiviert: nie Portal für diesen Kunden.
                      </span>
                    </span>
                  </label>
                </div>
              )}
              {formError && (
                <div className="text-sm text-red-600 dark:text-red-400" role="alert">
                  <p>{formError}</p>
                  {formError.startsWith('RLS-Fehler') && (
                    <Link
                      to="/einstellungen"
                      className="mt-2 inline-block px-3 py-1.5 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/60 text-xs font-medium"
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
                  className="flex-1 py-2 bg-vico-button dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg hover:bg-vico-button-hover dark:hover:bg-slate-600 disabled:opacity-50 border border-slate-300 dark:border-slate-600"
                >
                  {isSaving ? 'Speichern...' : 'Speichern'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="px-4 py-2 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50"
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
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto overscroll-contain"
          style={{ padding: 'max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left))' }}
          onClick={handleCloseBvForm}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg min-w-0 my-auto max-h-[min(90vh,90dvh)] overflow-y-auto flex flex-col border border-slate-200 dark:border-slate-600"
            role="dialog"
            aria-modal
            onClick={(e) => e.stopPropagation()}
            aria-labelledby="bv-form-title"
          >
            <div className="p-4 sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-600">
              <h3 id="bv-form-title" className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {bvEditingId ? 'Objekt/BV bearbeiten' : 'Objekt/BV anlegen'}
              </h3>
            </div>
            <form onSubmit={handleBvSubmit} className="p-4 space-y-4 min-w-0">
              {!bvEditingId && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bvFormData.copy_from_customer}
                    onChange={(e) => {
                      handleBvFormChange('copy_from_customer', e.target.checked)
                      if (e.target.checked) handleCopyFromCustomer()
                    }}
                    className="rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800"
                  />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Daten aus Kundenverwaltung übernehmen
                  </span>
                </label>
              )}
              <div className="min-w-0">
                <label htmlFor="bv-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Name *
                </label>
                <input
                  id="bv-name"
                  type="text"
                  value={bvFormData.name}
                  onChange={(e) => handleBvFormChange('name', e.target.value)}
                  className="w-full min-w-0 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="min-w-0">
                  <label htmlFor="bv-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    E-Mail
                  </label>
                  <input
                    id="bv-email"
                    type="email"
                    value={bvFormData.email}
                    onChange={(e) => handleBvFormChange('email', e.target.value)}
                    className="w-full min-w-0 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
                  />
                </div>
                <div className="min-w-0">
                  <label htmlFor="bv-phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Telefon
                  </label>
                  <input
                    id="bv-phone"
                    type="tel"
                    value={bvFormData.phone}
                    onChange={(e) => handleBvFormChange('phone', e.target.value)}
                    className="w-full min-w-0 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
                  />
                </div>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-600 pt-4">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Ansprechpartner</p>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Name"
                    value={bvFormData.contact_name}
                    onChange={(e) => handleBvFormChange('contact_name', e.target.value)}
                    className="w-full min-w-0 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="email"
                      placeholder="E-Mail"
                      value={bvFormData.contact_email}
                      onChange={(e) => handleBvFormChange('contact_email', e.target.value)}
                      className="w-full min-w-0 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
                    />
                    <input
                      type="tel"
                      placeholder="Telefon"
                      value={bvFormData.contact_phone}
                      onChange={(e) => handleBvFormChange('contact_phone', e.target.value)}
                      className="w-full min-w-0 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
                    />
                  </div>
                </div>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-600 pt-4 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bvFormData.maintenance_report_email}
                    onChange={(e) => handleBvFormChange('maintenance_report_email', e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800"
                  />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Wartungsbericht per E-Mail
                  </span>
                </label>
                {bvFormData.maintenance_report_email && (
                  <input
                    type="email"
                    placeholder="Wartungsbericht E-Mail-Adresse"
                    value={bvFormData.maintenance_report_email_address}
                    onChange={(e) => handleBvFormChange('maintenance_report_email_address', e.target.value)}
                    className="w-full min-w-0 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
                  />
                )}
              </div>
              {bvFormError && (
                <div className="text-sm text-red-600 dark:text-red-400" role="alert">
                  <p>{bvFormError}</p>
                  {bvFormError.startsWith('RLS-Fehler') && (
                    <Link
                      to="/einstellungen"
                      className="mt-2 inline-block px-3 py-1.5 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/60 text-xs font-medium"
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
                  className="flex-1 py-2 bg-vico-button dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg hover:bg-vico-button-hover dark:hover:bg-slate-600 disabled:opacity-50 border border-slate-300 dark:border-slate-600"
                >
                  {isBvSaving ? 'Speichern...' : 'Speichern'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseBvForm}
                  className="px-4 py-2 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {canUseQrBatch && qrBatchSelection.size > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 p-3 sm:p-4 border-t border-slate-200 dark:border-slate-600 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shadow-[0_-4px_20px_rgba(0,0,0,0.08)] pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          role="region"
          aria-label="A4 QR-Sammel-PDF"
        >
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <p className="text-sm text-slate-700 dark:text-slate-200">
              <strong>{qrBatchSelection.size}</strong> Objekt(e) für PDF ausgewählt
            </p>
            <div className="flex flex-wrap gap-2 items-center">
              <label className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2">
                <span className="whitespace-nowrap">Etikettgröße</span>
                <select
                  value={qrBatchPreset}
                  onChange={(e) => setQrBatchPreset(e.target.value as QrBatchPreset)}
                  className="px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm min-h-[40px]"
                  aria-label="Etikettgröße für A4"
                >
                  <option value="mini">Mini (ca. HERMA 48×25 mm)</option>
                  <option value="mid">Mittel (ca. HERMA 52×30 mm)</option>
                  <option value="max">Groß (ca. 63×38 mm)</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => setQrBatchSelection(new Map())}
                className="px-3 py-2 min-h-[40px] text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-transparent"
                disabled={qrBatchPdfLoading}
              >
                Auswahl leeren
              </button>
              <button
                type="button"
                onClick={() => void handleDownloadQrBatchPdf()}
                disabled={qrBatchPdfLoading}
                className="px-4 py-2 min-h-[40px] rounded-lg bg-vico-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {qrBatchPdfLoading ? 'PDF wird erzeugt…' : 'PDF herunterladen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Kunden
