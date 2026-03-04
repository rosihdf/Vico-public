import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { getSupabaseErrorMessage } from './supabaseErrors'
import {
  fetchCustomer,
  fetchBv,
  fetchObjects,
  createObject,
  updateObject,
  deleteObject,
  subscribeToDataChange,
  fetchObjectPhotos,
  uploadObjectPhoto,
  deleteObjectPhoto,
  getObjectPhotoDisplayUrl,
} from './lib/dataService'
import ObjectQRCodeModal from './ObjectQRCodeModal'
import { useComponentSettings } from './ComponentSettingsContext'
import type { Object as Obj, ObjectFormData, BV, Customer, ObjectPhoto } from './types'

const INITIAL_FORM: ObjectFormData = {
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

const Objekte = () => {
  const { customerId, bvId } = useParams<{ customerId: string; bvId: string }>()
  const { userRole } = useAuth()
  const { isEnabled } = useComponentSettings()
  const canEdit = userRole !== 'leser'
  const [searchParams, setSearchParams] = useSearchParams()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [bv, setBv] = useState<BV | null>(null)
  const [objects, setObjects] = useState<Obj[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<ObjectFormData>(INITIAL_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [qrObject, setQrObject] = useState<Obj | null>(null)
  const [objectPhotos, setObjectPhotos] = useState<ObjectPhoto[]>([])
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)

  const loadData = useCallback(async () => {
    if (!customerId || !bvId) return
    setIsLoading(true)
    const [cust, bvData, objData] = await Promise.all([
      fetchCustomer(customerId),
      fetchBv(bvId),
      fetchObjects(bvId),
    ])
    setCustomer(cust)
    setBv(bvData)
    setObjects(objData ?? [])
    setIsLoading(false)
  }, [customerId, bvId])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    return subscribeToDataChange(loadData)
  }, [loadData])

  const objectIdFromUrl = searchParams.get('objectId')
  useEffect(() => {
    if (!objectIdFromUrl || !objects.length || showForm) return
    const obj = objects.find((o) => o.id === objectIdFromUrl)
    if (obj) {
      fetchObjectPhotos(obj.id).then(setObjectPhotos)
      setFormData({
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
      setEditingId(obj.id)
      setFormError(null)
      setShowForm(true)
      setSearchParams({}, { replace: true })
    }
  }, [objectIdFromUrl, objects, showForm, setSearchParams])

  useEffect(() => {
    if (!showForm) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCloseForm()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [showForm])

  const filteredObjects = useMemo(
    () =>
      objects.filter(
        (o) =>
          (o.internal_id ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (o.room ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [objects, searchQuery]
  )

  const handleOpenCreate = () => {
    setFormData({ ...INITIAL_FORM, internal_id: `OBJ-${Date.now().toString(36).toUpperCase()}` })
    setEditingId(null)
    setFormError(null)
    setObjectPhotos([])
    setShowForm(true)
  }

  const handleOpenEdit = async (obj: Obj) => {
    const photos = await fetchObjectPhotos(obj.id)
    setObjectPhotos(photos)
    setFormData({
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
    setEditingId(obj.id)
    setFormError(null)
    setShowForm(true)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormError(null)
  }

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
    if (!bvId) return
    setIsSaving(true)
    const payload = {
      bv_id: bvId,
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
      if (error) setFormError(getSupabaseErrorMessage(error))
      else {
        handleCloseForm()
        loadData()
      }
    } else {
      const { error } = await createObject(payload)
      if (error) setFormError(getSupabaseErrorMessage(error))
      else {
        handleCloseForm()
        loadData()
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
    if (!window.confirm('Foto wirklich löschen?')) return
    const { error } = await deleteObjectPhoto(photo.id, photo.storage_path)
    if (!error) setObjectPhotos((prev) => prev.filter((p) => p.id !== photo.id))
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Objekt wirklich löschen?')) return
    const { error } = await deleteObject(id)
    if (!error) loadData()
  }

  if (!bvId || !customerId) {
    return (
      <div className="p-4">
        <p className="text-slate-600">Ungültige Navigation.</p>
        <Link to="/kunden" className="text-vico-primary hover:underline mt-2 inline-block">← Kunden</Link>
      </div>
    )
  }

  if (!bv || !customer) {
    return <div className="p-4"><p className="text-slate-600">Lade...</p></div>
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center gap-2 text-sm text-slate-600">
        <Link to="/kunden" className="hover:text-slate-800">Kunden</Link>
        <span>/</span>
        <Link to={`/kunden/${customerId}/bvs`} className="hover:text-slate-800">{customer.name}</Link>
        <span>/</span>
        <span className="font-medium text-slate-800">{bv.name}</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <h2 className="text-xl font-bold text-slate-800">Objekte</h2>
        <div className="flex gap-2">
          <input
            type="search"
            placeholder="Objekte suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 sm:w-48 px-3 py-2 border border-slate-300 rounded-lg text-sm"
            aria-label="Objekte suchen"
          />
          {canEdit && (
            <button type="button" onClick={handleOpenCreate} className="px-4 py-2 bg-vico-button text-slate-800 rounded-lg hover:bg-vico-button-hover font-medium border border-slate-300">
              + Neu
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-8 h-8 border-2 border-vico-primary border-t-transparent rounded-full animate-spin" role="status" aria-label="Lade Objekte" />
          <p className="text-slate-600 text-sm">Lade Objekte…</p>
        </div>
      ) : filteredObjects.length === 0 ? (
        <p className="text-slate-600 py-8 text-center">
          {searchQuery ? 'Keine Objekte gefunden.' : 'Noch keine Objekte angelegt.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {filteredObjects.map((obj) => (
            <li key={obj.id} className="bg-white rounded-lg border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="font-medium text-slate-800">{obj.internal_id || '–'}</p>
                <p className="text-sm text-slate-500">
                  {[obj.room, obj.floor].filter(Boolean).join(' · ') || obj.manufacturer || '–'}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {isEnabled('wartungsprotokolle') && (
                  <Link
                    to={`/kunden/${customerId}/bvs/${bvId}/objekte/${obj.id}/wartung`}
                    className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
                    aria-label="Wartungsprotokolle anzeigen"
                  >
                    Wartung
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => setQrObject(obj)}
                  className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
                  aria-label="QR-Code anzeigen"
                >
                  QR-Code
                </button>
                {canEdit && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(obj)}
                      className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
                      aria-label={`Objekt ${obj.internal_id || obj.id} bearbeiten`}
                    >
                      Bearbeiten
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(obj.id)}
                      className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                      aria-label={`Objekt ${obj.internal_id || obj.id} löschen`}
                    >
                      Löschen
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={handleCloseForm}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
            <div className="p-4 sticky top-0 bg-white border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">{editingId ? 'Objekt bearbeiten' : 'Objekt anlegen'}</h3>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Interne ID</label>
                  <input
                    type="text"
                    value={formData.internal_id}
                    onChange={(e) => handleFormChange('internal_id', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    readOnly={!!editingId}
                  />
                </div>
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
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            RM{i + 1} Baujahr
                          </label>
                          <input
                            type="text"
                            value={formData.smoke_detector_build_years[i] ?? ''}
                            onChange={(e) => handleSmokeDetectorBuildYearChange(i, e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                            placeholder="z.B. 2020"
                            aria-label={`Rauchmelder ${i + 1} Baujahr`}
                          />
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
                          <img
                            src={getObjectPhotoDisplayUrl(p)}
                            alt={p.caption || 'Objekt-Foto'}
                            className="w-20 h-20 object-cover rounded-lg border border-slate-200"
                          />
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => handlePhotoDelete(p)}
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
                <button type="button" onClick={handleCloseForm} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {qrObject && customer && bv && customerId && bvId && (
        <ObjectQRCodeModal
          object={qrObject}
          customerName={customer.name}
          bvName={bv.name}
          customerId={customerId}
          bvId={bvId}
          onClose={() => setQrObject(null)}
        />
      )}
    </div>
  )
}

export default Objekte
