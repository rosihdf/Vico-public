import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'
import { getSupabaseErrorMessage } from './supabaseErrors'
import { isOnline } from '../shared/networkUtils'
import {
  fetchCustomers,
  fetchArchivedCustomers,
  createCustomer,
  updateCustomer,
  archiveCustomer,
  unarchiveCustomer,
  fetchBvs,
  fetchAllBvs,
  createBv,
  updateBv,
  archiveBv,
  fetchObjects,
  fetchObjectsDirectUnderCustomer,
  duplicateObjectFromSource,
  fetchMaintenanceReminders,
  fetchMaintenanceContractsByCustomer,
  fetchMaintenanceContractsByBv,
  deleteMaintenanceContract,
  subscribeToDataChange,
  fetchPortalUsers,
  fetchProtocolOpenMangelsForListCounters,
  type ProtocolOpenMangelsListCounters,
} from './lib/dataService'
import { useComponentSettings } from './ComponentSettingsContext'
import { useLicense } from './LicenseContext'
import { checkCanCreateCustomer, hasFeature } from './lib/licenseService'
import {
  generateQrBatchA4Pdf,
  type QrBatchPdfItem,
  type QrBatchPreset,
} from './lib/generateQrBatchA4Pdf'
import { getStoredLicenseNumber, reportLimitExceeded, isLicenseApiConfigured } from './lib/licensePortalApi'
import { getObjectDisplayName } from './lib/objectUtils'
import ObjectFormModal from './components/ObjectFormModal'
import { LoadingSpinner } from './components/LoadingSpinner'
import EmptyState from '../shared/EmptyState'
import { KundenConfirmDialog, type KundenConfirmDialogState } from './components/kunden/KundenConfirmDialog'
import { KundenMaintenanceContractModalBridge } from './components/kunden/KundenMaintenanceContractModalBridge'
import type { Customer, CustomerFormData, BV, BVFormData } from './types'
import type { MaintenanceReminder, MaintenanceContract } from './types'

const ObjectQRCodeModal = lazy(() => import('./ObjectQRCodeModal'))
import type { Object as Obj } from './types'
import { KundenLicenseUsageBanner } from './components/kunden/KundenLicenseUsageBanner'
import { KundenFilterPanel } from './components/kunden/KundenFilterPanel'
import { KundenArchivedSection } from './components/kunden/KundenArchivedSection'
import { KundenQrBatchPdfBar } from './components/kunden/KundenQrBatchPdfBar'
import {
  KundenDuplicateObjectDialog,
  type KundenDuplicateObjectDialogState,
} from './components/kunden/KundenDuplicateObjectDialog'
import { useKundenListFilters } from './hooks/useKundenListFilters'
import { KundenCustomerFormModal } from './components/kunden/KundenCustomerFormModal'
import { KundenBvFormModal } from './components/kunden/KundenBvFormModal'
import { KundenObjectAccordionRow } from './components/kunden/KundenObjectAccordionRow'
import { KundenBvAccordionHeader } from './components/kunden/KundenBvAccordionHeader'
import { KundenPageToolbar } from './components/kunden/KundenPageToolbar'

const makeQrBatchKey = (customerId: string, bvId: string | null, objectId: string) =>
  `${customerId}|${bvId ?? ''}|${objectId}`

const ProtocolMangelCustomerBadge = ({ count }: { count: number }) => {
  if (count <= 0) return null
  const label = `${count} offene Protokoll-Mängel (letzter abgeschlossener Prüfungsauftrag)`
  return (
    <span
      className="ml-2 inline-flex min-h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-full bg-rose-100 px-2 text-xs font-bold text-rose-900 dark:bg-rose-900/45 dark:text-rose-100"
      title={label}
      aria-label={label}
    >
      {count > 99 ? '99+' : count}
    </span>
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
  maintenance_report_portal: false,
  monteur_report_internal_only: true,
  monteur_report_portal: false,
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
  uses_customer_report_delivery: true,
  maintenance_report_portal: false,
  monteur_report_portal: false,
  monteur_report_internal_only: true,
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
  const [showArchivedSection, setShowArchivedSection] = useState(false)
  const [archivedCustomers, setArchivedCustomers] = useState<Customer[]>([])
  const [isArchivedLoading, setIsArchivedLoading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<CustomerFormData>(INITIAL_CUSTOMER_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [portalUserCountForForm, setPortalUserCountForForm] = useState(0)
  const hasKundenportalFeature = Boolean(license && hasFeature(license, 'kundenportal'))
  const canOpenBenutzerverwaltung = userRole === 'admin'
  const canEditPortalConfig = userRole === 'admin'
  const showPortalDeliveryToggles =
    hasKundenportalFeature &&
    portalUserCountForForm > 0 &&
    showMonteurCustomerZustellung &&
    canEditPortalConfig

  const [portalUserCountForBvForm, setPortalUserCountForBvForm] = useState(0)
  const showBvPortalDeliveryToggles =
    hasKundenportalFeature &&
    portalUserCountForBvForm > 0 &&
    showMonteurCustomerZustellung &&
    canEditPortalConfig

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
  const [protocolMangels, setProtocolMangels] = useState<ProtocolOpenMangelsListCounters | null>(null)
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
  const [confirmDialog, setConfirmDialog] = useState<KundenConfirmDialogState>({
    open: false,
    title: '',
    message: '',
    confirmLabel: 'Bestätigen',
    variant: 'default',
    onConfirm: () => {},
  })

  const [duplicateObjectDialog, setDuplicateObjectDialog] = useState<KundenDuplicateObjectDialogState>({
    open: false,
    source: null,
    copyPhotos: false,
    copyProfilePhoto: true,
    copyDocuments: false,
    busy: false,
  })

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

  const protocolMangelCountByObjectId = useMemo(
    () => protocolMangels?.countByObjectId ?? {},
    [protocolMangels]
  )
  const protocolMangelTotalByCustomerId = useMemo(
    () => protocolMangels?.totalByCustomerId ?? {},
    [protocolMangels]
  )

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
    const [customerData, reminderData, bvsData, protocolPack] = await Promise.all([
      fetchCustomers(),
      fetchMaintenanceReminders(),
      fetchAllBvs(),
      fetchProtocolOpenMangelsForListCounters(),
    ])
    setCustomers(customerData ?? [])
    setMaintenanceReminders(reminderData ?? [])
    setAllBvs(bvsData ?? [])
    setProtocolMangels(protocolPack)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  useEffect(() => {
    if (!showForm) {
      setPortalUserCountForForm(0)
      return
    }
    if (!editingId) {
      setPortalUserCountForForm(0)
      return
    }
    let cancelled = false
    void fetchPortalUsers(editingId).then((users) => {
      if (!cancelled) setPortalUserCountForForm(users.length)
    })
    return () => {
      cancelled = true
    }
  }, [showForm, editingId])

  useEffect(() => {
    if (!showBvForm || !expandedCustomerId) {
      setPortalUserCountForBvForm(0)
      return
    }
    let cancelled = false
    void fetchPortalUsers(expandedCustomerId).then((users) => {
      if (!cancelled) setPortalUserCountForBvForm(users.length)
    })
    return () => {
      cancelled = true
    }
  }, [showBvForm, expandedCustomerId])

  useEffect(() => {
    return subscribeToDataChange(loadCustomers)
  }, [loadCustomers])

  const loadArchivedCustomers = useCallback(async () => {
    setIsArchivedLoading(true)
    const rows = await fetchArchivedCustomers()
    setArchivedCustomers(rows ?? [])
    setIsArchivedLoading(false)
  }, [])

  useEffect(() => {
    if (!showArchivedSection || !canDelete) return
    void loadArchivedCustomers()
  }, [showArchivedSection, canDelete, loadArchivedCustomers])

  const handleUnarchiveCustomer = async (id: string) => {
    const { error } = await unarchiveCustomer(id)
    if (error) {
      showError(getSupabaseErrorMessage(error))
      return
    }
    showToast('Kunde wurde wiederhergestellt.')
    await loadArchivedCustomers()
    await loadCustomers()
  }

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

  const { searchLower, filteredCustomers, filteredBvs, filteredObjects, hasActiveFilters } =
    useKundenListFilters({
      customers,
      searchQuery,
      filterPlz,
      filterWartungsstatus,
      filterBvMin,
      filterBvMax,
      customerWartungsstatus,
      bvCountByCustomerId,
      expandedBvs,
      expandedObjects,
    })

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  const handleResetFilters = () => {
    setFilterPlz('')
    setFilterWartungsstatus('all')
    setFilterBvMin('')
    setFilterBvMax('')
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
      maintenance_report_portal: customer.maintenance_report_portal !== false,
      ...(() => {
        const monteurPortal =
          customer.monteur_report_internal_only !== true && customer.monteur_report_portal !== false
        return {
          monteur_report_portal: monteurPortal,
          monteur_report_internal_only: !monteurPortal,
        }
      })(),
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

  const handleMonteurPortalToggle = (allowPortal: boolean) => {
    setFormData((prev) => ({
      ...prev,
      monteur_report_internal_only: !allowPortal,
      monteur_report_portal: allowPortal,
    }))
  }

  const handleMaintenanceReportPortalToggle = (allowPortal: boolean) => {
    setFormData((prev) => ({ ...prev, maintenance_report_portal: allowPortal }))
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
      maintenance_report_portal: formData.maintenance_report_portal,
      monteur_report_internal_only: !formData.monteur_report_portal,
      monteur_report_portal: formData.monteur_report_portal,
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
    const monteurPortal =
      bv.monteur_report_internal_only !== true && bv.monteur_report_portal !== false
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
      uses_customer_report_delivery: bv.uses_customer_report_delivery !== false,
      maintenance_report_portal: bv.maintenance_report_portal !== false,
      monteur_report_portal: monteurPortal,
      monteur_report_internal_only: !monteurPortal,
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
    const monteurPortal =
      customer.monteur_report_internal_only !== true && customer.monteur_report_portal !== false
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
      uses_customer_report_delivery: true,
      maintenance_report_portal: customer.maintenance_report_portal !== false,
      monteur_report_portal: monteurPortal,
      monteur_report_internal_only: !monteurPortal,
    }))
  }

  const handleBvUsesCustomerDeliveryToggle = (likeCustomer: boolean) => {
    setBvFormData((prev) => ({ ...prev, uses_customer_report_delivery: likeCustomer }))
  }

  const handleBvMonteurPortalToggle = (allowPortal: boolean) => {
    setBvFormData((prev) => ({
      ...prev,
      monteur_report_internal_only: !allowPortal,
      monteur_report_portal: allowPortal,
    }))
  }

  const handleBvMaintenanceReportPortalToggle = (allowPortal: boolean) => {
    setBvFormData((prev) => ({ ...prev, maintenance_report_portal: allowPortal }))
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
      uses_customer_report_delivery: data.uses_customer_report_delivery,
      maintenance_report_portal: data.maintenance_report_portal,
      monteur_report_internal_only: !data.monteur_report_portal,
      monteur_report_portal: data.monteur_report_portal,
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
    if (!isOnline()) {
      showError('Objektkopie ist nur bei Internetverbindung möglich.')
      return
    }
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
      <KundenLicenseUsageBanner
        customerCountForLicense={customerCountForLicense}
        maxCustomers={license?.max_customers}
      />

      <KundenPageToolbar
        canUseQrBatch={canUseQrBatch}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        canEdit={canEdit}
        showNeuDropdown={showNeuDropdown}
        onNeuToggleClick={(e) => {
          e.stopPropagation()
          setShowNeuDropdown((v) => !v)
        }}
        onNeuCustomerClick={(e) => {
          e.stopPropagation()
          setShowNeuDropdown(false)
          handleOpenCreate()
        }}
        canCreateBv={canCreateBv}
        onNeuBvClick={(e) => {
          e.stopPropagation()
          setShowNeuDropdown(false)
          if (expandedCustomerId) handleOpenBvCreate()
        }}
        neuBvDisabled={!expandedCustomerId}
        neuBvTitle={!expandedCustomerId ? 'Kunde zuerst ausklappen' : undefined}
        onNeuDoorClick={(e) => {
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
        neuDoorDisabled={!expandedCustomerId || ((expandedBvs?.length ?? 0) > 0 && !expandedBvId)}
        neuDoorTitle={
          !expandedCustomerId
            ? 'Kunde zuerst ausklappen'
            : (expandedBvs?.length ?? 0) > 0 && !expandedBvId
              ? 'Objekt/BV ausklappen oder Kunde ohne Objekte/BV wählen'
              : undefined
        }
        canDelete={canDelete}
        showArchivedSection={showArchivedSection}
        onToggleArchived={() => setShowArchivedSection((v) => !v)}
        showFilters={showFilters}
        hasActiveFilters={hasActiveFilters}
        onToggleFilters={() => setShowFilters((v) => !v)}
      />

      {showFilters && (
        <KundenFilterPanel
          filterPlz={filterPlz}
          setFilterPlz={setFilterPlz}
          filterWartungsstatus={filterWartungsstatus}
          setFilterWartungsstatus={setFilterWartungsstatus}
          filterBvMin={filterBvMin}
          setFilterBvMin={setFilterBvMin}
          filterBvMax={filterBvMax}
          setFilterBvMax={setFilterBvMax}
          hasActiveFilters={hasActiveFilters}
          onResetFilters={handleResetFilters}
        />
      )}

      <KundenArchivedSection
        visible={Boolean(canDelete && showArchivedSection)}
        isArchivedLoading={isArchivedLoading}
        archivedCustomers={archivedCustomers}
        onRequestRestore={(c) =>
          setConfirmDialog({
            open: true,
            title: 'Kunde wiederherstellen',
            message: `„${c.name}“ und alle zugehörigen Objekte/BV und Türen/Tore wieder in den Stammdaten anzeigen?`,
            confirmLabel: 'Wiederherstellen',
            variant: 'default',
            onConfirm: () => {
              setConfirmDialog((prev) => ({ ...prev, open: false }))
              void handleUnarchiveCustomer(c.id)
            },
          })
        }
      />

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
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <button
                    type="button"
                    onClick={() => handleToggleBvs(customer.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left text-slate-800 transition-colors hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-700/50"
                    aria-expanded={isExpanded}
                    aria-label={`Objekt/BV für ${customer.name} ${isExpanded ? 'einklappen' : 'ausklappen'}`}
                  >
                    <svg
                      className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 dark:text-slate-100 flex flex-wrap items-center gap-x-1 gap-y-0.5">
                        <span className="inline-flex items-center">
                          {customer.name}
                          <ProtocolMangelCustomerBadge count={protocolMangelTotalByCustomerId[customer.id] ?? 0} />
                        </span>
                        <span className="text-sm font-normal text-slate-400 dark:text-slate-500">
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
                  </button>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(customer)}
                        className="inline-flex min-h-[36px] items-center rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700/40"
                        aria-label={`${customer.name} öffnen`}
                      >
                        Öffnen
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        disabled={!isOnline()}
                        title={!isOnline() ? 'Nur bei Internetverbindung' : undefined}
                        onClick={() => {
                          if (!isOnline()) {
                            showError('Archivieren ist nur bei Internetverbindung möglich.')
                            return
                          }
                          setConfirmDialog({
                            open: true,
                            title: 'Kunde archivieren',
                            message:
                              'Kunden inkl. aller Objekte/BV und Türen/Tore archivieren? Stammdaten verschwinden aus den Listen; Aufträge und Wartungsprotokolle bleiben erhalten.',
                            confirmLabel: 'Archivieren',
                            variant: 'default',
                            onConfirm: () => {
                              setConfirmDialog((c) => ({ ...c, open: false }))
                              handleArchiveCustomer(customer.id)
                            },
                          })
                        }}
                        className="inline-flex min-h-[36px] items-center rounded-lg border border-amber-200 px-3 py-2 text-sm text-amber-800 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-950/30 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={`${customer.name} archivieren`}
                      >
                        Archiv
                      </button>
                    )}
                  </div>
                </div>

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
                                <KundenObjectAccordionRow
                                  key={obj.id}
                                  obj={obj}
                                  protocolMangelCount={protocolMangelCountByObjectId[obj.id] ?? 0}
                                  maintenanceReminder={remindersByObjectId.get(obj.id)}
                                  reminderDisplayMode="short"
                                  rowSurface="default"
                                  canUseQrBatch={canUseQrBatch}
                                  qrBatchChecked={qrBatchSelection.has(makeQrBatchKey(customer.id, null, obj.id))}
                                  onToggleQrBatch={() =>
                                    toggleQrBatchItem({
                                      customerId: customer.id,
                                      bvId: null,
                                      objectId: obj.id,
                                      objectName: getObjectDisplayName(obj),
                                      customerName: customer.name,
                                      bvName: '',
                                    })
                                  }
                                  canEdit={canEdit}
                                  onOpen={() => {
                                    setEditingObject(obj)
                                    setEditingObjectBvId(null)
                                    setEditingObjectCustomerId(customer.id)
                                  }}
                                  openButtonLabel="Öffnen"
                                  onDuplicate={() => handleOpenDuplicateObjectDialog(obj)}
                                  duplicateDisabled={!isOnline()}
                                  duplicateDisabledTitle={!isOnline() ? 'Nur bei Internetverbindung' : undefined}
                                  showAuftragLink={isEnabled('auftrag')}
                                  auftragTo={`/auftrag/neu-aus-qr?customerId=${customer.id}&objectId=${obj.id}`}
                                  showProtokollLink={isEnabled('wartungsprotokolle')}
                                  protokollTo={`/kunden/${customer.id}/objekte/${obj.id}/wartung`}
                                  onShowQr={() =>
                                    setQrObject({
                                      obj,
                                      customerId: customer.id,
                                      bvId: null,
                                      customerName: customer.name,
                                      bvName: '',
                                    })
                                  }
                                  isolateRowClicks={false}
                                />
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
                                        aria-label="Vertrag öffnen"
                                      >
                                        Öffnen
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
                                            confirmLabel: 'Löschen',
                                            variant: 'danger',
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
                              Diese Türen einem Objekt/BV zuordnen: Öffnen → Zuordnung auswählen → Speichern.
                            </p>
                            {isDirectObjectsLoading ? (
                              <LoadingSpinner message="Lade…" size="sm" className="py-2" />
                            ) : (
                              <ul className="space-y-1.5">
                                {directObjectsUnderCustomer.map((obj) => (
                                  <KundenObjectAccordionRow
                                    key={obj.id}
                                    obj={obj}
                                    protocolMangelCount={protocolMangelCountByObjectId[obj.id] ?? 0}
                                    maintenanceReminder={remindersByObjectId.get(obj.id)}
                                    reminderDisplayMode="short"
                                    rowSurface="amber"
                                    canUseQrBatch={canUseQrBatch}
                                    qrBatchChecked={qrBatchSelection.has(makeQrBatchKey(customer.id, null, obj.id))}
                                    onToggleQrBatch={() =>
                                      toggleQrBatchItem({
                                        customerId: customer.id,
                                        bvId: null,
                                        objectId: obj.id,
                                        objectName: getObjectDisplayName(obj),
                                        customerName: customer.name,
                                        bvName: '',
                                      })
                                    }
                                    canEdit={canEdit}
                                    onOpen={() => {
                                      setEditingObject(obj)
                                      setEditingObjectBvId(null)
                                      setEditingObjectCustomerId(customer.id)
                                    }}
                                    openButtonLabel="Öffnen (Objekt/BV zuordnen)"
                                    onDuplicate={() => handleOpenDuplicateObjectDialog(obj)}
                                    duplicateDisabled={!isOnline()}
                                    duplicateDisabledTitle={!isOnline() ? 'Nur bei Internetverbindung' : undefined}
                                    showAuftragLink={isEnabled('auftrag')}
                                    auftragTo={`/auftrag/neu-aus-qr?customerId=${customer.id}&objectId=${obj.id}`}
                                    showProtokollLink={isEnabled('wartungsprotokolle')}
                                    protokollTo={`/kunden/${customer.id}/objekte/${obj.id}/wartung`}
                                    onShowQr={() =>
                                      setQrObject({
                                        obj,
                                        customerId: customer.id,
                                        bvId: null,
                                        customerName: customer.name,
                                        bvName: '',
                                      })
                                    }
                                    isolateRowClicks={false}
                                  />
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
                                <KundenBvAccordionHeader
                                  bv={bv}
                                  isExpanded={isBvExpanded}
                                  onToggleExpand={() => handleToggleObjects(bv.id)}
                                  canEdit={canEdit}
                                  canDelete={canDelete}
                                  onOpenEdit={() => handleOpenBvEdit(bv)}
                                  archiveDisabled={!isOnline()}
                                  archiveDisabledTitle={!isOnline() ? 'Nur bei Internetverbindung' : undefined}
                                  onArchiveClick={() => {
                                    if (!isOnline()) {
                                      showError('Archivieren ist nur bei Internetverbindung möglich.')
                                      return
                                    }
                                    setConfirmDialog({
                                      open: true,
                                      title: 'Objekt/BV archivieren',
                                      message:
                                        'Objekt/BV und alle zugehörigen Türen/Tore archivieren? Listen werden bereinigt; Historie bleibt.',
                                      confirmLabel: 'Archivieren',
                                      variant: 'default',
                                      onConfirm: () => {
                                        setConfirmDialog((c) => ({ ...c, open: false }))
                                        handleArchiveBv(bv.id)
                                      },
                                    })
                                  }}
                                />

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
                                            <KundenObjectAccordionRow
                                              key={obj.id}
                                              obj={obj}
                                              protocolMangelCount={protocolMangelCountByObjectId[obj.id] ?? 0}
                                              maintenanceReminder={remindersByObjectId.get(obj.id)}
                                              reminderDisplayMode="long"
                                              rowSurface="default"
                                              canUseQrBatch={canUseQrBatch}
                                              qrBatchChecked={qrBatchSelection.has(makeQrBatchKey(customer.id, bv.id, obj.id))}
                                              onToggleQrBatch={() =>
                                                toggleQrBatchItem({
                                                  customerId: customer.id,
                                                  bvId: bv.id,
                                                  objectId: obj.id,
                                                  objectName: getObjectDisplayName(obj),
                                                  customerName: customer.name,
                                                  bvName: bv.name,
                                                })
                                              }
                                              canEdit={canEdit}
                                              onOpen={() => {
                                                setEditingObject(obj)
                                                setEditingObjectBvId(bv.id)
                                                setEditingObjectCustomerId(customer.id)
                                              }}
                                              openButtonLabel="Öffnen"
                                              onDuplicate={() => handleOpenDuplicateObjectDialog(obj)}
                                              duplicateDisabled={!isOnline()}
                                              duplicateDisabledTitle={!isOnline() ? 'Nur bei Internetverbindung' : undefined}
                                              showAuftragLink={isEnabled('auftrag')}
                                              auftragTo={`/auftrag/neu-aus-qr?customerId=${customer.id}&bvId=${bv.id}&objectId=${obj.id}`}
                                              showProtokollLink={isEnabled('wartungsprotokolle')}
                                              protokollTo={`/kunden/${customer.id}/bvs/${bv.id}/objekte/${obj.id}/wartung`}
                                              onShowQr={() =>
                                                setQrObject({
                                                  obj,
                                                  customerId: customer.id,
                                                  bvId: bv.id,
                                                  customerName: customer.name,
                                                  bvName: bv.name,
                                                })
                                              }
                                              isolateRowClicks
                                            />
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
                                                    aria-label="Vertrag öffnen"
                                                  >
                                                    Öffnen
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
                                                        confirmLabel: 'Löschen',
                                                        variant: 'danger',
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
                    {hasKundenportalFeature && (
                      <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/40 p-3">
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Kundenportal-Zugänge & Sichtbarkeit: zentrale Konfiguration in der Benutzerverwaltung.
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Freigabe Kunde: Monteursbericht {customer.monteur_report_portal !== false ? 'aktiv' : 'inaktiv'} ·
                          Wartungsbericht {customer.maintenance_report_portal !== false ? 'aktiv' : 'inaktiv'}.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <KundenDuplicateObjectDialog
        dialog={duplicateObjectDialog}
        setDialog={setDuplicateObjectDialog}
        onClose={handleDuplicateObjectDialogClose}
        onConfirm={handleDuplicateObjectConfirm}
      />

      <KundenConfirmDialog
        state={confirmDialog}
        onCancel={() => setConfirmDialog((c) => ({ ...c, open: false }))}
      />

      <KundenMaintenanceContractModalBridge
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
          protocolOpenMangelRows={
            editingObject?.id && protocolMangels
              ? protocolMangels.rows.filter((r) => r.object_id === editingObject.id)
              : undefined
          }
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

      {showForm && (
        <KundenCustomerFormModal
          editingId={editingId}
          formData={formData}
          formError={formError}
          isSaving={isSaving}
          showPortalDeliveryToggles={showPortalDeliveryToggles}
          hasKundenportalFeature={hasKundenportalFeature}
          canOpenBenutzerverwaltung={canOpenBenutzerverwaltung}
          portalUserCountForForm={portalUserCountForForm}
          onClose={handleCloseForm}
          onSubmit={handleSubmit}
          onFormChange={handleFormChange}
          onMonteurPortalToggle={handleMonteurPortalToggle}
          onMaintenanceReportPortalToggle={handleMaintenanceReportPortalToggle}
        />
      )}

      {showBvForm && (
        <KundenBvFormModal
          bvEditingId={bvEditingId}
          bvFormData={bvFormData}
          bvFormError={bvFormError}
          isBvSaving={isBvSaving}
          canEditPortalConfig={canEditPortalConfig}
          showMonteurCustomerZustellung={showMonteurCustomerZustellung}
          showBvPortalDeliveryToggles={showBvPortalDeliveryToggles}
          hasKundenportalFeature={hasKundenportalFeature}
          inheritedCustomerMonteurPortal={formData.monteur_report_portal}
          inheritedCustomerMaintenancePortal={formData.maintenance_report_portal}
          onClose={handleCloseBvForm}
          onSubmit={handleBvSubmit}
          onBvFormChange={handleBvFormChange}
          onCopyFromCustomer={handleCopyFromCustomer}
          onBvUsesCustomerDeliveryToggle={handleBvUsesCustomerDeliveryToggle}
          onBvMonteurPortalToggle={handleBvMonteurPortalToggle}
          onBvMaintenanceReportPortalToggle={handleBvMaintenanceReportPortalToggle}
        />
      )}

      <KundenQrBatchPdfBar
        visible={Boolean(canUseQrBatch && qrBatchSelection.size > 0)}
        selectionCount={qrBatchSelection.size}
        preset={qrBatchPreset}
        onPresetChange={setQrBatchPreset}
        onClearSelection={() => setQrBatchSelection(new Map())}
        pdfLoading={qrBatchPdfLoading}
        onDownloadPdf={() => void handleDownloadQrBatchPdf()}
      />
    </div>
  )
}

export default Kunden
