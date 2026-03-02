import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
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
  uploadMaintenancePdf,
  sendMaintenanceReportEmail,
} from './lib/dataService'
import SignatureField from './SignatureField'
import { useAuth } from './AuthContext'
import { generateMaintenancePdf } from './lib/generateMaintenancePdf'
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
    bvId: string
    objectId: string
  }>()
  const { user, userRole } = useAuth()
  const canEdit = userRole !== 'leser'
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [bv, setBv] = useState<BV | null>(null)
  const [object, setObject] = useState<Obj | null>(null)
  const [reports, setReports] = useState<MaintenanceReport[]>([])
  const [reportDetails, setReportDetails] = useState<
    Record<
      string,
      { smokeDetectors: { label: string; status: SmokeDetectorStatus }[]; photos: { id: string; storage_path: string | null; caption: string | null }[] }
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

  const loadData = useCallback(async () => {
    if (!customerId || !bvId || !objectId) return
    setIsLoading(true)
    const [cust, bvData, objData, reportData] = await Promise.all([
      fetchCustomer(customerId),
      fetchBv(bvId),
      fetchObject(objectId),
      fetchMaintenanceReports(objectId),
    ])
    setCustomer(cust)
    setBv(bvData)
    setObject(objData)
    setReports(reportData ?? [])

    const details: Record<
      string,
      { smokeDetectors: { label: string; status: SmokeDetectorStatus }[]; photos: { id: string; storage_path: string | null; caption: string | null }[] }
    > = {}
    for (const r of reportData ?? []) {
      const [sds, photos] = await Promise.all([
        fetchMaintenanceReportSmokeDetectors(r.id),
        fetchMaintenanceReportPhotos(r.id),
      ])
      details[r.id] = {
        smokeDetectors: sds.map((sd) => ({ label: sd.smoke_detector_label, status: sd.status })),
        photos: photos.map((p) => ({ id: p.id, storage_path: p.storage_path, caption: p.caption })),
      }
    }
    setReportDetails(details)
    setIsLoading(false)
  }, [customerId, bvId, objectId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleOpenCreate = () => {
    const smokeCount = object?.smoke_detector_count ?? 0
    setPhotoFiles([])
    setTechnicianSignature(null)
    setCustomerSignature(null)
    setFormData({
      ...INITIAL_FORM,
      maintenance_date: new Date().toISOString().slice(0, 10),
      maintenance_time: new Date().toTimeString().slice(0, 5),
      smoke_detector_statuses: Array.from({ length: smokeCount }, (_, i) => ({
        label: `RM${i + 1}`,
        status: 'ok' as SmokeDetectorStatus,
      })),
    })
    setFormError(null)
    setShowForm(true)
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
      manufacturer_maintenance_done: formData.manufacturer_maintenance_done,
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
    }

    const smokeDetectors = formData.smoke_detector_statuses.map((sd) => ({
      label: sd.label,
      status: sd.status,
    }))

    const { data, error } = await createMaintenanceReport(payload, smokeDetectors)
    if (error) {
      setFormError(getSupabaseErrorMessage(error))
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
    if (!window.confirm('Wartungsprotokoll wirklich löschen?')) return
    const { error } = await deleteMaintenanceReport(id)
    if (!error) loadData()
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

  const handleDeletePhoto = async (reportId: string, photoId: string, storagePath: string | null) => {
    const { error } = await deleteMaintenancePhoto(photoId, storagePath)
    if (!error) loadData()
  }

  const handleDownloadPdf = async (r: MaintenanceReport) => {
    const details = reportDetails[r.id]
    if (!customer || !bv || !object) return
    const blob = await generateMaintenancePdf({
      report: r,
      customer,
      bv,
      object,
      smokeDetectors: details?.smokeDetectors ?? [],
      photos: details?.photos ?? [],
      technicianSignaturePath: r.technician_signature_path,
      customerSignaturePath: r.customer_signature_path,
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Wartungsprotokoll_${r.maintenance_date}_${object.internal_id || r.id}.pdf`
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
      alert('Keine E-Mail-Adresse hinterlegt. Bitte unter Kunde oder BV „E-Mail für Wartungsprotokoll“ eintragen.')
      return
    }
    if (!customer || !bv || !object) return
    setSendingEmailFor(r.id)
    try {
      const details = reportDetails[r.id]
      const blob = await generateMaintenancePdf({
        report: r,
        customer,
        bv,
        object,
        smokeDetectors: details?.smokeDetectors ?? [],
        photos: details?.photos ?? [],
        technicianSignaturePath: r.technician_signature_path,
        customerSignaturePath: r.customer_signature_path,
      })
      const { path, error: uploadError } = await uploadMaintenancePdf(r.id, blob)
      if (uploadError) {
        alert(`Fehler beim Hochladen: ${uploadError.message}`)
        return
      }
      if (!path) {
        alert('PDF konnte nicht hochgeladen werden.')
        return
      }
      const filename = `Wartungsprotokoll_${r.maintenance_date}_${object.internal_id || r.id}.pdf`
      const subject = `Wartungsprotokoll ${object.internal_id ?? 'Objekt'} – ${r.maintenance_date}`
      const { error: sendError } = await sendMaintenanceReportEmail(path, recipient, subject, filename)
      if (sendError) {
        alert(`E-Mail konnte nicht gesendet werden: ${sendError.message}`)
        return
      }
      alert(`Wartungsprotokoll wurde an ${recipient} gesendet.`)
    } finally {
      setSendingEmailFor(null)
    }
  }

  if (!objectId || !bvId || !customerId) {
    return (
      <div className="p-4">
        <p className="text-slate-600">Ungültige Navigation.</p>
        <Link to="/kunden" className="text-vico-primary hover:underline mt-2 inline-block">
          ← Kunden
        </Link>
      </div>
    )
  }

  if (!bv || !customer || isLoading) {
    return (
      <div className="p-4">
        <p className="text-slate-600">Lade...</p>
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
        <Link to={`/kunden/${customerId}/bvs`} className="hover:text-slate-800">
          {customer.name}
        </Link>
        <span>/</span>
        <Link
          to={`/kunden/${customerId}/bvs/${bvId}/objekte`}
          className="hover:text-slate-800"
        >
          {bv.name}
        </Link>
        <span>/</span>
        <span className="font-medium text-slate-800">
          Wartung {object ? `· ${object.internal_id ?? 'Objekt'}` : ''}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <h2 className="text-xl font-bold text-slate-800">Wartungsprotokolle</h2>
        {canEdit && (
          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-vico-button text-slate-800 rounded-lg hover:bg-vico-button-hover font-medium border border-slate-300"
            aria-label="Neues Wartungsprotokoll anlegen"
          >
            + Neues Protokoll
          </button>
        )}
      </div>

      {reports.length === 0 ? (
        <p className="text-slate-600 py-8 text-center">
          Noch keine Wartungsprotokolle angelegt.
        </p>
      ) : (
        <ul className="space-y-2">
          {reports.map((r) => {
            const details = reportDetails[r.id]
            return (
              <li
                key={r.id}
                className="bg-white rounded-lg border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <p className="font-medium text-slate-800">
                    {r.maintenance_date}
                    {r.maintenance_time ? ` · ${r.maintenance_time}` : ''}
                  </p>
                  <p className="text-sm text-slate-500">
                    {r.reason ? REASON_LABELS[r.reason] : '–'}
                    {r.deficiencies_found && ' · Mängel festgestellt'}
                  </p>
                  {details?.smokeDetectors?.length ? (
                    <p className="text-xs text-slate-400 mt-1">
                      Rauchmelder: {details.smokeDetectors.map((sd) => `${sd.label}: ${STATUS_LABELS[sd.status]}`).join(', ')}
                    </p>
                  ) : null}
                  {(r.technician_signature_path || r.customer_signature_path) && (
                    <p className="text-xs text-slate-400 mt-1">
                      Unterschriften:{' '}
                      {r.technician_signature_path && `Techniker ✓${r.technician_name_printed ? ` (${r.technician_name_printed})` : ''}`}
                      {r.technician_signature_path && r.customer_signature_path && ' · '}
                      {r.customer_signature_path && `Kunde ✓${r.customer_name_printed ? ` (${r.customer_name_printed})` : ''}`}
                    </p>
                  )}
                  {details?.photos?.length ? (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {details.photos.map((p) => (
                        <div key={p.id} className="relative group">
                          <img
                            src={p.storage_path ? getMaintenancePhotoUrl(p.storage_path) : ''}
                            alt={p.caption || 'Foto'}
                            className="w-12 h-12 object-cover rounded border border-slate-200"
                          />
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
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadPdf(r)}
                    className="px-3 py-1.5 text-sm text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
                    aria-label="PDF herunterladen"
                  >
                    PDF
                  </button>
                  {canEdit && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSendEmail(r)}
                        disabled={!getRecipientEmail() || sendingEmailFor === r.id}
                        className="px-3 py-1.5 text-sm text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="E-Mail senden"
                      >
                        {sendingEmailFor === r.id ? '…' : 'E-Mail'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(r.id)}
                        className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
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

      {showForm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={handleCloseForm}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal
            aria-labelledby="wartung-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sticky top-0 bg-white border-b border-slate-200">
              <h3 id="wartung-title" className="text-lg font-bold text-slate-800">
                Neues Wartungsprotokoll
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Datum der Wartung
                  </label>
                  <input
                    type="date"
                    value={formData.maintenance_date}
                    onChange={(e) => handleFormChange('maintenance_date', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    required
                    aria-label="Datum der Wartung"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Uhrzeit
                  </label>
                  <input
                    type="time"
                    value={formData.maintenance_time}
                    onChange={(e) => handleFormChange('maintenance_time', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    aria-label="Uhrzeit"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Prüfgrund
                </label>
                <select
                  value={formData.reason}
                  onChange={(e) =>
                    handleFormChange('reason', e.target.value as MaintenanceReason)
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
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
                    className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg"
                    aria-label="Sonstiges"
                  />
                )}
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.manufacturer_maintenance_done}
                    onChange={(e) =>
                      handleFormChange('manufacturer_maintenance_done', e.target.checked)
                    }
                  />
                  Wartung nach Herstellerangaben durchgeführt
                </label>
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

              {formData.smoke_detector_statuses.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Rauchmelder
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {formData.smoke_detector_statuses.map((sd, i) => (
                      <div key={i}>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
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
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
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
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Fotos
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoSelect}
                  className="w-full text-sm text-slate-600 file:mr-2 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
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
                <label className="flex items-center gap-2">
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
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Beschreibung
                      </label>
                      <textarea
                        value={formData.deficiency_description}
                        onChange={(e) =>
                          handleFormChange('deficiency_description', e.target.value)
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                        rows={2}
                        placeholder="Mängel beschreiben"
                        aria-label="Mängel Beschreibung"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Dringlichkeit
                      </label>
                      <select
                        value={formData.urgency}
                        onChange={(e) =>
                          handleFormChange('urgency', e.target.value as MaintenanceUrgency)
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
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

export default Wartungsprotokolle
