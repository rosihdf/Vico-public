import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'
import { getSupabaseErrorMessage } from './supabaseErrors'
import { supabase } from './supabase'
import {
  fetchOrderById,
  fetchCompletionByOrderId,
  createOrderCompletion,
  updateOrderCompletion,
  updateOrderStatus,
  fetchCustomers,
  fetchAllBvs,
  fetchObject,
  fetchAllObjects,
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
  fetchOrders,
  updateOrder,
  insertDefectFollowupsForCompletedWartungOrder,
  fetchMaintenanceReportIdByOrderObject,
  fetchMaintenanceReportPruefprotokollMetaForOrderObject,
  fetchPruefprotokollPdfPathForOrderObject,
  fetchChecklistMangelPhotosGroupedForOrderObject,
  uploadChecklistDefectPhoto,
  uploadChecklistDefectPhotoDraft,
  deleteChecklistDefectPhoto,
  deleteChecklistDefectPhotoDraft,
  promoteChecklistDefectPhotoDrafts,
  mapDefectPhotoToMangel,
  getMaintenancePhotoUrl,
  uploadWartungChecklistInspectorSignature,
  type MonteurReportCustomerDeliveryMode,
  type MonteurReportSettingsFull,
} from './lib/dataService'
import { isOrderActivePerObjectError } from './lib/orderUtils'
import { useLicense } from './LicenseContext'
import { useComponentSettings } from './ComponentSettingsContext'
import { hasFeature } from './lib/licenseService'
import { resolveChecklistModePolicy, type ChecklistModePolicy } from './lib/checklistModePolicy'
import { isOnline } from '../shared/networkUtils'
import { fetchMyProfile, fetchProfiles, getProfileDisplayName } from './lib/userService'
import { LoadingSpinner } from './components/LoadingSpinner'
import ConfirmDialog from './components/ConfirmDialog'
import {
  AppButton,
  AppField,
  AppInput,
  AppTextarea,
} from './components/ui'
import { getAppDisplayNameFromLicenseCache } from './lib/appBranding'
import {
  AuftragsdetailPdfPreviewSlot,
  type PdfPreviewState,
} from './components/AuftragsdetailPdfPreviewSlot'
import { generateMonteurBerichtPdf } from './lib/generateMonteurBerichtPdf'
import { formatPruefprotokollNummerForPdf, generatePruefprotokollPdf } from './lib/generatePruefprotokollPdf'
import {
  getBriefbogenPdfAssetsCached,
  prefetchBriefbogenPdfAssets,
} from './lib/briefbogenPdfCache'
import { anyPauseExceedsGrossWork, sumWorkMinutes } from './lib/monteurReportTime'

/** Bucket für `monteur-berichte/…`-Pfade (vgl. uploadMonteurBerichtPdf). */
const MONTEUR_BERICHT_STORAGE_BUCKET = 'maintenance-photos'
import {
  evaluateWartungChecklistGate,
  type WartungChecklistGateBad,
} from './lib/wartungChecklistGate'
import {
  parseOrderCompletionExtra,
  materialLinesToText,
  defaultOrderCompletionExtra,
  stripWartungChecklistInspectorSignatureForObject,
  type OrderCompletionExtraV1,
  type WartungChecklistItemState,
  type WartungChecklistPerObject,
} from './types/orderCompletionExtra'
import {
  buildDeficiencyTextFromChecklist,
  checklistHasOpenMangel,
  getChecklistItemIdsForMode,
  normalizeDoorChecklistItemsForMode,
  validateChecklistComplete,
  type ChecklistDisplayMode,
} from './lib/doorMaintenanceChecklistCatalog'
import {
  buildDeficiencyTextFromFeststellChecklist,
  checklistHasOpenMangelFeststell,
  FESTSTELL_MELDER_INTERVAL_ITEM_ID,
  getFeststellChecklistItemIdsForMode,
  initEmptyFeststellChecklistItems,
  normalizeFeststellChecklistItemsForMode,
  validateFeststellChecklistComplete,
  type FeststellChecklistItemState,
} from './lib/feststellChecklistCatalog'
import WartungOrderChecklistPanel, {
  initEmptyChecklistItems,
  WartungInspectorSignatureSection,
} from './components/WartungOrderChecklistPanel'
import { getWartungChecklistObjectUiStatus } from './lib/wartungOrderChecklistUiStatus'
import FeststellOrderChecklistPanel from './components/FeststellOrderChecklistPanel'
import { AuftragsdetailPageHeader } from './components/AuftragsdetailPageHeader'
import { AuftragsdetailOrderSummaryCard } from './components/AuftragsdetailOrderSummaryCard'
import { AuftragsdetailWartungChecklistBypassNotice } from './components/AuftragsdetailWartungChecklistBypassNotice'
import { AuftragsdetailReopenOrderConfirmDialog } from './components/AuftragsdetailReopenOrderConfirmDialog'
import { AuftragsdetailAssistantResumeConfirmDialog } from './components/AuftragsdetailAssistantResumeConfirmDialog'
import { AuftragsdetailChecklistModeSwitchConfirmDialog } from './components/AuftragsdetailChecklistModeSwitchConfirmDialog'
import { AuftragsdetailMonteurKundenZusammenfassung } from './components/AuftragsdetailMonteurKundenZusammenfassung'
import { AuftragsdetailMonteurSelectedDoorsHint } from './components/AuftragsdetailMonteurSelectedDoorsHint'
import { AuftragsdetailMonteurZustellungHinweis } from './components/AuftragsdetailMonteurZustellungHinweis'
import { AuftragsdetailMonteurAutoFilledNotice } from './components/AuftragsdetailMonteurAutoFilledNotice'
import { AuftragsdetailMonteurFormErrorAlert } from './components/AuftragsdetailMonteurFormErrorAlert'
import { AuftragsdetailMonteurPrimaryWorktimeFieldset } from './components/AuftragsdetailMonteurPrimaryWorktimeFieldset'
import { AuftragsdetailMonteurWeitereMonteureBlock } from './components/AuftragsdetailMonteurWeitereMonteureBlock'
import { AuftragsdetailMonteurMaterialBlock } from './components/AuftragsdetailMonteurMaterialBlock'
import { AuftragsdetailMonteurTechnicianSignatureBlock } from './components/AuftragsdetailMonteurTechnicianSignatureBlock'
import { AuftragsdetailMonteurCustomerSignatureBlock } from './components/AuftragsdetailMonteurCustomerSignatureBlock'
import { AuftragsdetailMonteurExistingReportsPanel } from './components/AuftragsdetailMonteurExistingReportsPanel'
import { AuftragsdetailMonteurFormActionBar } from './components/AuftragsdetailMonteurFormActionBar'
import { getOrderObjectIds } from './lib/orderUtils'
import { getObjectDisplayName } from './lib/objectUtils'
import type { Order, OrderCompletion, Customer, BV, Object as Obj } from './types'
import type { Profile } from './lib/userService'
import type { ChecklistMangelPhoto } from './types/maintenance'
import { resolveReportDeliverySettings } from './lib/reportDeliverySettings'
import { ORDER_BILLING_STATUS_LABELS, resolveOrderBillingStatus } from './lib/orderBilling'
import {
  clampEndAfterStartSameDay,
  endHourOptionsAfterStart,
  endMinuteOptionsAfterStart,
  FESTSTELL_INTERVAL_SECTION_ID,
  getMonteurBerichtAbschlussBlocker,
  getMonteurReportRecipientEmail,
  getTimeParts,
  isFeststellMelderIntervalChosen,
  mergeTimeParts,
  normalizePauseMinutes,
  ORDER_STATUS_LABELS,
  ORDER_TYPE_LABELS,
  orderTypeToMaintenanceReason,
  PROFILE_ROLES_ZUSATZ,
} from './lib/auftragsdetailPure'

type ChecklistAssistantFlowStepKey =
  | 'door'
  | 'feststell'
  | 'signature'
  | 'monteur_leistungen'
  | 'monteur_zeit'
  | 'monteur_material'
  | 'monteur_monteur_signatur'
  | 'monteur_kunden_uebersicht'
  | 'monteur_kunden_unterschrift'
  | 'monteur_abschluss'

const Auftragsdetail = () => {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { license, design, isLoading: isLicenseLoading } = useLicense()
  const { isEnabled } = useComponentSettings()
  const { showError, showToast } = useToast()
  const [order, setOrder] = useState<Order | null>(null)
  const [completion, setCompletion] = useState<OrderCompletion | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [allBvs, setAllBvs] = useState<BV[]>([])
  const [allObjects, setAllObjects] = useState<Obj[]>([])
  const [objectLabel, setObjectLabel] = useState<string>('—')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [relatedParentOrder, setRelatedParentOrder] = useState<Order | null>(null)
  const [relatedChildOrders, setRelatedChildOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [extra, setExtra] = useState<OrderCompletionExtraV1>(() => defaultOrderCompletionExtra(''))
  const [ausgeführte, setAusgeführte] = useState('')
  const [sigTechDataUrl, setSigTechDataUrl] = useState<string | null>(null)
  const [sigCustDataUrl, setSigCustDataUrl] = useState<string | null>(null)
  const [monteurSignatureReplaceMode, setMonteurSignatureReplaceMode] = useState(false)
  const [customerSignatureReplaceMode, setCustomerSignatureReplaceMode] = useState(false)
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
  const [checklistSyncing, setChecklistSyncing] = useState(false)
  const [checklistSaveError, setChecklistSaveError] = useState<string | null>(null)
  const [feststellItemsByObject, setFeststellItemsByObject] = useState<
    Record<string, Record<string, FeststellChecklistItemState>>
  >({})
  const [feststellSaveError, setFeststellSaveError] = useState<string | null>(null)
  const [checklistModeOverride, setChecklistModeOverride] = useState<ChecklistDisplayMode | null>(null)
  const [checklistModeSwitchConfirmOpen, setChecklistModeSwitchConfirmOpen] = useState(false)
  const [pendingChecklistModeOverride, setPendingChecklistModeOverride] = useState<ChecklistDisplayMode | null>(null)
  const [checklistAssistantUiMode, setChecklistAssistantUiMode] = useState<'assistant' | 'classic' | null>(null)
  const [assistantResumeDialogOpen, setAssistantResumeDialogOpen] = useState(false)
  const [checklistAssistantStepIdx, setChecklistAssistantStepIdx] = useState(0)
  const [checklistAssistantDoorItemIdx, setChecklistAssistantDoorItemIdx] = useState(0)
  const [checklistAssistantFestItemIdx, setChecklistAssistantFestItemIdx] = useState(0)
  const [assistantAddDoorDialogOpen, setAssistantAddDoorDialogOpen] = useState(false)
  const [checklistReportIdByObject, setChecklistReportIdByObject] = useState<Record<string, string>>({})
  const [defectPhotosByObject, setDefectPhotosByObject] = useState<
    Record<string, Record<string, ChecklistMangelPhoto[]>>
  >({})
  const [uploadingDefectPhotoItem, setUploadingDefectPhotoItem] = useState<string | null>(null)
  const [pdfViewer, setPdfViewer] = useState<PdfPreviewState>(null)
  const [pruefprotokollViewLoading, setPruefprotokollViewLoading] = useState(false)
  const [monteurPdfViewLoading, setMonteurPdfViewLoading] = useState(false)
  const [myProfile, setMyProfile] = useState<Profile | null>(null)
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false)
  const checklistInitKeyRef = useRef<string>('')
  const checklistDraftAutosaveReadyRef = useRef(false)
  const checklistDraftFingerprintByOidRef = useRef<Record<string, string>>({})
  const skipAssistantStepAutoResetRef = useRef(false)
  /** Pro Besuch `/…/assistent`: Start-„Fortsetzen?“-Dialog nur einmal auto-öffnen. */
  const assistantEntryResumeHandledRef = useRef(false)
  const persistChecklistDraftForObjectRef = useRef<(oid: string) => Promise<string | null>>(async () => null)
  const orderRef = useRef<Order | null>(null)
  const extraRef = useRef(extra)
  const completionRef = useRef<OrderCompletion | null>(null)
  const userRef = useRef(user)
  const licenseReadOnlyRef = useRef(false)
  const checklistItemsByObjectRef = useRef<Record<string, Record<string, WartungChecklistItemState>>>({})
  const feststellItemsByObjectRef = useRef<Record<string, Record<string, FeststellChecklistItemState>>>({})
  const checklistModeRef = useRef<ChecklistDisplayMode>('detail')
  const objectsByIdRef = useRef<Record<string, Obj>>({})
  const ausgeführteRef = useRef(ausgeführte)
  const printedTechRef = useRef(printedTech)
  const printedCustRef = useRef(printedCust)
  const checklistSyncingRef = useRef(false)
  const checklistReportIdByObjectRef = useRef<Record<string, string>>({})
  const checklistInspectorSigDraftRef = useRef<Record<string, string | null>>({})
  const monteurAutosaveFingerprintRef = useRef('')
  const [checklistSigDraftTick, setChecklistSigDraftTick] = useState(0)

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
  const customerAddressLines = (id: string): string[] => {
    const c = customers.find((x) => x.id === id)
    if (!c) return []
    const l1 = [c.street, c.house_number].filter(Boolean).join(' ').trim()
    const l2 = [c.postal_code, c.city].filter(Boolean).join(' ').trim()
    return [l1, l2].filter(Boolean)
  }
  const bvAddressLines = (id: string | null | undefined): string[] => {
    if (!id) return []
    const b = allBvs.find((x) => x.id === id)
    if (!b) return []
    const l1 = [b.street, b.house_number].filter(Boolean).join(' ').trim()
    const l2 = [b.postal_code, b.city].filter(Boolean).join(' ').trim()
    return [l1, l2].filter(Boolean)
  }

  const profilesForZusatz = useMemo(
    () =>
      profiles.filter(
        (p) => p.id !== user?.id && PROFILE_ROLES_ZUSATZ.has(p.role) && p.role !== 'demo' && p.role !== 'kunde'
      ),
    [profiles, user?.id]
  )

  const loadData = useCallback(async () => {
    if (!orderId) return
    checklistDraftAutosaveReadyRef.current = false
    setIsLoading(true)
    setFormError(null)
    const [orderData, completionData, customerData, bvData, objectData, profileData, allProfiles, allOrders] = await Promise.all([
      fetchOrderById(orderId),
      fetchCompletionByOrderId(orderId),
      fetchCustomers(),
      fetchAllBvs(),
      fetchAllObjects(),
      user ? fetchMyProfile(user.id) : Promise.resolve(null),
      fetchProfiles(),
      fetchOrders(),
    ])
    setOrder(orderData ?? null)
    setCompletion(completionData ?? null)
    setCustomers(customerData ?? [])
    setAllBvs(bvData ?? [])
    setAllObjects(objectData ?? [])
    setProfiles(allProfiles ?? [])
    setMyProfile(profileData ?? null)
    if (orderData?.related_order_id) {
      const parent = (allOrders ?? []).find((o) => o.id === orderData.related_order_id) ?? null
      setRelatedParentOrder(parent)
    } else {
      setRelatedParentOrder(null)
    }
    if (orderData?.id) {
      const children = (allOrders ?? []).filter((o) => o.related_order_id === orderData.id)
      setRelatedChildOrders(children)
    } else {
      setRelatedChildOrders([])
    }

    const monteurName = profileData
      ? [profileData.first_name, profileData.last_name].filter(Boolean).join(' ') || profileData.email || 'Monteur'
      : 'Monteur'

    const parsedExtraFromDb = completionData
      ? parseOrderCompletionExtra(completionData.completion_extra, monteurName)
      : defaultOrderCompletionExtra(monteurName)
    const resolvedPrintedTech =
      (completionData?.unterschrift_mitarbeiter_name?.trim() ||
        parsedExtraFromDb.monteur_name?.trim() ||
        monteurName) ?? monteurName

    if (orderData) {
      const oid = getOrderObjectIds(orderData)[0] ?? orderData.object_id
      if (oid) {
        const ob = await fetchObject(oid)
        setObjectLabel(ob ? getObjectDisplayName(ob) : oid.slice(0, 8))
      } else {
        setObjectLabel('—')
      }
    }

    const parsedExtra: OrderCompletionExtraV1 = {
      ...parsedExtraFromDb,
      monteur_name: resolvedPrintedTech || parsedExtraFromDb.monteur_name,
    }
    if (completionData) {
      setAusgeführte(completionData.ausgeführte_arbeiten ?? '')
      setPrintedTech(resolvedPrintedTech)
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
          if (rid) reportMap[oid] = rid
          const grouped = await fetchChecklistMangelPhotosGroupedForOrderObject(
            orderData.id,
            oid,
            rid ?? null
          )
          setDefectPhotosByObject((prev) => ({ ...prev, [oid]: grouped }))
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
            saved && Object.keys(saved).length > 0
              ? normalizeDoorChecklistItemsForMode(mode, { ...saved })
              : initEmptyChecklistItems(mode)
        }
        setChecklistItemsByObject(map)
        const festMap: Record<string, Record<string, FeststellChecklistItemState>> = {}
        for (const oid of oids) {
          const o = objs.find((x) => x.id === oid)
          if (!o?.has_hold_open) continue
          const fs = wc[oid]?.feststell_checkliste?.items
          festMap[oid] =
            fs && Object.keys(fs).length > 0
              ? normalizeFeststellChecklistItemsForMode(mode, { ...fs })
              : initEmptyFeststellChecklistItems(mode)
        }
        setFeststellItemsByObject(festMap)
        setSelectedChecklistObjectId(oids[0] ?? null)
      }
      for (const oid of oids) {
        const saved = wc[oid]?.items
        const doorItems =
          saved && Object.keys(saved).length > 0
            ? normalizeDoorChecklistItemsForMode(mode, { ...saved })
            : initEmptyChecklistItems(mode)
        const o = objs.find((x) => x.id === oid)
        const fs = wc[oid]?.feststell_checkliste?.items
        const festForFp =
          o?.has_hold_open && fs && Object.keys(fs).length > 0
            ? normalizeFeststellChecklistItemsForMode(mode, { ...fs })
            : o?.has_hold_open
              ? initEmptyFeststellChecklistItems(mode)
              : {}
        checklistDraftFingerprintByOidRef.current[oid] = JSON.stringify({
          m: mode,
          door: doorItems,
          fest: festForFp,
        })
      }
      checklistDraftAutosaveReadyRef.current = true
    } else {
      setOrderObjects([])
      setChecklistItemsByObject({})
      setFeststellItemsByObject({})
      setChecklistReportIdByObject({})
      setDefectPhotosByObject({})
      setSelectedChecklistObjectId(null)
      checklistInitKeyRef.current = ''
      checklistDraftFingerprintByOidRef.current = {}
      checklistDraftAutosaveReadyRef.current = false
    }
    setSigTechDataUrl(null)
    setSigCustDataUrl(null)
    setMonteurSignatureReplaceMode(false)
    setCustomerSignatureReplaceMode(false)
    setIsLoading(false)
  }, [orderId, user])

  useEffect(() => {
    loadData()
  }, [loadData])

  const defaultMonteurPrintedName = useMemo(() => {
    if (!myProfile) return 'Monteur'
    return [myProfile.first_name, myProfile.last_name].filter(Boolean).join(' ') || myProfile.email || 'Monteur'
  }, [myProfile])

  useEffect(() => {
    if (printedTech.trim()) return
    setPrintedTech(defaultMonteurPrintedName)
  }, [printedTech, defaultMonteurPrintedName])

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
  const checklistAssistantDoorItemIds = useMemo(() => getChecklistItemIdsForMode(checklistMode), [checklistMode])
  const checklistAssistantFestItemIds = useMemo(() => getFeststellChecklistItemIdsForMode(checklistMode), [checklistMode])
  const checklistAssistantFocusDoorItemId =
    checklistAssistantDoorItemIds[Math.min(checklistAssistantDoorItemIdx, Math.max(0, checklistAssistantDoorItemIds.length - 1))] ??
    null
  const checklistAssistantFocusFestItemId =
    checklistAssistantFestItemIds[Math.min(checklistAssistantFestItemIdx, Math.max(0, checklistAssistantFestItemIds.length - 1))] ??
    null
  const checklistAssistantEnabled =
    Boolean(license && hasFeature(license, 'checklist_assistant')) &&
    isEnabled('wartung_checklist_assistant')
  const isAssistantRoute = location.pathname.endsWith('/assistent')
  const assistantDebugEnabled =
    location.search.includes('assistantDebug=1') ||
    (typeof window !== 'undefined' && window.localStorage.getItem('vico_assistant_debug') === '1')
  const checklistAssistantStrictEnabled =
    Boolean(license && hasFeature(license, 'checklist_assistant_strict_mode'))
  const checklistModePolicy: ChecklistModePolicy = resolveChecklistModePolicy({
    assistantFeatureEnabled: checklistAssistantEnabled,
    /** TODO später aus LP/mandanten settings lesen */
    requestedPolicy: 'selectable',
  })
  const checklistModeSelected = !checklistAssistantEnabled || checklistAssistantUiMode !== null
  const checklistAssistantActive = checklistAssistantEnabled && checklistAssistantUiMode === 'assistant'
  const objectsById = useMemo(() => {
    const m: Record<string, Obj> = {}
    for (const o of orderObjects) m[o.id] = o
    return m
  }, [orderObjects])
  const orderDoorLabels = useMemo(
    () =>
      orderObjectIds.map((oid) => {
        const obj = objectsById[oid]
        const display = obj ? getObjectDisplayName(obj) : `Tür/Tor ${oid.slice(0, 8)}`
        return { oid, display }
      }),
    [orderObjectIds, objectsById]
  )
  const selectedChecklistObjectHasHoldOpen = Boolean(
    selectedChecklistObjectId && objectsById[selectedChecklistObjectId]?.has_hold_open
  )
  const selectedDoorSaved = Boolean(
    selectedChecklistObjectId
      ? extra.wartung_checkliste?.by_object_id[selectedChecklistObjectId]?.saved_at
      : false
  )
  const selectedFeststellSaved = Boolean(
    selectedChecklistObjectId && selectedChecklistObjectHasHoldOpen
      ? extra.wartung_checkliste?.by_object_id[selectedChecklistObjectId]?.feststell_checkliste?.saved_at
      : true
  )
  const selectedInspectorSignatureSaved = Boolean(
    selectedChecklistObjectId
      ? extra.wartung_checkliste?.by_object_id[selectedChecklistObjectId]?.pruefer_signature_path?.trim()
      : false
  )
  const selectedDoorChecklistItems = useMemo(
    () => (selectedChecklistObjectId ? checklistItemsByObject[selectedChecklistObjectId] ?? {} : {}),
    [selectedChecklistObjectId, checklistItemsByObject]
  )
  const selectedFeststellChecklistItems = useMemo(
    () => (selectedChecklistObjectId ? feststellItemsByObject[selectedChecklistObjectId] ?? {} : {}),
    [selectedChecklistObjectId, feststellItemsByObject]
  )
  const selectedDoorChecklistComplete = useMemo(
    () => validateChecklistComplete(checklistMode, selectedDoorChecklistItems).ok,
    [checklistMode, selectedDoorChecklistItems]
  )
  const selectedFeststellChecklistComplete = useMemo(() => {
    if (!selectedChecklistObjectHasHoldOpen) return true
    return validateFeststellChecklistComplete(checklistMode, selectedFeststellChecklistItems).ok
  }, [selectedChecklistObjectHasHoldOpen, checklistMode, selectedFeststellChecklistItems])
  const checklistAssistantMonteurLeistungenDone = useMemo(
    () => Boolean(extra.bericht_datum?.trim()) && Boolean(ausgeführte.trim()),
    [extra.bericht_datum, ausgeführte]
  )
  const monteurAutoLeistungenText = useMemo(() => {
    if (!order || order.order_type !== 'wartung') return ''
    const doorLabels = orderDoorLabels.map((entry) => entry.display).filter(Boolean)
    if (doorLabels.length === 0) return ''

    const lines: string[] = []
    lines.push('Prüfung nach Norm durchgeführt (DIN EN 1634, DIN EN 16034, DIN 4102, DIN 18040).')
    if (orderObjectIds.some((oid) => Boolean(objectsById[oid]?.has_hold_open))) {
      lines.push('Feststellanlagenprüfung nach DIN 14677-1 / DIN 14677-2 durchgeführt.')
    }
    lines.push('Prüfprotokoll erstellt.')
    lines.push(
      doorLabels.length === 1
        ? `Geprüftes Objekt: ${doorLabels[0]}.`
        : `Geprüfte Objekte: ${doorLabels.join(', ')}.`
    )
    return lines.join('\n')
  }, [order, orderDoorLabels, orderObjectIds, objectsById])
  const checklistAssistantMonteurZeitDone = useMemo(
    () => sumWorkMinutes(extra.primary, extra.zusatz_monteure) > 0,
    [extra.primary, extra.zusatz_monteure]
  )
  const checklistAssistantMonteurMaterialDone = true
  const checklistAssistantMonteurMonteurSignaturDone = useMemo(
    () => Boolean(completion?.unterschrift_mitarbeiter_path?.trim()) && !monteurSignatureReplaceMode,
    [completion?.unterschrift_mitarbeiter_path, monteurSignatureReplaceMode]
  )
  const checklistAssistantMonteurKundenUebersichtDone = true
  const checklistAssistantCustomerSignatureSaved = useMemo(
    () => Boolean(completion?.unterschrift_kunde_path?.trim()) && !customerSignatureReplaceMode,
    [completion?.unterschrift_kunde_path, customerSignatureReplaceMode]
  )
  /** Kunde: (gespeicherte Unterschrift + Name) oder (keine Unterschrift + Grund); Entwurf/„Ersetzen“ offen = unvollständig */
  const customerSignatureStepComplete = useMemo(() => {
    const hasCustDraft =
      typeof sigCustDataUrl === 'string' && sigCustDataUrl.trim().startsWith('data:image')
    const nameOk = printedCust.trim().length > 0
    const reasonOk = Boolean(extra.customer_signature_reason?.trim())
    const pathOnFile = Boolean(completion?.unterschrift_kunde_path?.trim())
    if (hasCustDraft) return false
    if (customerSignatureReplaceMode) return false
    if (pathOnFile) return nameOk
    return reasonOk
  }, [
    sigCustDataUrl,
    printedCust,
    extra.customer_signature_reason,
    completion?.unterschrift_kunde_path,
    customerSignatureReplaceMode,
  ])
  const checklistAssistantMonteurKundenUnterschriftDone = customerSignatureStepComplete
  const checklistAssistantMonteurAbschlussDone = order?.status === 'erledigt'
  const checklistAssistantStepStatusByKey = useMemo(
    () => ({
      door: selectedDoorChecklistComplete,
      feststell: selectedFeststellChecklistComplete,
      signature: selectedInspectorSignatureSaved,
      monteur_leistungen:
        selectedDoorChecklistComplete &&
        selectedFeststellChecklistComplete &&
        selectedInspectorSignatureSaved &&
        checklistAssistantMonteurLeistungenDone,
      monteur_zeit:
        selectedDoorChecklistComplete &&
        selectedFeststellChecklistComplete &&
        selectedInspectorSignatureSaved &&
        checklistAssistantMonteurZeitDone,
      monteur_material:
        selectedDoorChecklistComplete &&
        selectedFeststellChecklistComplete &&
        selectedInspectorSignatureSaved &&
        checklistAssistantMonteurMaterialDone,
      monteur_monteur_signatur:
        selectedDoorChecklistComplete &&
        selectedFeststellChecklistComplete &&
        selectedInspectorSignatureSaved &&
        checklistAssistantMonteurMonteurSignaturDone,
      monteur_kunden_uebersicht:
        selectedDoorChecklistComplete &&
        selectedFeststellChecklistComplete &&
        selectedInspectorSignatureSaved &&
        checklistAssistantMonteurKundenUebersichtDone,
      monteur_kunden_unterschrift:
        selectedDoorChecklistComplete &&
        selectedFeststellChecklistComplete &&
        selectedInspectorSignatureSaved &&
        checklistAssistantMonteurKundenUnterschriftDone,
      monteur_abschluss:
        selectedDoorChecklistComplete &&
        selectedFeststellChecklistComplete &&
        selectedInspectorSignatureSaved &&
        checklistAssistantMonteurAbschlussDone,
    }),
    [
      selectedDoorChecklistComplete,
      selectedFeststellChecklistComplete,
      selectedInspectorSignatureSaved,
      checklistAssistantMonteurLeistungenDone,
      checklistAssistantMonteurZeitDone,
      checklistAssistantMonteurMaterialDone,
      checklistAssistantMonteurMonteurSignaturDone,
      checklistAssistantMonteurKundenUebersichtDone,
      checklistAssistantMonteurKundenUnterschriftDone,
      checklistAssistantMonteurAbschlussDone,
    ]
  )
  const checklistAssistantFlowSteps = useMemo(() => {
    const base: { key: ChecklistAssistantFlowStepKey; label: string }[] = [
      { key: 'door', label: 'Tür-Checkliste' },
    ]
    if (selectedChecklistObjectHasHoldOpen) {
      base.push({ key: 'feststell', label: 'Feststell' })
    }
    base.push({ key: 'signature', label: 'Prüfer-Unterschrift' })
    base.push({ key: 'monteur_leistungen', label: 'Monteursbericht: Leistungen' })
    base.push({ key: 'monteur_zeit', label: 'Monteursbericht: Zeit' })
    base.push({ key: 'monteur_material', label: 'Monteursbericht: Material' })
    base.push({ key: 'monteur_monteur_signatur', label: 'Monteursbericht: Monteur-Unterschrift' })
    base.push({ key: 'monteur_kunden_uebersicht', label: 'Monteursbericht: Kunden-Zusammenfassung' })
    base.push({ key: 'monteur_kunden_unterschrift', label: 'Monteursbericht: Kunden-Unterschrift' })
    base.push({ key: 'monteur_abschluss', label: 'Monteursbericht: Abschluss' })
    return base
  }, [selectedChecklistObjectHasHoldOpen])
  const checklistAssistantSteps = useMemo(
    () =>
      checklistAssistantFlowSteps.map((step) => ({
        key: step.key,
        label: step.label,
        done: checklistAssistantStepStatusByKey[step.key],
      })),
    [checklistAssistantFlowSteps, checklistAssistantStepStatusByKey]
  )
  const checklistAssistantCurrentFlowStep =
    checklistAssistantFlowSteps[Math.min(checklistAssistantStepIdx, checklistAssistantFlowSteps.length - 1)] ??
    checklistAssistantFlowSteps[0]
  const checklistAssistantCurrentFlowKey: ChecklistAssistantFlowStepKey | '' =
    checklistAssistantCurrentFlowStep?.key ?? ''
  const checklistAssistantMonteurStepActive = checklistAssistantCurrentFlowKey.startsWith('monteur_')
  const checklistAssistantSignatureDraftPending = Boolean(
    selectedChecklistObjectId &&
      checklistSigDraftTick >= 0 &&
      typeof checklistInspectorSigDraftRef.current[selectedChecklistObjectId] === 'string' &&
      checklistInspectorSigDraftRef.current[selectedChecklistObjectId]?.trim().startsWith('data:image')
  )
  const checklistAssistantMonteurSignatureDraftPending = Boolean(
    checklistAssistantCurrentFlowStep?.key === 'monteur_monteur_signatur' &&
      typeof sigTechDataUrl === 'string' &&
      sigTechDataUrl.trim().startsWith('data:image')
  )
  const checklistAssistantCustomerSignatureDraftPending = Boolean(
    checklistAssistantCurrentFlowStep?.key === 'monteur_kunden_unterschrift' &&
      typeof sigCustDataUrl === 'string' &&
      sigCustDataUrl.trim().startsWith('data:image')
  )
  /** Entwurf + Name: nur noch speichern nötig → Weiter-Button nicht als „Fehler“ (rot) darstellen. */
  const checklistAssistantKundenSignaturReadyToPersist = Boolean(
    checklistAssistantCustomerSignatureDraftPending && printedCust.trim().length > 0
  )
  const checklistAssistantCustomerSignatureMissingReason = useMemo(
    () =>
      !checklistAssistantCustomerSignatureSaved &&
      !checklistAssistantCustomerSignatureDraftPending &&
      !extra.customer_signature_reason?.trim(),
    [
      checklistAssistantCustomerSignatureSaved,
      checklistAssistantCustomerSignatureDraftPending,
      extra.customer_signature_reason,
    ]
  )
  const checklistAssistantCurrentStepDone = useMemo(() => {
    if (!checklistAssistantCurrentFlowStep) return false
    if (checklistAssistantCurrentFlowStep.key === 'door') return selectedDoorChecklistComplete
    if (checklistAssistantCurrentFlowStep.key === 'feststell') return selectedFeststellChecklistComplete
    if (checklistAssistantCurrentFlowStep.key === 'signature') return selectedInspectorSignatureSaved
    return Boolean(checklistAssistantStepStatusByKey[checklistAssistantCurrentFlowStep.key])
  }, [
    checklistAssistantCurrentFlowStep,
    selectedDoorChecklistComplete,
    selectedFeststellChecklistComplete,
    selectedInspectorSignatureSaved,
    checklistAssistantStepStatusByKey,
  ])
  const checklistAssistantNextFlowStep =
    checklistAssistantFlowSteps[Math.min(checklistAssistantStepIdx + 1, checklistAssistantFlowSteps.length - 1)] ??
    null
  const checklistAssistantCanGoBack = useMemo(() => {
    if (checklistAssistantCurrentFlowStep?.key === 'door' && checklistAssistantDoorItemIdx > 0) return true
    if (checklistAssistantCurrentFlowStep?.key === 'feststell' && checklistAssistantFestItemIdx > 0) return true
    return checklistAssistantStepIdx > 0
  }, [
    checklistAssistantCurrentFlowStep,
    checklistAssistantDoorItemIdx,
    checklistAssistantFestItemIdx,
    checklistAssistantStepIdx,
  ])
  const checklistAssistantBackCtaLabel = useMemo(() => {
    if (checklistAssistantStepIdx <= 0) return 'Zurück'
    return 'Vorheriger Schritt'
  }, [
    checklistAssistantStepIdx,
  ])
  const checklistAssistantNextCtaLabel = useMemo(() => {
    if (!checklistAssistantCurrentFlowStep) return 'Weiter'
    if (checklistAssistantStepIdx >= checklistAssistantFlowSteps.length - 1) return 'Letzter Schritt'
    if (
      checklistAssistantCurrentFlowStep.key === 'signature' &&
      !selectedInspectorSignatureSaved &&
      checklistAssistantSignatureDraftPending
    ) {
      return 'Unterschrift speichern & weiter'
    }
    if (
      checklistAssistantCurrentFlowStep.key === 'monteur_monteur_signatur' &&
      !completion?.unterschrift_mitarbeiter_path?.trim() &&
      !checklistAssistantCurrentStepDone &&
      checklistAssistantMonteurSignatureDraftPending
    ) {
      return 'Unterschrift speichern & weiter'
    }
    if (
      checklistAssistantCurrentFlowStep.key === 'monteur_kunden_unterschrift' &&
      !checklistAssistantCurrentStepDone &&
      checklistAssistantCustomerSignatureDraftPending
    ) {
      if (checklistAssistantKundenSignaturReadyToPersist) return 'Zum Abschluss'
      return 'Kundennamen eintragen'
    }
    if (
      checklistAssistantCurrentFlowStep.key === 'monteur_kunden_unterschrift' &&
      !customerSignatureStepComplete &&
      !checklistAssistantStrictEnabled
    ) {
      return 'Trotzdem weiter'
    }
    if (checklistAssistantCurrentFlowStep.key === 'door' && !checklistAssistantCurrentStepDone) {
      return 'Nächster offener Punkt'
    }
    if (checklistAssistantCurrentFlowStep.key === 'feststell' && !checklistAssistantCurrentStepDone) {
      return 'Nächster offener Punkt'
    }
    if (!checklistAssistantNextFlowStep) return 'Weiter'
    if (checklistAssistantNextFlowStep.key === 'feststell') return 'Weiter zur Feststell-Checkliste'
    if (checklistAssistantNextFlowStep.key === 'signature') return 'Weiter zur Unterschrift'
    if (checklistAssistantNextFlowStep.key.startsWith('monteur_')) {
      if (checklistAssistantNextFlowStep.key === 'monteur_zeit') return 'Weiter zu Arbeitszeit'
      if (checklistAssistantNextFlowStep.key === 'monteur_material') return 'Weiter zu Material'
      if (checklistAssistantNextFlowStep.key === 'monteur_monteur_signatur') return 'Weiter zur Monteur-Unterschrift'
      if (checklistAssistantNextFlowStep.key === 'monteur_kunden_uebersicht') return 'Weiter zur Kunden-Zusammenfassung'
      if (checklistAssistantNextFlowStep.key === 'monteur_kunden_unterschrift') return 'Weiter zur Kunden-Unterschrift'
      if (checklistAssistantNextFlowStep.key === 'monteur_abschluss') return 'Weiter zum Abschluss'
      return 'Weiter zum nächsten Schritt'
    }
    return 'Weiter'
  }, [
    checklistAssistantCurrentFlowStep,
    checklistAssistantStepIdx,
    checklistAssistantCurrentStepDone,
    checklistAssistantFlowSteps.length,
    checklistAssistantNextFlowStep,
    selectedInspectorSignatureSaved,
    completion?.unterschrift_mitarbeiter_path,
    completion?.unterschrift_kunde_path,
    checklistAssistantSignatureDraftPending,
    checklistAssistantMonteurSignatureDraftPending,
    checklistAssistantCustomerSignatureDraftPending,
    checklistAssistantKundenSignaturReadyToPersist,
    printedCust,
    customerSignatureStepComplete,
    checklistAssistantStrictEnabled,
  ])
  const openDoorChecklistPointsCount = useMemo(
    () =>
      checklistAssistantDoorItemIds.filter((id) => {
        const state = selectedDoorChecklistItems[id]
        return !state?.status
      }).length,
    [checklistAssistantDoorItemIds, selectedDoorChecklistItems]
  )
  const openFeststellChecklistPointsCount = useMemo(
    () =>
      checklistAssistantFestItemIds.filter((id) => {
        const state = selectedFeststellChecklistItems[id]
        if (id === FESTSTELL_MELDER_INTERVAL_ITEM_ID || id === FESTSTELL_INTERVAL_SECTION_ID) {
          return !isFeststellMelderIntervalChosen(selectedFeststellChecklistItems)
        }
        return !state?.status
      }).length,
    [checklistAssistantFestItemIds, selectedFeststellChecklistItems]
  )
  const checklistAssistantStepHint = useMemo(() => {
    if (!checklistAssistantCurrentFlowStep) return ''
    if (checklistAssistantCurrentFlowStep.key === 'door') {
      if (checklistAssistantFocusDoorItemId) {
        const currentState = selectedDoorChecklistItems[checklistAssistantFocusDoorItemId]
        if (currentState?.status) return ''
      }
      if (openDoorChecklistPointsCount <= 0) {
        return ''
      }
      return 'Diesen Punkt bewerten.'
    }
    if (checklistAssistantCurrentFlowStep.key === 'feststell') {
      if (checklistAssistantFocusFestItemId) {
        const currentState = selectedFeststellChecklistItems[checklistAssistantFocusFestItemId]
        if (
          checklistAssistantFocusFestItemId === FESTSTELL_MELDER_INTERVAL_ITEM_ID ||
          checklistAssistantFocusFestItemId === FESTSTELL_INTERVAL_SECTION_ID
        ) {
          if (isFeststellMelderIntervalChosen(selectedFeststellChecklistItems)) return ''
        } else if (currentState?.status) {
          return ''
        }
      }
      if (openFeststellChecklistPointsCount <= 0) {
        return ''
      }
      return 'Diesen Punkt bewerten.'
    }
    if (checklistAssistantCurrentFlowStep.key === 'signature') {
      return 'Bitte Prüfer-Unterschrift erfassen.'
    }
    if (checklistAssistantCurrentFlowStep.key === 'monteur_leistungen') return 'Leistungen ausfüllen.'
    if (checklistAssistantCurrentFlowStep.key === 'monteur_zeit') return 'Arbeitszeit erfassen.'
    if (checklistAssistantCurrentFlowStep.key === 'monteur_material') return 'Material ergänzen (falls vorhanden).'
    if (checklistAssistantCurrentFlowStep.key === 'monteur_monteur_signatur') return 'Monteur unterschreibt vorab.'
    if (checklistAssistantCurrentFlowStep.key === 'monteur_kunden_uebersicht') return 'Kunde sieht die Zusammenfassung.'
    if (checklistAssistantCurrentFlowStep.key === 'monteur_kunden_unterschrift') {
      if (checklistAssistantCustomerSignatureMissingReason) {
        return 'Ohne Kundenunterschrift bitte einen Grund im Monteurbericht angeben.'
      }
      return 'Kunde unterschreibt oder Grund erfassen.'
    }
    if (checklistAssistantCurrentFlowStep.key === 'monteur_abschluss') {
      return order?.status === 'erledigt' ? 'Monteursbericht abgeschlossen.' : 'Auftrag abschließen.'
    }
    return ''
  }, [
    checklistAssistantCurrentFlowStep,
    checklistAssistantFocusDoorItemId,
    checklistAssistantFocusFestItemId,
    selectedDoorChecklistItems,
    selectedFeststellChecklistItems,
    openDoorChecklistPointsCount,
    openFeststellChecklistPointsCount,
    checklistAssistantCustomerSignatureMissingReason,
    order?.status,
  ])
  useEffect(() => {
    if (!checklistAssistantActive || checklistAssistantCurrentFlowStep?.key !== 'monteur_leistungen') return
    if (!monteurAutoLeistungenText.trim()) return
    if (ausgeführte.trim()) return
    setAusgeführte(monteurAutoLeistungenText)
  }, [checklistAssistantActive, checklistAssistantCurrentFlowStep?.key, monteurAutoLeistungenText, ausgeführte])
  const checklistAssistantCurrentPointDone = useMemo(() => {
    if (!checklistAssistantCurrentFlowStep) return false
    if (checklistAssistantCurrentFlowStep.key === 'door') {
      if (!checklistAssistantFocusDoorItemId) return false
      return Boolean(selectedDoorChecklistItems[checklistAssistantFocusDoorItemId]?.status)
    }
    if (checklistAssistantCurrentFlowStep.key === 'feststell') {
      if (!checklistAssistantFocusFestItemId) return false
      const currentState = selectedFeststellChecklistItems[checklistAssistantFocusFestItemId]
      if (
        checklistAssistantFocusFestItemId === FESTSTELL_MELDER_INTERVAL_ITEM_ID ||
        checklistAssistantFocusFestItemId === FESTSTELL_INTERVAL_SECTION_ID
      ) {
        return isFeststellMelderIntervalChosen(selectedFeststellChecklistItems)
      }
      return Boolean(currentState?.status)
    }
    if (checklistAssistantCurrentFlowStep.key === 'signature') {
      return selectedInspectorSignatureSaved
    }
    if (checklistAssistantCurrentFlowStep.key === 'monteur_kunden_unterschrift') {
      return customerSignatureStepComplete
    }
    return checklistAssistantCurrentStepDone
  }, [
    checklistAssistantCurrentFlowStep,
    checklistAssistantFocusDoorItemId,
    selectedDoorChecklistItems,
    checklistAssistantFocusFestItemId,
    selectedFeststellChecklistItems,
    selectedInspectorSignatureSaved,
    checklistAssistantCurrentStepDone,
    customerSignatureStepComplete,
  ])
  const checklistAssistantDoorDoneCount = useMemo(
    () => Math.max(0, checklistAssistantDoorItemIds.length - openDoorChecklistPointsCount),
    [checklistAssistantDoorItemIds.length, openDoorChecklistPointsCount]
  )
  const checklistAssistantFestDoneCount = useMemo(() => {
    if (!selectedChecklistObjectHasHoldOpen) return 0
    return Math.max(0, checklistAssistantFestItemIds.length - openFeststellChecklistPointsCount)
  }, [selectedChecklistObjectHasHoldOpen, checklistAssistantFestItemIds.length, openFeststellChecklistPointsCount])
  const checklistAssistantTaskTotalCount = useMemo(
    () =>
      checklistAssistantDoorItemIds.length +
      (selectedChecklistObjectHasHoldOpen ? checklistAssistantFestItemIds.length : 0) +
      8, // Prüfer-Unterschrift + 7 Monteursbericht-Teilabschnitte
    [checklistAssistantDoorItemIds.length, selectedChecklistObjectHasHoldOpen, checklistAssistantFestItemIds.length]
  )
  const checklistAssistantTaskDoneCount = useMemo(
    () =>
      checklistAssistantDoorDoneCount +
      checklistAssistantFestDoneCount +
      (selectedInspectorSignatureSaved ? 1 : 0) +
      (checklistAssistantMonteurLeistungenDone ? 1 : 0) +
      (checklistAssistantMonteurZeitDone ? 1 : 0) +
      (checklistAssistantMonteurMaterialDone ? 1 : 0) +
      (checklistAssistantMonteurMonteurSignaturDone ? 1 : 0) +
      (checklistAssistantMonteurKundenUebersichtDone ? 1 : 0) +
      (checklistAssistantMonteurKundenUnterschriftDone ? 1 : 0) +
      (checklistAssistantMonteurAbschlussDone ? 1 : 0),
    [
      checklistAssistantDoorDoneCount,
      checklistAssistantFestDoneCount,
      selectedInspectorSignatureSaved,
      checklistAssistantMonteurLeistungenDone,
      checklistAssistantMonteurZeitDone,
      checklistAssistantMonteurMaterialDone,
      checklistAssistantMonteurMonteurSignaturDone,
      checklistAssistantMonteurKundenUebersichtDone,
      checklistAssistantMonteurKundenUnterschriftDone,
      checklistAssistantMonteurAbschlussDone,
    ]
  )
  const checklistAssistantProgressPercent = useMemo(() => {
    if (checklistAssistantTaskTotalCount <= 0) return 0
    return Math.round((checklistAssistantTaskDoneCount / checklistAssistantTaskTotalCount) * 100)
  }, [checklistAssistantTaskDoneCount, checklistAssistantTaskTotalCount])
  const checklistDoorCompletion = useMemo(() => {
    const total = orderObjectIds.length
    if (total === 0) return { done: 0, total: 0, open: 0 }
    const done = orderObjectIds.filter((oid) => Boolean(extra.wartung_checkliste?.by_object_id[oid]?.saved_at)).length
    return { done, total, open: Math.max(0, total - done) }
  }, [orderObjectIds, extra.wartung_checkliste?.by_object_id])
  const hasAssistantDraftProgress = useMemo(() => {
    const byObject = extra.wartung_checkliste?.by_object_id ?? {}
    return Object.values(byObject).some((entry) => {
      const hasDoor = Boolean(entry.saved_at)
      const hasFest = Boolean(entry.feststell_checkliste?.saved_at)
      const hasSign = Boolean(entry.pruefer_signature_path?.trim())
      return hasDoor || hasFest || hasSign
    })
  }, [extra.wartung_checkliste?.by_object_id])
  const hasChecklistLocalProgress = useMemo(() => {
    const hasDoorProgress = Object.values(checklistItemsByObject).some((items) =>
      Object.values(items).some((row) => {
        if (!row) return false
        if (row.status && row.status !== 'nicht_geprueft') return true
        if ((row.note ?? '').trim()) return true
        if (row.advisory) return true
        if ((row.advisory_note ?? '').trim()) return true
        return false
      })
    )
    if (hasDoorProgress) return true
    return Object.values(feststellItemsByObject).some((items) =>
      Object.values(items).some((row) => {
        if (!row) return false
        if (row.status && row.status !== 'nicht_geprueft') return true
        if ((row.note ?? '').trim()) return true
        if (row.advisory) return true
        if ((row.advisory_note ?? '').trim()) return true
        if (row.melder_interval && row.melder_interval !== 'nicht_beurteilt') return true
        return false
      })
    )
  }, [checklistItemsByObject, feststellItemsByObject])
  /** Gespeicherte oder noch nicht synchronisierte Checklisten-Bearbeitung → Fortsetzen/Neu starten */
  const assistantResumePromptEligible = useMemo(
    () => hasAssistantDraftProgress || hasChecklistLocalProgress,
    [hasAssistantDraftProgress, hasChecklistLocalProgress]
  )
  const shouldConfirmChecklistModeSwitch = hasAssistantDraftProgress || hasChecklistLocalProgress
  const assistantTechnicalError = useMemo(() => {
    const raw = checklistSaveError || feststellSaveError || ''
    if (!raw) return null
    if (
      raw.includes('Bitte alle Prüfpunkte bewerten') ||
      raw.includes('Bitte alle Feststellanlagen-Prüfpunkte bewerten') ||
      raw.includes('Unterschrift Prüfer (Pflicht)')
    ) {
      return null
    }
    return raw
  }, [checklistSaveError, feststellSaveError])
  const assistantSaveStatusLabel = useMemo(() => {
    if (checklistSyncing) return 'Wird synchronisiert'
    if (!isOnline()) return 'Entwurf lokal'
    if (assistantTechnicalError) return 'Fehler'
    return 'Gespeichert'
  }, [checklistSyncing, assistantTechnicalError])
  const assistantInlineSaveError = useMemo(() => {
    const raw = assistantTechnicalError
    if (!raw) return null
    if (!checklistAssistantActive) return raw
    if (
      raw.includes('Bitte alle Prüfpunkte bewerten') ||
      raw.includes('Bitte alle Feststellanlagen-Prüfpunkte bewerten') ||
      raw.includes('Bitte beim Punkt Rauchmelder-Austausch eine Option wählen.')
    ) {
      return null
    }
    return raw
  }, [assistantTechnicalError, checklistAssistantActive])
  const canViewSelectedPruefprotokoll = useMemo(() => {
    if (!selectedChecklistObjectId) return false
    if (!selectedDoorSaved) return false
    if (selectedChecklistObjectHasHoldOpen && !selectedFeststellSaved) return false
    if (!selectedInspectorSignatureSaved) return false
    return true
  }, [
    selectedChecklistObjectId,
    selectedDoorSaved,
    selectedChecklistObjectHasHoldOpen,
    selectedFeststellSaved,
    selectedInspectorSignatureSaved,
  ])
  const assistantDoorCandidates = useMemo(() => {
    if (!order) return []
    const selectedIds = new Set(orderObjectIds)
    return allObjects.filter(
      (obj) =>
        obj.customer_id === order.customer_id &&
        (obj.bv_id ?? null) === (order.bv_id ?? null) &&
        !selectedIds.has(obj.id)
    )
  }, [allObjects, order, orderObjectIds])

  const doorChecklistStatusByObjectId = useMemo(() => {
    const out: Record<string, ReturnType<typeof getWartungChecklistObjectUiStatus>> = {}
    if (order?.order_type !== 'wartung') return out
    for (const oid of orderObjectIds) {
      const ob = objectsById[oid]
      const doorItems = checklistItemsByObject[oid] ?? {}
      const festItems = feststellItemsByObject[oid] ?? {}
      const hasHold = Boolean(ob?.has_hold_open)
      out[oid] = getWartungChecklistObjectUiStatus(checklistMode, doorItems, hasHold ? festItems : null, hasHold)
    }
    return out
  }, [order?.order_type, orderObjectIds, objectsById, checklistItemsByObject, feststellItemsByObject, checklistMode])

  orderRef.current = order
  extraRef.current = extra
  completionRef.current = completion
  userRef.current = user
  licenseReadOnlyRef.current = Boolean(license?.read_only)
  checklistItemsByObjectRef.current = checklistItemsByObject
  feststellItemsByObjectRef.current = feststellItemsByObject
  checklistModeRef.current = checklistMode
  objectsByIdRef.current = objectsById
  ausgeführteRef.current = ausgeführte
  printedTechRef.current = printedTech
  printedCustRef.current = printedCust
  checklistSyncingRef.current = checklistSyncing
  checklistReportIdByObjectRef.current = checklistReportIdByObject

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

  useEffect(() => {
    if (isAssistantRoute && checklistAssistantEnabled) return
    if (checklistAssistantEnabled) {
      if (checklistModePolicy === 'assistant_only') {
        setChecklistAssistantUiMode('assistant')
      } else if (checklistModePolicy === 'classic_only') {
        setChecklistAssistantUiMode('classic')
      } else {
        setChecklistAssistantUiMode(null)
      }
      return
    }
    setChecklistAssistantUiMode('classic')
  }, [checklistAssistantEnabled, checklistModePolicy, order?.id, isAssistantRoute])

  useEffect(() => {
    if (!order) return
    if (!isAssistantRoute) {
      assistantEntryResumeHandledRef.current = false
      setAssistantResumeDialogOpen(false)
      return
    }
    if (isLicenseLoading) {
      return
    }
    if (!checklistAssistantEnabled || order.order_type !== 'wartung') {
      navigate(`/auftrag/${order.id}`, { replace: true })
      return
    }
    if (!assistantResumePromptEligible) return
    if (assistantEntryResumeHandledRef.current) return
    assistantEntryResumeHandledRef.current = true
    setAssistantResumeDialogOpen(true)
  }, [
    order,
    isAssistantRoute,
    checklistAssistantEnabled,
    isLicenseLoading,
    navigate,
    assistantResumePromptEligible,
  ])

  useEffect(() => {
    if (!isAssistantRoute) return
    if (!checklistAssistantEnabled) return
    if (checklistAssistantUiMode !== null) return
    setChecklistAssistantUiMode('assistant')
  }, [isAssistantRoute, checklistAssistantEnabled, checklistAssistantUiMode])

  useEffect(() => {
    if (!checklistAssistantActive) return
    if (skipAssistantStepAutoResetRef.current) {
      skipAssistantStepAutoResetRef.current = false
      return
    }
    setChecklistAssistantStepIdx(0)
  }, [checklistAssistantActive, selectedChecklistObjectId, selectedChecklistObjectHasHoldOpen])

  useEffect(() => {
    setChecklistAssistantDoorItemIdx(0)
    setChecklistAssistantFestItemIdx(0)
  }, [selectedChecklistObjectId, checklistMode, checklistAssistantUiMode])

  useEffect(() => {
    prefetchBriefbogenPdfAssets()
  }, [])

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

  const setExtraField = <K extends keyof OrderCompletionExtraV1>(key: K, value: OrderCompletionExtraV1[K]) => {
    setExtra((prev) => ({ ...prev, [key]: value }))
  }

  const setPrimary = (patch: Partial<OrderCompletionExtraV1['primary']>) => {
    setExtra((prev) => {
      const next = { ...prev.primary, ...patch }
      next.end = clampEndAfterStartSameDay(next.start, next.end)
      return { ...prev, primary: next }
    })
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
      zusatz_monteure: prev.zusatz_monteure.map((z, i) => {
        if (i !== index) return z
        const next = { ...z, ...patch }
        next.end = clampEndAfterStartSameDay(next.start, next.end)
        return next
      }),
    }))
  }

  const handleZusatzProfilePick = (index: number, profileId: string) => {
    const p = profiles.find((x) => x.id === profileId)
    handleZusatzChange(index, {
      profile_id: profileId || undefined,
      name: p ? getProfileDisplayName(p) : '',
    })
  }

  useEffect(() => {
    if (isLoading) return
    setExtra((prev) => {
      const pe = clampEndAfterStartSameDay(prev.primary.start, prev.primary.end)
      const nextZ = prev.zusatz_monteure.map((z) => ({
        ...z,
        end: clampEndAfterStartSameDay(z.start, z.end),
      }))
      const zusatzSame = nextZ.every((z, i) => z.end === prev.zusatz_monteure[i]?.end)
      if (pe === prev.primary.end && zusatzSame) return prev
      return { ...prev, primary: { ...prev.primary, end: pe }, zusatz_monteure: nextZ }
    })
  }, [isLoading, orderId])

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

    const mergedExtra: OrderCompletionExtraV1 = { ...payloadBase.completion_extra }
    const extraJson = mergedExtra as unknown as OrderCompletion['completion_extra']

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
        const msg = String(error.message ?? '').toLowerCase()
        const isDuplicate =
          msg.includes('duplicate key value') ||
          msg.includes('violates unique constraint') ||
          msg.includes('23505') ||
          msg.includes('datensatz existiert bereits')
        if (!isDuplicate) {
          showError(getSupabaseErrorMessage(error))
          return null
        }
        // Concurrent/previous insert exists: continue with existing completion row.
        const existing = await fetchCompletionByOrderId(order.id)
        if (!existing?.id) {
          showError(getSupabaseErrorMessage(error))
          return null
        }
        id = existing.id
      }
      if (!id) {
        if (!data) return null
        id = data.id
      }
    }

    if (sigTechDataUrl && id) {
      const up = await uploadOrderCompletionSignature(id, sigTechDataUrl, 'technician')
      if (up.path) techPath = up.path
      else if (up.error) showError(up.error.message)
    }
    if (sigCustDataUrl && id) {
      const customerNameOk = (payloadBase.unterschrift_kunde_name ?? '').trim().length > 0
      if (!customerNameOk) {
        // Kundenunterschrift nur mit Namen speichern; ohne Namen: Grund bei fehlender Unterschrift (Monteurbericht)
        // Kein Toast hier (Autosave) — Rückmeldung bei explizitem „Weiter“ / Abschlussdialog
      } else {
        const up = await uploadOrderCompletionSignature(id, sigCustDataUrl, 'customer')
        if (up.path) custPath = up.path
        else if (up.error) showError(up.error.message)
      }
    }
    const finalPayload = {
      ausgeführte_arbeiten: payloadBase.ausgeführte_arbeiten,
      material: payloadBase.material,
      arbeitszeit_minuten: payloadBase.arbeitszeit_minuten,
      completion_extra: mergedExtra as unknown as OrderCompletion['completion_extra'],
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
      completion_extra: mergedExtra,
    } as OrderCompletion
  }

  const maybeInvalidateForeignInspectorSignature = useCallback((oid: string) => {
    const uid = userRef.current?.id
    if (!uid) return
    const per = extraRef.current.wartung_checkliste?.by_object_id[oid]
    if (!per?.pruefer_signature_path?.trim()) return
    if (per.pruefer_profile_id === uid) return
    const next = stripWartungChecklistInspectorSignatureForObject(extraRef.current, oid)
    extraRef.current = next
    setExtra(next)
    checklistInspectorSigDraftRef.current[oid] = null
    setChecklistSigDraftTick((t) => t + 1)
    if (checklistReportIdByObjectRef.current[oid]) {
      setChecklistReportIdByObject((prev) => {
        if (!prev[oid]) return prev
        const n = { ...prev }
        delete n[oid]
        checklistReportIdByObjectRef.current = n
        return n
      })
    }
    checklistDraftFingerprintByOidRef.current[oid] = ''
  }, [])

  persistChecklistDraftForObjectRef.current = async (oid: string): Promise<string | null> => {
    const orderL = orderRef.current
    if (!orderL || orderL.order_type !== 'wartung') return null
    if (licenseReadOnlyRef.current) return null
    if (!isOnline()) return null
    if (checklistSyncingRef.current) {
      return checklistReportIdByObjectRef.current[oid] ?? null
    }
    if (!checklistDraftAutosaveReadyRef.current) {
      return checklistReportIdByObjectRef.current[oid] ?? null
    }

    const extraL = extraRef.current
    const mode = checklistModeRef.current
    const items = checklistItemsByObjectRef.current[oid] ?? {}
    const objectsByIdL = objectsByIdRef.current
    const ob = objectsByIdL[oid]
    const festItems = ob?.has_hold_open ? feststellItemsByObjectRef.current[oid] ?? {} : {}

    const doorV = validateChecklistComplete(mode, items)
    const festV = ob?.has_hold_open ? validateFeststellChecklistComplete(mode, festItems) : { ok: true as const, message: '' }
    const fullyOk = doorV.ok && festV.ok

    const prevPer = extraL.wartung_checkliste?.by_object_id[oid]
    const draftSigRaw = checklistInspectorSigDraftRef.current[oid]
    const hasNewSignatureDraft =
      typeof draftSigRaw === 'string' && draftSigRaw.trim().startsWith('data:image')

    const fp = JSON.stringify({
      m: mode,
      door: items,
      fest: festItems,
      sigDraftHead: hasNewSignatureDraft ? draftSigRaw.slice(0, 96) : '',
      sigPath: prevPer?.pruefer_signature_path ?? '',
      sigProfile: prevPer?.pruefer_profile_id ?? '',
    })
    const existingRid = checklistReportIdByObjectRef.current[oid]
    if (checklistDraftFingerprintByOidRef.current[oid] === fp) {
      if (!fullyOk) return existingRid ?? null
      if (existingRid) return existingRid
    }
    const stamp = new Date().toISOString()

    const draftPer: WartungChecklistPerObject = {
      ...(prevPer ?? { items: {} }),
      checklist_modus: mode,
      items: { ...items },
      saved_at: undefined,
    }
    if (ob?.has_hold_open) {
      draftPer.feststell_checkliste = {
        ...(prevPer?.feststell_checkliste ?? { items: {} }),
        checklist_modus: mode,
        items: { ...festItems },
        saved_at: undefined,
      }
    } else if (prevPer?.feststell_checkliste) {
      draftPer.feststell_checkliste = { ...prevPer.feststell_checkliste }
    }

    const mergeExtraWithPer = (per: WartungChecklistPerObject): OrderCompletionExtraV1 => ({
      ...extraL,
      wartung_checkliste: {
        v: 1,
        by_object_id: {
          ...(extraL.wartung_checkliste?.by_object_id ?? {}),
          [oid]: per,
        },
      },
    })

    const doorText = buildDeficiencyTextFromChecklist(mode, items)
    const festText = ob?.has_hold_open
      ? buildDeficiencyTextFromFeststellChecklist(mode, festItems)
      : ''
    const merged = [doorText, festText].filter((x) => x.trim().length > 0).join('\n\n---\n\n')
    const mergedDef = { text: merged, hasDef: merged.trim().length > 0 }

    const draftExtra = mergeExtraWithPer(draftPer)
    const completionL = completionRef.current
    const aus = ausgeführteRef.current
    const pt = printedTechRef.current
    const pc = printedCustRef.current

    const buildCompletionPayload = (x: OrderCompletionExtraV1) => ({
      ausgeführte_arbeiten: aus.trim() || null,
      material: materialLinesToText(x.material_lines) || null,
      arbeitszeit_minuten: sumWorkMinutes(x.primary, x.zusatz_monteure) > 0
        ? sumWorkMinutes(x.primary, x.zusatz_monteure)
        : null,
      completion_extra: x,
      unterschrift_mitarbeiter_name: pt.trim() || null,
      unterschrift_mitarbeiter_date: new Date().toISOString(),
      unterschrift_kunde_name: pc.trim() || null,
      unterschrift_kunde_date: pc.trim() ? new Date().toISOString() : null,
      unterschrift_mitarbeiter_path: completionL?.unterschrift_mitarbeiter_path ?? null,
      unterschrift_kunde_path: completionL?.unterschrift_kunde_path ?? null,
    })

    checklistSyncingRef.current = true
    setChecklistSyncing(true)
    setChecklistSaveError(doorV.ok ? null : doorV.message)
    setFeststellSaveError(ob?.has_hold_open && !festV.ok ? festV.message : null)

    setExtra(draftExtra)
    const compDraft = await persistCompletion(completionL?.id ?? null, buildCompletionPayload(draftExtra))
    if (!compDraft) {
      checklistSyncingRef.current = false
      setChecklistSyncing(false)
      return null
    }
    setCompletion(compDraft)
    extraRef.current = draftExtra
    completionRef.current = compDraft

    if (!fullyOk) {
      if (checklistReportIdByObjectRef.current[oid]) {
        setChecklistReportIdByObject((prev) => {
          if (!prev[oid]) return prev
          const next = { ...prev }
          delete next[oid]
          return next
        })
        const ridMap = { ...checklistReportIdByObjectRef.current }
        delete ridMap[oid]
        checklistReportIdByObjectRef.current = ridMap
      }
      checklistDraftFingerprintByOidRef.current[oid] = fp
      checklistSyncingRef.current = false
      setChecklistSyncing(false)
      return null
    }

    const uid = userRef.current?.id ?? null
    const storedSigValid =
      Boolean(prevPer?.pruefer_signature_path?.trim()) && prevPer?.pruefer_profile_id === uid
    const hasValidInspectorSig = Boolean(uid) && (hasNewSignatureDraft || storedSigValid)

    if (!hasValidInspectorSig) {
      setChecklistSaveError(
        uid
          ? 'Unterschrift Prüfer (Pflicht): Bitte unten unterschreiben.'
          : 'Anmeldung erforderlich für die Prüfer-Unterschrift.'
      )
      if (checklistReportIdByObjectRef.current[oid]) {
        setChecklistReportIdByObject((prev) => {
          if (!prev[oid]) return prev
          const next = { ...prev }
          delete next[oid]
          checklistReportIdByObjectRef.current = next
          return next
        })
      }
      checklistDraftFingerprintByOidRef.current[oid] = fp
      checklistSyncingRef.current = false
      setChecklistSyncing(false)
      return null
    }

    let perForUpsert: WartungChecklistPerObject = { ...draftPer }

    if (hasNewSignatureDraft) {
      if (!isOnline()) {
        showError('Unterschrift: Bitte mit Verbindung speichern (Upload).')
        checklistSyncingRef.current = false
        setChecklistSyncing(false)
        return null
      }
      const sigUp = await uploadWartungChecklistInspectorSignature(compDraft.id, oid, draftSigRaw)
      if (!sigUp.path) {
        if (sigUp.error) showError(sigUp.error.message)
        checklistSyncingRef.current = false
        setChecklistSyncing(false)
        return null
      }
      checklistInspectorSigDraftRef.current[oid] = null
      const sigAt = new Date().toISOString()
      perForUpsert = {
        ...draftPer,
        pruefer_signature_path: sigUp.path,
        pruefer_signature_at: sigAt,
        pruefer_profile_id: uid,
      }
      const signedExtra = mergeExtraWithPer(perForUpsert)
      setExtra(signedExtra)
      extraRef.current = signedExtra
      const compSigned = await persistCompletion(compDraft.id, buildCompletionPayload(signedExtra))
      if (!compSigned) {
        checklistSyncingRef.current = false
        setChecklistSyncing(false)
        return null
      }
      setCompletion(compSigned)
      completionRef.current = compSigned
    }

    const hadReportBefore = Boolean(checklistReportIdByObjectRef.current[oid])
    const festProto = ob?.has_hold_open
      ? {
          modus: mode,
          items: festItems,
          norms: ['DIN 14677-1', 'DIN 14677-2'],
          order_id: orderL.id,
        }
      : undefined

    const up = await upsertWartungsChecklistProtocol({
      orderId: orderL.id,
      objectId: oid,
      maintenanceDate: draftExtra.bericht_datum,
      technicianId: userRef.current?.id ?? null,
      checklistProtocol: {
        modus: mode,
        items,
        norms: ['DIN EN 1634', 'DIN EN 16034', 'DIN 4102', 'DIN 18040'],
        order_id: orderL.id,
      },
      ...(festProto ? { feststellChecklistProtocol: festProto } : {}),
      deficiencyDescription: mergedDef.hasDef ? mergedDef.text : null,
      deficienciesFound: mergedDef.hasDef,
    })
    if (up.error) {
      showError(up.error.message)
      checklistSyncingRef.current = false
      setChecklistSyncing(false)
      return null
    }

    const completePer: WartungChecklistPerObject = {
      ...perForUpsert,
      saved_at: prevPer?.saved_at ?? stamp,
    }
    if (ob?.has_hold_open && perForUpsert.feststell_checkliste) {
      completePer.feststell_checkliste = {
        ...perForUpsert.feststell_checkliste,
        saved_at: prevPer?.feststell_checkliste?.saved_at ?? stamp,
      }
    }

    const completeExtra = mergeExtraWithPer(completePer)
    setExtra(completeExtra)
    const compFinal = await persistCompletion(compDraft.id, buildCompletionPayload(completeExtra))
    checklistSyncingRef.current = false
    setChecklistSyncing(false)
    if (!compFinal) return null
    setCompletion(compFinal)
    extraRef.current = completeExtra
    completionRef.current = compFinal

    checklistDraftFingerprintByOidRef.current[oid] = fp
    const newId = up.data?.id ?? null
    if (newId) {
      setChecklistReportIdByObject((prev) => ({ ...prev, [oid]: newId }))
      checklistReportIdByObjectRef.current = { ...checklistReportIdByObjectRef.current, [oid]: newId }
      const prom = await promoteChecklistDefectPhotoDrafts(orderL.id, oid, newId)
      if (prom.error) {
        showToast(`Entwurfsfotos konnten nicht übernommen werden: ${prom.error.message}`, 'info')
      }
      const regrouped = await fetchChecklistMangelPhotosGroupedForOrderObject(orderL.id, oid, newId)
      setDefectPhotosByObject((prev) => ({ ...prev, [oid]: regrouped }))
      if (!hadReportBefore) {
        showToast(
          prom.promoted > 0
            ? `Prüfprotokoll angelegt; ${prom.promoted} Entwurfsfoto${prom.promoted === 1 ? '' : 's'} übernommen.`
            : 'Prüfprotokoll angelegt.',
          'success'
        )
      }
    }
    return newId
  }

  useEffect(() => {
    if (!checklistDraftAutosaveReadyRef.current) return
    if (order?.order_type !== 'wartung') return
    const oid = selectedChecklistObjectId
    if (!oid) return
    if (license?.read_only) return
    const t = window.setTimeout(() => {
      void persistChecklistDraftForObjectRef.current(oid)
    }, 350)
    return () => clearTimeout(t)
  }, [
    checklistItemsByObject,
    feststellItemsByObject,
    selectedChecklistObjectId,
    checklistMode,
    order?.id,
    order?.order_type,
    license?.read_only,
    checklistSigDraftTick,
  ])

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

  const persistCompletionExecRef = useRef(persistCompletion)
  persistCompletionExecRef.current = persistCompletion

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
      setExtra(
        parseOrderCompletionExtra(
          comp.completion_extra,
          printedTech.trim() || comp.unterschrift_mitarbeiter_name || extra.monteur_name
        )
      )
      setSigTechDataUrl(null)
      setMonteurSignatureReplaceMode(false)
      setSigCustDataUrl(null)
      setCustomerSignatureReplaceMode(false)
      showToast('Bericht gespeichert.', 'success')
    }
  }

  const handleReplaceInspectorSignature = () => {
    const oid = selectedChecklistObjectId
    if (!oid) return
    const next = stripWartungChecklistInspectorSignatureForObject(extraRef.current, oid)
    extraRef.current = next
    setExtra(next)
    checklistInspectorSigDraftRef.current[oid] = null
    setChecklistSigDraftTick((t) => t + 1)
    if (checklistReportIdByObjectRef.current[oid]) {
      setChecklistReportIdByObject((prev) => {
        if (!prev[oid]) return prev
        const n = { ...prev }
        delete n[oid]
        checklistReportIdByObjectRef.current = n
        return n
      })
    }
    checklistDraftFingerprintByOidRef.current[oid] = ''
  }

  const handleInspectorSignatureChange = (dataUrl: string | null) => {
    const oid = selectedChecklistObjectId
    if (!oid) return
    checklistInspectorSigDraftRef.current[oid] = dataUrl
    setChecklistSigDraftTick((t) => t + 1)
  }

  const handleChecklistItemChange = (itemId: string, patch: Partial<WartungChecklistItemState>) => {
    const oid = selectedChecklistObjectId
    if (!oid) return
    setChecklistSaveError(null)
    setFeststellSaveError(null)
    maybeInvalidateForeignInspectorSignature(oid)
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
    setChecklistSaveError(null)
    setFeststellSaveError(null)
    maybeInvalidateForeignInspectorSignature(oid)
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

  const isDoorChecklistRowOpen = useCallback((row: WartungChecklistItemState | undefined) => {
    return !row?.status
  }, [])

  const findNextOpenDoorItemIndex = useCallback(
    (fromIdx: number): number => {
      if (checklistAssistantDoorItemIds.length === 0) return 0
      for (let i = fromIdx + 1; i < checklistAssistantDoorItemIds.length; i++) {
        const id = checklistAssistantDoorItemIds[i]
        const row = selectedDoorChecklistItems[id]
        if (isDoorChecklistRowOpen(row)) return i
      }
      for (let i = 0; i < fromIdx && i < checklistAssistantDoorItemIds.length; i++) {
        const id = checklistAssistantDoorItemIds[i]
        const row = selectedDoorChecklistItems[id]
        if (isDoorChecklistRowOpen(row)) return i
      }
      return fromIdx
    },
    [checklistAssistantDoorItemIds, selectedDoorChecklistItems, isDoorChecklistRowOpen]
  )

  const isFeststellChecklistRowOpen = useCallback((row: FeststellChecklistItemState | undefined) => {
    return !row?.status
  }, [])

  const findNextOpenFeststellItemIndex = useCallback(
    (fromIdx: number): number => {
      if (checklistAssistantFestItemIds.length === 0) return 0
      for (let i = fromIdx + 1; i < checklistAssistantFestItemIds.length; i++) {
        const id = checklistAssistantFestItemIds[i]
        const row = selectedFeststellChecklistItems[id]
        if (id === FESTSTELL_MELDER_INTERVAL_ITEM_ID || id === FESTSTELL_INTERVAL_SECTION_ID) {
          if (!isFeststellMelderIntervalChosen(selectedFeststellChecklistItems)) return i
          continue
        }
        if (isFeststellChecklistRowOpen(row)) return i
      }
      for (let i = 0; i < fromIdx && i < checklistAssistantFestItemIds.length; i++) {
        const id = checklistAssistantFestItemIds[i]
        const row = selectedFeststellChecklistItems[id]
        if (id === FESTSTELL_MELDER_INTERVAL_ITEM_ID || id === FESTSTELL_INTERVAL_SECTION_ID) {
          if (!isFeststellMelderIntervalChosen(selectedFeststellChecklistItems)) return i
          continue
        }
        if (isFeststellChecklistRowOpen(row)) return i
      }
      return fromIdx
    },
    [checklistAssistantFestItemIds, selectedFeststellChecklistItems, isFeststellChecklistRowOpen]
  )
  const handleSelectNextOpenDoor = useCallback(() => {
    if (orderObjectIds.length === 0) return
    const nextOpen = orderObjectIds.find((oid) => !extra.wartung_checkliste?.by_object_id[oid]?.saved_at)
    if (nextOpen) {
      setSelectedChecklistObjectId(nextOpen)
      return
    }
    setSelectedChecklistObjectId(orderObjectIds[0] ?? null)
  }, [orderObjectIds, extra.wartung_checkliste?.by_object_id])
  const handleStartAssistant = async (resume: boolean) => {
      if (!resume) {
        const mode = checklistModeRef.current
        const resetDoorItems: Record<string, Record<string, WartungChecklistItemState>> = {}
        const resetFestItems: Record<string, Record<string, FeststellChecklistItemState>> = {}
        for (const oid of orderObjectIds) {
          resetDoorItems[oid] = initEmptyChecklistItems(mode)
          if (objectsById[oid]?.has_hold_open) {
            resetFestItems[oid] = initEmptyFeststellChecklistItems(mode)
          }
        }
        const nextExtra: OrderCompletionExtraV1 = {
          ...extraRef.current,
          wartung_checkliste: { v: 1, by_object_id: {} },
        }

        setChecklistItemsByObject(resetDoorItems)
        setFeststellItemsByObject(resetFestItems)
        setChecklistReportIdByObject({})
        checklistReportIdByObjectRef.current = {}
        setDefectPhotosByObject({})
        checklistInspectorSigDraftRef.current = {}
        setChecklistSigDraftTick((t) => t + 1)
        setChecklistSaveError(null)
        setFeststellSaveError(null)
        checklistDraftFingerprintByOidRef.current = {}
        setExtra(nextExtra)
        extraRef.current = nextExtra

        const payload = {
          ausgeführte_arbeiten: (ausgeführteRef.current ?? '').trim() || null,
          material: materialLinesToText(nextExtra.material_lines) || null,
          arbeitszeit_minuten:
            sumWorkMinutes(nextExtra.primary, nextExtra.zusatz_monteure) > 0
              ? sumWorkMinutes(nextExtra.primary, nextExtra.zusatz_monteure)
              : null,
          completion_extra: nextExtra,
          unterschrift_mitarbeiter_name: (printedTechRef.current ?? '').trim() || null,
          unterschrift_mitarbeiter_date: new Date().toISOString(),
          unterschrift_kunde_name: (printedCustRef.current ?? '').trim() || null,
          unterschrift_kunde_date: (printedCustRef.current ?? '').trim() ? new Date().toISOString() : null,
          unterschrift_mitarbeiter_path: completion?.unterschrift_mitarbeiter_path ?? null,
          unterschrift_kunde_path: completion?.unterschrift_kunde_path ?? null,
        }
        const comp = await persistCompletion(completion?.id ?? null, payload)
        if (comp) {
          setCompletion(comp)
          completionRef.current = comp
        }

        setChecklistAssistantStepIdx(0)
        setChecklistAssistantDoorItemIdx(0)
        setChecklistAssistantFestItemIdx(0)
        setSelectedChecklistObjectId(orderObjectIds[0] ?? null)
      } else {
        const firstIncomplete =
          orderObjectIds.find((oid) => !extra.wartung_checkliste?.by_object_id[oid]?.saved_at) ??
          orderObjectIds[0] ??
          null
        if (firstIncomplete) {
          const mode = checklistModeRef.current
          const doorIds = getChecklistItemIdsForMode(mode)
          const festIds = getFeststellChecklistItemIdsForMode(mode)
          const doorItems = checklistItemsByObjectRef.current[firstIncomplete] ?? initEmptyChecklistItems(mode)
          const festItems = feststellItemsByObjectRef.current[firstIncomplete] ?? initEmptyFeststellChecklistItems(mode)
          const hasHoldOpen = Boolean(objectsByIdRef.current[firstIncomplete]?.has_hold_open)
          const doorDone = validateChecklistComplete(mode, doorItems).ok
          const festDone = hasHoldOpen ? validateFeststellChecklistComplete(mode, festItems).ok : true
          const sigSaved = Boolean(
            extraRef.current.wartung_checkliste?.by_object_id[firstIncomplete]?.pruefer_signature_path?.trim()
          )
          const monteurLeistungenDone =
            Boolean(extraRef.current.bericht_datum?.trim()) && Boolean((ausgeführteRef.current ?? '').trim())
          const monteurZeitDone = sumWorkMinutes(extraRef.current.primary, extraRef.current.zusatz_monteure) > 0
          const monteurMaterialDone = true
          const monteurMonteurSignaturDone =
            Boolean(completionRef.current?.unterschrift_mitarbeiter_path?.trim()) ||
            Boolean(typeof sigTechDataUrl === 'string' && sigTechDataUrl.trim().startsWith('data:image'))
          const monteurKundenUebersichtDone = true
          const custPath = completionRef.current?.unterschrift_kunde_path?.trim()
          const custNameOk = Boolean((printedCustRef.current ?? '').trim())
          const custReasonOk = Boolean(extraRef.current.customer_signature_reason?.trim())
          const monteurKundenSignaturDone =
            Boolean(custPath && custNameOk) || (!custPath && custReasonOk)
          const monteurAbschlussDone = order?.status === 'erledigt'

          const flow = hasHoldOpen
            ? [
                'door',
                'feststell',
                'signature',
                'monteur_leistungen',
                'monteur_zeit',
                'monteur_material',
                'monteur_monteur_signatur',
                'monteur_kunden_uebersicht',
                'monteur_kunden_unterschrift',
                'monteur_abschluss',
              ]
            : [
                'door',
                'signature',
                'monteur_leistungen',
                'monteur_zeit',
                'monteur_material',
                'monteur_monteur_signatur',
                'monteur_kunden_uebersicht',
                'monteur_kunden_unterschrift',
                'monteur_abschluss',
              ]
          const doneByKey: Record<string, boolean> = {
            door: doorDone,
            feststell: festDone,
            signature: sigSaved,
            monteur_leistungen: monteurLeistungenDone,
            monteur_zeit: monteurZeitDone,
            monteur_material: monteurMaterialDone,
            monteur_monteur_signatur: monteurMonteurSignaturDone,
            monteur_kunden_uebersicht: monteurKundenUebersichtDone,
            monteur_kunden_unterschrift: monteurKundenSignaturDone,
            monteur_abschluss: monteurAbschlussDone,
          }
          const targetStep = Math.max(0, flow.findIndex((key) => !doneByKey[key]))
          const nextDoorIdx = Math.max(
            0,
            doorIds.findIndex((id) => {
              const row = doorItems[id]
              return !row?.status
            })
          )
          const nextFestIdx = Math.max(
            0,
            festIds.findIndex((id) => {
              const row = festItems[id]
              if (id === FESTSTELL_MELDER_INTERVAL_ITEM_ID || id === FESTSTELL_INTERVAL_SECTION_ID) {
                return !isFeststellMelderIntervalChosen(festItems)
              }
              return !row?.status
            })
          )

          skipAssistantStepAutoResetRef.current = true
          setChecklistAssistantStepIdx(targetStep >= 0 ? targetStep : 0)
          setChecklistAssistantDoorItemIdx(nextDoorIdx >= 0 ? nextDoorIdx : 0)
          setChecklistAssistantFestItemIdx(nextFestIdx >= 0 ? nextFestIdx : 0)
        }
        setSelectedChecklistObjectId(firstIncomplete)
      }
      setChecklistAssistantUiMode('assistant')
      setAssistantResumeDialogOpen(false)
      if (order?.id && !location.pathname.endsWith('/assistent')) {
        navigate(`/auftrag/${order.id}/assistent`, { replace: true })
      }
    }

  const handleAddDoorToOrder = useCallback(
    async (objectId: string) => {
      if (!order) return
      const mergedObjectIds = [...new Set([...orderObjectIds, objectId])]
      const { error } = await updateOrder(order.id, {
        customer_id: order.customer_id,
        bv_id: order.bv_id ?? null,
        object_ids: mergedObjectIds,
        order_date: order.order_date,
        order_time: order.order_time ?? null,
        order_type: order.order_type,
        status: order.status,
        description: order.description ?? null,
        assigned_to: order.assigned_to ?? null,
      })
      if (error) {
        showError(error.message)
        return
      }
      setAssistantAddDoorDialogOpen(false)
      await loadData()
      setSelectedChecklistObjectId(objectId)
      showToast('Tür/Tor wurde dem Auftrag hinzugefügt.', 'success')
    },
    [order, orderObjectIds, loadData, showError, showToast]
  )

  const handleUploadDoorDefectPhoto = async (itemId: string, file: File) => {
    if (!order || !selectedChecklistObjectId) return
    const oid = selectedChecklistObjectId
    maybeInvalidateForeignInspectorSignature(oid)
    const reportId = checklistReportIdByObject[oid]
    const key = `door:${itemId}`
    if ((defectPhotosByObject[oid]?.[key] ?? []).length >= 3) {
      showError('Maximal 3 Fotos pro Mangelpunkt.')
      return
    }
    setUploadingDefectPhotoItem(itemId)
    if (reportId) {
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
          [key]: [...(prev[oid]?.[key] ?? []), mapDefectPhotoToMangel(data)],
        },
      }))
      return
    }
    const { data, error } = await uploadChecklistDefectPhotoDraft({
      orderId: order.id,
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
  const applyChecklistModeOverride = (nextMode: ChecklistDisplayMode | null) => {
    if (nextMode === checklistModeOverride) return
    if (!shouldConfirmChecklistModeSwitch) {
      if (order?.order_type === 'wartung') {
        const oids = getOrderObjectIds(order).filter(Boolean)
        for (const oid of oids) maybeInvalidateForeignInspectorSignature(oid)
      }
      setChecklistModeOverride(nextMode)
      return
    }
    setPendingChecklistModeOverride(nextMode)
    setChecklistModeSwitchConfirmOpen(true)
  }
  const handleConfirmChecklistModeSwitch = () => {
    const nextMode = pendingChecklistModeOverride
    setChecklistModeSwitchConfirmOpen(false)
    setPendingChecklistModeOverride(null)
    if (nextMode === undefined) return
    if (order?.order_type === 'wartung') {
      const oids = getOrderObjectIds(order).filter(Boolean)
      for (const oid of oids) maybeInvalidateForeignInspectorSignature(oid)
    }
    setChecklistModeOverride(nextMode)
  }

  const handleUploadFeststellDefectPhoto = async (itemId: string, file: File) => {
    if (!order || !selectedChecklistObjectId) return
    const oid = selectedChecklistObjectId
    maybeInvalidateForeignInspectorSignature(oid)
    const reportId = checklistReportIdByObject[oid]
    const key = `feststell:${itemId}`
    if ((defectPhotosByObject[oid]?.[key] ?? []).length >= 3) {
      showError('Maximal 3 Fotos pro Mangelpunkt.')
      return
    }
    setUploadingDefectPhotoItem(itemId)
    if (reportId) {
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
          [key]: [...(prev[oid]?.[key] ?? []), mapDefectPhotoToMangel(data)],
        },
      }))
      return
    }
    const { data, error } = await uploadChecklistDefectPhotoDraft({
      orderId: order.id,
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
    storagePath: string | null,
    isDraft?: boolean
  ) => {
    if (!selectedChecklistObjectId) return
    const oid = selectedChecklistObjectId
    maybeInvalidateForeignInspectorSignature(oid)
    const key = `${scope}:${itemId}`
    const { error } = isDraft
      ? await deleteChecklistDefectPhotoDraft(photoId, storagePath)
      : await deleteChecklistDefectPhoto(photoId, storagePath)
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
      navigate('/auftrag')
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
    const monteurBlock = getMonteurBerichtAbschlussBlocker({
      extra: payload.completion_extra as OrderCompletionExtraV1,
      ausgeführte,
      completion,
      printedTech,
      printedCust,
      sigTechDataUrl,
      sigCustDataUrl,
      monteurSignatureReplaceMode,
      customerSignatureReplaceMode,
    })
    if (monteurBlock) {
      showError(monteurBlock)
      setIsSaving(false)
      return
    }
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
        const restExtra = { ...payload.completion_extra }
        delete restExtra.wartung_checkliste_abschluss_bypass
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
      const { letterheadPages, pdfTextLayout } = await getBriefbogenPdfAssetsCached()
      const extraSnap = { ...payload.completion_extra, parked: false, portal_teilen: false }
      const protocolPortalBase = (
        design?.kundenportal_url ??
        import.meta.env.VITE_KUNDENPORTAL_URL ??
        ''
      )
        .trim()
        .replace(/\/$/, '')
      const protocolAddressMode = monteurSettingsFull?.pruefprotokoll_address_mode ?? 'both'
      const wartungInspectedDoorLabels =
        order.order_type === 'wartung' && oidsComplete.length > 0
          ? oidsComplete.map((oid) => {
              const o = orderObjects.find((x) => x.id === oid)
              return o ? getObjectDisplayName(o) : oid.slice(0, 8)
            })
          : undefined
      const wartungDoorSummaries =
        order.order_type === 'wartung' && oidsComplete.length > 0
          ? oidsComplete.map((oid) => {
              const o = orderObjects.find((x) => x.id === oid)
              const per = extraSnap.wartung_checkliste?.by_object_id[oid]
              const d = Object.values(per?.items ?? {}).filter((r) => r?.status === 'mangel').length
              const f = Object.values(per?.feststell_checkliste?.items ?? {}).filter((r) => r?.status === 'mangel').length
              const defects = d + f
              const label = o ? getObjectDisplayName(o) : oid.slice(0, 8)
              return {
                doorLabel: label,
                passed: defects === 0,
                defects,
                protocolRef: `Prüfprotokoll: ${label}`,
              }
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
        letterheadPages: letterheadPages ?? undefined,
        letterheadContentMargins: pdfTextLayout.margins,
        letterheadFollowPageCompactTop: pdfTextLayout.followPageCompactTop,
        wartungInspectedDoorLabels,
        wartungDoorSummaries,
        pruefprotokollKurzverweis: order.order_type === 'wartung' && oidsComplete.length > 0,
        customerAddressLines: customerAddressLines(order.customer_id),
        bvAddressLines: bvAddressLines(order.bv_id),
        showAddressMode: monteurSettingsFull?.pruefprotokoll_address_mode ?? 'both',
        pendingTechnicianSignatureDataUrl: sigTechDataUrl,
        pendingCustomerSignatureDataUrl: sigCustDataUrl,
      })
      const { monteurPath } = await runAfterSavePdfAndPortal(comp, pdfBlob, doPortal, extraSnap)
      if (order.order_type === 'wartung' && isOnline()) {
        for (const oid of oidsComplete) {
          const obj = orderObjects.find((x) => x.id === oid)
          const per = extraSnap.wartung_checkliste?.by_object_id[oid]
          if (!obj || !per?.saved_at) continue
          const mode = per.checklist_modus === 'compact' ? 'compact' : 'detail'
          try {
            const prMeta = await fetchMaintenanceReportPruefprotokollMetaForOrderObject(order.id, oid)
            const reportId = prMeta?.id ?? null
            const portalProtocolUrl = reportId
              ? `${protocolPortalBase || window.location.origin}/berichte?pruefprotokoll=${encodeURIComponent(reportId)}`
              : null
            const prBlob = await generatePruefprotokollPdf({
              pruefprotokollNummer: formatPruefprotokollNummerForPdf(
                prMeta?.pruefprotokoll_laufnummer,
                order.id,
                oid
              ),
              order,
              customerName: getCustomerName(order.customer_id),
              bvName: getBvName(order.bv_id),
              object: obj,
              berichtDatum: extraSnap.bericht_datum,
              monteurName: (printedTech.trim() || extraSnap.monteur_name || 'Monteur').trim(),
              customerAddressLines: customerAddressLines(order.customer_id),
              bvAddressLines: bvAddressLines(order.bv_id),
              showAddressMode: protocolAddressMode,
              portalProtocolUrl,
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
              letterheadPages: letterheadPages ?? undefined,
              letterheadContentMargins: pdfTextLayout.margins,
              letterheadFollowPageCompactTop: pdfTextLayout.followPageCompactTop,
              technicianSignaturePath:
                per.pruefer_signature_path?.trim() ?? comp.unterschrift_mitarbeiter_path ?? null,
              technicianSignatureDate:
                per.pruefer_signature_at?.trim() ?? comp.unterschrift_mitarbeiter_date ?? null,
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
              `Folgende Türen waren nicht vollständig geprüft: ${labels}. Soll ein neuer Prüfungsauftrag mit genau diesen Türen angelegt werden?`
            )
            setFollowUpDialogOpen(true)
          }
        }
      }
      navigate('/auftrag')
    }
    setIsSaving(false)
  }

  const handleOpenCompleteDialog = () => {
    if (anyPauseExceedsGrossWork(extra.primary, extra.zusatz_monteure)) {
      showToast(
        'Hinweis: Die Pause ist bei mindestens einer Arbeitszeit-Zeile größer als die Brutto-Arbeitszeit. Bitte Angaben prüfen.',
        'info'
      )
    }
    const block = getMonteurBerichtAbschlussBlocker({
      extra,
      ausgeführte,
      completion,
      printedTech,
      printedCust,
      sigTechDataUrl,
      sigCustDataUrl,
      monteurSignatureReplaceMode,
      customerSignatureReplaceMode,
    })
    if (block) {
      showError(block)
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
    const monteurBlock = getMonteurBerichtAbschlussBlocker({
      extra: payload.completion_extra as OrderCompletionExtraV1,
      ausgeführte,
      completion,
      printedTech,
      printedCust,
      sigTechDataUrl,
      sigCustDataUrl,
      monteurSignatureReplaceMode,
      customerSignatureReplaceMode,
    })
    if (monteurBlock) {
      showError(monteurBlock)
      return
    }
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
        related_order_id: order.id,
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
      showToast('Folge-Prüfungsauftrag angelegt.', 'success')
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

  const handlePdfOnly = async (
    completionOverride?: OrderCompletion | null,
    options?: { openPreview?: boolean }
  ) => {
    const activeCompletion = completionOverride ?? completion
    if (!order || !activeCompletion) {
      showError('Bitte zuerst speichern.')
      return
    }
    const openPreview = options?.openPreview ?? true
    const payload = buildPayload(extra.parked ?? false)
    const scanUrl = `${window.location.origin}/auftrag/${order.id}`
    try {
      const { letterheadPages, pdfTextLayout } = await getBriefbogenPdfAssetsCached()
      const oids = getOrderObjectIds(order).filter(Boolean)
      const wartungInspectedDoorLabels =
        order.order_type === 'wartung' && oids.length > 0
          ? oids.map((oid) => {
              const o = orderObjects.find((x) => x.id === oid)
              return o ? getObjectDisplayName(o) : oid.slice(0, 8)
            })
          : undefined
      const wartungDoorSummaries =
        order.order_type === 'wartung' && oids.length > 0
          ? oids.map((oid) => {
              const o = orderObjects.find((x) => x.id === oid)
              const per = payload.completion_extra.wartung_checkliste?.by_object_id[oid]
              const d = Object.values(per?.items ?? {}).filter((r) => r?.status === 'mangel').length
              const f = Object.values(per?.feststell_checkliste?.items ?? {}).filter((r) => r?.status === 'mangel').length
              const defects = d + f
              const label = o ? getObjectDisplayName(o) : oid.slice(0, 8)
              return {
                doorLabel: label,
                passed: defects === 0,
                defects,
                protocolRef: `Prüfprotokoll: ${label}`,
              }
            })
          : undefined
      const pdfBlob = await generateMonteurBerichtPdf({
        order,
        completion: { ...activeCompletion, ...payload, ausgeführte_arbeiten: payload.ausgeführte_arbeiten },
        extra: payload.completion_extra,
        customerName: getCustomerName(order.customer_id),
        bvName: getBvName(order.bv_id),
        objectLabel,
        orderTypeLabel: ORDER_TYPE_LABELS[order.order_type],
        scanUrl,
        letterheadPages: letterheadPages ?? undefined,
        letterheadContentMargins: pdfTextLayout.margins,
        letterheadFollowPageCompactTop: pdfTextLayout.followPageCompactTop,
        wartungInspectedDoorLabels,
        wartungDoorSummaries,
        pruefprotokollKurzverweis: order.order_type === 'wartung' && oids.length > 0,
        customerAddressLines: customerAddressLines(order.customer_id),
        bvAddressLines: bvAddressLines(order.bv_id),
        showAddressMode: monteurSettingsFull?.pruefprotokoll_address_mode ?? 'both',
        pendingTechnicianSignatureDataUrl: sigTechDataUrl,
        pendingCustomerSignatureDataUrl: sigCustDataUrl,
      })
      if (openPreview) {
        const previewTitle = [
          'Monteurbericht',
          objectLabel !== '—' ? objectLabel : null,
          extra.bericht_datum?.trim() || null,
        ]
          .filter(Boolean)
          .join(' – ')
        openBlobPdfViewer(pdfBlob, previewTitle || 'Monteurbericht')
      }
      const { path } = await uploadMonteurBerichtPdf(activeCompletion.id, pdfBlob)
      if (path) {
        await updateOrderCompletion(activeCompletion.id, { monteur_pdf_path: path })
        setCompletion((prev) => (prev ? { ...prev, monteur_pdf_path: path } : prev))
        if (!openPreview) {
          showToast('Monteursbericht gespeichert.', 'success')
        }
      }
    } catch {
      showError('PDF fehlgeschlagen.')
    }
  }

  const handleViewMonteurBericht = async () => {
    const path = completion?.monteur_pdf_path?.trim()
    if (!path || !order) {
      showError('Kein Monteurbericht-PDF vorhanden.')
      return
    }
    if (!isOnline()) {
      showError('Monteurbericht ist nur mit Verbindung abrufbar.')
      return
    }
    setMonteurPdfViewLoading(true)
    try {
      const { data, error: dlErr } = await supabase.storage.from(MONTEUR_BERICHT_STORAGE_BUCKET).download(path)
      if (dlErr || !data) {
        showError(dlErr?.message ?? 'Monteurbericht konnte nicht geladen werden.')
        return
      }
      const previewTitle = [
        'Monteurbericht',
        objectLabel !== '—' ? objectLabel : null,
        extra.bericht_datum?.trim() || null,
      ]
        .filter(Boolean)
        .join(' – ')
      openBlobPdfViewer(data, previewTitle || 'Monteurbericht')
    } catch {
      showError('Monteurbericht konnte nicht geladen werden.')
    } finally {
      setMonteurPdfViewLoading(false)
    }
  }

  const handleViewPruefprotokoll = async () => {
    if (!order || order.order_type !== 'wartung' || !selectedChecklistObjectId) {
      showError('Bitte eine Tür wählen.')
      return
    }
    const per = extra.wartung_checkliste?.by_object_id[selectedChecklistObjectId]
    if (!per?.saved_at) {
      showError('Bitte die Prüfcheckliste vollständig ausfüllen; das Prüfprotokoll wird dann automatisch angelegt.')
      return
    }
    if (!per.pruefer_signature_path?.trim() || !per.pruefer_profile_id) {
      showError('Für diese Tür fehlt die Pflicht-Unterschrift des Prüfers.')
      return
    }
    const obj = orderObjects.find((x) => x.id === selectedChecklistObjectId)
    if (!obj) {
      showError('Tür nicht gefunden.')
      return
    }
    setPruefprotokollViewLoading(true)
    try {
      const prMeta = await fetchMaintenanceReportPruefprotokollMetaForOrderObject(
        order.id,
        selectedChecklistObjectId
      )
      const prNumLabel = formatPruefprotokollNummerForPdf(
        prMeta?.pruefprotokoll_laufnummer,
        order.id,
        selectedChecklistObjectId
      ).trim()
      const bvLabel = getBvName(order.bv_id)
      const prTitleParts = [
        'Prüfprotokoll',
        getObjectDisplayName(obj),
        extra.bericht_datum?.trim() || null,
        bvLabel !== '—' ? bvLabel : null,
        prNumLabel ? `Nr ${prNumLabel}` : null,
      ].filter((p): p is string => Boolean(p))
      const prTitle = prTitleParts.join(' – ')

      if (isOnline()) {
        const storedPath = await fetchPruefprotokollPdfPathForOrderObject(order.id, selectedChecklistObjectId)
        if (storedPath) {
          openPublicPdfViewerFromStoragePath(storedPath, prTitle)
          return
        }
      }
      const mode = per.checklist_modus === 'compact' ? 'compact' : 'detail'
      const { letterheadPages, pdfTextLayout } = await getBriefbogenPdfAssetsCached()
      const reportId = prMeta?.id ?? null
      const protocolPortalBase = (
        design?.kundenportal_url ??
        import.meta.env.VITE_KUNDENPORTAL_URL ??
        ''
      )
        .trim()
        .replace(/\/$/, '')
      const portalProtocolUrl = reportId
        ? `${protocolPortalBase || window.location.origin}/berichte?pruefprotokoll=${encodeURIComponent(reportId)}`
        : null
      const prBlob = await generatePruefprotokollPdf({
        pruefprotokollNummer: formatPruefprotokollNummerForPdf(
          prMeta?.pruefprotokoll_laufnummer,
          order.id,
          selectedChecklistObjectId
        ),
        order,
        customerName: getCustomerName(order.customer_id),
        bvName: getBvName(order.bv_id),
        object: obj,
        berichtDatum: extra.bericht_datum,
        monteurName: (printedTech.trim() || extra.monteur_name || 'Monteur').trim(),
        customerAddressLines: customerAddressLines(order.customer_id),
        bvAddressLines: bvAddressLines(order.bv_id),
        showAddressMode: monteurSettingsFull?.pruefprotokoll_address_mode ?? 'both',
        portalProtocolUrl,
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
        letterheadPages: letterheadPages ?? undefined,
        letterheadContentMargins: pdfTextLayout.margins,
        letterheadFollowPageCompactTop: pdfTextLayout.followPageCompactTop,
        technicianSignaturePath:
          per.pruefer_signature_path?.trim() ?? completion?.unterschrift_mitarbeiter_path ?? null,
        technicianSignatureDate:
          per.pruefer_signature_at?.trim() ?? completion?.unterschrift_mitarbeiter_date ?? null,
      })
      openBlobPdfViewer(prBlob, prTitle)
    } catch {
      showError('Prüfprotokoll konnte nicht angezeigt werden.')
    } finally {
      setPruefprotokollViewLoading(false)
    }
  }

  const monteurAutosaveFingerprint = useMemo(
    () =>
      JSON.stringify({
        e: extra,
        a: ausgeführte,
        pt: printedTech,
        pc: printedCust,
        st: sigTechDataUrl ? sigTechDataUrl.slice(0, 96) : '',
        sc: sigCustDataUrl ? sigCustDataUrl.slice(0, 96) : '',
        mr: monteurSignatureReplaceMode,
        cr: customerSignatureReplaceMode,
      }),
    [
      extra,
      ausgeführte,
      printedTech,
      printedCust,
      sigTechDataUrl,
      sigCustDataUrl,
      monteurSignatureReplaceMode,
      customerSignatureReplaceMode,
    ]
  )

  useEffect(() => {
    if (!checklistAssistantActive || !checklistAssistantMonteurStepActive) return
    if (!order || isLoading || isSaving || license?.read_only) return

    if (!monteurAutosaveFingerprintRef.current) {
      monteurAutosaveFingerprintRef.current = monteurAutosaveFingerprint
      return
    }
    if (monteurAutosaveFingerprintRef.current === monteurAutosaveFingerprint) return

    const t = window.setTimeout(() => {
      void (async () => {
        const custPathBefore = completionRef.current?.unterschrift_kunde_path?.trim() ?? ''
        const hadTechDraft =
          typeof sigTechDataUrl === 'string' && sigTechDataUrl.trim().startsWith('data:image')
        const hadCustomerDraft =
          typeof sigCustDataUrl === 'string' && sigCustDataUrl.trim().startsWith('data:image')
        const comp = await persistCompletionExecRef.current(
          completionRef.current?.id ?? null,
          buildPayload(extra.parked ?? false)
        )
        if (comp) {
          setCompletion(comp)
          completionRef.current = comp
          if (hadTechDraft && comp.unterschrift_mitarbeiter_path?.trim()) {
            setSigTechDataUrl(null)
            setMonteurSignatureReplaceMode(false)
          }
          const newCustPath = comp.unterschrift_kunde_path?.trim() ?? ''
          if (hadCustomerDraft && newCustPath && newCustPath !== custPathBefore) {
            setSigCustDataUrl(null)
            setCustomerSignatureReplaceMode(false)
          }
          monteurAutosaveFingerprintRef.current = monteurAutosaveFingerprint
        }
      })()
    }, 350)
    return () => clearTimeout(t)
  }, [
    checklistAssistantActive,
    checklistAssistantMonteurStepActive,
    order,
    isLoading,
    isSaving,
    license?.read_only,
    monteurAutosaveFingerprint,
    buildPayload,
    extra.parked,
    sigTechDataUrl,
    sigCustDataUrl,
  ])

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
                : 'Nach dem Abschließen: Monteursbericht-PDF wird am Auftrag gespeichert; Anzeige über die Schaltfläche „Monteursbericht“ oder in der Auftragsliste; keine automatische Kundenzustellung (Einstellungen).'
  const monteurAutoFilledReady =
    Boolean(orderCustomer) &&
    Boolean(extra.bericht_datum?.trim()) &&
    Boolean(ausgeführte.trim())

  const resolvedBillingStatus = order ? resolveOrderBillingStatus(order) : null
  const assistantRouteGuided = isAssistantRoute && checklistAssistantEnabled
  const assistantShowMonteurReport =
    !assistantRouteGuided ||
    !checklistAssistantActive ||
    checklistAssistantMonteurStepActive
  const showMonteurLeistungenSection =
    !checklistAssistantActive || !checklistAssistantMonteurStepActive || checklistAssistantCurrentFlowKey === 'monteur_leistungen'
  const showMonteurZeitSection =
    !checklistAssistantActive || !checklistAssistantMonteurStepActive || checklistAssistantCurrentFlowKey === 'monteur_zeit'
  const showMonteurMaterialSection =
    !checklistAssistantActive || !checklistAssistantMonteurStepActive || checklistAssistantCurrentFlowKey === 'monteur_material'
  const showMonteurMonteurSignaturSection =
    !checklistAssistantActive || !checklistAssistantMonteurStepActive || checklistAssistantCurrentFlowKey === 'monteur_monteur_signatur'
  const showMonteurKundenUebersichtSection =
    !checklistAssistantActive || !checklistAssistantMonteurStepActive || checklistAssistantCurrentFlowKey === 'monteur_kunden_uebersicht'
  const showMonteurKundenUnterschriftSection =
    !checklistAssistantActive || !checklistAssistantMonteurStepActive || checklistAssistantCurrentFlowKey === 'monteur_kunden_unterschrift'
  const showMonteurAbschlussSection =
    !checklistAssistantActive || !checklistAssistantMonteurStepActive || checklistAssistantCurrentFlowKey === 'monteur_abschluss'
  const canParkOrderBase =
    order.status !== 'erledigt' && order.status !== 'storniert' && !license?.read_only
  /** Zwischenstand speichern in allen Assistenten-Schritten außer dem letzten (Abschluss – dort nur noch abschließen). */
  const showParkenButton =
    canParkOrderBase &&
    (!checklistAssistantActive || checklistAssistantCurrentFlowStep?.key !== 'monteur_abschluss')
  /** Abschluss nur ohne Assistent oder explizit im Schritt „Monteur: Abschluss“. */
  const showAuftragAbschliessenButton =
    canParkOrderBase &&
    (!checklistAssistantActive || checklistAssistantCurrentFlowStep?.key === 'monteur_abschluss') &&
    assistantShowMonteurReport
  const monteurSignaturePath = completion?.unterschrift_mitarbeiter_path?.trim() ?? ''
  const monteurSignatureSaved = Boolean(monteurSignaturePath)
  const monteurSignaturePreviewUrl = monteurSignatureSaved ? getMaintenancePhotoUrl(monteurSignaturePath) : ''
  const showMonteurSignaturePad =
    !monteurSignatureSaved || monteurSignatureReplaceMode || checklistAssistantMonteurSignatureDraftPending
  const customerSignaturePath = completion?.unterschrift_kunde_path?.trim() ?? ''
  const customerSignatureSaved = Boolean(customerSignaturePath)
  const customerSignatureActiveSaved = customerSignatureSaved && !customerSignatureReplaceMode
  const customerSignaturePreviewUrl = customerSignatureSaved ? getMaintenancePhotoUrl(customerSignaturePath) : ''
  const showCustomerSignaturePad =
    !customerSignatureActiveSaved || checklistAssistantCustomerSignatureDraftPending
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
      <AuftragsdetailPageHeader
        orderTypeLabel={ORDER_TYPE_LABELS[order.order_type]}
        orderStatusLabel={ORDER_STATUS_LABELS[order.status]}
        canReopenOrder={canReopenOrder}
        onReopenClick={() => setReopenDialogOpen(true)}
      />

      {!assistantRouteGuided ? (
        <AuftragsdetailOrderSummaryCard
          customerName={getCustomerName(order.customer_id)}
          bvDisplay={order.bv_id ? getBvName(order.bv_id) : '— (direkt unter Kunde)'}
          objectLabel={objectLabel}
          orderDateDisplay={`${order.order_date}${order.order_time ? ` ${order.order_time.slice(0, 5)}` : ''}`}
          billingStatusLabel={
            resolvedBillingStatus ? ORDER_BILLING_STATUS_LABELS[resolvedBillingStatus] : 'Offen'
          }
          relatedParentOrderId={
            order.related_order_id ? (relatedParentOrder?.id ?? order.related_order_id) : null
          }
          description={order.description}
          relatedChildren={relatedChildOrders.map((child) => ({
            id: child.id,
            orderTypeLabel: ORDER_TYPE_LABELS[child.order_type],
          }))}
        />
      ) : null}

      {!assistantRouteGuided && order.status === 'erledigt' && extra.wartung_checkliste_abschluss_bypass ? (
        <AuftragsdetailWartungChecklistBypassNotice
          bypassAtIso={extra.wartung_checkliste_abschluss_bypass.at}
          bypassAtDisplay={new Date(extra.wartung_checkliste_abschluss_bypass.at).toLocaleString('de-DE', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
          bypassUserDisplay={
            extra.wartung_checkliste_abschluss_bypass.profile_id
              ? (() => {
                  const pid = extra.wartung_checkliste_abschluss_bypass.profile_id
                  const p = profiles.find((x) => x.id === pid)
                  return p ? getProfileDisplayName(p) : `ID ${pid.slice(0, 8)}…`
                })()
              : null
          }
          incompleteDoorsLine={
            extra.wartung_checkliste_abschluss_bypass.incomplete_object_ids.length > 0
              ? extra.wartung_checkliste_abschluss_bypass.incomplete_object_ids
                  .map((oid) => {
                    const ob = orderObjects.find((x) => x.id === oid)
                    return ob ? getObjectDisplayName(ob) : oid.slice(0, 8)
                  })
                  .join(', ')
              : null
          }
        />
      ) : null}

      {order.order_type === 'wartung' && orderObjectIds.length > 0 && (
        <div className="mb-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Prüfcheckliste (kombiniert)</h3>
            {checklistModeSelected ? (
              <div className="flex flex-wrap items-center gap-1">
                {checklistModePolicy === 'selectable' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setChecklistAssistantUiMode('assistant')}
                      className={`px-2 py-1 rounded text-xs border ${
                        checklistAssistantUiMode === 'assistant'
                          ? 'border-vico-primary bg-vico-primary/10 text-vico-primary'
                          : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Assistent
                    </button>
                    <button
                      type="button"
                      onClick={() => setChecklistAssistantUiMode('classic')}
                      className={`px-2 py-1 rounded text-xs border ${
                        checklistAssistantUiMode === 'classic'
                          ? 'border-vico-primary bg-vico-primary/10 text-vico-primary'
                          : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Klassisch
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => applyChecklistModeOverride(null)}
                  className={`px-2 py-1 rounded text-xs border ${
                    checklistModeOverride === null
                      ? 'border-vico-primary bg-vico-primary/10 text-vico-primary'
                      : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Standard
                </button>
                <button
                  type="button"
                  onClick={() => applyChecklistModeOverride('detail')}
                  className={`px-2 py-1 rounded text-xs border ${
                    checklistModeOverride === 'detail'
                      ? 'border-vico-primary bg-vico-primary/10 text-vico-primary'
                      : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Detail
                </button>
                <button
                  type="button"
                  onClick={() => applyChecklistModeOverride('compact')}
                  className={`px-2 py-1 rounded text-xs border ${
                    checklistModeOverride === 'compact'
                      ? 'border-vico-primary bg-vico-primary/10 text-vico-primary'
                      : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Kompakt
                </button>
              </div>
            ) : null}
          </div>
          {checklistAssistantEnabled && checklistModePolicy === 'selectable' && !checklistModeSelected ? (
            <div className="mb-3 rounded-lg border border-sky-200 bg-sky-50 dark:bg-sky-900/20 dark:border-sky-800 p-3">
              <p className="text-sm font-medium text-sky-900 dark:text-sky-100">
                Wie möchten Sie diesen Auftrag abarbeiten?
              </p>
              <p className="mt-1 text-xs text-sky-900/90 dark:text-sky-100/90">
                Wählen Sie einmalig für diesen Auftrag den Modus. Danach führt die gewählte Ansicht durch den Ablauf.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setChecklistAssistantUiMode('assistant')}
                  className="px-3 py-1.5 rounded-lg text-sm border bg-vico-primary text-white border-vico-primary"
                >
                  Assistent starten
                </button>
                <button
                  type="button"
                  onClick={() => setChecklistAssistantUiMode('classic')}
                  className="px-3 py-1.5 rounded-lg text-sm border bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600"
                >
                  Klassische Ansicht
                </button>
              </div>
            </div>
          ) : null}
          {checklistAssistantEnabled && checklistModePolicy !== 'selectable' && checklistModeSelected ? (
            <p className="mb-2 text-xs text-slate-600 dark:text-slate-400">
              Modus für diesen Mandanten: {checklistModePolicy === 'assistant_only' ? 'Assistent' : 'Klassisch'}
            </p>
          ) : null}
          {checklistAssistantActive ? (
            <div className="mb-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/30 px-2.5 py-2">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                <span>Abschnitt: {checklistAssistantCurrentFlowStep?.label ?? '—'}</span>
                <span>
                  Aufgaben {checklistAssistantTaskDoneCount}/{checklistAssistantTaskTotalCount}
                </span>
                <span>{checklistAssistantProgressPercent}%</span>
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-full bg-vico-primary transition-all"
                  style={{ width: `${checklistAssistantProgressPercent}%` }}
                />
              </div>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span>
                  {selectedChecklistObjectId && objectsById[selectedChecklistObjectId]
                    ? getObjectDisplayName(objectsById[selectedChecklistObjectId])
                    : 'Ausgewählte Tür'}
                </span>
                <span>{checklistAssistantCurrentFlowStep?.label ?? '—'}</span>
              </div>
              {checklistDoorCompletion.total > 1 ? (
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-600 dark:text-slate-300">
                    Türen: {checklistDoorCompletion.done}/{checklistDoorCompletion.total} geprüft · {checklistDoorCompletion.open} offen
                  </span>
                  <button
                    type="button"
                    onClick={handleSelectNextOpenDoor}
                    className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-[11px] text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700"
                    aria-label="Nächste offene Tür auswählen"
                  >
                    Nächste offene Tür
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/scan')}
                    className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-[11px] text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700"
                    aria-label="QR-Scan öffnen"
                  >
                    QR-Scan
                  </button>
                  {assistantDoorCandidates.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setAssistantAddDoorDialogOpen(true)}
                      className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-[11px] text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                      Tür hinzufügen
                    </button>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-1 flex flex-wrap gap-1.5">
                {checklistAssistantSteps.map((step) => {
                  const active = checklistAssistantCurrentFlowStep?.key === step.key
                  return (
                  <div
                    key={step.key}
                    className={`rounded-full border px-2 py-0.5 text-[11px] ${
                      active
                        ? 'border-vico-primary bg-vico-primary/10 text-slate-900 dark:text-slate-100'
                        : step.done
                          ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200'
                          : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <span className="font-medium">{step.done ? '✓' : '○'} {step.label}</span>
                  </div>
                )})}
              </div>
              {checklistAssistantStrictEnabled ? (
                <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-200">
                  Strict-Mode aktiv
                </p>
              ) : null}
            </div>
          ) : null}
          {assistantDebugEnabled && checklistAssistantActive ? (
            <div className="mb-2 rounded-lg border border-fuchsia-200 dark:border-fuchsia-800 bg-fuchsia-50/80 dark:bg-fuchsia-950/30 px-2.5 py-2 text-[11px] text-fuchsia-900 dark:text-fuchsia-200">
              <p className="font-semibold">Assistant Debug (lokal)</p>
              <p>
                step=`{checklistAssistantCurrentFlowStep?.key ?? '—'}` idx={checklistAssistantStepIdx + 1}/
                {checklistAssistantFlowSteps.length}
              </p>
              <p>
                focusDoor=`{checklistAssistantFocusDoorItemId ?? '—'}` focusFest=`{checklistAssistantFocusFestItemId ?? '—'}`
              </p>
              <p>
                pointDone={String(checklistAssistantCurrentPointDone)} stepDone={String(checklistAssistantCurrentStepDone)} strict=
                {String(checklistAssistantStrictEnabled)}
              </p>
              <p>
                hint="{checklistAssistantStepHint || '—'}" cta="
                {!checklistAssistantCurrentPointDone && !checklistAssistantStrictEnabled
                  ? 'Trotzdem weiter'
                  : checklistAssistantNextCtaLabel}
                "
              </p>
            </div>
          ) : null}
          {!checklistModeSelected || (checklistAssistantActive && checklistAssistantMonteurStepActive) ? null : (
            <>
          {!checklistAssistantActive ? (
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
              Eingaben werden automatisch im Bericht entworfen (ca. 0,5 s nach der letzten Änderung, nur online). Das
              Prüfprotokoll in der Datenbank entsteht erst, wenn Tür- und ggf. Feststell-Checkliste vollständig und gültig
              ausgefüllt sind. Mangelfotos können Sie schon vorher anlegen; sie werden als Entwurf gespeichert und beim
              Anlegen des Prüfprotokolls automatisch übernommen.
              {checklistSyncing ? (
                <span className="ml-2 text-slate-500 dark:text-slate-400" role="status">
                  Synchronisiere…
                </span>
              ) : null}
            </p>
          ) : (
            <div className="mb-2 flex items-center gap-2">
              <p className="text-xs text-slate-600 dark:text-slate-400">Speicherstatus</p>
              <span
                className="inline-flex items-center rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-0.5 text-[11px] text-slate-600 dark:text-slate-300"
                role="status"
              >
                {assistantSaveStatusLabel}
              </span>
            </div>
          )}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/30 p-3 space-y-4">
            {(!checklistAssistantEnabled ||
              !checklistAssistantActive ||
              checklistAssistantCurrentFlowStep?.key === 'door') && (
              <div className="space-y-2">
                {checklistAssistantActive ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 px-2 py-1.5">
                    <div className="w-full flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <span>
                        Punkt {Math.min(checklistAssistantDoorItemIdx + 1, checklistAssistantDoorItemIds.length)} von{' '}
                        {checklistAssistantDoorItemIds.length} (Tür-Checkliste)
                      </span>
                      {selectedChecklistObjectId && doorChecklistStatusByObjectId[selectedChecklistObjectId] ? (
                        <span
                          className={`font-medium ${
                            doorChecklistStatusByObjectId[selectedChecklistObjectId].kind === 'ok'
                              ? 'text-emerald-700 dark:text-emerald-300'
                              : doorChecklistStatusByObjectId[selectedChecklistObjectId].kind === 'mangel'
                                ? 'text-rose-700 dark:text-rose-300'
                                : 'text-amber-800 dark:text-amber-200'
                          }`}
                        >
                          {doorChecklistStatusByObjectId[selectedChecklistObjectId].kind === 'ok'
                            ? '✓ vollständig ohne Mängel'
                            : doorChecklistStatusByObjectId[selectedChecklistObjectId].kind === 'mangel'
                              ? `✕ vollständig mit ${doorChecklistStatusByObjectId[selectedChecklistObjectId].count} ${
                                  doorChecklistStatusByObjectId[selectedChecklistObjectId].count === 1
                                    ? 'Mangel'
                                    : 'Mängeln'
                                }`
                              : '○ unvollständig'}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                <WartungOrderChecklistPanel
                  mode={checklistMode}
                  objectIds={orderObjectIds}
                  objectsById={objectsById}
                  selectedObjectId={selectedChecklistObjectId}
                  onSelectObjectId={(id) => {
                    const prev = selectedChecklistObjectId
                    if (prev && prev !== id) {
                      void persistChecklistDraftForObjectRef.current(prev)
                    }
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
                  onSave={() => {}}
                  saving={checklistSyncing}
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
                  onDeleteDefectPhoto={(itemId, photoId, storagePath, isDraft) =>
                    handleDeleteDefectPhoto('door', itemId, photoId, storagePath, isDraft)
                  }
                  uploadingItemId={uploadingDefectPhotoItem}
                  showSaveControls={false}
                  showOpenPointsSummary={!checklistAssistantActive}
                  showSingleDoorStatus={!checklistAssistantActive}
                  doorStatusByObjectId={doorChecklistStatusByObjectId}
                  assistantFocusItemId={checklistAssistantActive ? checklistAssistantFocusDoorItemId : null}
                />
              </div>
            )}
            {selectedChecklistObjectId &&
            objectsById[selectedChecklistObjectId]?.has_hold_open &&
            (!checklistAssistantActive ||
              checklistAssistantCurrentFlowStep?.key === 'feststell') ? (
              <div className="space-y-2">
                {checklistAssistantActive ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 px-2 py-1.5">
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Punkt {Math.min(checklistAssistantFestItemIdx + 1, checklistAssistantFestItemIds.length)} von{' '}
                      {checklistAssistantFestItemIds.length} (Feststell)
                    </p>
                  </div>
                ) : null}
                <FeststellOrderChecklistPanel
                  mode={checklistMode}
                  items={feststellItemsByObject[selectedChecklistObjectId] ?? {}}
                  onChangeItem={handleFeststellItemChange}
                  savedAt={extra.wartung_checkliste?.by_object_id[selectedChecklistObjectId]?.feststell_checkliste?.saved_at}
                  onSave={() => {}}
                  saving={checklistSyncing}
                  saveError={feststellSaveError}
                  defectPhotosByItem={Object.fromEntries(
                    Object.entries(defectPhotosByObject[selectedChecklistObjectId] ?? {})
                      .filter(([k]) => k.startsWith('feststell:'))
                      .map(([k, v]) => [k.slice(10), v])
                  )}
                  onUploadDefectPhoto={handleUploadFeststellDefectPhoto}
                  onDeleteDefectPhoto={(itemId, photoId, storagePath, isDraft) =>
                    handleDeleteDefectPhoto('feststell', itemId, photoId, storagePath, isDraft)
                  }
                  uploadingItemId={uploadingDefectPhotoItem}
                  showSaveControls={false}
                  showOpenPointsSummary={!checklistAssistantActive}
                  assistantFocusItemId={checklistAssistantActive ? checklistAssistantFocusFestItemId : null}
                />
              </div>
            ) : null}
            {(!checklistAssistantActive ||
              checklistAssistantCurrentFlowStep?.key === 'signature') && (
              <WartungInspectorSignatureSection
                selectedObjectId={selectedChecklistObjectId}
                inspectorSignaturePath={
                  selectedChecklistObjectId
                    ? extra.wartung_checkliste?.by_object_id[selectedChecklistObjectId]?.pruefer_signature_path ?? null
                    : null
                }
                inspectorSignatureAt={
                  selectedChecklistObjectId
                    ? extra.wartung_checkliste?.by_object_id[selectedChecklistObjectId]?.pruefer_signature_at ?? null
                    : null
                }
                signedByProfileId={
                  selectedChecklistObjectId
                    ? extra.wartung_checkliste?.by_object_id[selectedChecklistObjectId]?.pruefer_profile_id ?? null
                    : null
                }
                currentUserId={user?.id ?? null}
                onInspectorSignatureChange={handleInspectorSignatureChange}
                onRequestReplaceInspectorSignature={handleReplaceInspectorSignature}
                inspectorPrintedName={printedTech}
                onInspectorPrintedNameChange={setPrintedTech}
              />
            )}
            {assistantInlineSaveError && (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {assistantInlineSaveError}
              </p>
            )}
            {checklistAssistantActive && !checklistAssistantMonteurStepActive ? (
              <div className="space-y-2">
                {!checklistAssistantCurrentStepDone ? (
                  <p
                    className={`text-xs ${
                      checklistAssistantStrictEnabled
                        ? 'text-red-700 dark:text-red-300'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {checklistAssistantStepHint}
                  </p>
                ) : null}
                <div className="flex items-center justify-between gap-2">
                <AppButton
                  type="button"
                  variant="outline"
                  disabled={!checklistAssistantCanGoBack}
                  onClick={() => {
                    if (checklistAssistantCurrentFlowStep?.key === 'door' && checklistAssistantDoorItemIdx > 0) {
                      setChecklistAssistantDoorItemIdx((prev) => Math.max(0, prev - 1))
                      return
                    }
                    if (checklistAssistantCurrentFlowStep?.key === 'feststell' && checklistAssistantFestItemIdx > 0) {
                      setChecklistAssistantFestItemIdx((prev) => Math.max(0, prev - 1))
                      return
                    }
                    setChecklistAssistantStepIdx((prev) => Math.max(0, prev - 1))
                  }}
                >
                  {checklistAssistantBackCtaLabel}
                </AppButton>
                <AppButton
                  type="button"
                  variant={
                    !checklistAssistantCurrentPointDone &&
                    !checklistAssistantStrictEnabled &&
                    (checklistAssistantCurrentFlowStep?.key === 'door' ||
                      checklistAssistantCurrentFlowStep?.key === 'feststell')
                      ? 'dangerSolid'
                      : 'primary'
                  }
                  disabled={
                    checklistAssistantStepIdx >= checklistAssistantFlowSteps.length - 1 ||
                    (checklistAssistantStrictEnabled &&
                      !checklistAssistantCurrentStepDone &&
                      !(
                        checklistAssistantCurrentFlowStep?.key === 'signature' &&
                        checklistAssistantSignatureDraftPending
                      ))
                  }
                  onClick={() => {
                    if (
                      checklistAssistantCurrentFlowStep?.key === 'signature' &&
                      !selectedInspectorSignatureSaved &&
                      checklistAssistantSignatureDraftPending &&
                      selectedChecklistObjectId
                    ) {
                      void (async () => {
                        await persistChecklistDraftForObjectRef.current(selectedChecklistObjectId)
                        const signatureSaved = Boolean(
                          extraRef.current.wartung_checkliste?.by_object_id[selectedChecklistObjectId]
                            ?.pruefer_signature_path?.trim()
                        )
                        if (signatureSaved) {
                          setChecklistAssistantStepIdx((prev) =>
                            Math.min(checklistAssistantFlowSteps.length - 1, prev + 1)
                          )
                        }
                      })()
                      return
                    }
                    if (
                      checklistAssistantCurrentFlowStep?.key === 'door' &&
                      !checklistAssistantCurrentStepDone
                    ) {
                      setChecklistAssistantDoorItemIdx((prev) => findNextOpenDoorItemIndex(prev))
                      return
                    }
                    if (
                      checklistAssistantCurrentFlowStep?.key === 'feststell' &&
                      !checklistAssistantCurrentStepDone
                    ) {
                      setChecklistAssistantFestItemIdx((prev) => findNextOpenFeststellItemIndex(prev))
                      return
                    }
                    setChecklistAssistantStepIdx((prev) =>
                      Math.min(checklistAssistantFlowSteps.length - 1, prev + 1)
                    )
                  }}
                >
                  {!checklistAssistantCurrentPointDone &&
                  !checklistAssistantStrictEnabled &&
                  (checklistAssistantCurrentFlowStep?.key === 'door' ||
                    checklistAssistantCurrentFlowStep?.key === 'feststell')
                    ? 'Trotzdem weiter'
                    : checklistAssistantNextCtaLabel}
                </AppButton>
                </div>
                {showParkenButton ? (
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200 dark:border-slate-700">
                    <AppButton
                      type="button"
                      variant="outline"
                      disabled={isSaving}
                      onClick={handlePark}
                      title="Bericht zwischenspeichern, Auftrag bleibt in Bearbeitung"
                    >
                      Parken
                    </AppButton>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Zwischenstand sichern und zur Auftragsliste zurück
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}
            {canViewSelectedPruefprotokoll && (!checklistAssistantActive || !checklistAssistantMonteurStepActive) ? (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <AppButton
                  type="button"
                  variant="outline"
                  disabled={checklistSyncing || !selectedChecklistObjectId || pruefprotokollViewLoading}
                  onClick={() => void handleViewPruefprotokoll()}
                  aria-label={
                    selectedChecklistObjectId && objectsById[selectedChecklistObjectId]
                      ? `Prüfprotokoll anzeigen: ${getObjectDisplayName(objectsById[selectedChecklistObjectId])}`
                      : 'Prüfprotokoll anzeigen'
                  }
                >
                  {pruefprotokollViewLoading ? 'Laden…' : 'Prüfprotokoll anzeigen'}
                </AppButton>
              </div>
            ) : null}
          </div>
            </>
          )}
        </div>
      )}

      {assistantShowMonteurReport ? (
      <form
        onSubmit={handleSave}
        className={`rounded-xl border space-y-4 ${
          checklistAssistantActive
            ? 'p-3 bg-slate-50/60 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700'
            : 'p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600'
        }`}
      >
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Monteursbericht</h2>
        <AuftragsdetailMonteurAutoFilledNotice
          visible={
            checklistAssistantActive && showMonteurLeistungenSection && monteurAutoFilledReady
          }
        />
        <AuftragsdetailMonteurFormErrorAlert message={formError} />

        <fieldset
          disabled={monteurLocked}
          className="min-w-0 space-y-4 border-0 p-0 m-0 disabled:opacity-60"
        >
        {showMonteurLeistungenSection ? (
          <>
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
          <AuftragsdetailMonteurSelectedDoorsHint doors={orderDoorLabels} />
        </AppField>
          </>
        ) : null}

        {showMonteurZeitSection ? (
          <AuftragsdetailMonteurPrimaryWorktimeFieldset
            totalMin={totalMin}
            primaryStartHour={getTimeParts(extra.primary.start).hour}
            primaryStartMinute={getTimeParts(extra.primary.start).minute}
            primaryEndHour={getTimeParts(extra.primary.end).hour}
            primaryEndMinute={getTimeParts(extra.primary.end).minute}
            primaryPauseMinuten={extra.primary.pause_minuten}
            primaryEndHourOptions={endHourOptionsAfterStart(extra.primary.start)}
            primaryEndMinuteOptions={endMinuteOptionsAfterStart(
              extra.primary.start,
              getTimeParts(extra.primary.end).hour
            )}
            onPrimaryStartHourChange={(e) => {
              const parts = getTimeParts(extra.primary.start)
              setPrimary({ start: mergeTimeParts(e.target.value, parts.minute) })
            }}
            onPrimaryStartMinuteChange={(e) => {
              const parts = getTimeParts(extra.primary.start)
              setPrimary({ start: mergeTimeParts(parts.hour, e.target.value) })
            }}
            onPrimaryEndHourChange={(e) => {
              const parts = getTimeParts(extra.primary.end)
              setPrimary({ end: mergeTimeParts(e.target.value, parts.minute) })
            }}
            onPrimaryEndMinuteChange={(e) => {
              const parts = getTimeParts(extra.primary.end)
              setPrimary({ end: mergeTimeParts(parts.hour, e.target.value) })
            }}
            onPrimaryPauseChange={(e) =>
              setPrimary({
                pause_minuten: normalizePauseMinutes(parseInt(e.target.value, 10) || 0),
              })
            }
          />
        ) : null}

        {showMonteurZeitSection ? (
          <AuftragsdetailMonteurWeitereMonteureBlock
            zusatzMonteure={extra.zusatz_monteure}
            profilesForZusatz={profilesForZusatz}
            onAddRow={handleAddZusatz}
            onZusatzProfilePick={handleZusatzProfilePick}
            onZusatzNameChange={(i, e) => handleZusatzChange(i, { name: e.target.value })}
            onZusatzStartHourChange={(i, e) => {
              const z = extra.zusatz_monteure[i]
              const parts = getTimeParts(z.start)
              handleZusatzChange(i, { start: mergeTimeParts(e.target.value, parts.minute) })
            }}
            onZusatzStartMinuteChange={(i, e) => {
              const z = extra.zusatz_monteure[i]
              const parts = getTimeParts(z.start)
              handleZusatzChange(i, { start: mergeTimeParts(parts.hour, e.target.value) })
            }}
            onZusatzEndHourChange={(i, e) => {
              const z = extra.zusatz_monteure[i]
              const parts = getTimeParts(z.end)
              handleZusatzChange(i, { end: mergeTimeParts(e.target.value, parts.minute) })
            }}
            onZusatzEndMinuteChange={(i, e) => {
              const z = extra.zusatz_monteure[i]
              const parts = getTimeParts(z.end)
              handleZusatzChange(i, { end: mergeTimeParts(parts.hour, e.target.value) })
            }}
            onZusatzPauseChange={(i, e) =>
              handleZusatzChange(i, {
                pause_minuten: normalizePauseMinutes(parseInt(e.target.value, 10) || 0),
              })
            }
          />
        ) : null}

        {showMonteurMaterialSection ? (
          <AuftragsdetailMonteurMaterialBlock
            materialLines={extra.material_lines}
            onAddRow={handleAddMaterialRow}
            onMaterialChange={handleMaterialChange}
          />
        ) : null}

        {showMonteurMonteurSignaturSection ? (
          <AuftragsdetailMonteurTechnicianSignatureBlock
            showSavedPreview={monteurSignatureSaved && !monteurSignatureReplaceMode}
            previewUrl={monteurSignaturePreviewUrl}
            savedAtDisplay={
              completion?.unterschrift_mitarbeiter_date
                ? new Date(completion.unterschrift_mitarbeiter_date).toLocaleString('de-DE')
                : null
            }
            onReplaceSavedClick={() => {
              setMonteurSignatureReplaceMode(true)
              setSigTechDataUrl(null)
            }}
            showSignaturePad={showMonteurSignaturePad}
            onSigTechChange={setSigTechDataUrl}
            printedTech={printedTech}
            onPrintedTechChange={setPrintedTech}
          />
        ) : null}

        {showMonteurKundenUebersichtSection ? (
          <AuftragsdetailMonteurKundenZusammenfassung
            berichtDatumDisplay={extra.bericht_datum || '—'}
            bvTitle={order?.bv_id ? getBvName(order.bv_id) : '— (direkt unter Kunde)'}
            bvAddressMultiline={
              order?.bv_id ? bvAddressLines(order.bv_id).join('\n') || '—' : null
            }
            ausgefuehrteDisplay={ausgeführte.trim() ? ausgeführte : '—'}
            arbeitszeitGesamtDisplay={totalMin > 0 ? `${totalMin} Min.` : '—'}
            materialDisplay={materialLinesToText(extra.material_lines) || '—'}
            monteurDisplay={printedTech.trim() || extra.monteur_name || '—'}
          />
        ) : null}

        {showMonteurKundenUnterschriftSection ? (
          <AuftragsdetailMonteurCustomerSignatureBlock
            showSavedPreview={customerSignatureActiveSaved}
            previewUrl={customerSignaturePreviewUrl}
            savedAtDisplay={
              completion?.unterschrift_kunde_date
                ? new Date(completion.unterschrift_kunde_date).toLocaleString('de-DE')
                : null
            }
            onReplaceSavedClick={() => {
              setCustomerSignatureReplaceMode(true)
              setSigCustDataUrl(null)
            }}
            showSignaturePad={showCustomerSignaturePad}
            onSigCustChange={setSigCustDataUrl}
            printedCust={printedCust}
            onPrintedCustChange={setPrintedCust}
            showReasonSection={
              !customerSignatureActiveSaved && !checklistAssistantCustomerSignatureDraftPending
            }
            customerSignatureReason={extra.customer_signature_reason ?? ''}
            onCustomerSignatureReasonChange={(v) => setExtraField('customer_signature_reason', v)}
            showAssistantMissingReasonAlert={
              checklistAssistantActive && checklistAssistantCustomerSignatureMissingReason
            }
            showClassicMissingReasonAlert={
              !checklistAssistantActive && !extra.customer_signature_reason?.trim()
            }
          />
        ) : null}

        </fieldset>

        <AuftragsdetailMonteurExistingReportsPanel
          show={
            showMonteurAbschlussSection &&
            (canViewSelectedPruefprotokoll || Boolean(completion?.monteur_pdf_path))
          }
          showPruefberichtButton={canViewSelectedPruefprotokoll}
          pruefberichtDisabled={
            checklistSyncing || !selectedChecklistObjectId || pruefprotokollViewLoading
          }
          pruefberichtLoading={pruefprotokollViewLoading}
          onViewPruefbericht={() => void handleViewPruefprotokoll()}
          monteurPdfPath={completion?.monteur_pdf_path}
          monteurBerichtDisabled={monteurPdfViewLoading}
          monteurBerichtLoading={monteurPdfViewLoading}
          onViewMonteurBericht={() => void handleViewMonteurBericht()}
        />

        <AuftragsdetailMonteurZustellungHinweis
          show={
            showMonteurAbschlussSection &&
            order.status !== 'erledigt' &&
            order.status !== 'storniert'
          }
          message={monteurZustellungHinweis}
        />

        {checklistAssistantActive && checklistAssistantMonteurStepActive ? (
          <div className="space-y-2">
            {!checklistAssistantCurrentStepDone ? (
              <p
                className={`text-xs ${
                  checklistAssistantStrictEnabled
                    ? 'text-red-700 dark:text-red-300'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {checklistAssistantStepHint}
              </p>
            ) : null}
            <div className="flex items-center justify-between gap-2">
              <AppButton
                type="button"
                variant="outline"
                disabled={!checklistAssistantCanGoBack}
                onClick={() => setChecklistAssistantStepIdx((prev) => Math.max(0, prev - 1))}
              >
                {checklistAssistantBackCtaLabel}
              </AppButton>
              {checklistAssistantCurrentFlowStep?.key !== 'monteur_abschluss' ? (
                <AppButton
                  type="button"
                  variant={
                    !checklistAssistantCurrentStepDone &&
                    !checklistAssistantStrictEnabled &&
                    (checklistAssistantCurrentFlowStep?.key === 'door' ||
                      checklistAssistantCurrentFlowStep?.key === 'feststell' ||
                      (checklistAssistantCurrentFlowStep?.key === 'monteur_kunden_unterschrift' &&
                        !checklistAssistantKundenSignaturReadyToPersist))
                      ? 'dangerSolid'
                      : 'primary'
                  }
                  disabled={
                    checklistAssistantStepIdx >= checklistAssistantFlowSteps.length - 1 ||
                    (checklistAssistantStrictEnabled &&
                      !checklistAssistantCurrentStepDone &&
                      !checklistAssistantMonteurSignatureDraftPending &&
                      !checklistAssistantCustomerSignatureDraftPending)
                  }
                  onClick={() => {
                    if (
                      checklistAssistantCurrentFlowStep?.key === 'monteur_monteur_signatur' &&
                      !completion?.unterschrift_mitarbeiter_path?.trim() &&
                      !checklistAssistantCurrentStepDone &&
                      checklistAssistantMonteurSignatureDraftPending
                    ) {
                      void (async () => {
                        const comp = await persistCompletionExecRef.current(
                          completionRef.current?.id ?? null,
                          buildPayload(extra.parked ?? false)
                        )
                        if (comp?.unterschrift_mitarbeiter_path?.trim()) {
                          setCompletion(comp)
                          completionRef.current = comp
                          setSigTechDataUrl(null)
                          setMonteurSignatureReplaceMode(false)
                          setChecklistAssistantStepIdx((prev) =>
                            Math.min(checklistAssistantFlowSteps.length - 1, prev + 1)
                          )
                        }
                      })()
                      return
                    }
                    if (checklistAssistantCurrentFlowStep?.key === 'monteur_kunden_unterschrift') {
                      if (checklistAssistantCustomerSignatureDraftPending && !printedCust.trim()) {
                        showError(
                          'Bitte den Namen des Kunden eintragen, bevor die Unterschrift gespeichert wird. Ohne Kundenunterschrift können Sie die Zeichnung löschen und einen Grund im Monteurbericht angeben.'
                        )
                        return
                      }
                      if (
                        !customerSignatureStepComplete &&
                        !checklistAssistantStrictEnabled &&
                        !checklistAssistantCustomerSignatureDraftPending
                      ) {
                        void (async () => {
                          const comp = await persistCompletionExecRef.current(
                            completionRef.current?.id ?? null,
                            buildPayload(extra.parked ?? false)
                          )
                          if (comp) {
                            setCompletion(comp)
                            completionRef.current = comp
                          }
                          setChecklistAssistantStepIdx((prev) =>
                            Math.min(checklistAssistantFlowSteps.length - 1, prev + 1)
                          )
                        })()
                        return
                      }
                      if (
                        checklistAssistantStrictEnabled &&
                        !customerSignatureStepComplete &&
                        !checklistAssistantCustomerSignatureDraftPending
                      ) {
                        showError(
                          'Bitte Kundenunterschrift mit Namen speichern oder ohne Unterschrift einen Grund im Monteurbericht angeben.'
                        )
                        return
                      }
                      void (async () => {
                        const comp = await persistCompletionExecRef.current(
                          completionRef.current?.id ?? null,
                          buildPayload(extra.parked ?? false)
                        )
                        if (comp?.unterschrift_kunde_path?.trim()) {
                          setCompletion(comp)
                          completionRef.current = comp
                          setSigCustDataUrl(null)
                          setCustomerSignatureReplaceMode(false)
                          setChecklistAssistantStepIdx((prev) =>
                            Math.min(checklistAssistantFlowSteps.length - 1, prev + 1)
                          )
                          void handlePdfOnly(comp, { openPreview: false })
                          return
                        }
                        const stillHasCustDraft =
                          typeof sigCustDataUrl === 'string' && sigCustDataUrl.trim().startsWith('data:image')
                        if (
                          comp &&
                          !stillHasCustDraft &&
                          (printedCust.trim() || extra.customer_signature_reason?.trim())
                        ) {
                          setCompletion(comp)
                          completionRef.current = comp
                          setChecklistAssistantStepIdx((prev) =>
                            Math.min(checklistAssistantFlowSteps.length - 1, prev + 1)
                          )
                          void handlePdfOnly(comp, { openPreview: false })
                        }
                      })()
                      return
                    }
                    setChecklistAssistantStepIdx((prev) =>
                      Math.min(checklistAssistantFlowSteps.length - 1, prev + 1)
                    )
                  }}
                >
                  {!checklistAssistantCurrentStepDone &&
                  !checklistAssistantStrictEnabled &&
                  (checklistAssistantCurrentFlowStep?.key === 'door' ||
                    checklistAssistantCurrentFlowStep?.key === 'feststell')
                    ? 'Trotzdem weiter'
                    : checklistAssistantNextCtaLabel}
                </AppButton>
              ) : null}
            </div>
          </div>
        ) : null}

        <AuftragsdetailMonteurFormActionBar
          showSaveButton={!checklistAssistantActive}
          saveDisabled={isSaving || (order.order_type === 'wartung' && monteurLocked)}
          saveBusy={isSaving}
          showCompleteButton={showAuftragAbschliessenButton}
          onOpenCompleteDialog={handleOpenCompleteDialog}
          showEmailToCustomerButton={
            order.status === 'erledigt' &&
            monteurDeliveryMode === 'email_manual' &&
            Boolean(completion?.monteur_pdf_path)
          }
          emailToCustomerSending={monteurEmailSending}
          onSendMonteurReportEmail={handleSendMonteurReportEmail}
          showGenerateMonteurPdfButton={
            !checklistAssistantActive &&
            !showMonteurAbschlussSection &&
            Boolean(completion?.monteur_pdf_path)
          }
          onGenerateMonteurPdf={() => void handlePdfOnly()}
          showParkSection={showParkenButton && assistantShowMonteurReport}
          parkDisabled={isSaving}
          onPark={handlePark}
        />
      </form>
      ) : null}

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

      {assistantAddDoorDialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Tür zum Auftrag hinzufügen"
          onClick={() => setAssistantAddDoorDialogOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Tür zum Auftrag hinzufügen</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Wählen Sie eine weitere Tür/Tor aus demselben Kunden und Objekt/BV.
            </p>
            <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
              {assistantDoorCandidates.length === 0 ? (
                <p className="p-3 text-sm text-slate-500 dark:text-slate-400">Keine weiteren Türen verfügbar.</p>
              ) : (
                <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                  {assistantDoorCandidates.map((obj) => (
                    <li key={obj.id} className="p-2">
                      <button
                        type="button"
                        onClick={() => void handleAddDoorToOrder(obj.id)}
                        className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-left text-sm text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700"
                      >
                        {getObjectDisplayName(obj)}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="mt-3 flex justify-end">
              <AppButton type="button" variant="outline" onClick={() => setAssistantAddDoorDialogOpen(false)}>
                Schließen
              </AppButton>
            </div>
          </div>
        </div>
      ) : null}

      <AuftragsdetailAssistantResumeConfirmDialog
        open={assistantResumeDialogOpen}
        onConfirm={() => handleStartAssistant(true)}
        onCancel={() => handleStartAssistant(false)}
      />

      <AuftragsdetailChecklistModeSwitchConfirmDialog
        open={checklistModeSwitchConfirmOpen}
        onConfirm={handleConfirmChecklistModeSwitch}
        onCancel={() => {
          setChecklistModeSwitchConfirmOpen(false)
          setPendingChecklistModeOverride(null)
        }}
      />

      <ConfirmDialog
        open={followUpDialogOpen}
        title="Folge-Prüfungsauftrag?"
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

      <AuftragsdetailReopenOrderConfirmDialog
        open={reopenDialogOpen}
        onConfirm={() => void handleConfirmReopenOrder()}
        onCancel={() => setReopenDialogOpen(false)}
      />

      <AuftragsdetailPdfPreviewSlot state={pdfViewer} onClose={handleClosePdfViewer} />
    </div>
  )
}

export default Auftragsdetail
