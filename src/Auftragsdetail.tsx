import { useState, useEffect, useCallback, useMemo } from 'react'
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
  fetchMonteurReportSettings,
  fetchMonteurPortalDeliveryEligible,
  sendMaintenanceReportEmail,
  notifyPortalOnMaintenanceReport,
  type MonteurReportCustomerDeliveryMode,
} from './lib/dataService'
import { useLicense } from './LicenseContext'
import { hasFeature } from './lib/licenseService'
import { isOnline } from '../shared/networkUtils'
import { fetchMyProfile, fetchProfiles, getProfileDisplayName } from './lib/userService'
import { LoadingSpinner } from './components/LoadingSpinner'
import SignatureField from './SignatureField'
import { generateMonteurBerichtPdf } from './lib/generateMonteurBerichtPdf'
import { sumWorkMinutes } from './lib/monteurReportTime'
import {
  parseOrderCompletionExtra,
  materialLinesToText,
  defaultOrderCompletionExtra,
  type OrderCompletionExtraV1,
} from './types/orderCompletionExtra'
import { getOrderObjectIds } from './lib/orderUtils'
import { getObjectDisplayName } from './lib/objectUtils'
import type { Order, OrderCompletion, Customer, BV, OrderType, OrderStatus } from './types'
import type { Profile } from './lib/userService'
import type { MaintenanceReason } from './types/maintenance'
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

const Auftragsdetail = () => {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { license } = useLicense()
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
  const [completeSharePortal, setCompleteSharePortal] = useState(true)

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

    if (completionData) {
      setAusgeführte(completionData.ausgeführte_arbeiten ?? '')
      setPrintedTech(completionData.unterschrift_mitarbeiter_name ?? monteurName)
      setPrintedCust(completionData.unterschrift_kunde_name ?? '')
      setExtra(parseOrderCompletionExtra(completionData.completion_extra, monteurName))
    } else {
      setAusgeführte('')
      setPrintedTech(monteurName)
      setPrintedCust('')
      setExtra(defaultOrderCompletionExtra(monteurName))
    }

    const oidForPortal = orderData ? getOrderObjectIds(orderData)[0] ?? orderData.object_id : null
    const [settingsRow, eligible] = await Promise.all([
      fetchMonteurReportSettings(),
      oidForPortal ? fetchMonteurPortalDeliveryEligible(oidForPortal) : Promise.resolve(false),
    ])
    setMonteurDeliveryMode(settingsRow?.customer_delivery_mode ?? 'none')
    setPortalEligible(Boolean(eligible))
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
  const monteurReportDelivery = useMemo(
    () => resolveReportDeliverySettings(orderCustomer, orderBv),
    [orderCustomer, orderBv]
  )
  const monteurInternalOnly = !monteurReportDelivery.monteur_report_portal
  const monteurPortalForCustomer = monteurReportDelivery.monteur_report_portal

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

  const handlePark = async () => {
    if (!order) return
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

  const runCompleteOrder = async (shareToPortal: boolean) => {
    if (!order) return
    setCompleteDialogOpen(false)
    setIsSaving(true)
    const payload = buildPayload(false)
    const comp = await persistCompletion(completion?.id ?? null, payload)
    if (!comp) {
      setIsSaving(false)
      return
    }
    setCompletion(comp)
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
      })
      const { monteurPath } = await runAfterSavePdfAndPortal(comp, pdfBlob, doPortal, extraSnap)
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
      const url = URL.createObjectURL(pdfBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Monteursbericht-${order.id.slice(0, 8)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      showError('PDF-Erstellung fehlgeschlagen.')
    }
    const { error } = await updateOrderStatus(order.id, 'erledigt')
    if (error) showError(getSupabaseErrorMessage(error))
    else {
      setOrder((o) => (o ? { ...o, status: 'erledigt' } : null))
      showToast('Auftrag erledigt.', 'success')
    }
    setIsSaving(false)
  }

  const handleOpenCompleteDialog = () => {
    setCompleteSharePortal(true)
    setCompleteDialogOpen(true)
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
        'Keine E-Mail-Adresse hinterlegt. Bitte unter Kunde oder BV die Adresse für Wartungsprotokoll eintragen.'
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
      })
      const url = URL.createObjectURL(pdfBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Monteursbericht-${order.id.slice(0, 8)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      const { path } = await uploadMonteurBerichtPdf(completion.id, pdfBlob)
      if (path) await updateOrderCompletion(completion.id, { monteur_pdf_path: path })
    } catch {
      showError('PDF fehlgeschlagen.')
    }
  }

  if (!orderId) {
    navigate('/auftrag')
    return null
  }

  if (isLoading) {
    return <LoadingSpinner message="Auftrag wird geladen…" className="p-8" />
  }

  if (!order) {
    return (
      <div className="p-4">
        <p className="text-slate-600">Auftrag nicht gefunden.</p>
        <Link to="/auftrag" className="mt-2 inline-block text-vico-primary hover:underline">
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
    ? 'Für diesen Kunden ist der Monteursbericht ins Kundenportal in den Stammdaten aus; das PDF wird am Auftrag gespeichert. E-Mail-Versand richtet sich nach den Firmen-Einstellungen und der Adresse für Wartungsprotokoll (Kunde/BV).'
    : monteurDeliveryMode === 'email_auto'
      ? 'Nach dem Abschließen wird der Monteursbericht automatisch per E-Mail mit PDF-Anhang versendet (Adresse aus Kunde/BV „Wartungsprotokoll“, BV hat Vorrang), sofern online und eine Adresse hinterlegt ist.'
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
                : 'Nach dem Abschließen: PDF-Download und Speicherung in Vico; keine automatische Kundenzustellung (Einstellungen).'

  return (
    <div className="p-4 max-w-2xl min-w-0 mx-auto">
      <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
        <Link to="/auftrag" className="text-vico-primary hover:underline" aria-label="Zurück zu Aufträgen">
          ← Aufträge
        </Link>
        <span className="text-sm text-slate-600 dark:text-slate-400">
          {ORDER_TYPE_LABELS[order.order_type]} · {ORDER_STATUS_LABELS[order.status]}
        </span>
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

      <form onSubmit={handleSave} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Monteursbericht</h2>
        {formError && (
          <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg p-2" role="alert">
            {formError}
          </p>
        )}

        <div>
          <label htmlFor="bericht-datum" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Berichtsdatum
          </label>
          <input
            id="bericht-datum"
            type="date"
            value={extra.bericht_datum}
            onChange={(e) => setExtraField('bericht_datum', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
          />
        </div>

        <div>
          <label htmlFor="completion-arbeiten" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Ausgeführte Arbeiten
          </label>
          <textarea
            id="completion-arbeiten"
            value={ausgeführte}
            onChange={(e) => setAusgeführte(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
            placeholder="Beschreibung der durchgeführten Arbeiten"
          />
        </div>

        <fieldset className="space-y-3 border border-slate-200 dark:border-slate-600 rounded-lg p-4">
          <legend className="text-sm font-semibold text-slate-800 dark:text-slate-100 px-1">
            Arbeitszeit Monteur (Haupt)
          </legend>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="wt-start" className="block text-xs text-slate-500 mb-1">
                Beginn
              </label>
              <input
                id="wt-start"
                type="time"
                value={extra.primary.start}
                onChange={(e) => setPrimary({ start: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label htmlFor="wt-end" className="block text-xs text-slate-500 mb-1">
                Ende
              </label>
              <input
                id="wt-end"
                type="time"
                value={extra.primary.end}
                onChange={(e) => setPrimary({ end: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label htmlFor="wt-pause" className="block text-xs text-slate-500 mb-1">
                Pause (Min.)
              </label>
              <input
                id="wt-pause"
                type="number"
                min={0}
                value={extra.primary.pause_minuten}
                onChange={(e) => setPrimary({ pause_minuten: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">Berechnete Zeit: {totalMin} Min. (inkl. weitere Monteure)</p>
        </fieldset>

        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Weitere Monteure</span>
            <button
              type="button"
              onClick={handleAddZusatz}
              className="text-sm px-2 py-1 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              + Zeile
            </button>
          </div>
          <ul className="space-y-3">
            {extra.zusatz_monteure.map((z, i) => (
              <li key={i} className="border border-slate-200 dark:border-slate-600 rounded-lg p-3 space-y-2">
                <select
                  value={z.profile_id ?? ''}
                  onChange={(e) => handleZusatzProfilePick(i, e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm"
                  aria-label={`Mitarbeiter ${i + 1}`}
                >
                  <option value="">— Benutzer wählen oder Name unten —</option>
                  {profilesForZusatz.map((p) => (
                    <option key={p.id} value={p.id}>
                      {getProfileDisplayName(p)}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={z.name}
                  onChange={(e) => handleZusatzChange(i, { name: e.target.value })}
                  placeholder="Name"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="time"
                    value={z.start}
                    onChange={(e) => handleZusatzChange(i, { start: e.target.value })}
                    className="px-2 py-1 border rounded-lg bg-white dark:bg-slate-700 text-sm"
                    aria-label="Beginn"
                  />
                  <input
                    type="time"
                    value={z.end}
                    onChange={(e) => handleZusatzChange(i, { end: e.target.value })}
                    className="px-2 py-1 border rounded-lg bg-white dark:bg-slate-700 text-sm"
                    aria-label="Ende"
                  />
                  <input
                    type="number"
                    min={0}
                    value={z.pause_minuten}
                    onChange={(e) => handleZusatzChange(i, { pause_minuten: parseInt(e.target.value, 10) || 0 })}
                    className="px-2 py-1 border rounded-lg bg-white dark:bg-slate-700 text-sm"
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
            <button
              type="button"
              onClick={handleAddMaterialRow}
              className="text-sm px-2 py-1 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              + Zeile
            </button>
          </div>
          <ul className="space-y-2">
            {extra.material_lines.map((row, i) => (
              <li key={i} className="flex gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={row.anzahl}
                  onChange={(e) => handleMaterialChange(i, 'anzahl', e.target.value)}
                  placeholder="Anzahl"
                  className="w-24 shrink-0 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm"
                  aria-label={`Material Anzahl ${i + 1}`}
                />
                <input
                  type="text"
                  value={row.artikel}
                  onChange={(e) => handleMaterialChange(i, 'artikel', e.target.value)}
                  placeholder="Artikel / Bezeichnung"
                  className="flex-1 min-w-0 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm"
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
          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 min-h-[40px] shrink-0 rounded-lg font-medium bg-vico-primary text-white hover:bg-vico-primary-hover disabled:opacity-50"
          >
            {isSaving ? 'Speichern…' : 'Bericht speichern'}
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={handlePark}
            title="Bericht zwischenspeichern, Auftrag bleibt in Bearbeitung"
            className="px-4 py-2 min-h-[40px] shrink-0 rounded-lg font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
          >
            Parken
          </button>
          {order.status !== 'erledigt' && order.status !== 'storniert' && (
            <button
              type="button"
              disabled={isSaving}
              onClick={handleOpenCompleteDialog}
              className="px-4 py-2 min-h-[40px] shrink-0 rounded-lg font-medium border border-emerald-600 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 disabled:opacity-50"
            >
              Auftrag abschließen
            </button>
          )}
          {order.status === 'erledigt' &&
            monteurDeliveryMode === 'email_manual' &&
            completion?.monteur_pdf_path && (
              <button
                type="button"
                disabled={monteurEmailSending}
                onClick={handleSendMonteurReportEmail}
                className="px-4 py-2 min-h-[40px] shrink-0 rounded-lg font-medium bg-slate-700 text-white hover:bg-slate-600 dark:bg-slate-600 dark:hover:bg-slate-500 disabled:opacity-50"
                aria-label="Monteursbericht per E-Mail an den Kunden senden"
              >
                {monteurEmailSending ? 'Senden…' : 'E-Mail an Kunden'}
              </button>
            )}
          {completion && (
            <button
              type="button"
              onClick={handlePdfOnly}
              className="px-4 py-2 min-h-[40px] shrink-0 rounded-lg font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              PDF erzeugen
            </button>
          )}
        </div>
      </form>

      {completeDialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={() => !isSaving && setCompleteDialogOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !isSaving) setCompleteDialogOpen(false)
          }}
        >
          <div
            role="dialog"
            aria-modal
            aria-labelledby="complete-order-title"
            className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full min-w-0 p-4 border border-slate-200 dark:border-slate-600"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="complete-order-title" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              Auftrag abschließen?
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Es wird ein Monteursbericht-PDF erzeugt, der Auftrag auf „Erledigt“ gesetzt. Die Zustellung richtet sich nach
              den Firmen-Einstellungen und den Monteursbericht-Optionen des Kunden (Kundenstammdaten: nur intern /
              Kundenportal).
            </p>
            {showPortalChoiceInDialog ? (
              <label className="mt-4 flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-slate-400 text-vico-primary focus:ring-vico-primary"
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
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setCompleteDialogOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void runCompleteOrder(showPortalChoiceInDialog ? completeSharePortal : false)}
                className="px-4 py-2 rounded-lg font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {isSaving ? 'Wird ausgeführt…' : 'Abschließen'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default Auftragsdetail
