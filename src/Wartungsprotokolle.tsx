import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useToast } from './ToastContext'
import { getSupabaseErrorMessage } from './supabaseErrors'
import {
  fetchCustomer,
  fetchBv,
  fetchObject,
  fetchMaintenanceReports,
  fetchMaintenanceReportSmokeDetectors,
  fetchMaintenanceReportPhotos,
  createMaintenanceReport,
  updateMaintenanceReportSignatures,
  uploadSignatureToStorage,
  deleteMaintenanceReport,
  uploadMaintenancePhoto,
  getMaintenancePhotoUrl,
  deleteMaintenancePhoto,
  sendMaintenanceReportEmailOrQueue,
} from './lib/dataService'
import SignatureField from './SignatureField'
import { useAuth } from './AuthContext'
import { LoadingSpinner } from './components/LoadingSpinner'
import ConfirmDialog from './components/ConfirmDialog'
import EmptyState from '../shared/EmptyState'
import { fetchMyProfile, getProfileDisplayName } from './lib/userService'
import { getObjectDisplayName } from './lib/objectUtils'
import { WARTUNG_CHECKLIST_ITEMS, emptyWartungChecklistState, mergeWartungChecklistState } from './lib/wartungChecklistCatalog'
import { fetchBriefbogenLetterheadPagesForPdf } from './lib/briefbogenService'
import type {
  Object as Obj,
  Customer,
  BV,
  MaintenanceReport,
  MaintenanceReportFormData,
  MaintenanceReason,
  MaintenanceUrgency,
  SmokeDetectorStatus,
} from './types'

const REASON_LABELS: Record<MaintenanceReason, string> = {
  regelwartung: 'Regelwartung',
  reparatur: 'Reparatur',
  nachpruefung: 'Nachprüfung',
  sonstiges: 'Sonstiges',
}

const URGENCY_LABELS: Record<MaintenanceUrgency, string> = {
  niedrig: 'Niedrig',
  mittel: 'Mittel',
  hoch: 'Hoch',
}

const STATUS_LABELS: Record<SmokeDetectorStatus, string> = {
  ok: 'OK',
  defekt: 'Defekt',
  ersetzt: 'Ersetzt',
}

const INITIAL_FORM: MaintenanceReportFormData = {
  maintenance_date: new Date().toISOString().slice(0, 10),
  maintenance_time: new Date().toTimeString().slice(0, 5),
  reason: 'regelwartung',
  reason_other: '',
  manufacturer_maintenance_done: false,
  hold_open_checked: false,
  deficiencies_found: false,
  deficiency_description: '',
  urgency: 'mittel',
  fixed_immediately: false,
  smoke_detector_statuses: [],
  technician_name_printed: '',
  customer_name_printed: '',
}

const Wartungsprotokolle = () => {
  const { customerId, bvId, objectId } = useParams<{
    customerId: string
    bvId?: string
    objectId: string
  }>()
  const { user, userRole } = useAuth()
  const { showError } = useToast()
  const canEdit = userRole === 'admin' || userRole === 'mitarbeiter' || userRole === 'operator'
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [bv, setBv] = useState<BV | null>(null)
  const [object, setObject] = useState<Obj | null>(null)
  const [reports, setReports] = useState<MaintenanceReport[]>([])
  const [reportDetails, setReportDetails] = useState<
    Record<
      string,
      { smokeDetectors: { label: string; status: SmokeDetectorStatus }[]; photos: { id: string; storage_path: string | null; caption: string | null; localDataUrl?: string }[] }
    >
  >({})
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [technicianSignature, setTechnicianSignature] = useState<string | null>(null)
  const [customerSignature, setCustomerSignature] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<MaintenanceReportFormData>(INITIAL_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [sendingEmailFor, setSendingEmailFor] = useState<string | null>(null)
  const [expandedPhotoUrl, setExpandedPhotoUrl] = useState<string | null>(null)
  const [checklistState, setChecklistState] = useState<Record<string, boolean>>(emptyWartungChecklistState)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    reportId: string | null
  }>({ open: false, reportId: null })

  const loadData = useCallback(async () => {
    if (!customerId || !objectId) return
    setIsLoading(true)
    const [cust, bvData, objData, reportData] = await Promise.all([
      fetchCustomer(customerId),
      bvId ? fetchBv(bvId) : Promise.resolve(null),
      fetchObject(objectId),
      fetchMaintenanceReports(objectId),
    ])
    setCustomer(cust)
    setBv(bvData)
    setObject(objData)
    setReports(reportData ?? [])

    const details: Record<
      string,
      { smokeDetectors: { label: string; status: SmokeDetectorStatus }[]; photos: { id: string; storage_path: string | null; caption: string | null; localDataUrl?: string }[] }
    > = {}
    for (const r of reportData ?? []) {
      const [sds, photos] = await Promise.all([
        fetchMaintenanceReportSmokeDetectors(r.id),
        fetchMaintenanceReportPhotos(r.id),
      ])
      details[r.id] = {
        smokeDetectors: sds.map((sd) => ({ label: sd.smoke_detector_label, status: sd.status })),
        photos: photos.map((p) => ({
          id: p.id,
          storage_path: p.storage_path,
          caption: p.caption,
          localDataUrl: (p as { localDataUrl?: string }).localDataUrl,
        })),
      }
    }
    setReportDetails(details)
    setIsLoading(false)
  }, [customerId, bvId, objectId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleOpenCreate = async () => {
    const smokeCount = object?.smoke_detector_count ?? 0
    setPhotoFiles([])
    setTechnicianSignature(null)
    setCustomerSignature(null)

    let technicianName = ''
    if (user?.id) {
      const profile = await fetchMyProfile(user.id)
      if (profile) technicianName = getProfileDisplayName(profile)
    }

    setFormData({
      ...INITIAL_FORM,
      maintenance_date: new Date().toISOString().slice(0, 10),
      maintenance_time: new Date().toTimeString().slice(0, 5),
      technician_name_printed: technicianName,
      smoke_detector_statuses: Array.from({ length: smokeCount }, (_, i) => ({
        label: `RM${i + 1}`,
        status: 'ok' as SmokeDetectorStatus,
      })),
    })
    setChecklistState(emptyWartungChecklistState())
    setFormError(null)
    setShowForm(true)
  }

  const handleWartungChecklistToggle = (itemId: string) => {
    setChecklistState((prev) => {
      const base = mergeWartungChecklistState(prev)
      return { ...base, [itemId]: !base[itemId] }
    })
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setFormError(null)
  }

  const handleFormChange = (
    field: keyof MaintenanceReportFormData,
    value: string | boolean
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSmokeDetectorStatusChange = (
    index: number,
    status: SmokeDetectorStatus
  ) => {
    setFormData((prev) => {
      const next = [...prev.smoke_detector_statuses]
      next[index] = { ...next[index], status }
      return { ...prev, smoke_detector_statuses: next }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!objectId) return
    setIsSaving(true)

    const payload = {
      object_id: objectId,
      maintenance_date: formData.maintenance_date,
      maintenance_time: formData.maintenance_time.trim() || null,
      technician_id: user?.id ?? null,
      reason: formData.reason || null,
      reason_other: formData.reason_other.trim() || null,
      manufacturer_maintenance_done: false,
      hold_open_checked: object?.has_hold_open ? formData.hold_open_checked : null,
      deficiencies_found: formData.deficiencies_found,
      deficiency_description: formData.deficiency_description.trim() || null,
      urgency: formData.urgency || null,
      fixed_immediately: formData.fixed_immediately,
      customer_signature_path: null,
      technician_signature_path: null,
      technician_name_printed: formData.technician_name_printed.trim() || null,
      customer_name_printed: formData.customer_name_printed.trim() || null,
      pdf_path: null,
      synced: true,
      checklist_state: mergeWartungChecklistState(checklistState),
    }

    const smokeDetectors = formData.smoke_detector_statuses.map((sd) => ({
      label: sd.label,
      status: sd.status,
    }))

    const { data, error } = await createMaintenanceReport(payload, smokeDetectors)
    if (error) {
      const msg = getSupabaseErrorMessage(error)
      setFormError(msg)
      showError(msg)
      setIsSaving(false)
      return
    }
    if (data && photoFiles.length > 0) {
      for (const file of photoFiles) {
        await uploadMaintenancePhoto(data.id, file)
      }
    }
    if (data && (technicianSignature || customerSignature)) {
      let techPath: string | null = null
      let custPath: string | null = null
      if (technicianSignature) {
        const res = await uploadSignatureToStorage(data.id, technicianSignature, 'technician')
        techPath = res.path
      }
      if (customerSignature) {
        const res = await uploadSignatureToStorage(data.id, customerSignature, 'customer')
        custPath = res.path
      }
      await updateMaintenanceReportSignatures(data.id, techPath, custPath)
    }
    if (data) {
      handleCloseForm()
      loadData()
    }
    setIsSaving(false)
  }

  const handleDelete = async (id: string) => {
    const { error } = await deleteMaintenanceReport(id)
    if (error) showError(getSupabaseErrorMessage(error))
    else loadData()
  }

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    setPhotoFiles((prev) => [...prev, ...Array.from(files)])
    e.target.value = ''
  }

  const handlePhotoRemove = (index: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleDeletePhoto = async (_reportId: string, photoId: string, storagePath: string | null) => {
    const { error } = await deleteMaintenancePhoto(photoId, storagePath)
    if (error) showError(getSupabaseErrorMessage(error))
    else loadData()
  }

  const handleDownloadPdf = async (r: MaintenanceReport) => {
    const details = reportDetails[r.id]
    if (!customer || !object) return
    const bvForPdf = bv ?? {
      id: '',
      customer_id: customer.id,
      name: '–',
      street: customer.street,
      house_number: customer.house_number,
      postal_code: customer.postal_code,
      city: customer.city,
      email: customer.email,
      phone: customer.phone,
      contact_name: customer.contact_name,
      contact_email: customer.contact_email,
      contact_phone: customer.contact_phone,
      maintenance_report_email: customer.maintenance_report_email,
      maintenance_report_email_address: customer.maintenance_report_email_address,
      created_at: '',
      updated_at: '',
    } as BV
    const letterheadPages = await fetchBriefbogenLetterheadPagesForPdf()
    const { generateMaintenancePdf } = await import('./lib/generateMaintenancePdf')
    const blob = await generateMaintenancePdf({
      report: r,
      customer,
      bv: bvForPdf,
      object,
      smokeDetectors: details?.smokeDetectors ?? [],
      photos: details?.photos ?? [],
      technicianSignaturePath: r.technician_signature_path,
      customerSignaturePath: r.customer_signature_path,
      letterheadPages: letterheadPages ?? undefined,
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Pruefbericht_${r.maintenance_date}_${getObjectDisplayName(object)}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getRecipientEmail = (): string | null => {
    const bvEmail = bv?.maintenance_report_email !== false ? bv?.maintenance_report_email_address : null
    const custEmail = customer?.maintenance_report_email !== false ? customer?.maintenance_report_email_address : null
    return (bvEmail || custEmail || '').trim() || null
  }

  const handleSendEmail = async (r: MaintenanceReport) => {
    const recipient = getRecipientEmail()
    if (!recipient) {
      alert('Keine E-Mail-Adresse hinterlegt. Bitte unter Kunde oder BV „E-Mail für Prüfbericht“ eintragen.')
      return
    }
    if (!customer || !object) return
    const bvForPdf = bv ?? {
      id: '',
      customer_id: customer.id,
      name: '–',
      street: customer.street,
      house_number: customer.house_number,
      postal_code: customer.postal_code,
      city: customer.city,
      email: customer.email,
      phone: customer.phone,
      contact_name: customer.contact_name,
      contact_email: customer.contact_email,
      contact_phone: customer.contact_phone,
      maintenance_report_email: customer.maintenance_report_email,
      maintenance_report_email_address: customer.maintenance_report_email_address,
      created_at: '',
      updated_at: '',
    } as BV
    setSendingEmailFor(r.id)
    try {
      const letterheadPages = await fetchBriefbogenLetterheadPagesForPdf()
      const { generateMaintenancePdf } = await import('./lib/generateMaintenancePdf')
      const details = reportDetails[r.id]
      const blob = await generateMaintenancePdf({
        report: r,
        customer,
        bv: bvForPdf,
        object,
        smokeDetectors: details?.smokeDetectors ?? [],
        photos: details?.photos ?? [],
        technicianSignaturePath: r.technician_signature_path,
        customerSignaturePath: r.customer_signature_path,
        letterheadPages: letterheadPages ?? undefined,
      })
      const filename = `Pruefbericht_${r.maintenance_date}_${getObjectDisplayName(object)}.pdf`
      const subject = `Prüfbericht ${getObjectDisplayName(object)} – ${r.maintenance_date}`
      const { error: sendError } = await sendMaintenanceReportEmailOrQueue(blob, r.id, recipient, subject, filename)
      if (sendError) {
        alert(`E-Mail konnte nicht gesendet werden: ${sendError.message}`)
        return
      }
      alert(
        navigator.onLine
          ? `Prüfbericht wurde an ${recipient} gesendet.`
          : `E-Mail wird beim nächsten Sync gesendet (${recipient}).`
      )
    } finally {
      setSendingEmailFor(null)
    }
  }

  if (!objectId || !customerId) {
    return (
      <div className="p-4 min-w-0">
        <p className="text-slate-600">Ungültige Navigation.</p>
        <Link to="/kunden" className="text-vico-primary hover:underline mt-2 inline-block">
          ← Kunden
        </Link>
      </div>
    )
  }

  if (isLoading || !customer) {
    return (
      <div className="p-4 min-w-0">
        <LoadingSpinner message="Lade…" className="py-8" />
      </div>
    )
  }

  if (bvId && !bv) {
    return (
      <div className="p-4 min-w-0">
        <p className="text-slate-600 dark:text-slate-400">Betriebsstätte nicht gefunden oder kein Zugriff.</p>
        <Link to="/kunden" className="text-vico-primary hover:underline mt-2 inline-block">
          ← Kunden
        </Link>
      </div>
    )
  }

  if (!object) {
    return (
      <div className="p-4 min-w-0">
        <p className="text-slate-600 dark:text-slate-400">Tür/Tor nicht gefunden.</p>
        <Link to="/kunden" className="text-vico-primary hover:underline mt-2 inline-block">
          ← Kunden
        </Link>
      </div>
    )
  }

  if (bvId && object.bv_id != null && object.bv_id !== bvId) {
    return (
      <div className="p-4 min-w-0">
        <p className="text-slate-600 dark:text-slate-400">
          Dieses Tür/Tor ist nicht der gewählten Betriebsstätte zugeordnet.
        </p>
        <Link to="/kunden" className="text-vico-primary hover:underline mt-2 inline-block">
          ← Kunden
        </Link>
      </div>
    )
  }

  return (
    <div className="p-4 min-w-0">
      <div className="mb-4 flex items-center gap-2 text-sm text-slate-600">
        <Link to="/kunden" className="hover:text-slate-800">
          Kunden
        </Link>
        <span>/</span>
        <Link to={`/kunden?customerId=${customerId}`} className="hover:text-slate-800">
          {customer.name}
        </Link>
        {bv && (
          <>
            <span>/</span>
            <Link
              to={`/kunden?customerId=${customerId}&bvId=${bvId}`}
              className="hover:text-slate-800"
            >
              {bv.name}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="font-medium text-slate-800">
          Wartung {object ? `· ${getObjectDisplayName(object)}` : ''}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <h2 className="text-xl font-bold text-slate-800">Prüfberichte</h2>
        {canEdit && (
          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-vico-button dark:bg-vico-primary text-slate-800 dark:text-white rounded-lg hover:bg-vico-button-hover dark:hover:opacity-90 font-medium border border-slate-300 dark:border-slate-600"
            aria-label="Neuen Prüfbericht anlegen"
          >
            + Neues Protokoll
          </button>
        )}
      </div>

      {reports.length === 0 ? (
        <EmptyState
          title="Noch keine Prüfberichte angelegt."
          description={canEdit ? 'Klicken Sie auf „+ Neues Protokoll“, um zu starten.' : undefined}
          className="py-8"
        />
      ) : (
        <ul className="space-y-2">
          {reports.map((r) => {
            const details = reportDetails[r.id]
            return (
              <li
                key={r.id}
                className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-100">
                    {r.maintenance_date}
                    {r.maintenance_time ? ` · ${r.maintenance_time}` : ''}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {r.reason ? REASON_LABELS[r.reason] : '–'}
                    {r.deficiencies_found && ' · Mängel festgestellt'}
                  </p>
                  {details?.smokeDetectors?.length ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                      Rauchmelder: {details.smokeDetectors.map((sd) => `${sd.label}: ${STATUS_LABELS[sd.status]}`).join(', ')}
                    </p>
                  ) : null}
                  {(r.technician_signature_path || r.customer_signature_path) && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                      Unterschriften:{' '}
                      {r.technician_signature_path && `Techniker ✓${r.technician_name_printed ? ` (${r.technician_name_printed})` : ''}`}
                      {r.technician_signature_path && r.customer_signature_path && ' · '}
                      {r.customer_signature_path && `Kunde ✓${r.customer_name_printed ? ` (${r.customer_name_printed})` : ''}`}
                    </p>
                  )}
                  {details?.photos?.length ? (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {details.photos.map((p) => {
                        const photoUrl = (p as { localDataUrl?: string }).localDataUrl ?? (p.storage_path ? getMaintenancePhotoUrl(p.storage_path) : '')
                        if (!photoUrl) return null
                        return (
                        <div key={p.id} className="relative group">
                          <button
                            type="button"
                            onClick={() => setExpandedPhotoUrl(photoUrl)}
                            className="block w-12 h-12 rounded border border-slate-200 dark:border-slate-600 overflow-hidden focus:outline-none focus:ring-2 focus:ring-vico-primary cursor-zoom-in"
                            aria-label="Foto vergrößern"
                          >
                            <img
                              src={photoUrl}
                              alt={p.caption || 'Foto'}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </button>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => handleDeletePhoto(r.id, p.id, p.storage_path)}
                              className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              aria-label="Foto löschen"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      )})}
                    </div>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadPdf(r)}
                    className="px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
                    aria-label="PDF herunterladen"
                  >
                    PDF
                  </button>
                  {canEdit && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSendEmail(r)}
                        disabled={
                          !getRecipientEmail() ||
                          sendingEmailFor === r.id ||
                          r.synced === false ||
                          r.id.startsWith('temp-')
                        }
                        className="px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="E-Mail senden"
                      >
                        {sendingEmailFor === r.id
                          ? '…'
                          : r.synced === false || r.id.startsWith('temp-')
                            ? 'Wird sync.'
                            : 'E-Mail'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmDialog({ open: true, reportId: r.id })
                        }
                        className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50"
                        aria-label="Protokoll löschen"
                      >
                        Löschen
                      </button>
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        title="Prüfbericht löschen"
        message="Prüfbericht wirklich löschen?"
        confirmLabel="Löschen"
        variant="danger"
        onConfirm={() => {
          if (confirmDialog.reportId) {
            handleDelete(confirmDialog.reportId)
            setConfirmDialog({ open: false, reportId: null })
          }
        }}
        onCancel={() => setConfirmDialog({ open: false, reportId: null })}
      />

      {showForm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto overscroll-contain"
          style={{ padding: 'max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left))' }}
          onClick={handleCloseForm}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-2xl w-full min-w-0 my-auto max-h-[min(90vh,90dvh)] overflow-y-auto flex flex-col text-slate-900 dark:text-slate-100"
            role="dialog"
            aria-modal
            aria-labelledby="wartung-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-600">
              <h3 id="wartung-title" className="text-lg font-bold text-slate-800 dark:text-slate-100">
                Neuer Prüfbericht
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4 min-w-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="min-w-0">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Datum der Wartung
                  </label>
                  <input
                    type="date"
                    value={formData.maintenance_date}
                    onChange={(e) => handleFormChange('maintenance_date', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    required
                    aria-label="Datum der Wartung"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Uhrzeit
                  </label>
                  <input
                    type="time"
                    value={formData.maintenance_time}
                    onChange={(e) => handleFormChange('maintenance_time', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    aria-label="Uhrzeit"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Prüfgrund
                </label>
                <select
                  value={formData.reason}
                  onChange={(e) =>
                    handleFormChange('reason', e.target.value as MaintenanceReason)
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  aria-label="Prüfgrund"
                >
                  {Object.entries(REASON_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                {formData.reason === 'sonstiges' && (
                  <input
                    type="text"
                    placeholder="Sonstiges (Bitte angeben)"
                    value={formData.reason_other}
                    onChange={(e) => handleFormChange('reason_other', e.target.value)}
                    className="mt-2 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    aria-label="Sonstiges"
                  />
                )}
              </div>

              <div className="space-y-2 text-slate-800 dark:text-slate-200">
                {object?.has_hold_open && (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.hold_open_checked}
                      onChange={(e) =>
                        handleFormChange('hold_open_checked', e.target.checked)
                      }
                    />
                    Feststellanlage geprüft
                  </label>
                )}
              </div>

              <fieldset className="space-y-2 border border-slate-200 dark:border-slate-600 rounded-lg p-4">
                <legend className="text-sm font-semibold text-slate-800 dark:text-slate-100 px-1">
                  Wartungs-Checkliste
                </legend>
                <ul className="space-y-2 list-none p-0 m-0">
                  {WARTUNG_CHECKLIST_ITEMS.map((item) => (
                    <li key={item.id}>
                      <label className="flex items-start gap-2 text-sm text-slate-800 dark:text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(checklistState[item.id])}
                          onChange={() => handleWartungChecklistToggle(item.id)}
                          disabled={isSaving}
                          className="mt-0.5 rounded border-slate-400 text-vico-primary"
                          aria-label={item.label}
                        />
                        <span>{item.label}</span>
                      </label>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Wird im Protokoll gespeichert und bei Offline-Erfassung mit der Outbox synchronisiert.
                </p>
              </fieldset>

              {formData.smoke_detector_statuses.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Rauchmelder
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {formData.smoke_detector_statuses.map((sd, i) => (
                      <div key={i}>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          {sd.label}
                        </label>
                        <select
                          value={sd.status}
                          onChange={(e) =>
                            handleSmokeDetectorStatusChange(
                              i,
                              e.target.value as SmokeDetectorStatus
                            )
                          }
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                          aria-label={`${sd.label} Status`}
                        >
                          {Object.entries(STATUS_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SignatureField
                  label="Techniker-Unterschrift"
                  value={technicianSignature}
                  onChange={setTechnicianSignature}
                  disabled={isSaving}
                  printedName={formData.technician_name_printed}
                  onPrintedNameChange={(v) => handleFormChange('technician_name_printed', v)}
                />
                <SignatureField
                  label="Kunden-Unterschrift"
                  value={customerSignature}
                  onChange={setCustomerSignature}
                  disabled={isSaving}
                  printedName={formData.customer_name_printed}
                  onPrintedNameChange={(v) => handleFormChange('customer_name_printed', v)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Fotos
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoSelect}
                  className="w-full text-sm text-slate-600 dark:text-slate-300 file:mr-2 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-100 dark:file:bg-slate-700 file:text-slate-700 dark:file:text-slate-200 hover:file:bg-slate-200 dark:hover:file:bg-slate-600"
                  aria-label="Fotos hinzufügen"
                />
                {photoFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {photoFiles.map((file, i) => (
                      <div key={i} className="relative">
                        <img
                          src={URL.createObjectURL(file)}
                          alt=""
                          className="w-16 h-16 object-cover rounded border"
                        />
                        <button
                          type="button"
                          onClick={() => handlePhotoRemove(i)}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                          aria-label="Entfernen"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={formData.deficiencies_found}
                    onChange={(e) =>
                      handleFormChange('deficiencies_found', e.target.checked)
                    }
                  />
                  Neue Mängel festgestellt
                </label>
                {formData.deficiencies_found && (
                  <div className="mt-2 space-y-2">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Beschreibung
                      </label>
                      <textarea
                        value={formData.deficiency_description}
                        onChange={(e) =>
                          handleFormChange('deficiency_description', e.target.value)
                        }
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                        rows={2}
                        placeholder="Mängel beschreiben"
                        aria-label="Mängel Beschreibung"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Dringlichkeit
                      </label>
                      <select
                        value={formData.urgency}
                        onChange={(e) =>
                          handleFormChange('urgency', e.target.value as MaintenanceUrgency)
                        }
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                        aria-label="Dringlichkeit"
                      >
                        {Object.entries(URGENCY_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.fixed_immediately}
                        onChange={(e) =>
                          handleFormChange('fixed_immediately', e.target.checked)
                        }
                      />
                      Sofort behoben
                    </label>
                  </div>
                )}
              </div>

              {formError && (
                <div className="text-sm text-red-600">
                  <p>{formError}</p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2 bg-vico-button dark:bg-vico-primary text-slate-800 dark:text-white rounded-lg hover:bg-vico-button-hover dark:hover:opacity-90 disabled:opacity-50 border border-slate-300 dark:border-slate-600"
                >
                  {isSaving ? 'Speichern...' : 'Speichern'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {expandedPhotoUrl && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setExpandedPhotoUrl(null)}
          onKeyDown={(e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') setExpandedPhotoUrl(null) }}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-zoom-out"
          aria-label="Foto schließen"
        >
          <img
            src={expandedPhotoUrl}
            alt="Foto vergrößert"
            className="max-w-full max-h-full object-contain rounded-lg shadow-xl"
          />
        </div>
      )}
    </div>
  )
}

export default Wartungsprotokolle
