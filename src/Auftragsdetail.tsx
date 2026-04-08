import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'
import { getSupabaseErrorMessage } from './supabaseErrors'
import {
  fetchOrderById,
  fetchCompletionByOrderId,
  createOrderCompletion,
  updateOrderCompletion,
  updateOrderStatus,
  fetchCustomers,
  fetchAllBvs,
  fetchObject,
  uploadOrderCompletionSignature,
  uploadMonteurBerichtPdf,
  createMaintenanceReport,
  uploadMaintenancePdf,
  updateMaintenanceReportPdfPath,
  fetchMonteurReportSettingsFull,
  fetchMonteurPortalDeliveryEligible,
  sendMaintenanceReportEmail,
  notifyPortalOnMaintenanceReport,
  upsertWartungsChecklistProtocol,
  attachMonteurPdfToOrderChecklistProtocol,
  attachPruefprotokollPdfToOrderChecklistProtocol,
  createOrder,
  insertDefectFollowupsForCompletedWartungOrder,
  fetchMaintenanceReportIdByOrderObject,
  fetchPruefprotokollPdfPathForOrderObject,
  fetchChecklistDefectPhotos,
  uploadChecklistDefectPhoto,
  deleteChecklistDefectPhoto,
  getMaintenancePhotoUrl,
  type MonteurReportCustomerDeliveryMode,
  type MonteurReportSettingsFull,
} from './lib/dataService'
import { isOrderActivePerObjectError } from './lib/orderUtils'
import { useLicense } from './LicenseContext'
import { hasFeature } from './lib/licenseService'
import { isAssignedChannelReleaseAtLeast } from './lib/releaseGate'
import { isOnline } from '../shared/networkUtils'
import { fetchMyProfile, fetchProfiles, getProfileDisplayName } from './lib/userService'
import { LoadingSpinner } from './components/LoadingSpinner'
import ConfirmDialog from './components/ConfirmDialog'
import {
  AppButton,
  AppField,
  AppInput,
  AppSelect,
  AppTextarea,
  appLabelClassNameSmall,
} from './components/ui'
import { getAppDisplayNameFromLicenseCache } from './lib/appBranding'
import SignatureField from './SignatureField'
import PdfPreviewOverlay, { type PdfPreviewState } from './components/PdfPreviewOverlay'
import { generateMonteurBerichtPdf } from './lib/generateMonteurBerichtPdf'
import { generatePruefprotokollPdf } from './lib/generatePruefprotokollPdf'
import { sumWorkMinutes } from './lib/monteurReportTime'
import {
  parseOrderCompletionExtra,
  materialLinesToText,
  defaultOrderCompletionExtra,
  type OrderCompletionExtraV1,
  type WartungChecklistExtraV1,
  type WartungChecklistItemState,
} from './types/orderCompletionExtra'
import {
  buildDeficiencyTextFromChecklist,
  checklistHasOpenMangel,
  validateChecklistComplete,
  type ChecklistDisplayMode,
} from './lib/doorMaintenanceChecklistCatalog'
import {
  buildDeficiencyTextFromFeststellChecklist,
  checklistHasOpenMangelFeststell,
  initEmptyFeststellChecklistItems,
  validateFeststellChecklistComplete,
  type FeststellChecklistItemState,
} from './lib/feststellChecklistCatalog'
import WartungOrderChecklistPanel, { initEmptyChecklistItems } from './components/WartungOrderChecklistPanel'
import FeststellOrderChecklistPanel from './components/FeststellOrderChecklistPanel'
import { getOrderObjectIds } from './lib/orderUtils'
import { getObjectDisplayName } from './lib/objectUtils'
import type { Order, OrderCompletion, Customer, BV, OrderType, OrderStatus, Object as Obj } from './types'
import type { Profile } from './lib/userService'
import type { MaintenanceReason } from './types/maintenance'
import type { ChecklistDefectPhoto } from './types/maintenance'
import { resolveReportDeliverySettings } from './lib/reportDeliverySettings'

const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  wartung: 'Wartung',
  reparatur: 'Reparatur',
  montage: 'Montage',
  sonstiges: 'Sonstiges',
}

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  offen: 'Offen',
  in_bearbeitung: 'In Bearbeitung',
  erledigt: 'Erledigt',
  storniert: 'Storniert',
}

const PROFILE_ROLES_ZUSATZ = new Set(['admin', 'mitarbeiter', 'teamleiter', 'operator'])

const orderTypeToMaintenanceReason = (t: OrderType): MaintenanceReason => {
  if (t === 'wartung') return 'regelwartung'
  if (t === 'reparatur') return 'reparatur'
  return 'sonstiges'
}

const getMonteurReportRecipientEmail = (customer: Customer | undefined, bv: BV | undefined): string | null => {
  const r = resolveReportDeliverySettings(customer, bv)
  if (!r.maintenance_report_email) return null
  return (r.maintenance_report_email_address || '').trim() || null
}

type WartungChecklistGateBad = {
  ok: false
  message: string
  incompleteObjectIds: string[]
}

type WartungChecklistGateResult = { ok: true } | WartungChecklistGateBad

/** Wartungsauftrag: alle am Auftrag hängenden Türen müssen für den Standard-Abschluss checklisten-fertig sein. */
const evaluateWartungChecklistGate = (
  order: Order,
  wc: WartungChecklistExtraV1 | undefined,
  orderObjects: Obj[]
): WartungChecklistGateResult => {
  if (order.order_type !== 'wartung') return { ok: true }
  const oids = getOrderObjectIds(order).filter(Boolean)
  if (oids.length === 0) return { ok: true }
  if (!wc?.by_object_id) {
    return {
      ok: false,
      message: 'Bitte für jede Tür die Wartungscheckliste speichern.',
      incompleteObjectIds: oids,
    }
  }
  const incomplete: string[] = []
  let firstMessage: string | null = null
  for (const oid of oids) {
    const per = wc.by_object_id[oid]
    if (!per?.saved_at) {
      incomplete.push(oid)
      if (!firstMessage) firstMessage = 'Für mindestens eine Tür fehlt eine gespeicherte Checkliste.'
      continue
    }
    const mode = per.checklist_modus === 'compact' ? 'compact' : 'detail'
    const val = validateChecklistComplete(mode, per.items ?? {})
    if (!val.ok) {
      incomplete.push(oid)
      if (!firstMessage) firstMessage = val.message
      continue
    }
    const ob = orderObjects.find((x) => x.id === oid)
    if (ob?.has_hold_open) {
      const f = per.feststell_checkliste
      if (!f?.saved_at) {
        incomplete.push(oid)
        if (!firstMessage) {
          firstMessage =
            'Für mindestens eine Tür mit Feststellanlage fehlt eine gespeicherte Feststell-Checkliste.'
        }
        continue
      }
      const fm = f.checklist_modus === 'compact' ? 'compact' : 'detail'
      const fv = validateFeststellChecklistComplete(fm, f.items ?? {})
      if (!fv.ok) {
        incomplete.push(oid)
        if (!firstMessage) firstMessage = fv.message
      }
    }
  }
  if (incomplete.length === 0) return { ok: true }
  return {
    ok: false,
    message: firstMessage ?? 'Checkliste unvollständig.',
    incompleteObjectIds: [...new Set(incomplete)],
  }
}

const Auftragsdetail = () => {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { license, design, mandantenReleases } = useLicense()
  const isRelease110Enabled = isAssignedChannelReleaseAtLeast(mandantenReleases, '1.1.0')
  const { showError, showToast } = useToast()
  const [order, setOrder] = useState<Order | null>(null)
  const [completion, setCompletion] = useState<OrderCompletion | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [allBvs, setAllBvs] = useState<BV[]>([])
  const [objectLabel, setObjectLabel] = useState<string>('—')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [extra, setExtra] = useState<OrderCompletionExtraV1>(() => defaultOrderCompletionExtra(''))
  const [ausgeführte, setAusgeführte] = useState('')
  const [sigTechDataUrl, setSigTechDataUrl] = useState<string | null>(null)
  const [sigCustDataUrl, setSigCustDataUrl] = useState<string | null>(null)
  const [printedTech, setPrintedTech] = useState('')
  const [printedCust, setPrintedCust] = useState('')
  const [monteurDeliveryMode, setMonteurDeliveryMode] =
    useState<MonteurReportCustomerDeliveryMode>('none')
  const [portalEligible, setPortalEligible] = useState(false)
  const [monteurEmailSending, setMonteurEmailSending] = useState(false)
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false)
  const [completeDialogPhase, setCompleteDialogPhase] = useState<'confirm' | 'bypass_warning'>('confirm')
  const [completeDialogGate, setCompleteDialogGate] = useState<WartungChecklistGateBad | null>(null)
  const [completeSharePortal, setCompleteSharePortal] = useState(true)
  const [followUpDialogOpen, setFollowUpDialogOpen] = useState(false)
  const [followUpDialogMessage, setFollowUpDialogMessage] = useState('')
  const followUpOidsRef = useRef<string[]>([])
  const [monteurSettingsFull, setMonteurSettingsFull] = useState<MonteurReportSettingsFull | null>(null)
  const [orderObjects, setOrderObjects] = useState<Obj[]>([])
  const [selectedChecklistObjectId, setSelectedChecklistObjectId] = useState<string | null>(null)
  const [checklistItemsByObject, setChecklistItemsByObject] = useState<
    Record<string, Record<string, WartungChecklistItemState>>
  >({})
  const [checklistSaving, setChecklistSaving] = useState(false)
  const [checklistSaveError, setChecklistSaveError] = useState<string | null>(null)
  const [feststellItemsByObject, setFeststellItemsByObject] = useState<
    Record<string, Record<string, FeststellChecklistItemState>>
  >({})
  const [feststellSaving, setFeststellSaving] = useState(false)
  const [feststellSaveError, setFeststellSaveError] = useState<string | null>(null)
  const [checklistModeOverride, setChecklistModeOverride] = useState<ChecklistDisplayMode | null>(null)
  const [checklistReportIdByObject, setChecklistReportIdByObject] = useState<Record<string, string>>({})
  const [defectPhotosByObject, setDefectPhotosByObject] = useState<
    Record<string, Record<string, ChecklistDefectPhoto[]>>
  >({})
  const [uploadingDefectPhotoItem, setUploadingDefectPhotoItem] = useState<string | null>(null)
  const [pdfViewer, setPdfViewer] = useState<PdfPreviewState>(null)
  const [pruefprotokollViewLoading, setPruefprotokollViewLoading] = useState(false)
  const [myProfile, setMyProfile] = useState<Profile | null>(null)
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false)
  const checklistInitKeyRef = useRef<string>('')

  const handleClosePdfViewer = () => {
    setPdfViewer((prev) => {
      if (prev?.revokeOnClose && prev.url.startsWith('blob:')) {
        URL.revokeObjectURL(prev.url)
      }
      return null
    })
  }

  const openBlobPdfViewer = (blob: Blob, title: string) => {
    const url = URL.createObjectURL(blob)
    setPdfViewer({ url, title, revokeOnClose: true })
  }

  const openPublicPdfViewerFromStoragePath = (storagePath: string, title: string) => {
    setPdfViewer({ url: getMaintenancePhotoUrl(storagePath), title, revokeOnClose: false })
  }

  const getCustomerName = (id: string) => customers.find((c) => c.id === id)?.name ?? '-'
  const getBvName = (id: string | null | undefined) =>
    !id ? '—' : allBvs.find((b) => b.id === id)?.name ?? '-'

  const profilesForZusatz = useMemo(
    () =>
      profiles.filter(
        (p) => p.id !== user?.id && PROFILE_ROLES_ZUSATZ.has(p.role) && p.role !== 'demo' && p.role !== 'kunde'
      ),
    [profiles, user?.id]
  )

  const loadData = useCallback(async () => {
    if (!orderId) return
    setIsLoading(true)
    setFormError(null)
    const [orderData, completionData, customerData, bvData, profileData, allProfiles] = await Promise.all([
      fetchOrderById(orderId),
      fetchCompletionByOrderId(orderId),
      fetchCustomers(),
      fetchAllBvs(),
      user ? fetchMyProfile(user.id) : Promise.resolve(null),
      fetchProfiles(),
    ])
    setOrder(orderData ?? null)
    setCompletion(completionData ?? null)
    setCustomers(customerData ?? [])
    setAllBvs(bvData ?? [])
    setProfiles(allProfiles ?? [])
    setMyProfile(profileData ?? null)

    const monteurName = profileData
      ? [profileData.first_name, profileData.last_name].filter(Boolean).join(' ') || profileData.email || 'Monteur'
      : 'Monteur'

    if (orderData) {
      const oid = getOrderObjectIds(orderData)[0] ?? orderData.object_id
      if (oid) {
        const ob = await fetchObject(oid)
        setObjectLabel(ob ? getObjectDisplayName(ob) : oid.slice(0, 8))
      } else {
        setObjectLabel('—')
      }
    }

    const parsedExtra = completionData
      ? parseOrderCompletionExtra(completionData.completion_extra, monteurName)
      : defaultOrderCompletionExtra(monteurName)
    if (completionData) {
      setAusgeführte(completionData.ausgeführte_arbeiten ?? '')
      setPrintedTech(completionData.unterschrift_mitarbeiter_name ?? monteurName)
      setPrintedCust(completionData.unterschrift_kunde_name ?? '')
    } else {
      setAusgeführte('')
      setPrintedTech(monteurName)
      setPrintedCust('')
    }
    setExtra(parsedExtra)

    const oidForPortal = orderData ? getOrderObjectIds(orderData)[0] ?? orderData.object_id : null
    const [settingsRow, eligible] = await Promise.all([
      fetchMonteurReportSettingsFull(),
      oidForPortal ? fetchMonteurPortalDeliveryEligible(oidForPortal) : Promise.resolve(false),
    ])
    setMonteurSettingsFull(settingsRow)
    setMonteurDeliveryMode(settingsRow?.customer_delivery_mode ?? 'none')
    setPortalEligible(Boolean(eligible))

    if (orderData?.order_type === 'wartung' && settingsRow) {
      const oids = getOrderObjectIds(orderData).filter(Boolean)
      const objs: Obj[] = []
      for (const id of oids) {
        const o = await fetchObject(id)
        if (o) objs.push(o)
      }
      setOrderObjects(objs)
      const reportMap: Record<string, string> = {}
      if (isOnline()) {
        for (const oid of oids) {
          const rid = await fetchMaintenanceReportIdByOrderObject(orderData.id, oid)
          if (rid) {
            reportMap[oid] = rid
            const rows = await fetchChecklistDefectPhotos(rid, oid)
            const grouped: Record<string, ChecklistDefectPhoto[]> = {}
            for (const r of rows) {
              const key = `${r.checklist_scope}:${r.checklist_item_id}`
              grouped[key] = [...(grouped[key] ?? []), r]
            }
            setDefectPhotosByObject((prev) => ({ ...prev, [oid]: grouped }))
          }
        }
      }
      setChecklistReportIdByObject(reportMap)
      const mode = settingsRow.wartung_checkliste_modus
      const wc = parsedExtra.wartung_checkliste?.by_object_id ?? {}
      const initKey = `${orderData.id}-${completionData?.id ?? 'new'}`
      if (checklistInitKeyRef.current !== initKey) {
        checklistInitKeyRef.current = initKey
        const map: Record<string, Record<string, WartungChecklistItemState>> = {}
        for (const oid of oids) {
          const saved = wc[oid]?.items
          map[oid] =
            saved && Object.keys(saved).length > 0 ? { ...saved } : initEmptyChecklistItems(mode)
        }
        setChecklistItemsByObject(map)
        const festMap: Record<string, Record<string, FeststellChecklistItemState>> = {}
        for (const oid of oids) {
          const o = objs.find((x) => x.id === oid)
          if (!o?.has_hold_open) continue
          const fs = wc[oid]?.feststell_checkliste?.items
          festMap[oid] =
            fs && Object.keys(fs).length > 0 ? { ...fs } : initEmptyFeststellChecklistItems(mode)
        }
        setFeststellItemsByObject(festMap)
        setSelectedChecklistObjectId(oids[0] ?? null)
      }
    } else {
      setOrderObjects([])
      setChecklistItemsByObject({})
      setFeststellItemsByObject({})
      setChecklistReportIdByObject({})
      setDefectPhotosByObject({})
      setSelectedChecklistObjectId(null)
      checklistInitKeyRef.current = ''
    }
    setSigTechDataUrl(null)
    setSigCustDataUrl(null)
    setIsLoading(false)
  }, [orderId, user])

  useEffect(() => {
    loadData()
  }, [loadData])

  const orderCustomer = useMemo(
    () => (order ? customers.find((c) => c.id === order.customer_id) : undefined),
    [order, customers]
  )
  const orderBv = useMemo(
    () => (order?.bv_id ? allBvs.find((b) => b.id === order.bv_id) : undefined),
    [order, allBvs]
  )
  const orderObjectIds = useMemo(
    () => (order ? getOrderObjectIds(order).filter(Boolean) : []),
    [order]
  )
  const defaultChecklistMode: ChecklistDisplayMode = monteurSettingsFull?.wartung_checkliste_modus ?? 'detail'
  const checklistMode: ChecklistDisplayMode = checklistModeOverride ?? defaultChecklistMode
  const objectsById = useMemo(() => {
    const m: Record<string, Obj> = {}
    for (const o of orderObjects) m[o.id] = o
    return m
  }, [orderObjects])
  const monteurLocked = useMemo(() => {
    if (order?.order_type !== 'wartung' || orderObjectIds.length === 0) return false
    const sel = selectedChecklistObjectId
    if (!sel) return true
    const doorSaved = Boolean(extra.wartung_checkliste?.by_object_id[sel]?.saved_at)
    const needFest = Boolean(objectsById[sel]?.has_hold_open)
    const festSaved = Boolean(extra.wartung_checkliste?.by_object_id[sel]?.feststell_checkliste?.saved_at)
    if (!doorSaved) return true
    if (needFest && !festSaved) return true
    return false
  }, [
    order?.order_type,
    orderObjectIds.length,
    selectedChecklistObjectId,
    extra.wartung_checkliste?.by_object_id,
    objectsById,
  ])
  const monteurReportDelivery = useMemo(
    () => resolveReportDeliverySettings(orderCustomer, orderBv),
    [orderCustomer, orderBv]
  )
  const monteurInternalOnly = !monteurReportDelivery.monteur_report_portal
  const monteurPortalForCustomer = monteurReportDelivery.monteur_report_portal

  const canReopenOrder = useMemo(() => {
    if (!order || order.status !== 'erledigt') return false
    if (license?.read_only) return false
    if (!myProfile) return false
    return myProfile.role === 'admin' || myProfile.role === 'mitarbeiter'
  }, [order, license?.read_only, myProfile])

  const buildMergedDeficiencyForOid = useCallback(
    (oid: string) => {
      const doorItems =
        checklistItemsByObject[oid] ?? extra.wartung_checkliste?.by_object_id[oid]?.items ?? {}
      const doorText = buildDeficiencyTextFromChecklist(checklistMode, doorItems)
      const ob = objectsById[oid]
      if (!ob?.has_hold_open) {
        const t = doorText.trim()
        return { text: doorText, hasDef: t.length > 0 }
      }
      const festItems =
        feststellItemsByObject[oid] ??
        extra.wartung_checkliste?.by_object_id[oid]?.feststell_checkliste?.items ??
        {}
      const festText = buildDeficiencyTextFromFeststellChecklist(checklistMode, festItems)
      const merged = [doorText, festText].filter((x) => x.trim().length > 0).join('\n\n---\n\n')
      return { text: merged, hasDef: merged.trim().length > 0 }
    },
    [
      checklistItemsByObject,
      checklistMode,
      extra.wartung_checkliste?.by_object_id,
      feststellItemsByObject,
      objectsById,
    ]
  )

  const setExtraField = <K extends keyof OrderCompletionExtraV1>(key: K, value: OrderCompletionExtraV1[K]) => {
    setExtra((prev) => ({ ...prev, [key]: value }))
  }

  const setPrimary = (patch: Partial<OrderCompletionExtraV1['primary']>) => {
    setExtra((prev) => ({ ...prev, primary: { ...prev.primary, ...patch } }))
  }

  const handleMaterialChange = (index: number, field: 'anzahl' | 'artikel', value: string) => {
    setExtra((prev) => {
      const material_lines = prev.material_lines.map((row, i) =>
        i === index ? { ...row, [field]: value } : row
      )
      return { ...prev, material_lines }
    })
  }

  const handleAddMaterialRow = () => {
    setExtra((prev) => ({ ...prev, material_lines: [...prev.material_lines, { anzahl: '', artikel: '' }] }))
  }

  const handleAddZusatz = () => {
    setExtra((prev) => ({
      ...prev,
      zusatz_monteure: [...prev.zusatz_monteure, { name: '', start: '', end: '', pause_minuten: 0 }],
    }))
  }

  const handleZusatzChange = (
    index: number,
    patch: Partial<OrderCompletionExtraV1['zusatz_monteure'][0]>
  ) => {
    setExtra((prev) => ({
      ...prev,
      zusatz_monteure: prev.zusatz_monteure.map((z, i) => (i === index ? { ...z, ...patch } : z)),
    }))
  }

  const handleZusatzProfilePick = (index: number, profileId: string) => {
    const p = profiles.find((x) => x.id === profileId)
    handleZusatzChange(index, {
      profile_id: profileId || undefined,
      name: p ? getProfileDisplayName(p) : '',
    })
  }

  const persistCompletion = async (
    completionId: string | null,
    payloadBase: {
      ausgeführte_arbeiten: string | null
      material: string | null
      arbeitszeit_minuten: number | null
      completion_extra: OrderCompletionExtraV1
      unterschrift_mitarbeiter_name: string | null
      unterschrift_mitarbeiter_date: string | null
      unterschrift_kunde_name: string | null
      unterschrift_kunde_date: string | null
      unterschrift_mitarbeiter_path: string | null
      unterschrift_kunde_path: string | null
    }
  ): Promise<OrderCompletion | null> => {
    if (!order) return null
    let id = completionId
    let techPath = payloadBase.unterschrift_mitarbeiter_path
    let custPath = payloadBase.unterschrift_kunde_path

    const extraJson = payloadBase.completion_extra as unknown as OrderCompletion['completion_extra']

    if (!id) {
      const { data, error } = await createOrderCompletion({
        order_id: order.id,
        ausgeführte_arbeiten: payloadBase.ausgeführte_arbeiten,
        material: payloadBase.material,
        arbeitszeit_minuten: payloadBase.arbeitszeit_minuten,
        completion_extra: extraJson,
        monteur_pdf_path: null,
        unterschrift_mitarbeiter_name: payloadBase.unterschrift_mitarbeiter_name,
        unterschrift_mitarbeiter_date: payloadBase.unterschrift_mitarbeiter_date,
        unterschrift_kunde_name: payloadBase.unterschrift_kunde_name,
        unterschrift_kunde_date: payloadBase.unterschrift_kunde_date,
        unterschrift_mitarbeiter_path: null,
        unterschrift_kunde_path: null,
      })
      if (error) {
        showError(getSupabaseErrorMessage(error))
        return null
      }
      if (!data) return null
      id = data.id
    }

    if (sigTechDataUrl && id) {
      const up = await uploadOrderCompletionSignature(id, sigTechDataUrl, 'technician')
      if (up.path) techPath = up.path
      else if (up.error) showError(up.error.message)
    }
    if (sigCustDataUrl && id) {
      const up = await uploadOrderCompletionSignature(id, sigCustDataUrl, 'customer')
      if (up.path) custPath = up.path
      else if (up.error) showError(up.error.message)
    }

    const finalPayload = {
      ausgeführte_arbeiten: payloadBase.ausgeführte_arbeiten,
      material: payloadBase.material,
      arbeitszeit_minuten: payloadBase.arbeitszeit_minuten,
      completion_extra: extraJson,
      unterschrift_mitarbeiter_name: payloadBase.unterschrift_mitarbeiter_name,
      unterschrift_mitarbeiter_date: payloadBase.unterschrift_mitarbeiter_date,
      unterschrift_kunde_name: payloadBase.unterschrift_kunde_name,
      unterschrift_kunde_date: payloadBase.unterschrift_kunde_date,
      unterschrift_mitarbeiter_path: techPath,
      unterschrift_kunde_path: custPath,
    }

    const { error: upErr } = await updateOrderCompletion(id, finalPayload)
    if (upErr) {
      showError(getSupabaseErrorMessage(upErr))
      return null
    }

    return {
      id,
      order_id: order.id,
      created_at: completion?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
      monteur_pdf_path: completion?.monteur_pdf_path ?? null,
      ...finalPayload,
      completion_extra: payloadBase.completion_extra,
    } as OrderCompletion
  }

  const buildPayload = useCallback(
    (parked: boolean): Omit<Parameters<typeof persistCompletion>[1], never> & { order_id?: string } => {
      const nextExtra: OrderCompletionExtraV1 = {
        ...extra,
        parked,
        portal_teilen: false,
        monteur_name: printedTech.trim() || extra.monteur_name,
      }
      const totalMin = sumWorkMinutes(nextExtra.primary, nextExtra.zusatz_monteure)
      return {
        ausgeführte_arbeiten: ausgeführte.trim() || null,
        material: materialLinesToText(nextExtra.material_lines) || null,
        arbeitszeit_minuten: totalMin > 0 ? totalMin : null,
        completion_extra: nextExtra,
        unterschrift_mitarbeiter_name: printedTech.trim() || null,
        unterschrift_mitarbeiter_date: new Date().toISOString(),
        unterschrift_kunde_name: printedCust.trim() || null,
        unterschrift_kunde_date: printedCust.trim() ? new Date().toISOString() : null,
        unterschrift_mitarbeiter_path: completion?.unterschrift_mitarbeiter_path ?? null,
        unterschrift_kunde_path: completion?.unterschrift_kunde_path ?? null,
      }
    },
    [extra, ausgeführte, printedTech, printedCust, completion]
  )

  const runAfterSavePdfAndPortal = async (
    comp: OrderCompletion,
    pdfBlob: Blob,
    doPortal: boolean,
    extraSnapshot: OrderCompletionExtraV1
  ): Promise<{ monteurPath: string | null }> => {
    let monteurPath: string | null = null
    const { path, error } = await uploadMonteurBerichtPdf(comp.id, pdfBlob)
    if (!error && path) {
      await updateOrderCompletion(comp.id, { monteur_pdf_path: path })
      monteurPath = path
    }
    if (doPortal && order) {
      const oid = getOrderObjectIds(order)[0] ?? order.object_id
      if (!oid) {
        showError('Kein Tür/Tor am Auftrag – Portal-Freigabe nicht möglich.')
        return { monteurPath }
      }
      if (order.order_type === 'wartung') {
        const attached = await attachMonteurPdfToOrderChecklistProtocol(order.id, oid, pdfBlob)
        if (attached.error) {
          showError(attached.error.message)
          return { monteurPath }
        }
        if (attached.reportId) {
          return { monteurPath }
        }
      }
      const { data: report, error: crErr } = await createMaintenanceReport(
        {
          object_id: oid,
          maintenance_date: extraSnapshot.bericht_datum,
          maintenance_time: null,
          technician_id: user?.id ?? null,
          reason: orderTypeToMaintenanceReason(order.order_type),
          reason_other: null,
          manufacturer_maintenance_done: false,
          hold_open_checked: null,
          deficiencies_found: false,
          deficiency_description: (ausgeführte || '').slice(0, 2000) || null,
          urgency: null,
          fixed_immediately: true,
          customer_signature_path: comp.unterschrift_kunde_path,
          technician_signature_path: comp.unterschrift_mitarbeiter_path,
          technician_name_printed: printedTech || null,
          customer_name_printed: printedCust || null,
          pdf_path: null,
          synced: true,
        },
        [],
        { skipPortalNotify: true }
      )
      if (crErr || !report) {
        showError(crErr ? getSupabaseErrorMessage(crErr) : 'Portal-Bericht konnte nicht angelegt werden.')
        return { monteurPath }
      }
      const up = await uploadMaintenancePdf(report.id, pdfBlob)
      if (up.path) {
        const { error: pdfErr } = await updateMaintenanceReportPdfPath(report.id, up.path)
        if (!pdfErr) {
          notifyPortalOnMaintenanceReport(report.id)
        }
      }
    }
    return { monteurPath }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!order) return
    if (license?.read_only) {
      showError('Schreibschutz aktiv (Lizenz).')
      return
    }
    setFormError(null)
    setIsSaving(true)
    const payload = buildPayload(extra.parked ?? false)
    const comp = await persistCompletion(completion?.id ?? null, payload)
    setIsSaving(false)
    if (comp) {
      setCompletion(comp)
      setSigTechDataUrl(null)
      setSigCustDataUrl(null)
      showToast('Bericht gespeichert.', 'success')
    }
  }

  const handleChecklistItemChange = (itemId: string, patch: Partial<WartungChecklistItemState>) => {
    const oid = selectedChecklistObjectId
    if (!oid) return
    setChecklistItemsByObject((prev) => {
      const cur = prev[oid] ?? {}
      return {
        ...prev,
        [oid]: {
          ...cur,
          [itemId]: { ...(cur[itemId] ?? {}), ...patch },
        },
      }
    })
  }

  const handleFeststellItemChange = (itemId: string, patch: Partial<FeststellChecklistItemState>) => {
    const oid = selectedChecklistObjectId
    if (!oid) return
    setFeststellItemsByObject((prev) => {
      const cur = prev[oid] ?? {}
      return {
        ...prev,
        [oid]: {
          ...cur,
          [itemId]: { ...(cur[itemId] ?? {}), ...patch },
        },
      }
    })
  }

  const handleUploadDoorDefectPhoto = async (itemId: string, file: File) => {
    if (!order || !selectedChecklistObjectId) return
    const oid = selectedChecklistObjectId
    const reportId = checklistReportIdByObject[oid]
    if (!reportId) {
      showError('Bitte zuerst Checkliste speichern, damit das Prüfprotokoll erstellt ist.')
      return
    }
    const key = `door:${itemId}`
    if ((defectPhotosByObject[oid]?.[key] ?? []).length >= 3) {
      showError('Maximal 3 Fotos pro Mangelpunkt.')
      return
    }
    setUploadingDefectPhotoItem(itemId)
    const { data, error } = await uploadChecklistDefectPhoto({
      maintenanceReportId: reportId,
      objectId: oid,
      checklistScope: 'door',
      checklistItemId: itemId,
      file,
    })
    setUploadingDefectPhotoItem(null)
    if (error || !data) {
      showError(error?.message ?? 'Foto konnte nicht gespeichert werden.')
      return
    }
    setDefectPhotosByObject((prev) => ({
      ...prev,
      [oid]: {
        ...(prev[oid] ?? {}),
        [key]: [...(prev[oid]?.[key] ?? []), data],
      },
    }))
  }

  const handleUploadFeststellDefectPhoto = async (itemId: string, file: File) => {
    if (!order || !selectedChecklistObjectId) return
    const oid = selectedChecklistObjectId
    const reportId = checklistReportIdByObject[oid]
    if (!reportId) {
      showError('Bitte zuerst Checkliste speichern, damit das Prüfprotokoll erstellt ist.')
      return
    }
    const key = `feststell:${itemId}`
    if ((defectPhotosByObject[oid]?.[key] ?? []).length >= 3) {
      showError('Maximal 3 Fotos pro Mangelpunkt.')
      return
    }
    setUploadingDefectPhotoItem(itemId)
    const { data, error } = await uploadChecklistDefectPhoto({
      maintenanceReportId: reportId,
      objectId: oid,
      checklistScope: 'feststell',
      checklistItemId: itemId,
      file,
    })
    setUploadingDefectPhotoItem(null)
    if (error || !data) {
      showError(error?.message ?? 'Foto konnte nicht gespeichert werden.')
      return
    }
    setDefectPhotosByObject((prev) => ({
      ...prev,
      [oid]: {
        ...(prev[oid] ?? {}),
        [key]: [...(prev[oid]?.[key] ?? []), data],
      },
    }))
  }

  const handleDeleteDefectPhoto = async (
    scope: 'door' | 'feststell',
    itemId: string,
    photoId: string,
    storagePath: string | null
  ) => {
    if (!selectedChecklistObjectId) return
    const oid = selectedChecklistObjectId
    const key = `${scope}:${itemId}`
    const { error } = await deleteChecklistDefectPhoto(photoId, storagePath)
    if (error) {
      showError(error.message)
      return
    }
    setDefectPhotosByObject((prev) => ({
      ...prev,
      [oid]: {
        ...(prev[oid] ?? {}),
        [key]: (prev[oid]?.[key] ?? []).filter((p) => p.id !== photoId),
      },
    }))
  }

  const handleSaveFeststellChecklist = async () => {
    if (!order || !selectedChecklistObjectId) return
    if (license?.read_only) {
      showError('Schreibschutz aktiv (Lizenz).')
      return
    }
    const oid = selectedChecklistObjectId
    if (!objectsById[oid]?.has_hold_open) return
    const items = feststellItemsByObject[oid] ?? {}
    const v = validateFeststellChecklistComplete(checklistMode, items)
    if (!v.ok) {
      setFeststellSaveError(v.message)
      return
    }
    setFeststellSaveError(null)
    if (!isOnline()) {
      showError('Checklisten-Protokoll ist nur bei Verbindung speicherbar.')
      return
    }
    const prevPer = extra.wartung_checkliste?.by_object_id[oid]
    const baseDoorItems = checklistItemsByObject[oid] ?? prevPer?.items ?? {}
    setFeststellSaving(true)
    const nextWartung: WartungChecklistExtraV1 = {
      v: 1,
      by_object_id: {
        ...(extra.wartung_checkliste?.by_object_id ?? {}),
        [oid]: {
          ...prevPer,
          saved_at: prevPer?.saved_at ?? new Date().toISOString(),
          checklist_modus: checklistMode,
          items: { ...baseDoorItems },
          feststell_checkliste: {
            saved_at: new Date().toISOString(),
            checklist_modus: checklistMode,
            items: { ...items },
          },
        },
      },
    }
    const mergedExtra: OrderCompletionExtraV1 = { ...extra, wartung_checkliste: nextWartung }
    setExtra(mergedExtra)
    const totalMin = sumWorkMinutes(mergedExtra.primary, mergedExtra.zusatz_monteure)
    const completionPayload = {
      ausgeführte_arbeiten: ausgeführte.trim() || null,
      material: materialLinesToText(mergedExtra.material_lines) || null,
      arbeitszeit_minuten: totalMin > 0 ? totalMin : null,
      completion_extra: mergedExtra,
      unterschrift_mitarbeiter_name: printedTech.trim() || null,
      unterschrift_mitarbeiter_date: new Date().toISOString(),
      unterschrift_kunde_name: printedCust.trim() || null,
      unterschrift_kunde_date: printedCust.trim() ? new Date().toISOString() : null,
      unterschrift_mitarbeiter_path: completion?.unterschrift_mitarbeiter_path ?? null,
      unterschrift_kunde_path: completion?.unterschrift_kunde_path ?? null,
    }
    const comp = await persistCompletion(completion?.id ?? null, completionPayload)
    if (comp) {
      setCompletion(comp)
      const merged = buildMergedDeficiencyForOid(oid)
      const up = await upsertWartungsChecklistProtocol({
        orderId: order.id,
        objectId: oid,
        maintenanceDate: mergedExtra.bericht_datum,
        technicianId: user?.id ?? null,
        feststellChecklistProtocol: {
          modus: checklistMode,
          items,
          norms: ['DIN 14677-1', 'DIN 14677-2'],
          order_id: order.id,
        },
        deficiencyDescription: merged.hasDef ? merged.text : null,
        deficienciesFound: merged.hasDef,
      })
      if (up.error) showError(up.error.message)
      else {
        if (up.data?.id) setChecklistReportIdByObject((prev) => ({ ...prev, [oid]: up.data!.id }))
        showToast('Feststellanlagen-Checkliste gespeichert.', 'success')
      }
    }
    setFeststellSaving(false)
  }

  const handleSaveCombinedChecklist = async () => {
    await handleSaveChecklist()
    if (selectedChecklistObjectId && objectsById[selectedChecklistObjectId]?.has_hold_open) {
      await handleSaveFeststellChecklist()
    }
  }

  const handleSaveChecklist = async () => {
    if (!order || !selectedChecklistObjectId) return
    if (license?.read_only) {
      showError('Schreibschutz aktiv (Lizenz).')
      return
    }
    const oid = selectedChecklistObjectId
    const items = checklistItemsByObject[oid] ?? {}
    const v = validateChecklistComplete(checklistMode, items)
    if (!v.ok) {
      setChecklistSaveError(v.message)
      return
    }
    setChecklistSaveError(null)
    if (!isOnline()) {
      showError('Checklisten-Protokoll ist nur bei Verbindung speicherbar.')
      return
    }
    setChecklistSaving(true)
    const prevPer = extra.wartung_checkliste?.by_object_id[oid]
    const nextWartung: WartungChecklistExtraV1 = {
      v: 1,
      by_object_id: {
        ...(extra.wartung_checkliste?.by_object_id ?? {}),
        [oid]: {
          saved_at: new Date().toISOString(),
          checklist_modus: checklistMode,
          items: { ...items },
          ...(prevPer?.feststell_checkliste
            ? { feststell_checkliste: { ...prevPer.feststell_checkliste } }
            : {}),
        },
      },
    }
    const mergedExtra: OrderCompletionExtraV1 = { ...extra, wartung_checkliste: nextWartung }
    setExtra(mergedExtra)
    const totalMin = sumWorkMinutes(mergedExtra.primary, mergedExtra.zusatz_monteure)
    const completionPayload = {
      ausgeführte_arbeiten: ausgeführte.trim() || null,
      material: materialLinesToText(mergedExtra.material_lines) || null,
      arbeitszeit_minuten: totalMin > 0 ? totalMin : null,
      completion_extra: mergedExtra,
      unterschrift_mitarbeiter_name: printedTech.trim() || null,
      unterschrift_mitarbeiter_date: new Date().toISOString(),
      unterschrift_kunde_name: printedCust.trim() || null,
      unterschrift_kunde_date: printedCust.trim() ? new Date().toISOString() : null,
      unterschrift_mitarbeiter_path: completion?.unterschrift_mitarbeiter_path ?? null,
      unterschrift_kunde_path: completion?.unterschrift_kunde_path ?? null,
    }
    const comp = await persistCompletion(completion?.id ?? null, completionPayload)
    if (comp) {
      setCompletion(comp)
      const merged = buildMergedDeficiencyForOid(oid)
      const ob = objectsById[oid]
      const festItems =
        feststellItemsByObject[oid] ??
        extra.wartung_checkliste?.by_object_id[oid]?.feststell_checkliste?.items ??
        {}
      const festProto =
        ob?.has_hold_open
          ? {
              modus: checklistMode,
              items: festItems,
              norms: ['DIN 14677-1', 'DIN 14677-2'],
              order_id: order.id,
            }
          : undefined
      const up = await upsertWartungsChecklistProtocol({
        orderId: order.id,
        objectId: oid,
        maintenanceDate: mergedExtra.bericht_datum,
        technicianId: user?.id ?? null,
        checklistProtocol: {
          modus: checklistMode,
          items,
          norms: ['DIN EN 1634', 'DIN EN 16034', 'DIN 4102', 'DIN 18040'],
          order_id: order.id,
        },
        ...(festProto ? { feststellChecklistProtocol: festProto } : {}),
        deficiencyDescription: merged.hasDef ? merged.text : null,
        deficienciesFound: merged.hasDef,
      })
      if (up.error) showError(up.error.message)
      else {
        if (up.data?.id) setChecklistReportIdByObject((prev) => ({ ...prev, [oid]: up.data!.id }))
        showToast('Checkliste und Prüfprotokoll gespeichert.', 'success')
      }
    }
    setChecklistSaving(false)
  }

  const handlePark = async () => {
    if (!order) return
    if (license?.read_only) {
      showError('Schreibschutz aktiv (Lizenz).')
      return
    }
    setIsSaving(true)
    const payload = buildPayload(true)
    const comp = await persistCompletion(completion?.id ?? null, payload)
    if (comp) {
      setCompletion(comp)
      if (order.status === 'offen') await updateOrderStatus(order.id, 'in_bearbeitung')
      setOrder((o) => (o ? { ...o, status: 'in_bearbeitung' } : null))
      showToast('Bericht zwischengespeichert (geparkt).', 'success')
    }
    setIsSaving(false)
  }

  const runCompleteOrder = async (
    shareToPortal: boolean,
    opts?: { bypassWartungChecklist?: boolean }
  ) => {
    if (!order) return
    if (license?.read_only) {
      showError('Schreibschutz aktiv (Lizenz).')
      return
    }
    setCompleteDialogOpen(false)
    setCompleteDialogPhase('confirm')
    setCompleteDialogGate(null)
    setIsSaving(true)
    const payload = buildPayload(false)
    const oidsComplete = getOrderObjectIds(order).filter(Boolean)
    if (
      order.order_type === 'wartung' &&
      oidsComplete.length > 0 &&
      !opts?.bypassWartungChecklist
    ) {
      const gate = evaluateWartungChecklistGate(
        order,
        payload.completion_extra.wartung_checkliste,
        orderObjects
      )
      if (!gate.ok) {
        showError(gate.message)
        setIsSaving(false)
        return
      }
    }
    if (order.order_type === 'wartung') {
      if (opts?.bypassWartungChecklist) {
        const gateSnap = evaluateWartungChecklistGate(
          order,
          payload.completion_extra.wartung_checkliste,
          orderObjects
        )
        payload.completion_extra = {
          ...payload.completion_extra,
          wartung_checkliste_abschluss_bypass: {
            at: new Date().toISOString(),
            profile_id: user?.id ?? null,
            incomplete_object_ids: gateSnap.ok ? [] : gateSnap.incompleteObjectIds,
          },
        }
      } else {
        const { wartung_checkliste_abschluss_bypass: _omitBypass, ...restExtra } = payload.completion_extra
        payload.completion_extra = restExtra as OrderCompletionExtraV1
      }
    }
    const comp = await persistCompletion(completion?.id ?? null, payload)
    if (!comp) {
      setIsSaving(false)
      return
    }
    setCompletion(comp)
    setExtra(
      parseOrderCompletionExtra(
        comp.completion_extra,
        printedTech.trim() || comp.unterschrift_mitarbeiter_name || extra.monteur_name
      )
    )
    const hasPortalLicense = Boolean(license && hasFeature(license, 'kundenportal'))
    let doPortal =
      !monteurInternalOnly &&
      monteurPortalForCustomer &&
      monteurDeliveryMode === 'portal_notify' &&
      hasPortalLicense &&
      portalEligible &&
      shareToPortal
    if (monteurInternalOnly) {
      /* nur intern: kein Portal, kein E-Mail */
    } else if (monteurDeliveryMode === 'portal_notify' && hasPortalLicense && portalEligible && !monteurPortalForCustomer) {
      showToast(
        'Kundenportal-Zustellung für diesen Kunden in den Stammdaten deaktiviert; es wird kein Portal-Eintrag erzeugt.',
        'info'
      )
    } else if (monteurDeliveryMode === 'portal_notify' && hasPortalLicense && !portalEligible) {
      showToast(
        'Kundenportal-Zustellung für dieses Objekt nicht möglich (kein passender Portal-Zugang oder keine Sichtbarkeit Firma/BV).',
        'info'
      )
    }
    if (monteurDeliveryMode === 'portal_notify' && !hasPortalLicense) {
      doPortal = false
      showToast('Kundenportal ist in der Lizenz nicht aktiv; es wird kein Portal-Eintrag erzeugt.', 'info')
    }
    const scanUrl = `${window.location.origin}/auftrag/${order.id}`
    try {
      const extraSnap = { ...payload.completion_extra, parked: false, portal_teilen: false }
      const wartungInspectedDoorLabels =
        order.order_type === 'wartung' && oidsComplete.length > 0
          ? oidsComplete.map((oid) => {
              const o = orderObjects.find((x) => x.id === oid)
              return o ? getObjectDisplayName(o) : oid.slice(0, 8)
            })
          : undefined
      const pdfBlob = await generateMonteurBerichtPdf({
        order,
        completion: comp,
        extra: extraSnap,
        customerName: getCustomerName(order.customer_id),
        bvName: getBvName(order.bv_id),
        objectLabel,
        orderTypeLabel: ORDER_TYPE_LABELS[order.order_type],
        scanUrl,
        letterheadDataUrl: null,
        wartungInspectedDoorLabels,
        pruefprotokollKurzverweis: order.order_type === 'wartung' && oidsComplete.length > 0,
      })
      const { monteurPath } = await runAfterSavePdfAndPortal(comp, pdfBlob, doPortal, extraSnap)
      if (order.order_type === 'wartung' && isRelease110Enabled && isOnline()) {
        for (const oid of oidsComplete) {
          const obj = orderObjects.find((x) => x.id === oid)
          const per = extraSnap.wartung_checkliste?.by_object_id[oid]
          if (!obj || !per?.saved_at) continue
          const mode = per.checklist_modus === 'compact' ? 'compact' : 'detail'
          try {
            const prBlob = await generatePruefprotokollPdf({
              order,
              customerName: getCustomerName(order.customer_id),
              bvName: getBvName(order.bv_id),
              object: obj,
              berichtDatum: extraSnap.bericht_datum,
              monteurName: (printedTech.trim() || extraSnap.monteur_name || 'Monteur').trim(),
              doorMode: mode,
              doorItems: per.items ?? {},
              feststellMode: mode,
              feststellItems: per.feststell_checkliste?.items ?? {},
              includeFeststell: Boolean(obj.has_hold_open && per.feststell_checkliste?.saved_at),
              defectPhotosByItem: Object.fromEntries(
                Object.entries(defectPhotosByObject[oid] ?? {}).map(([k, v]) => [
                  k,
                  v.map((p) => ({ storage_path: p.storage_path, caption: p.caption })),
                ])
              ),
            })
            const att = await attachPruefprotokollPdfToOrderChecklistProtocol(order.id, oid, prBlob)
            if (att.error) showToast(`Prüfprotokoll: ${att.error.message}`, 'info')
          } catch {
            showToast(
              `Prüfprotokoll für ${getObjectDisplayName(obj)} konnte nicht erzeugt oder gespeichert werden.`,
              'info'
            )
          }
        }
      }
      if (monteurPath) {
        setCompletion((prev) => (prev ? { ...prev, monteur_pdf_path: monteurPath } : prev))
      }
      if (monteurDeliveryMode === 'email_auto' && monteurPath && isOnline()) {
        const cust = customers.find((c) => c.id === order.customer_id)
        const bv = order.bv_id ? allBvs.find((b) => b.id === order.bv_id) : undefined
        const recipient = getMonteurReportRecipientEmail(cust, bv)
        if (recipient) {
          const subject = `Monteursbericht ${objectLabel} – ${extraSnap.bericht_datum}`
          const filename = `Monteursbericht-${order.id.slice(0, 8)}.pdf`
          const { error: sendErr } = await sendMaintenanceReportEmail(
            monteurPath,
            recipient,
            subject,
            filename
          )
          if (sendErr) showError(`E-Mail: ${sendErr.message}`)
          else showToast(`Bericht wurde an ${recipient} gesendet.`, 'success')
        } else {
          showToast('Automatischer E-Mail-Versand übersprungen: keine Adresse bei Kunde/BV hinterlegt.', 'info')
        }
      }
    } catch {
      showError('PDF-Erstellung fehlgeschlagen.')
    }
    const { error } = await updateOrderStatus(order.id, 'erledigt')
    if (error) showError(getSupabaseErrorMessage(error))
    else {
      setOrder((o) => (o ? { ...o, status: 'erledigt' } : null))
      showToast('Auftrag erledigt.', 'success')
      if (order.order_type === 'wartung') {
        const byObject = payload.completion_extra.wartung_checkliste?.by_object_id
        if (byObject && Object.keys(byObject).length > 0) {
          const fu = await insertDefectFollowupsForCompletedWartungOrder({
            orderId: order.id,
            byObject,
          })
          if (fu.error) showToast(`Hinweis Follow-up Mängel: ${fu.error.message}`, 'info')
        }
        if (monteurSettingsFull?.mangel_neuer_auftrag_default) {
          const wc = payload.completion_extra.wartung_checkliste?.by_object_id
          let anyMangel = false
          if (wc) {
            for (const per of Object.values(wc)) {
              if (!per?.saved_at) continue
              const mode = per.checklist_modus === 'compact' ? 'compact' : 'detail'
              if (checklistHasOpenMangel(mode, per.items ?? {})) anyMangel = true
              const fc = per.feststell_checkliste
              if (
                fc?.saved_at &&
                checklistHasOpenMangelFeststell(
                  fc.checklist_modus === 'compact' ? 'compact' : 'detail',
                  fc.items ?? {}
                )
              ) {
                anyMangel = true
              }
            }
          }
          if (anyMangel) {
            showToast('Hinweis: Folgeauftrag zur Mängelbeseitigung können Sie unter „Aufträge“ anlegen.', 'info')
          }
        }
        if (opts?.bypassWartungChecklist) {
          const gateAfter = evaluateWartungChecklistGate(
            order,
            payload.completion_extra.wartung_checkliste,
            orderObjects
          )
          if (!gateAfter.ok && gateAfter.incompleteObjectIds.length > 0) {
            followUpOidsRef.current = gateAfter.incompleteObjectIds
            const labels = gateAfter.incompleteObjectIds
              .map((oid) => {
                const ob = orderObjects.find((x) => x.id === oid)
                return ob ? getObjectDisplayName(ob) : oid.slice(0, 8)
              })
              .join(', ')
            setFollowUpDialogMessage(
              `Folgende Türen waren nicht vollständig geprüft: ${labels}. Soll ein neuer Wartungsauftrag mit genau diesen Türen angelegt werden?`
            )
            setFollowUpDialogOpen(true)
          }
        }
      }
    }
    setIsSaving(false)
  }

  const handleOpenCompleteDialog = () => {
    if (!printedTech.trim()) {
      showError('Bitte Monteur-Namen für die Unterschrift angeben.')
      return
    }
    if (!printedCust.trim() && !(extra.customer_signature_reason ?? '').trim()) {
      showError('Ohne Kundenunterschrift bitte einen Grund im Monteurbericht angeben.')
      return
    }
    setCompleteDialogPhase('confirm')
    setCompleteDialogGate(null)
    setCompleteSharePortal(true)
    setCompleteDialogOpen(true)
  }

  const resetCompleteDialog = () => {
    setCompleteDialogOpen(false)
    setCompleteDialogPhase('confirm')
    setCompleteDialogGate(null)
  }

  const handleSubmitCompleteDialog = () => {
    if (!order) return
    const payload = buildPayload(false)
    const gate = evaluateWartungChecklistGate(
      order,
      payload.completion_extra.wartung_checkliste,
      orderObjects
    )
    if (!gate.ok) {
      setCompleteDialogGate(gate)
      setCompleteDialogPhase('bypass_warning')
      return
    }
    void runCompleteOrder(showPortalChoiceInDialog ? completeSharePortal : false, {})
  }

  const handleBackFromBypassWarning = () => {
    setCompleteDialogPhase('confirm')
    setCompleteDialogGate(null)
  }

  const handleCompleteDespiteChecklist = () => {
    void runCompleteOrder(showPortalChoiceInDialog ? completeSharePortal : false, {
      bypassWartungChecklist: true,
    })
  }

  const handleFollowUpDialogConfirm = async () => {
    const oids = [...followUpOidsRef.current]
    setFollowUpDialogOpen(false)
    followUpOidsRef.current = []
    if (!order || oids.length === 0) return
    if (!isOnline()) {
      showError('Neuer Auftrag ist nur mit Verbindung möglich.')
      return
    }
    const { data, error } = await createOrder(
      {
        customer_id: order.customer_id,
        bv_id: order.bv_id,
        object_id: oids[0] ?? null,
        object_ids: oids,
        order_date: new Date().toISOString().slice(0, 10),
        order_time: null,
        order_type: 'wartung',
        status: 'offen',
        description: `Nacharbeit / nicht vollständig geprüft (Folge zu Auftrag ${order.id.slice(0, 8)})`,
        assigned_to: order.assigned_to ?? null,
      },
      user?.id ?? null
    )
    if (error) {
      if (isOrderActivePerObjectError(error) && error.conflicts[0]) {
        showError(error.message)
        navigate(`/auftrag/${error.conflicts[0].orderId}`)
        return
      }
      showError(error.message)
      return
    }
    if (data) {
      showToast('Folge-Wartungsauftrag angelegt.', 'success')
      navigate(`/auftrag/${data.id}`)
    }
  }

  const handleSendMonteurReportEmail = async () => {
    if (!order || !completion?.monteur_pdf_path || monteurEmailSending) return
    if (!isOnline()) {
      showError('E-Mail ist nur bei Verbindung möglich.')
      return
    }
    const cust = customers.find((c) => c.id === order.customer_id)
    const bv = order.bv_id ? allBvs.find((b) => b.id === order.bv_id) : undefined
    const recipient = getMonteurReportRecipientEmail(cust, bv)
    if (!recipient) {
      showError(
        'Keine E-Mail-Adresse hinterlegt. Bitte unter Kunde oder BV die Adresse für den Monteursbericht (E-Mail) eintragen.'
      )
      return
    }
    setMonteurEmailSending(true)
    const subject = `Monteursbericht ${objectLabel} – ${extra.bericht_datum}`
    const filename = `Monteursbericht-${order.id.slice(0, 8)}.pdf`
    const { error: sendErr } = await sendMaintenanceReportEmail(
      completion.monteur_pdf_path,
      recipient,
      subject,
      filename
    )
    setMonteurEmailSending(false)
    if (sendErr) showError(sendErr.message)
    else showToast(`Bericht wurde an ${recipient} gesendet.`, 'success')
  }

  const handlePdfOnly = async () => {
    if (!order || !completion) {
      showError('Bitte zuerst speichern.')
      return
    }
    const payload = buildPayload(extra.parked ?? false)
    const scanUrl = `${window.location.origin}/auftrag/${order.id}`
    try {
      const oids = getOrderObjectIds(order).filter(Boolean)
      const wartungInspectedDoorLabels =
        order.order_type === 'wartung' && oids.length > 0
          ? oids.map((oid) => {
              const o = orderObjects.find((x) => x.id === oid)
              return o ? getObjectDisplayName(o) : oid.slice(0, 8)
            })
          : undefined
      const pdfBlob = await generateMonteurBerichtPdf({
        order,
        completion: { ...completion, ...payload, ausgeführte_arbeiten: payload.ausgeführte_arbeiten },
        extra: payload.completion_extra,
        customerName: getCustomerName(order.customer_id),
        bvName: getBvName(order.bv_id),
        objectLabel,
        orderTypeLabel: ORDER_TYPE_LABELS[order.order_type],
        scanUrl,
        letterheadDataUrl: null,
        wartungInspectedDoorLabels,
        pruefprotokollKurzverweis: order.order_type === 'wartung' && oids.length > 0,
      })
      openBlobPdfViewer(pdfBlob, 'Monteursbericht')
      const { path } = await uploadMonteurBerichtPdf(completion.id, pdfBlob)
      if (path) await updateOrderCompletion(completion.id, { monteur_pdf_path: path })
    } catch {
      showError('PDF fehlgeschlagen.')
    }
  }

  const handleViewPruefprotokoll = async () => {
    if (!order || order.order_type !== 'wartung' || !selectedChecklistObjectId) {
      showError('Bitte eine Tür wählen.')
      return
    }
    const per = extra.wartung_checkliste?.by_object_id[selectedChecklistObjectId]
    if (!per?.saved_at) {
      showError('Bitte zuerst die Prüfcheckliste speichern.')
      return
    }
    const obj = orderObjects.find((x) => x.id === selectedChecklistObjectId)
    if (!obj) {
      showError('Tür nicht gefunden.')
      return
    }
    setPruefprotokollViewLoading(true)
    try {
      if (isOnline()) {
        const storedPath = await fetchPruefprotokollPdfPathForOrderObject(order.id, selectedChecklistObjectId)
        if (storedPath) {
          openPublicPdfViewerFromStoragePath(storedPath, `Prüfprotokoll – ${getObjectDisplayName(obj)}`)
          return
        }
      }
      if (!isRelease110Enabled) {
        showError('Prüfprotokoll ist für diesen Mandanten noch nicht freigeschaltet.')
        return
      }
      const mode = per.checklist_modus === 'compact' ? 'compact' : 'detail'
      const prBlob = await generatePruefprotokollPdf({
        order,
        customerName: getCustomerName(order.customer_id),
        bvName: getBvName(order.bv_id),
        object: obj,
        berichtDatum: extra.bericht_datum,
        monteurName: (printedTech.trim() || extra.monteur_name || 'Monteur').trim(),
        doorMode: mode,
        doorItems: per.items ?? {},
        feststellMode: mode,
        feststellItems: per.feststell_checkliste?.items ?? {},
        includeFeststell: Boolean(obj.has_hold_open && per.feststell_checkliste?.saved_at),
        defectPhotosByItem: Object.fromEntries(
          Object.entries(defectPhotosByObject[selectedChecklistObjectId] ?? {}).map(([k, v]) => [
            k,
            v.map((p) => ({ storage_path: p.storage_path, caption: p.caption })),
          ])
        ),
      })
      openBlobPdfViewer(prBlob, `Prüfprotokoll – ${getObjectDisplayName(obj)}`)
    } catch {
      showError('Prüfprotokoll konnte nicht angezeigt werden.')
    } finally {
      setPruefprotokollViewLoading(false)
    }
  }

  if (!orderId) {
    navigate('/auftrag')
    return null
  }

  const detailLoadingMessage = (() => {
    const n = design?.app_name?.trim() || getAppDisplayNameFromLicenseCache()
    return n ? `${n}: Auftrag wird geladen…` : 'Auftrag wird geladen…'
  })()

  if (isLoading) {
    return <LoadingSpinner message={detailLoadingMessage} className="p-8" />
  }

  if (!order) {
    return (
      <div className="p-4">
        <p className="text-slate-600 dark:text-slate-300">Auftrag nicht gefunden.</p>
        <Link
          to="/auftrag"
          className="mt-2 inline-block text-vico-primary hover:underline dark:text-sky-400 dark:hover:text-sky-300"
        >
          ← Zurück zu Aufträgen
        </Link>
      </div>
    )
  }

  const totalMin = sumWorkMinutes(extra.primary, extra.zusatz_monteure)
  const hasPortalLicense = Boolean(license && hasFeature(license, 'kundenportal'))
  const showPortalChoiceInDialog =
    !monteurInternalOnly &&
    monteurPortalForCustomer &&
    monteurDeliveryMode === 'portal_notify' &&
    hasPortalLicense &&
    portalEligible

  const monteurZustellungHinweis = monteurInternalOnly
    ? 'Für diesen Kunden ist der Monteursbericht ins Kundenportal in den Stammdaten aus; das PDF wird am Auftrag gespeichert. E-Mail-Versand richtet sich nach den Firmen-Einstellungen und der E-Mail-Adresse für den Monteursbericht (Kunde/BV).'
    : monteurDeliveryMode === 'email_auto'
      ? 'Nach dem Abschließen wird der Monteursbericht automatisch per E-Mail mit PDF-Anhang versendet (Adresse aus Kunde/BV für den Monteursbericht, BV hat Vorrang), sofern online und eine Adresse hinterlegt ist.'
      : monteurDeliveryMode === 'email_manual'
        ? 'Nach dem Abschließen können Sie den Bericht per E-Mail senden (Schaltfläche erscheint bei erledigtem Auftrag, sobald ein PDF gespeichert ist).'
        : monteurDeliveryMode === 'portal_notify' && hasPortalLicense && portalEligible && !monteurPortalForCustomer
          ? 'Firmen-Einstellung Kundenportal – für diesen Kunden ist das Portal in den Stammdaten deaktiviert; es wird kein Portal-Eintrag erzeugt.'
          : monteurDeliveryMode === 'portal_notify' && hasPortalLicense && portalEligible && monteurPortalForCustomer
            ? 'Nach dem Abschließen kann der Bericht im Kundenportal abgelegt werden (Dialog); Portal-Nutzer werden ggf. per E-Mail informiert.'
            : monteurDeliveryMode === 'portal_notify' && hasPortalLicense && !portalEligible
              ? 'Firmen-Einstellung: Kundenportal – für dieses Objekt derzeit nicht möglich (kein Portal-Zugang oder keine Zuordnung Firma/BV). Es wird kein Portal-Eintrag erzeugt.'
              : monteurDeliveryMode === 'portal_notify' && !hasPortalLicense
                ? 'Firmen-Einstellung: Kundenportal – Lizenz ohne Kundenportal; es wird kein Portal-Eintrag erzeugt.'
                : 'Nach dem Abschließen: Monteursbericht-PDF wird in Vico gespeichert; Anzeige über die Schaltfläche „Monteursbericht“ oder in der Auftragsliste; keine automatische Kundenzustellung (Einstellungen).'

  const handleConfirmReopenOrder = async () => {
    if (!order || license?.read_only) return
    setReopenDialogOpen(false)
    const { error } = await updateOrderStatus(order.id, 'in_bearbeitung')
    if (error) showError(getSupabaseErrorMessage(error))
    else {
      setOrder((o) => (o ? { ...o, status: 'in_bearbeitung' } : null))
      showToast('Auftrag wurde wieder geöffnet (In Bearbeitung).', 'success')
    }
  }

  return (
    <div className="p-4 max-w-2xl min-w-0 mx-auto">
      <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
        <Link
          to="/auftrag"
          className="text-vico-primary hover:underline dark:text-sky-400 dark:hover:text-sky-300"
          aria-label="Zurück zu Aufträgen"
        >
          ← Aufträge
        </Link>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <span className="text-sm text-slate-600 dark:text-slate-400">
            {ORDER_TYPE_LABELS[order.order_type]} · {ORDER_STATUS_LABELS[order.status]}
          </span>
          {canReopenOrder ? (
            <AppButton
              type="button"
              variant="outline"
              className="text-sm py-1.5 px-3"
              onClick={() => setReopenDialogOpen(true)}
              aria-label="Erledigten Auftrag wieder öffnen"
            >
              Auftrag wieder öffnen
            </AppButton>
          ) : null}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 p-6 mb-6">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Auftrag</h2>
        <dl className="grid gap-2 text-sm">
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Kunde</dt>
            <dd className="font-medium text-slate-800 dark:text-slate-100">{getCustomerName(order.customer_id)}</dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Objekt/BV</dt>
            <dd className="font-medium text-slate-800 dark:text-slate-100">
              {order.bv_id ? getBvName(order.bv_id) : '— (direkt unter Kunde)'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Tür/Tor</dt>
            <dd className="font-medium text-slate-800 dark:text-slate-100">{objectLabel}</dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Auftragsdatum</dt>
            <dd className="font-medium text-slate-800 dark:text-slate-100">
              {order.order_date}
              {order.order_time ? ` ${order.order_time.slice(0, 5)}` : ''}
            </dd>
          </div>
          {order.description && (
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Beschreibung</dt>
              <dd className="text-slate-700 dark:text-slate-300">{order.description}</dd>
            </div>
          )}
        </dl>
      </div>

      {order.status === 'erledigt' && extra.wartung_checkliste_abschluss_bypass ? (
        <div
          className="mb-6 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700/60 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
          role="note"
          aria-label="Hinweis zum Abschluss der Wartungscheckliste"
        >
          <p className="font-semibold text-amber-900 dark:text-amber-50">Abschluss mit Ausnahme</p>
          <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">
            Dieser Auftrag wurde mit „Trotzdem abschließen“ beendet, obwohl die Wartungscheckliste nicht für alle
            Türen vollständig war. Zeitpunkt:{' '}
            <time dateTime={extra.wartung_checkliste_abschluss_bypass.at}>
              {new Date(extra.wartung_checkliste_abschluss_bypass.at).toLocaleString('de-DE', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </time>
            {extra.wartung_checkliste_abschluss_bypass.profile_id ? (
              <>
                {' '}
                · Nutzer:{' '}
                {(() => {
                  const pid = extra.wartung_checkliste_abschluss_bypass.profile_id
                  const p = profiles.find((x) => x.id === pid)
                  return p ? getProfileDisplayName(p) : `ID ${pid.slice(0, 8)}…`
                })()}
              </>
            ) : null}
          </p>
          {extra.wartung_checkliste_abschluss_bypass.incomplete_object_ids.length > 0 ? (
            <p className="mt-2 text-xs text-amber-900/85 dark:text-amber-100/85">
              Unvollständig (Tür/Tor):{' '}
              {extra.wartung_checkliste_abschluss_bypass.incomplete_object_ids
                .map((oid) => {
                  const ob = orderObjects.find((x) => x.id === oid)
                  return ob ? getObjectDisplayName(ob) : oid.slice(0, 8)
                })
                .join(', ')}
            </p>
          ) : null}
        </div>
      ) : null}

      {isRelease110Enabled && order.order_type === 'wartung' && orderObjectIds.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">Prüfcheckliste (kombiniert)</h3>
          <div className="mb-3 flex items-center gap-2">
            <label htmlFor="checklist-mode-override" className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Checklistenmodus
            </label>
            <select
              id="checklist-mode-override"
              value={checklistModeOverride ?? ''}
              onChange={(e) => {
                const v = e.target.value
                setChecklistModeOverride(v === 'compact' || v === 'detail' ? v : null)
              }}
              className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
            >
              <option value="">Standard ({defaultChecklistMode === 'compact' ? 'Kompakt' : 'Detail'})</option>
              <option value="detail">Detail</option>
              <option value="compact">Kompakt</option>
            </select>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/30 p-3 space-y-4">
            <WartungOrderChecklistPanel
              mode={checklistMode}
              objectIds={orderObjectIds}
              objectsById={objectsById}
              selectedObjectId={selectedChecklistObjectId}
              onSelectObjectId={(id) => {
                setSelectedChecklistObjectId(id)
                setChecklistSaveError(null)
                setFeststellSaveError(null)
              }}
              items={selectedChecklistObjectId ? checklistItemsByObject[selectedChecklistObjectId] ?? {} : {}}
              onChangeItem={handleChecklistItemChange}
              savedAtForSelection={
                selectedChecklistObjectId
                  ? extra.wartung_checkliste?.by_object_id[selectedChecklistObjectId]?.saved_at
                  : undefined
              }
              onSave={() => void handleSaveChecklist()}
              saving={checklistSaving}
              saveError={checklistSaveError}
              defectPhotosByItem={
                selectedChecklistObjectId
                  ? Object.fromEntries(
                      Object.entries(defectPhotosByObject[selectedChecklistObjectId] ?? {})
                        .filter(([k]) => k.startsWith('door:'))
                        .map(([k, v]) => [k.slice(5), v])
                    )
                  : {}
              }
              onUploadDefectPhoto={handleUploadDoorDefectPhoto}
              onDeleteDefectPhoto={(itemId, photoId, storagePath) =>
                handleDeleteDefectPhoto('door', itemId, photoId, storagePath)
              }
              uploadingItemId={uploadingDefectPhotoItem}
              showSaveControls={false}
            />
            {selectedChecklistObjectId && objectsById[selectedChecklistObjectId]?.has_hold_open ? (
              <FeststellOrderChecklistPanel
                mode={checklistMode}
                items={feststellItemsByObject[selectedChecklistObjectId] ?? {}}
                onChangeItem={handleFeststellItemChange}
                savedAt={extra.wartung_checkliste?.by_object_id[selectedChecklistObjectId]?.feststell_checkliste?.saved_at}
                onSave={() => void handleSaveFeststellChecklist()}
                saving={feststellSaving}
                saveError={feststellSaveError}
                defectPhotosByItem={Object.fromEntries(
                  Object.entries(defectPhotosByObject[selectedChecklistObjectId] ?? {})
                    .filter(([k]) => k.startsWith('feststell:'))
                    .map(([k, v]) => [k.slice(10), v])
                )}
                onUploadDefectPhoto={handleUploadFeststellDefectPhoto}
                onDeleteDefectPhoto={(itemId, photoId, storagePath) =>
                  handleDeleteDefectPhoto('feststell', itemId, photoId, storagePath)
                }
                uploadingItemId={uploadingDefectPhotoItem}
                showSaveControls={false}
              />
            ) : null}
            {(checklistSaveError || feststellSaveError) && (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {checklistSaveError || feststellSaveError}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-end gap-2">
              <AppButton
                type="button"
                variant="outline"
                disabled={
                  checklistSaving ||
                  feststellSaving ||
                  !selectedChecklistObjectId ||
                  pruefprotokollViewLoading ||
                  !extra.wartung_checkliste?.by_object_id[selectedChecklistObjectId ?? '']?.saved_at
                }
                onClick={() => void handleViewPruefprotokoll()}
                aria-label={
                  selectedChecklistObjectId && objectsById[selectedChecklistObjectId]
                    ? `Prüfprotokoll anzeigen: ${getObjectDisplayName(objectsById[selectedChecklistObjectId])}`
                    : 'Prüfprotokoll anzeigen'
                }
              >
                {pruefprotokollViewLoading ? 'Laden…' : 'Prüfprotokoll anzeigen'}
              </AppButton>
              <button
                type="button"
                onClick={() => void handleSaveCombinedChecklist()}
                disabled={checklistSaving || feststellSaving || !selectedChecklistObjectId}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-vico-primary text-white hover:bg-vico-primary-hover disabled:opacity-50"
              >
                {checklistSaving || feststellSaving ? 'Speichern…' : 'Gesamte Prüfcheckliste speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSave}
        className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 p-6 space-y-4"
      >
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Monteursbericht</h2>
        {formError && (
          <p
            className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg p-2"
            role="alert"
          >
            {formError}
          </p>
        )}

        <fieldset
          disabled={monteurLocked}
          className="min-w-0 space-y-4 border-0 p-0 m-0 disabled:opacity-60"
        >
        <AppField label="Berichtsdatum" htmlFor="bericht-datum">
          <AppInput
            id="bericht-datum"
            type="date"
            value={extra.bericht_datum}
            onChange={(e) => setExtraField('bericht_datum', e.target.value)}
            className="text-base sm:text-sm max-w-full"
          />
        </AppField>

        <AppField label="Ausgeführte Arbeiten" htmlFor="completion-arbeiten">
          <AppTextarea
            id="completion-arbeiten"
            value={ausgeführte}
            onChange={(e) => setAusgeführte(e.target.value)}
            rows={3}
            placeholder="Beschreibung der durchgeführten Arbeiten"
          />
        </AppField>

        <fieldset className="space-y-3 border border-slate-200 dark:border-slate-600 rounded-lg p-4">
          <legend className="text-sm font-semibold text-slate-800 dark:text-slate-100 px-1">
            Arbeitszeit Monteur (Haupt)
          </legend>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="min-w-0">
              <label htmlFor="wt-start" className="block text-xs text-slate-500 mb-1">
                Beginn
              </label>
              <AppInput
                id="wt-start"
                type="time"
                value={extra.primary.start}
                onChange={(e) => setPrimary({ start: e.target.value })}
                className="text-base sm:text-sm max-w-full"
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="wt-end" className="block text-xs text-slate-500 mb-1">
                Ende
              </label>
              <AppInput
                id="wt-end"
                type="time"
                value={extra.primary.end}
                onChange={(e) => setPrimary({ end: e.target.value })}
                className="text-base sm:text-sm max-w-full"
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="wt-pause" className={appLabelClassNameSmall}>
                Pause (Min.)
              </label>
              <AppInput
                id="wt-pause"
                type="number"
                min={0}
                value={extra.primary.pause_minuten}
                onChange={(e) => setPrimary({ pause_minuten: parseInt(e.target.value, 10) || 0 })}
                className="text-base sm:text-sm max-w-full"
              />
            </div>
          </div>
          <p className="text-sm text-app-muted">Berechnete Zeit: {totalMin} Min. (inkl. weitere Monteure)</p>
        </fieldset>

        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Weitere Monteure</span>
            <AppButton type="button" variant="outline" size="sm" onClick={handleAddZusatz}>
              + Zeile
            </AppButton>
          </div>
          <ul className="space-y-3">
            {extra.zusatz_monteure.map((z, i) => (
              <li key={i} className="border border-slate-200 dark:border-slate-600 rounded-lg p-3 space-y-2">
                <AppSelect
                  value={z.profile_id ?? ''}
                  onChange={(e) => handleZusatzProfilePick(i, e.target.value)}
                  className="text-sm"
                  aria-label={`Mitarbeiter ${i + 1}`}
                >
                  <option value="">— Benutzer wählen oder Name unten —</option>
                  {profilesForZusatz.map((p) => (
                    <option key={p.id} value={p.id}>
                      {getProfileDisplayName(p)}
                    </option>
                  ))}
                </AppSelect>
                <AppInput
                  type="text"
                  value={z.name}
                  onChange={(e) => handleZusatzChange(i, { name: e.target.value })}
                  placeholder="Name"
                  className="text-sm"
                />
                <div className="grid grid-cols-3 gap-2">
                  <AppInput
                    type="time"
                    value={z.start}
                    onChange={(e) => handleZusatzChange(i, { start: e.target.value })}
                    className="min-w-0 px-2 py-1 text-base sm:text-sm max-w-full"
                    aria-label="Beginn"
                  />
                  <AppInput
                    type="time"
                    value={z.end}
                    onChange={(e) => handleZusatzChange(i, { end: e.target.value })}
                    className="min-w-0 px-2 py-1 text-base sm:text-sm max-w-full"
                    aria-label="Ende"
                  />
                  <AppInput
                    type="number"
                    min={0}
                    value={z.pause_minuten}
                    onChange={(e) => handleZusatzChange(i, { pause_minuten: parseInt(e.target.value, 10) || 0 })}
                    className="min-w-0 px-2 py-1 text-base sm:text-sm max-w-full"
                    placeholder="Pause"
                    aria-label="Pause Minuten"
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Material (pro Zeile)</span>
            <AppButton type="button" variant="outline" size="sm" onClick={handleAddMaterialRow}>
              + Zeile
            </AppButton>
          </div>
          <ul className="space-y-2">
            {extra.material_lines.map((row, i) => (
              <li key={i} className="flex gap-2">
                <AppInput
                  type="text"
                  inputMode="decimal"
                  value={row.anzahl}
                  onChange={(e) => handleMaterialChange(i, 'anzahl', e.target.value)}
                  placeholder="Anzahl"
                  className="w-24 shrink-0 text-sm"
                  aria-label={`Material Anzahl ${i + 1}`}
                />
                <AppInput
                  type="text"
                  value={row.artikel}
                  onChange={(e) => handleMaterialChange(i, 'artikel', e.target.value)}
                  placeholder="Artikel / Bezeichnung"
                  className="flex-1 min-w-0 text-sm"
                  aria-label={`Material Artikel ${i + 1}`}
                />
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SignatureField
            label="Unterschrift Monteur"
            value={null}
            onChange={setSigTechDataUrl}
            printedName={printedTech}
            onPrintedNameChange={setPrintedTech}
          />
          <SignatureField
            label="Unterschrift Kunde"
            value={null}
            onChange={setSigCustDataUrl}
            printedName={printedCust}
            onPrintedNameChange={setPrintedCust}
          />
        </div>
        {!printedCust.trim() && (
          <AppField label="Grund ohne Kundenunterschrift" htmlFor="cust-sign-reason">
            <AppTextarea
              id="cust-sign-reason"
              value={extra.customer_signature_reason ?? ''}
              onChange={(e) => setExtraField('customer_signature_reason', e.target.value)}
              placeholder="z. B. Kunde nicht anwesend oder Unterschrift abgelehnt"
              rows={2}
              className="text-base sm:text-sm max-w-full"
            />
          </AppField>
        )}

        </fieldset>

        {order.status !== 'erledigt' && order.status !== 'storniert' && (
          <p
            className="text-sm text-slate-600 dark:text-slate-300 max-w-xl pt-1"
            role="status"
            aria-live="polite"
          >
            {monteurZustellungHinweis}
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-2 pb-1 items-center">
          <AppButton
            type="submit"
            variant="primary"
            disabled={isSaving || (order.order_type === 'wartung' && monteurLocked)}
          >
            {isSaving ? 'Speichern…' : 'Bericht speichern'}
          </AppButton>
          <AppButton
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={handlePark}
            title="Bericht zwischenspeichern, Auftrag bleibt in Bearbeitung"
          >
            Parken
          </AppButton>
          {order.status !== 'erledigt' && order.status !== 'storniert' && (
            <AppButton type="button" variant="success" disabled={isSaving} onClick={handleOpenCompleteDialog}>
              Auftrag abschließen
            </AppButton>
          )}
          {order.status === 'erledigt' &&
            monteurDeliveryMode === 'email_manual' &&
            completion?.monteur_pdf_path && (
              <AppButton
                type="button"
                variant="neutralSolid"
                disabled={monteurEmailSending}
                onClick={handleSendMonteurReportEmail}
                aria-label="Monteursbericht per E-Mail an den Kunden senden"
              >
                {monteurEmailSending ? 'Senden…' : 'E-Mail an Kunden'}
              </AppButton>
            )}
          {completion && (
            <AppButton
              type="button"
              variant="outline"
              onClick={handlePdfOnly}
              title="Monteursbericht aus den aktuellen Angaben als PDF erzeugen, anzeigen und am Auftrag speichern"
            >
              Monteursbericht
            </AppButton>
          )}
        </div>
      </form>

      {completeDialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={() => !isSaving && resetCompleteDialog()}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !isSaving) resetCompleteDialog()
          }}
        >
          <div
            role="dialog"
            aria-modal
            aria-labelledby="complete-order-title"
            className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full min-w-0 p-4 border border-slate-200 dark:border-slate-600"
            onClick={(e) => e.stopPropagation()}
          >
            {completeDialogPhase === 'confirm' ? (
              <>
                <h3 id="complete-order-title" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                  Auftrag abschließen?
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  Es wird ein Monteursbericht-PDF erzeugt und am Auftrag gespeichert (Anzeige danach über „Monteursbericht“
                  oder in der Auftragsliste). Der Auftrag wird auf „Erledigt“ gesetzt. Für Wartungen wird zusätzlich je
                  vollständig geprüfter Tür ein Prüfprotokoll-PDF erzeugt und gespeichert (offene Türen können Sie aktiv
                  auslassen, siehe nächster Schritt). Die Zustellung des Monteursberichts richtet sich nach den
                  Firmen-Einstellungen und den Optionen des Kunden (Kundenstammdaten: nur intern / Kundenportal).
                </p>
                {showPortalChoiceInDialog ? (
                  <label className="mt-4 flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5 rounded border-slate-400 dark:border-slate-500 dark:bg-slate-800 text-vico-primary focus:ring-vico-primary"
                      checked={completeSharePortal}
                      disabled={isSaving}
                      onChange={(e) => setCompleteSharePortal(e.target.checked)}
                    />
                    <span>
                      Bericht im Kundenportal bereitstellen und Portal-Nutzer benachrichtigen (entspricht der
                      Firmen-Einstellung „Kundenportal + Benachrichtigung“ für diesen Vorgang).
                    </span>
                  </label>
                ) : null}
                <div className="mt-6 flex flex-wrap gap-2 justify-end">
                  <AppButton type="button" variant="outline" disabled={isSaving} onClick={resetCompleteDialog}>
                    Abbrechen
                  </AppButton>
                  <AppButton
                    type="button"
                    variant="successSolid"
                    disabled={isSaving}
                    onClick={handleSubmitCompleteDialog}
                  >
                    {isSaving ? 'Wird ausgeführt…' : 'Abschließen'}
                  </AppButton>
                </div>
              </>
            ) : (
              <>
                <h3 id="complete-order-title" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                  Checkliste unvollständig
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{completeDialogGate?.message}</p>
                <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
                  Nicht alle Türen am Auftrag sind vollständig geprüft oder gespeichert (z. B. nicht erreichbar). Sie
                  können trotzdem abschließen; für ausgelassene Türen entstehen dann keine vollständigen Prüfprotokolle
                  in diesem Auftrag.
                </p>
                {completeDialogGate && completeDialogGate.incompleteObjectIds.length > 0 ? (
                  <ul className="mt-2 text-sm list-disc pl-5 text-slate-700 dark:text-slate-300">
                    {completeDialogGate.incompleteObjectIds.map((oid) => {
                      const ob = orderObjects.find((x) => x.id === oid)
                      return (
                        <li key={oid}>{ob ? getObjectDisplayName(ob) : oid.slice(0, 8)}</li>
                      )
                    })}
                  </ul>
                ) : null}
                <div className="mt-6 flex flex-wrap gap-2 justify-end">
                  <AppButton
                    type="button"
                    variant="outline"
                    disabled={isSaving}
                    onClick={handleBackFromBypassWarning}
                  >
                    Zurück
                  </AppButton>
                  <AppButton
                    type="button"
                    variant="successSolid"
                    disabled={isSaving}
                    onClick={handleCompleteDespiteChecklist}
                  >
                    {isSaving ? 'Wird ausgeführt…' : 'Trotzdem abschließen'}
                  </AppButton>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={followUpDialogOpen}
        title="Folge-Wartungsauftrag?"
        message={followUpDialogMessage}
        confirmLabel="Ja, anlegen"
        cancelLabel="Nein"
        variant="default"
        onConfirm={() => void handleFollowUpDialogConfirm()}
        onCancel={() => {
          setFollowUpDialogOpen(false)
          followUpOidsRef.current = []
        }}
      />

      <ConfirmDialog
        open={reopenDialogOpen}
        title="Auftrag wieder öffnen?"
        message="Der Auftrag wird auf „In Bearbeitung“ gesetzt. Der gespeicherte Monteursbericht (order_completion) und die PDFs bleiben unverändert; Sie können den Vorgang bei Bedarf erneut bearbeiten oder erneut abschließen."
        confirmLabel="Wieder öffnen"
        cancelLabel="Abbrechen"
        variant="default"
        onConfirm={() => void handleConfirmReopenOrder()}
        onCancel={() => setReopenDialogOpen(false)}
      />

      {isRelease110Enabled ? <PdfPreviewOverlay state={pdfViewer} onClose={handleClosePdfViewer} /> : null}
    </div>
  )
}

export default Auftragsdetail
