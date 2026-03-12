import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '../ToastContext'
import ConfirmDialog from './ConfirmDialog'
import { getSupabaseErrorMessage } from '../supabaseErrors'
import {
  createObject,
  updateObject,
  fetchObjectPhotos,
  uploadObjectPhoto,
  deleteObjectPhoto,
  getObjectPhotoDisplayUrl,
  fetchObjectDocuments,
  uploadObjectDocument,
  deleteObjectDocument,
  getObjectDocumentUrl,
} from '../lib/dataService'
import type { Object as Obj, ObjectFormData, ObjectPhoto, ObjectDocumentType } from '../types'
import type { ObjectDocumentDisplay } from '../lib/dataService'

const INITIAL_FORM: ObjectFormData = {
  name: '',
  internal_id: '',
  door_position: '',
  internal_door_number: '',
  floor: '',
  room: '',
  type_tuer: false,
  type_sektionaltor: false,
  type_schiebetor: false,
  type_freitext: '',
  wing_count: '',
  manufacturer: '',
  build_year: '',
  lock_manufacturer: '',
  lock_type: '',
  has_hold_open: false,
  hold_open_manufacturer: '',
  hold_open_type: '',
  hold_open_approval_no: '',
  hold_open_approval_date: '',
  smoke_detector_count: '0',
  smoke_detector_build_years: [],
  panic_function: '',
  accessories: '',
  maintenance_by_manufacturer: false,
  hold_open_maintenance: false,
  defects: '',
  remarks: '',
  maintenance_interval_months: '',
}

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR - 1990 + 2 }, (_, i) => 1990 + i).reverse()

const objToFormData = (obj: Obj): ObjectFormData => ({
  name: obj.name ?? '',
  internal_id: obj.internal_id ?? '',
  door_position: obj.door_position ?? '',
  internal_door_number: obj.internal_door_number ?? '',
  floor: obj.floor ?? '',
  room: obj.room ?? '',
  type_tuer: obj.type_tuer ?? false,
  type_sektionaltor: obj.type_sektionaltor ?? false,
  type_schiebetor: obj.type_schiebetor ?? false,
  type_freitext: obj.type_freitext ?? '',
  wing_count: obj.wing_count?.toString() ?? '',
  manufacturer: obj.manufacturer ?? '',
  build_year: obj.build_year ?? '',
  lock_manufacturer: obj.lock_manufacturer ?? '',
  lock_type: obj.lock_type ?? '',
  has_hold_open: obj.has_hold_open ?? false,
  hold_open_manufacturer: obj.hold_open_manufacturer ?? '',
  hold_open_type: obj.hold_open_type ?? '',
  hold_open_approval_no: obj.hold_open_approval_no ?? '',
  hold_open_approval_date: obj.hold_open_approval_date ?? '',
  smoke_detector_count: obj.smoke_detector_count?.toString() ?? '0',
  smoke_detector_build_years: (() => {
    const raw = obj.smoke_detector_build_years
    const arr = Array.isArray(raw) ? raw.map((v) => String(v ?? '')) : []
    const count = obj.smoke_detector_count ?? 0
    return Array.from({ length: count }, (_, i) => arr[i] ?? '')
  })(),
  panic_function: obj.panic_function ?? '',
  accessories: obj.accessories ?? '',
  maintenance_by_manufacturer: obj.maintenance_by_manufacturer ?? false,
  hold_open_maintenance: obj.hold_open_maintenance ?? false,
  defects: obj.defects ?? '',
  remarks: obj.remarks ?? '',
  maintenance_interval_months: obj.maintenance_interval_months?.toString() ?? '',
})

type ObjectFormModalProps = {
  bvId: string
  object: Obj | null
  canEdit: boolean
  canDelete: boolean
  onClose: () => void
  onSuccess: () => void
}

const ObjectFormModal = ({
  bvId,
  object,
  canEdit,
  canDelete,
  onClose,
  onSuccess,
}: ObjectFormModalProps) => {
  const { showError } = useToast()
  const isEdit = !!object
  const [formData, setFormData] = useState<ObjectFormData>(
    object ? objToFormData(object) : { ...INITIAL_FORM, internal_id: `OBJ-${Date.now().toString(36).toUpperCase()}` }
  )
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [objectPhotos, setObjectPhotos] = useState<ObjectPhoto[]>([])
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [expandedPhoto, setExpandedPhoto] = useState<ObjectPhoto | null>(null)
  const [objectDocuments, setObjectDocuments] = useState<ObjectDocumentDisplay[]>([])
  const [isUploadingDocument, setIsUploadingDocument] = useState(false)
  const [documentUploadType, setDocumentUploadType] = useState<ObjectDocumentType>('zeichnung')
  const [documentUploadTitle, setDocumentUploadTitle] = useState('')
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    photo: ObjectPhoto | null
  }>({ open: false, photo: null })
  const [confirmDocumentDialog, setConfirmDocumentDialog] = useState<{
    open: boolean
    document: ObjectDocumentDisplay | null
  }>({ open: false, document: null })
  const editingId = object?.id ?? null

  useEffect(() => {
    if (!object) return
    fetchObjectPhotos(object.id).then(setObjectPhotos)
  }, [object?.id])

  useEffect(() => {
    if (!object) return
    fetchObjectDocuments(object.id).then(setObjectDocuments)
  }, [object?.id])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const handleFormChange = (field: keyof ObjectFormData, value: string | number | boolean) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'smoke_detector_count') {
        const count = parseInt(String(value), 10) || 0
        const buildYears = prev.smoke_detector_build_years
        next.smoke_detector_build_years = Array.from(
          { length: count },
          (_, i) => buildYears[i] ?? ''
        )
      }
      return next
    })
  }

  const handleSmokeDetectorBuildYearChange = (index: number, value: string) => {
    setFormData((prev) => {
      const next = [...prev.smoke_detector_build_years]
      next[index] = value
      return { ...prev, smoke_detector_build_years: next }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setIsSaving(true)
    const payload = {
      bv_id: bvId,
      name: formData.name.trim() || null,
      internal_id: formData.internal_id.trim() || null,
      door_position: formData.door_position.trim() || null,
      internal_door_number: formData.internal_door_number.trim() || null,
      floor: formData.floor.trim() || null,
      room: formData.room.trim() || null,
      type_tuer: formData.type_tuer,
      type_sektionaltor: formData.type_sektionaltor,
      type_schiebetor: formData.type_schiebetor,
      type_freitext: formData.type_freitext.trim() || null,
      wing_count: formData.wing_count ? parseInt(formData.wing_count, 10) : null,
      manufacturer: formData.manufacturer.trim() || null,
      build_year: formData.build_year.trim() || null,
      lock_manufacturer: formData.lock_manufacturer.trim() || null,
      lock_type: formData.lock_type.trim() || null,
      has_hold_open: formData.has_hold_open,
      hold_open_manufacturer: formData.hold_open_manufacturer.trim() || null,
      hold_open_type: formData.hold_open_type.trim() || null,
      hold_open_approval_no: formData.hold_open_approval_no.trim() || null,
      hold_open_approval_date: formData.hold_open_approval_date.trim() || null,
      smoke_detector_count: parseInt(formData.smoke_detector_count, 10) || 0,
      smoke_detector_build_years: formData.smoke_detector_build_years,
      panic_function: formData.panic_function.trim() || null,
      accessories: formData.accessories.trim() || null,
      maintenance_by_manufacturer: formData.maintenance_by_manufacturer,
      hold_open_maintenance: formData.hold_open_maintenance,
      defects: formData.defects.trim() || null,
      remarks: formData.remarks.trim() || null,
      maintenance_interval_months: formData.maintenance_interval_months.trim()
        ? parseInt(formData.maintenance_interval_months, 10) || null
        : null,
    }
    if (editingId) {
      const { error } = await updateObject(editingId, payload)
      if (error) {
        setFormError(getSupabaseErrorMessage(error))
        showError(getSupabaseErrorMessage(error))
      } else {
        onClose()
        onSuccess()
      }
    } else {
      const { error } = await createObject(payload)
      if (error) {
        setFormError(getSupabaseErrorMessage(error))
        showError(getSupabaseErrorMessage(error))
      } else {
        onClose()
        onSuccess()
      }
    }
    setIsSaving(false)
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingId || !e.target.files?.length) return
    setIsUploadingPhoto(true)
    for (const file of Array.from(e.target.files)) {
      const { data } = await uploadObjectPhoto(editingId, file)
      if (data) setObjectPhotos((prev) => [data, ...prev])
    }
    setIsUploadingPhoto(false)
    e.target.value = ''
  }

  const handlePhotoDelete = async (photo: ObjectPhoto) => {
    const { error } = await deleteObjectPhoto(photo.id, photo.storage_path)
    if (error) {
      showError(getSupabaseErrorMessage(error))
    } else {
      setObjectPhotos((prev) => prev.filter((p) => p.id !== photo.id))
    }
  }

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingId || !e.target.files?.length) return
    setIsUploadingDocument(true)
    for (const file of Array.from(e.target.files)) {
      const { data } = await uploadObjectDocument(editingId, file, documentUploadType, documentUploadTitle || undefined)
      if (data) setObjectDocuments((prev) => [data, ...prev])
    }
    setIsUploadingDocument(false)
    setDocumentUploadTitle('')
    e.target.value = ''
  }

  const handleDocumentDelete = async (doc: ObjectDocumentDisplay) => {
    const { error } = await deleteObjectDocument(doc.id, doc.storage_path)
    if (error) {
      showError(getSupabaseErrorMessage(error))
    } else {
      setObjectDocuments((prev) => prev.filter((d) => d.id !== doc.id))
    }
  }

  const getDocumentDisplayUrl = (doc: ObjectDocumentDisplay): string =>
    doc.localDataUrl ?? getObjectDocumentUrl(doc.storage_path)

  const DOCUMENT_TYPE_LABELS: Record<ObjectDocumentType, string> = {
    zeichnung: 'Zeichnung',
    zertifikat: 'Zertifikat',
    sonstiges: 'Sonstiges',
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
        onClick={onClose}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
        aria-label="Modal schließen"
      >
        <div
          className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          role="dialog"
          aria-modal
          onClick={(e) => e.stopPropagation()}
          aria-labelledby="object-form-title"
        >
          <div className="p-4 sticky top-0 bg-white border-b border-slate-200">
            <h3 id="object-form-title" className="text-lg font-bold text-slate-800">
              {isEdit ? 'Objekt bearbeiten' : 'Objekt anlegen'}
            </h3>
            {formData.internal_id && (
              <p className="mt-1 text-sm text-slate-600">
                Interne ID: <span className="font-mono">{formData.internal_id}</span>
              </p>
            )}
          </div>
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div>
              <label htmlFor="obj-name" className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input
                id="obj-name"
                type="text"
                value={formData.name}
                onChange={(e) => handleFormChange('name', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                placeholder="z. B. Haupteingang, Kellerzugang"
                aria-label="Objektname"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tür Position</label>
                <input
                  type="text"
                  value={formData.door_position}
                  onChange={(e) => handleFormChange('door_position', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Interne Türnr.</label>
                <input
                  type="text"
                  value={formData.internal_door_number}
                  onChange={(e) => handleFormChange('internal_door_number', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Etage</label>
                <input
                  type="text"
                  value={formData.floor}
                  onChange={(e) => handleFormChange('floor', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Raum</label>
                <input
                  type="text"
                  value={formData.room}
                  onChange={(e) => handleFormChange('room', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Art</label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2"><input type="checkbox" checked={formData.type_tuer} onChange={(e) => handleFormChange('type_tuer', e.target.checked)} /> Tür</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={formData.type_sektionaltor} onChange={(e) => handleFormChange('type_sektionaltor', e.target.checked)} /> Sektionaltor</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={formData.type_schiebetor} onChange={(e) => handleFormChange('type_schiebetor', e.target.checked)} /> Schiebetor</label>
              </div>
              <input
                type="text"
                placeholder="Freitext"
                value={formData.type_freitext}
                onChange={(e) => handleFormChange('type_freitext', e.target.value)}
                className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Flügelanzahl</label>
                <input
                  type="number"
                  min={0}
                  value={formData.wing_count}
                  onChange={(e) => handleFormChange('wing_count', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Hersteller</label>
                <input
                  type="text"
                  value={formData.manufacturer}
                  onChange={(e) => handleFormChange('manufacturer', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Baujahr</label>
                <input
                  type="text"
                  value={formData.build_year}
                  onChange={(e) => handleFormChange('build_year', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Schließmittel Hersteller</label>
                <input
                  type="text"
                  value={formData.lock_manufacturer}
                  onChange={(e) => handleFormChange('lock_manufacturer', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Schließmittel Typ</label>
                <input
                  type="text"
                  value={formData.lock_type}
                  onChange={(e) => handleFormChange('lock_type', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="flex items-center gap-2"><input type="checkbox" checked={formData.has_hold_open} onChange={(e) => handleFormChange('has_hold_open', e.target.checked)} /> Feststellanlage vorhanden</label>
              {formData.has_hold_open && (
                <div className="mt-2 grid grid-cols-2 gap-4">
                  <input type="text" placeholder="Hersteller" value={formData.hold_open_manufacturer} onChange={(e) => handleFormChange('hold_open_manufacturer', e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg" />
                  <input type="text" placeholder="Typ" value={formData.hold_open_type} onChange={(e) => handleFormChange('hold_open_type', e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg" />
                  <input type="text" placeholder="Zulassungsnr." value={formData.hold_open_approval_no} onChange={(e) => handleFormChange('hold_open_approval_no', e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg" />
                  <input type="text" placeholder="Abnahme am" value={formData.hold_open_approval_date} onChange={(e) => handleFormChange('hold_open_approval_date', e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rauchmelder Anzahl</label>
              <input
                type="number"
                min={0}
                value={formData.smoke_detector_count}
                onChange={(e) => handleFormChange('smoke_detector_count', e.target.value)}
                className="w-24 px-3 py-2 border border-slate-300 rounded-lg"
                aria-label="Rauchmelder Anzahl"
              />
              {(() => {
                const count = parseInt(formData.smoke_detector_count, 10) || 0
                return count > 0 ? (
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Array.from({ length: count }, (_, i) => (
                      <div key={i}>
                        <label htmlFor={`smoke-year-${i}`} className="block text-sm font-medium text-slate-700 mb-1">RM{i + 1} Baujahr</label>
                        <select
                          id={`smoke-year-${i}`}
                          value={formData.smoke_detector_build_years[i] ?? ''}
                          onChange={(e) => handleSmokeDetectorBuildYearChange(i, e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                          aria-label={`Rauchmelder ${i + 1} Baujahr`}
                        >
                          <option value="">–</option>
                          {YEAR_OPTIONS.map((y) => (
                            <option key={y} value={String(y)}>{y}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                ) : null
              })()}
            </div>
            <div>
              <label className="flex items-center gap-2"><input type="checkbox" checked={formData.maintenance_by_manufacturer} onChange={(e) => handleFormChange('maintenance_by_manufacturer', e.target.checked)} /> Wartung nach Herstellerangaben durchgeführt</label>
              {formData.has_hold_open && (
                <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={formData.hold_open_maintenance} onChange={(e) => handleFormChange('hold_open_maintenance', e.target.checked)} /> Feststellanlage Wartung nach Herstellerangaben</label>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Vorhandene Mängel</label>
                <textarea
                  value={formData.defects}
                  onChange={(e) => handleFormChange('defects', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Bemerkungen</label>
                <textarea
                  value={formData.remarks}
                  onChange={(e) => handleFormChange('remarks', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Wartungsintervall (Monate)</label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={formData.maintenance_interval_months}
                  onChange={(e) => handleFormChange('maintenance_interval_months', e.target.value)}
                  placeholder="z. B. 12 für jährlich"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  aria-label="Wartungsintervall in Monaten"
                />
                <p className="mt-1 text-xs text-slate-500">Leer = keine Erinnerung. Beispiel: 12 = jährliche Wartung.</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Panikfunktion / Zubehör</label>
              <input
                type="text"
                value={formData.panic_function}
                onChange={(e) => handleFormChange('panic_function', e.target.value)}
                placeholder="Panikfunktion"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-2"
              />
              <input
                type="text"
                value={formData.accessories}
                onChange={(e) => handleFormChange('accessories', e.target.value)}
                placeholder="Weiteres Zubehör"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            {editingId && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Fotos</label>
                {canEdit && (
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    disabled={isUploadingPhoto}
                    className="w-full text-sm text-slate-600 file:mr-2 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 disabled:opacity-50 mb-2"
                    aria-label="Objekt-Fotos hochladen"
                  />
                )}
                {isUploadingPhoto && <p className="text-xs text-slate-500 mb-2">Wird hochgeladen…</p>}
                {objectPhotos.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {objectPhotos.map((p) => (
                      <div key={p.id} className="relative group">
                        <button
                          type="button"
                          onClick={() => setExpandedPhoto(p)}
                          className="block w-20 h-20 rounded-lg border border-slate-200 overflow-hidden focus:outline-none focus:ring-2 focus:ring-vico-primary cursor-zoom-in"
                          aria-label="Foto vergrößern"
                        >
                          <img
                            src={getObjectPhotoDisplayUrl(p)}
                            loading="lazy"
                            alt={p.caption || 'Objekt-Foto'}
                            className="w-full h-full object-cover"
                          />
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDialog({ open: true, photo: p })
                            }
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="Foto löschen"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Keine Fotos vorhanden.</p>
                )}
              </div>
            )}
            {editingId && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Dokumente (Zeichnungen, Zertifikate)</label>
                {canEdit && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    <select
                      value={documentUploadType}
                      onChange={(e) => setDocumentUploadType(e.target.value as ObjectDocumentType)}
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      aria-label="Dokumenttyp"
                    >
                      <option value="zeichnung">Zeichnung</option>
                      <option value="zertifikat">Zertifikat</option>
                      <option value="sonstiges">Sonstiges</option>
                    </select>
                    <input
                      type="text"
                      value={documentUploadTitle}
                      onChange={(e) => setDocumentUploadTitle(e.target.value)}
                      placeholder="Titel (optional)"
                      className="flex-1 min-w-[120px] px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      aria-label="Dokumenttitel"
                    />
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      multiple
                      onChange={handleDocumentUpload}
                      disabled={isUploadingDocument}
                      className="text-sm text-slate-600 file:mr-2 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 disabled:opacity-50"
                      aria-label="Dokument hochladen"
                    />
                  </div>
                )}
                {isUploadingDocument && <p className="text-xs text-slate-500 mb-2">Wird hochgeladen…</p>}
                {objectDocuments.length > 0 ? (
                  <ul className="space-y-2">
                    {objectDocuments.map((doc) => (
                      <li
                        key={doc.id}
                        className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50 dark:bg-slate-800/50 dark:border-slate-700"
                      >
                        <span className="text-xs font-medium text-slate-500 w-20 shrink-0">
                          {DOCUMENT_TYPE_LABELS[doc.document_type]}
                        </span>
                        <a
                          href={getDocumentDisplayUrl(doc)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 text-sm text-vico-primary hover:underline truncate"
                          aria-label={`${doc.title || doc.file_name || 'Dokument'} öffnen`}
                        >
                          {doc.title || doc.file_name || 'Dokument'}
                        </a>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => setConfirmDocumentDialog({ open: true, document: doc })}
                            className="shrink-0 w-8 h-8 flex items-center justify-center text-red-600 hover:bg-red-50 rounded-lg"
                            aria-label="Dokument löschen"
                          >
                            ×
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400">Keine Dokumente vorhanden.</p>
                )}
              </div>
            )}
            {formError && (
              <div className="text-sm text-red-600">
                <p>{formError}</p>
                {formError.startsWith('RLS-Fehler') && (
                  <Link to="/einstellungen" className="mt-2 inline-block px-3 py-1.5 bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 text-xs font-medium">→ Zu Einstellungen (RLS-Fix)</Link>
                )}
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={isSaving} className="flex-1 py-2 bg-vico-button text-slate-800 rounded-lg hover:bg-vico-button-hover disabled:opacity-50 border border-slate-300">
                {isSaving ? 'Speichern...' : 'Speichern'}
              </button>
              <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">
                Abbrechen
              </button>
            </div>
          </form>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDialog.open}
        title="Foto löschen"
        message="Foto wirklich löschen?"
        confirmLabel="Löschen"
        variant="danger"
        onConfirm={() => {
          if (confirmDialog.photo) {
            handlePhotoDelete(confirmDialog.photo)
            setConfirmDialog({ open: false, photo: null })
          }
        }}
        onCancel={() => setConfirmDialog({ open: false, photo: null })}
      />

      <ConfirmDialog
        open={confirmDocumentDialog.open}
        title="Dokument löschen"
        message="Dokument wirklich löschen?"
        confirmLabel="Löschen"
        variant="danger"
        onConfirm={() => {
          if (confirmDocumentDialog.document) {
            handleDocumentDelete(confirmDocumentDialog.document)
            setConfirmDocumentDialog({ open: false, document: null })
          }
        }}
        onCancel={() => setConfirmDocumentDialog({ open: false, document: null })}
      />

      {expandedPhoto && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setExpandedPhoto(null)}
          onKeyDown={(e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') setExpandedPhoto(null) }}
          className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4 cursor-zoom-out"
          aria-label="Foto schließen"
        >
          <img
            src={getObjectPhotoDisplayUrl(expandedPhoto)}
            alt={expandedPhoto.caption || 'Objekt-Foto vergrößert'}
            className="max-w-full max-h-full object-contain rounded-lg shadow-xl"
          />
        </div>
      )}
    </>
  )
}

export default ObjectFormModal
