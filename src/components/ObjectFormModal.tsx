import { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '../ToastContext'
import { useComponentSettings } from '../ComponentSettingsContext'
import ConfirmDialog from './ConfirmDialog'
import CameraCaptureModal from './CameraCaptureModal'
import { getSupabaseErrorMessage } from '../supabaseErrors'
import { isOnline } from '../../shared/networkUtils'
import {
  createObject,
  updateObject,
  archiveObject,
  fetchObjectPhotos,
  uploadObjectPhoto,
  deleteObjectPhoto,
  getObjectPhotoDisplayUrl,
  getObjectPhotoUrl,
  setObjectProfilePhoto,
  removeObjectProfilePhoto,
  fetchObjectDocuments,
  uploadObjectDocument,
  deleteObjectDocument,
  getObjectDocumentUrl,
  fetchObjectDefectPhotosForDefect,
  uploadObjectDefectPhoto,
  deleteObjectDefectPhoto,
  getObjectDefectPhotoDisplayUrl,
  deleteAllObjectDefectPhotosForEntry,
  fetchProtocolOpenMangelsForListCounters,
  fetchProtocolOpenMangelsDraftForObject,
  fetchChecklistDefectPhotosGroupedForOrderObject,
  getMaintenancePhotoUrl,
} from '../lib/dataService'
import { fetchDoorFieldCatalog, type DoorFieldCatalog } from '../lib/doorFieldCatalog'
import { COMPONENT_KEY_DOOR_STAMMDATEN_AUSWAHL } from '../lib/componentSettingsService'
import type { Object as Obj, ObjectFormData, ObjectDocumentType, ObjectDefectPhotoDisplay } from '../types'
import type { ChecklistDefectPhoto } from '../types/maintenance'
import type { ProtocolOpenMangelRow } from '../lib/protocolOpenMangels'
import {
  defectEntriesFromObject,
  normalizeDefectEntriesForSave,
  openDefectsToLegacyText,
} from '../lib/objectDefects'
import { accessoriesFormLinesToPayload, objectAccessoriesToFormLines } from '../lib/objectUtils'
import type { ObjectDocumentDisplay, ObjectPhotoDisplay } from '../lib/dataService'

/** Lokale Galerie-Fotos vor dem ersten Speichern der Tür (Upload erst nach createObject) */
type PendingGalleryPhoto = {
  id: string
  file: File
  previewUrl: string
}

const PENDING_GALLERY_PREFIX = 'pending-gallery-'

const toPendingPhotoDisplay = (p: PendingGalleryPhoto): ObjectPhotoDisplay => ({
  id: p.id,
  object_id: '',
  storage_path: '',
  caption: null,
  created_at: new Date().toISOString(),
  localDataUrl: p.previewUrl,
})

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
  accessories_lines: [''],
  maintenance_by_manufacturer: false,
  hold_open_maintenance: false,
  defect_entries: [],
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
  accessories_lines: objectAccessoriesToFormLines(obj),
  maintenance_by_manufacturer: obj.maintenance_by_manufacturer ?? false,
  hold_open_maintenance: obj.hold_open_maintenance ?? false,
  defect_entries: defectEntriesFromObject(obj),
  remarks: obj.remarks ?? '',
  maintenance_interval_months: obj.maintenance_interval_months?.toString() ?? '',
})

type BvOption = { id: string; name: string | null }

type ObjectFormModalProps = {
  bvId?: string | null
  customerId?: string | null
  /** BVs des Kunden für das Zuordnungs-Dropdown (nur beim Bearbeiten) */
  customerBvs?: BvOption[] | null
  object: Obj | null
  canEdit: boolean
  canDelete: boolean
  /** §11.17: optional vom Parent (Kunden); sonst wird bei Bearbeitung online geladen */
  protocolOpenMangelRows?: ProtocolOpenMangelRow[]
  onClose: () => void
  onSuccess: () => void
}

const ObjectFormModal = ({
  bvId = null,
  customerId = null,
  customerBvs = null,
  object,
  canEdit,
  canDelete,
  protocolOpenMangelRows: protocolOpenMangelRowsProp,
  onClose,
  onSuccess,
}: ObjectFormModalProps) => {
  const effectiveBvId = bvId ?? object?.bv_id ?? null
  const effectiveCustomerId = customerId ?? object?.customer_id ?? null
  const { showError } = useToast()
  const { isEnabled } = useComponentSettings()
  const doorStammdatenListsEnabled = isEnabled(COMPONENT_KEY_DOOR_STAMMDATEN_AUSWAHL)
  const isEdit = !!object
  /** Zuordnung: null = direkt unter Kunde, string = BV-ID. Wenn Kunde Objekte/BV hat, darf nicht "direkt unter Kunde" gewählt werden. */
  const bvsList = useMemo(() => customerBvs ?? [], [customerBvs])
  const customerHasBvs = bvsList.length > 0
  const [assignmentBvId, setAssignmentBvId] = useState<string | null>(() => {
    if (effectiveBvId) return effectiveBvId
    if (bvsList.length > 0) return bvsList[0].id
    return null
  })
  useEffect(() => {
    if (!object) return
    if (effectiveBvId) setAssignmentBvId(effectiveBvId)
    else if (bvsList.length > 0) setAssignmentBvId(bvsList[0].id)
    else setAssignmentBvId(null)
  }, [object, object?.id, effectiveBvId, bvsList])
  const [formData, setFormData] = useState<ObjectFormData>(
    object ? objToFormData(object) : { ...INITIAL_FORM, internal_id: `OBJ-${Date.now().toString(36).toUpperCase()}` }
  )
  const [showResolvedDefects, setShowResolvedDefects] = useState(false)
  const [protocolRowsFetched, setProtocolRowsFetched] = useState<ProtocolOpenMangelRow[]>([])
  const [protocolPhotosByKey, setProtocolPhotosByKey] = useState<Record<string, ChecklistDefectPhoto[]>>({})
  const [protocolDraftRowsFetched, setProtocolDraftRowsFetched] = useState<ProtocolOpenMangelRow[]>([])
  const [protocolDraftPhotosByKey, setProtocolDraftPhotosByKey] = useState<
    Record<string, ChecklistDefectPhoto[]>
  >({})
  const [defectPanelExpanded, setDefectPanelExpanded] = useState(false)
  const [defectPhotosByEntryId, setDefectPhotosByEntryId] = useState<Record<string, ObjectDefectPhotoDisplay[]>>(
    {}
  )
  const [profilePhotoPathState, setProfilePhotoPathState] = useState<string | null>(
    object?.profile_photo_path?.trim() ?? null
  )
  const [pendingProfileFile, setPendingProfileFile] = useState<File | null>(null)
  const [pendingProfilePreviewUrl, setPendingProfilePreviewUrl] = useState<string | null>(null)
  const [isUploadingProfile, setIsUploadingProfile] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [objectPhotos, setObjectPhotos] = useState<ObjectPhotoDisplay[]>([])
  const [pendingGalleryPhotos, setPendingGalleryPhotos] = useState<PendingGalleryPhoto[]>([])
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [expandedPhoto, setExpandedPhoto] = useState<ObjectPhotoDisplay | null>(null)
  const [objectDocuments, setObjectDocuments] = useState<ObjectDocumentDisplay[]>([])
  const [isUploadingDocument, setIsUploadingDocument] = useState(false)
  const [documentUploadType, setDocumentUploadType] = useState<ObjectDocumentType>('zeichnung')
  const [documentUploadTitle, setDocumentUploadTitle] = useState('')
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    photo: ObjectPhotoDisplay | null
  }>({ open: false, photo: null })
  const [confirmDocumentDialog, setConfirmDocumentDialog] = useState<{
    open: boolean
    document: ObjectDocumentDisplay | null
  }>({ open: false, document: null })
  const [cameraTarget, setCameraTarget] = useState<'photo' | 'document' | 'profile' | null>(null)
  const [confirmProfileRemoveOpen, setConfirmProfileRemoveOpen] = useState(false)
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)
  const [doorCatalog, setDoorCatalog] = useState<DoorFieldCatalog>({
    door_manufacturers: [],
    lock_manufacturers: [],
    lock_types: [],
  })
  const [manufacturerUseFreeText, setManufacturerUseFreeText] = useState(true)
  const [lockManufacturerUseFreeText, setLockManufacturerUseFreeText] = useState(true)
  const [lockTypeUseFreeText, setLockTypeUseFreeText] = useState(true)
  /** Profil-Steuerung: öffnet per Klick auf Foto/Platzhalter im Kopfbereich */
  const [profilePanelOpen, setProfilePanelOpen] = useState(false)
  const pendingPreviewCleanupRef = useRef<string | null>(null)
  const editingId = object?.id ?? null
  pendingPreviewCleanupRef.current = pendingProfilePreviewUrl

  const pendingGalleryCleanupRef = useRef<PendingGalleryPhoto[]>([])
  useEffect(() => {
    pendingGalleryCleanupRef.current = pendingGalleryPhotos
  }, [pendingGalleryPhotos])

  useEffect(() => {
    return () => {
      pendingGalleryCleanupRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl))
    }
  }, [])

  const revokePendingGallery = (items: PendingGalleryPhoto[]) => {
    items.forEach((p) => URL.revokeObjectURL(p.previewUrl))
  }

  useEffect(() => {
    setShowResolvedDefects(false)
  }, [object?.id])

  useEffect(() => {
    if (object) {
      setFormData(objToFormData(object))
      setProfilePhotoPathState(object.profile_photo_path?.trim() ?? null)
      setPendingProfileFile(null)
      setPendingProfilePreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      setPendingGalleryPhotos((prev) => {
        revokePendingGallery(prev)
        return []
      })
    } else {
      setFormData({ ...INITIAL_FORM, internal_id: `OBJ-${Date.now().toString(36).toUpperCase()}` })
      setProfilePhotoPathState(null)
      setPendingProfileFile(null)
      setPendingProfilePreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      setPendingGalleryPhotos((prev) => {
        revokePendingGallery(prev)
        return []
      })
    }
    setProfilePanelOpen(false)
  }, [object?.id])

  useEffect(() => {
    if (!doorStammdatenListsEnabled) {
      setDoorCatalog({ door_manufacturers: [], lock_manufacturers: [], lock_types: [] })
      return
    }
    void fetchDoorFieldCatalog().then((c) => {
      setDoorCatalog(c)
      if (!object) {
        setManufacturerUseFreeText(c.door_manufacturers.length === 0)
        setLockManufacturerUseFreeText(c.lock_manufacturers.length === 0)
        setLockTypeUseFreeText(c.lock_types.length === 0)
        return
      }
      const fd = objToFormData(object)
      const m = fd.manufacturer.trim()
      const lm = fd.lock_manufacturer.trim()
      const lt = fd.lock_type.trim()
      setManufacturerUseFreeText(c.door_manufacturers.length === 0 || !c.door_manufacturers.includes(m))
      setLockManufacturerUseFreeText(c.lock_manufacturers.length === 0 || !c.lock_manufacturers.includes(lm))
      setLockTypeUseFreeText(c.lock_types.length === 0 || !c.lock_types.includes(lt))
    })
  }, [object?.id, doorStammdatenListsEnabled])

  useEffect(() => {
    return () => {
      const u = pendingPreviewCleanupRef.current
      if (u) URL.revokeObjectURL(u)
    }
  }, [])

  useEffect(() => {
    if (!object?.id) {
      setObjectPhotos([])
      return
    }
    fetchObjectPhotos(object.id).then((rows) => setObjectPhotos(rows))
  }, [object?.id])

  useEffect(() => {
    if (!object?.id) {
      setObjectDocuments([])
      return
    }
    fetchObjectDocuments(object.id).then(setObjectDocuments)
  }, [object?.id])

  useEffect(() => {
    if (object) {
      setDefectPanelExpanded(defectEntriesFromObject(object).length > 0)
    } else {
      setDefectPanelExpanded(false)
    }
  }, [object?.id])

  const protocolRowsEffective =
    protocolOpenMangelRowsProp !== undefined ? protocolOpenMangelRowsProp : protocolRowsFetched

  useEffect(() => {
    if (!object?.id) {
      setProtocolRowsFetched([])
      return
    }
    if (protocolOpenMangelRowsProp !== undefined) {
      setProtocolRowsFetched([])
      return
    }
    if (!isOnline()) {
      setProtocolRowsFetched([])
      return
    }
    let cancelled = false
    void fetchProtocolOpenMangelsForListCounters().then((d) => {
      if (cancelled) return
      setProtocolRowsFetched(d.rows.filter((r) => r.object_id === object.id))
    })
    return () => {
      cancelled = true
    }
  }, [object?.id, protocolOpenMangelRowsProp])

  useEffect(() => {
    if (!object?.id || !isEdit) {
      setProtocolDraftRowsFetched([])
      return
    }
    let cancelled = false
    void fetchProtocolOpenMangelsDraftForObject(object.id).then((rows) => {
      if (!cancelled) setProtocolDraftRowsFetched(rows)
    })
    return () => {
      cancelled = true
    }
  }, [object?.id, isEdit])

  const protocolPhotoOrderId = protocolRowsEffective[0]?.order_id ?? ''

  useEffect(() => {
    if (!object?.id || !protocolPhotoOrderId || !isOnline()) {
      setProtocolPhotosByKey({})
      return
    }
    let cancelled = false
    void fetchChecklistDefectPhotosGroupedForOrderObject(protocolPhotoOrderId, object.id).then((m) => {
      if (!cancelled) setProtocolPhotosByKey(m)
    })
    return () => {
      cancelled = true
    }
  }, [object?.id, protocolPhotoOrderId])

  const protocolDraftPhotoOrderId = protocolDraftRowsFetched[0]?.order_id ?? ''

  useEffect(() => {
    if (!object?.id || !protocolDraftPhotoOrderId || !isOnline()) {
      setProtocolDraftPhotosByKey({})
      return
    }
    let cancelled = false
    void fetchChecklistDefectPhotosGroupedForOrderObject(protocolDraftPhotoOrderId, object.id).then((m) => {
      if (!cancelled) setProtocolDraftPhotosByKey(m)
    })
    return () => {
      cancelled = true
    }
  }, [object?.id, protocolDraftPhotoOrderId])

  const defectEntryIdsKey = useMemo(
    () =>
      [...formData.defect_entries]
        .map((e) => e.id)
        .sort()
        .join('|'),
    [formData.defect_entries]
  )

  const galleryDisplayItems: ObjectPhotoDisplay[] = useMemo(
    () => [...pendingGalleryPhotos.map(toPendingPhotoDisplay), ...objectPhotos],
    [pendingGalleryPhotos, objectPhotos]
  )

  useEffect(() => {
    if (!object?.id) {
      setDefectPhotosByEntryId({})
      return
    }
    let cancelled = false
    ;(async () => {
      const next: Record<string, ObjectDefectPhotoDisplay[]> = {}
      for (const e of formData.defect_entries) {
        const photos = await fetchObjectDefectPhotosForDefect(object.id, e.id)
        if (cancelled) return
        next[e.id] = photos
      }
      if (!cancelled) setDefectPhotosByEntryId(next)
    })()
    return () => {
      cancelled = true
    }
  }, [object?.id, defectEntryIdsKey])

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
      if (field === 'has_hold_open' && value === false) {
        next.smoke_detector_count = '0'
        next.smoke_detector_build_years = []
      }
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

  const handleAddDefectEntry = () => {
    setDefectPanelExpanded(true)
    setFormData((prev) => ({
      ...prev,
      defect_entries: [
        ...prev.defect_entries,
        {
          id: crypto.randomUUID(),
          text: '',
          status: 'open',
          created_at: new Date().toISOString(),
          resolved_at: null,
        },
      ],
    }))
  }

  const handleDefectPhotoInputChange = async (entryId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !object?.id) return
    const { data, error } = await uploadObjectDefectPhoto({
      objectId: object.id,
      defectEntryId: entryId,
      file,
    })
    if (error) {
      showError(error.message)
      return
    }
    if (data) {
      setDefectPhotosByEntryId((prev) => ({
        ...prev,
        [entryId]: [...(prev[entryId] ?? []), data],
      }))
    }
  }

  const handleRemoveDefectPhoto = async (entryId: string, photo: ObjectDefectPhotoDisplay) => {
    const { error } = await deleteObjectDefectPhoto(photo.id, photo.storage_path || null)
    if (error) {
      showError(error.message)
      return
    }
    setDefectPhotosByEntryId((prev) => ({
      ...prev,
      [entryId]: (prev[entryId] ?? []).filter((p) => p.id !== photo.id),
    }))
  }

  const handleDefectTextChange = (id: string, text: string) => {
    setFormData((prev) => ({
      ...prev,
      defect_entries: prev.defect_entries.map((e) => (e.id === id ? { ...e, text } : e)),
    }))
  }

  const handleMarkDefectResolved = (id: string) => {
    const now = new Date().toISOString()
    setFormData((prev) => ({
      ...prev,
      defect_entries: prev.defect_entries.map((e) =>
        e.id === id && e.status === 'open'
          ? { ...e, status: 'resolved' as const, resolved_at: now }
          : e
      ),
    }))
  }

  const handleReopenDefect = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      defect_entries: prev.defect_entries.map((e) =>
        e.id === id && e.status === 'resolved'
          ? { ...e, status: 'open' as const, resolved_at: null }
          : e
      ),
    }))
  }

  const handleAccessoryLineChange = (index: number, value: string) => {
    setFormData((prev) => {
      const next = [...prev.accessories_lines]
      next[index] = value
      return { ...prev, accessories_lines: next }
    })
  }

  const handleAddAccessoryLine = () => {
    setFormData((prev) => ({ ...prev, accessories_lines: [...prev.accessories_lines, ''] }))
  }

  const handleRemoveAccessoryLine = (index: number) => {
    setFormData((prev) => {
      if (prev.accessories_lines.length <= 1) return { ...prev, accessories_lines: [''] }
      return {
        ...prev,
        accessories_lines: prev.accessories_lines.filter((_, i) => i !== index),
      }
    })
  }

  const handleClearPendingProfile = () => {
    setPendingProfileFile(null)
    setPendingProfilePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }

  const applyProfileFile = async (file: File): Promise<boolean> => {
    if (!file.type.startsWith('image/')) return false
    if (!isOnline()) {
      showError('Profilfoto ist nur online speicherbar.')
      return false
    }
    if (editingId) {
      setIsUploadingProfile(true)
      const { path, error } = await setObjectProfilePhoto(editingId, file)
      setIsUploadingProfile(false)
      if (error) {
        showError(getSupabaseErrorMessage(error))
        return false
      }
      if (path) setProfilePhotoPathState(path)
      return true
    }
    setPendingProfilePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
    setPendingProfileFile(file)
    return true
  }

  const handleProfileFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    await applyProfileFile(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (editingId && customerHasBvs && !assignmentBvId) {
      setFormError('Bitte ein Objekt/BV auswählen. Wenn Objekte/BV vorhanden sind, muss die Tür einem zugeordnet sein.')
      return
    }
    const defectNorm = normalizeDefectEntriesForSave(formData.defect_entries)
    if (editingId && object) {
      const prevEntries = defectEntriesFromObject(object)
      const nextIds = new Set(defectNorm.map((e) => e.id))
      for (const e of prevEntries) {
        if (!nextIds.has(e.id)) {
          const { error: phErr } = await deleteAllObjectDefectPhotosForEntry(editingId, e.id)
          if (phErr) {
            setFormError(phErr.message)
            showError(phErr.message)
            return
          }
        }
      }
    }
    setIsSaving(true)
    const payload = {
      bv_id: assignmentBvId,
      customer_id: assignmentBvId ? null : effectiveCustomerId,
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
      hold_open_manufacturer: formData.has_hold_open ? formData.hold_open_manufacturer.trim() || null : null,
      hold_open_type: formData.has_hold_open ? formData.hold_open_type.trim() || null : null,
      hold_open_approval_no: formData.has_hold_open ? formData.hold_open_approval_no.trim() || null : null,
      hold_open_approval_date: formData.has_hold_open ? formData.hold_open_approval_date.trim() || null : null,
      smoke_detector_count: formData.has_hold_open ? parseInt(formData.smoke_detector_count, 10) || 0 : 0,
      smoke_detector_build_years: formData.has_hold_open ? formData.smoke_detector_build_years : [],
      panic_function: formData.panic_function.trim() || null,
      ...accessoriesFormLinesToPayload(formData.accessories_lines),
      maintenance_by_manufacturer: false,
      hold_open_maintenance: false,
      defects: openDefectsToLegacyText(defectNorm),
      defects_structured: defectNorm,
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
      if (pendingProfileFile && !isOnline()) {
        const msg =
          'Profilfoto ist nur online speicherbar. Bitte Verbindung herstellen oder die Foto-Auswahl aufheben.'
        setFormError(msg)
        showError(msg)
        setIsSaving(false)
        return
      }
      const { data: newRow, error } = await createObject(payload)
      if (error) {
        setFormError(getSupabaseErrorMessage(error))
        showError(getSupabaseErrorMessage(error))
      } else {
        if (pendingProfileFile && newRow?.id) {
          const { error: photoErr } = await setObjectProfilePhoto(newRow.id, pendingProfileFile)
          if (photoErr) {
            showError(`Tür/Tor wurde angelegt. Profilfoto: ${getSupabaseErrorMessage(photoErr)}`)
          }
          handleClearPendingProfile()
        }
        if (newRow?.id && pendingGalleryPhotos.length > 0) {
          let firstPhotoErr: string | null = null
          for (const pg of pendingGalleryPhotos) {
            const { error: upErr } = await uploadObjectPhoto(newRow.id, pg.file)
            URL.revokeObjectURL(pg.previewUrl)
            if (upErr && !firstPhotoErr) firstPhotoErr = upErr.message
          }
          setPendingGalleryPhotos([])
          if (firstPhotoErr) {
            showError(`Tür/Tor wurde angelegt. Galerie-Fotos: ${firstPhotoErr}`)
          }
        }
        onClose()
        onSuccess()
      }
    }
    setIsSaving(false)
  }

  const runPhotoUploadForFiles = async (files: File[]): Promise<boolean> => {
    if (files.length === 0) return false
    if (!editingId) {
      setIsUploadingPhoto(true)
      const imageFiles = files.filter((f) => f.type.startsWith('image/'))
      if (imageFiles.length < files.length) {
        showError('Nur Bilddateien sind erlaubt.')
      }
      for (const file of imageFiles) {
        const previewUrl = URL.createObjectURL(file)
        const id = `${PENDING_GALLERY_PREFIX}${crypto.randomUUID()}`
        setPendingGalleryPhotos((prev) => [...prev, { id, file, previewUrl }])
      }
      setIsUploadingPhoto(false)
      return imageFiles.length > 0
    }
    setIsUploadingPhoto(true)
    let allOk = true
    for (const file of files) {
      const { data, error } = await uploadObjectPhoto(editingId, file)
      if (error) {
        showError(getSupabaseErrorMessage(error))
        allOk = false
        break
      }
      if (data) setObjectPhotos((prev) => [data, ...prev])
    }
    setIsUploadingPhoto(false)
    return allOk
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return
    await runPhotoUploadForFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  const handlePhotoDelete = async (photo: ObjectPhotoDisplay) => {
    if (photo.id.startsWith(PENDING_GALLERY_PREFIX)) {
      setPendingGalleryPhotos((prev) => {
        const found = prev.find((p) => p.id === photo.id)
        if (found) URL.revokeObjectURL(found.previewUrl)
        return prev.filter((p) => p.id !== photo.id)
      })
      setExpandedPhoto((ex) => (ex?.id === photo.id ? null : ex))
      return
    }
    const { error } = await deleteObjectPhoto(photo.id, photo.storage_path)
    if (error) {
      showError(getSupabaseErrorMessage(error))
    } else {
      setObjectPhotos((prev) => prev.filter((p) => p.id !== photo.id))
    }
  }

  const runDocumentUploadForFile = async (file: File): Promise<boolean> => {
    if (!editingId) return false
    setIsUploadingDocument(true)
    const { data, error } = await uploadObjectDocument(
      editingId,
      file,
      documentUploadType,
      documentUploadTitle || undefined
    )
    setIsUploadingDocument(false)
    if (error) {
      showError(getSupabaseErrorMessage(error))
      return false
    }
    if (data) setObjectDocuments((prev) => [data, ...prev])
    return true
  }

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingId || !e.target.files?.length) return
    for (const file of Array.from(e.target.files)) {
      const ok = await runDocumentUploadForFile(file)
      if (!ok) break
    }
    setDocumentUploadTitle('')
    e.target.value = ''
  }

  const handleCameraCapture = async (file: File): Promise<boolean> => {
    if (cameraTarget === 'profile') {
      return applyProfileFile(file)
    }
    if (cameraTarget === 'photo') return runPhotoUploadForFiles([file])
    if (cameraTarget === 'document') {
      const ok = await runDocumentUploadForFile(file)
      if (ok) setDocumentUploadTitle('')
      return ok
    }
    return false
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

  const profileThumbSrc = profilePhotoPathState?.trim()
    ? getObjectPhotoUrl(profilePhotoPathState.trim())
    : pendingProfilePreviewUrl
  const hasProfileThumb = Boolean(profileThumbSrc)

  const handleProfileHeaderKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setProfilePanelOpen((v) => !v)
    }
  }

  const profileEditorBody = (
    <>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Optional. Erscheint in der Kundenübersicht neben dieser Tür, sofern hinterlegt.
      </p>
      {(profilePhotoPathState || pendingProfilePreviewUrl) && canEdit ? (
        <div className="flex flex-wrap items-center gap-2">
          {profilePhotoPathState && editingId ? (
            <button
              type="button"
              onClick={() => setConfirmProfileRemoveOpen(true)}
              disabled={isUploadingProfile}
              className="px-3 py-2 text-sm min-h-[40px] rounded-lg border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
              aria-label="Profilfoto entfernen"
            >
              Profilfoto entfernen
            </button>
          ) : null}
          {pendingProfilePreviewUrl && !editingId ? (
            <button
              type="button"
              onClick={handleClearPendingProfile}
              className="px-3 py-2 text-sm min-h-[40px] rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50"
              aria-label="Profilfoto-Auswahl aufheben"
            >
              Auswahl aufheben
            </button>
          ) : null}
        </div>
      ) : null}
      {canEdit ? (
        <div className="flex flex-col sm:flex-row flex-wrap gap-2">
          <input
            type="file"
            accept="image/*"
            onChange={handleProfileFileInputChange}
            disabled={isUploadingProfile || (!!editingId && !isOnline())}
            className="flex-1 min-w-0 text-sm text-slate-600 dark:text-slate-300 file:mr-2 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-100 dark:file:bg-slate-700 file:text-slate-700 dark:file:text-slate-200 hover:file:bg-slate-200 dark:hover:file:bg-slate-600 disabled:opacity-50"
            aria-label="Profilfoto aus Datei wählen"
          />
          <button
            type="button"
            onClick={() => setCameraTarget('profile')}
            disabled={isUploadingProfile || (!!editingId && !isOnline())}
            className="shrink-0 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-vico-primary focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            aria-label="Profilfoto mit Kamera aufnehmen"
          >
            Foto aufnehmen
          </button>
        </div>
      ) : null}
      {isUploadingProfile ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">Profilfoto wird verarbeitet…</p>
      ) : null}
      {editingId && !isOnline() ? (
        <p className="text-xs text-amber-700 dark:text-amber-300/90">
          Profilfoto ändern ist nur mit Internetverbindung möglich.
        </p>
      ) : null}
    </>
  )

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto overscroll-contain"
        style={{ padding: 'max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left))' }}
        onClick={onClose}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
        aria-label="Modal schließen"
      >
        <div
          className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-2xl w-full min-w-0 my-auto max-h-[min(90vh,90dvh)] overflow-y-auto text-slate-900 dark:text-slate-100"
          role="dialog"
          aria-modal
          onClick={(e) => e.stopPropagation()}
          aria-labelledby="object-form-title"
        >
          <div className="p-4 sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-600">
            <h3 id="object-form-title" className="text-lg font-bold text-slate-800 dark:text-slate-100">
              {isEdit ? 'Tür/Tor bearbeiten' : 'Tür/Tor anlegen'}
            </h3>
            <div className="mt-2 flex flex-row items-center justify-between gap-3 min-w-0">
              <div className="min-w-0 flex-1">
                {formData.internal_id ? (
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Interne ID:{' '}
                    <span className="font-mono break-all">{formData.internal_id}</span>
                  </p>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Interne ID wird beim ersten Speichern vergeben.</p>
                )}
              </div>
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => setProfilePanelOpen((v) => !v)}
                  onKeyDown={handleProfileHeaderKeyDown}
                  className={`shrink-0 rounded-lg border overflow-hidden focus:outline-none focus:ring-2 focus:ring-vico-primary focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
                    profilePanelOpen
                      ? 'border-vico-primary ring-2 ring-vico-primary/30'
                      : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                  }`}
                  aria-expanded={profilePanelOpen}
                  aria-controls="object-profile-panel"
                  aria-label={hasProfileThumb ? 'Profilfoto ändern, Panel ein- oder ausblenden' : 'Profilfoto hinterlegen, Panel ein- oder ausblenden'}
                >
                  {hasProfileThumb && profileThumbSrc ? (
                    <img
                      src={profileThumbSrc}
                      alt=""
                      className="w-14 h-14 sm:w-16 sm:h-16 object-cover block"
                    />
                  ) : (
                    <div
                      className="w-14 h-14 sm:w-16 sm:h-16 bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400"
                      aria-hidden
                    >
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    </div>
                  )}
                </button>
              ) : (
                <div className="shrink-0 rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden" aria-hidden={!hasProfileThumb}>
                  {hasProfileThumb && profileThumbSrc ? (
                    <img src={profileThumbSrc} alt="Profilfoto" className="w-14 h-14 sm:w-16 sm:h-16 object-cover block" />
                  ) : (
                    <div className="w-14 h-14 sm:w-16 sm:h-16 bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {profilePanelOpen && canEdit ? (
            <div
              id="object-profile-panel"
              role="region"
              aria-label="Profilfoto bearbeiten"
              className="px-4 py-3 border-b border-slate-200 dark:border-slate-600 bg-slate-50/90 dark:bg-slate-800/80 space-y-2"
            >
              {profileEditorBody}
              <button
                type="button"
                onClick={() => setProfilePanelOpen(false)}
                className="mt-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50"
              >
                Fertig
              </button>
            </div>
          ) : null}
          <form onSubmit={handleSubmit} className="p-4 space-y-4 min-w-0">
            {isEdit && effectiveCustomerId != null && customerBvs !== undefined && (
              <div>
                <label htmlFor="obj-assignment" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Zuordnung
                </label>
                <select
                  id="obj-assignment"
                  value={assignmentBvId ?? ''}
                  onChange={(e) => setAssignmentBvId(e.target.value || null)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  aria-label="Tür/Tor zuordnen zu Objekt/BV oder direkt unter Kunde"
                  disabled={!canEdit}
                >
                  {!customerHasBvs && <option value="">Direkt unter Kunde</option>}
                  {bvsList.map((bv) => (
                    <option key={bv.id} value={bv.id}>
                      {bv.name ?? bv.id}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {customerHasBvs
                    ? 'Wenn Objekte/BV vorhanden sind, muss jede Tür einem Objekt/BV zugeordnet sein.'
                    : 'Protokolle, Fotos und Dokumente bleiben der Tür zugeordnet.'}
                </p>
              </div>
            )}
            <div>
              <label htmlFor="obj-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
              <input
                id="obj-name"
                type="text"
                value={formData.name}
                onChange={(e) => handleFormChange('name', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                placeholder="z. B. Haupteingang, Kellerzugang"
                aria-label="Bezeichnung Tür oder Tor"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="min-w-0">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tür Position</label>
                <input
                  type="text"
                  value={formData.door_position}
                  onChange={(e) => handleFormChange('door_position', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="min-w-0">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Interne Türnr.</label>
                <input
                  type="text"
                  value={formData.internal_door_number}
                  onChange={(e) => handleFormChange('internal_door_number', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="min-w-0">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Etage</label>
                <input
                  type="text"
                  value={formData.floor}
                  onChange={(e) => handleFormChange('floor', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="min-w-0">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Raum</label>
                <input
                  type="text"
                  value={formData.room}
                  onChange={(e) => handleFormChange('room', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Art</label>
              <div className="flex flex-wrap gap-4 text-slate-800 dark:text-slate-200">
                <label className="flex items-center gap-2"><input type="checkbox" checked={formData.type_tuer} onChange={(e) => handleFormChange('type_tuer', e.target.checked)} /> Tür</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={formData.type_sektionaltor} onChange={(e) => handleFormChange('type_sektionaltor', e.target.checked)} /> Sektionaltor</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={formData.type_schiebetor} onChange={(e) => handleFormChange('type_schiebetor', e.target.checked)} /> Schiebetor</label>
              </div>
              <input
                type="text"
                placeholder="Freitext"
                value={formData.type_freitext}
                onChange={(e) => handleFormChange('type_freitext', e.target.value)}
                className="mt-2 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="min-w-0">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Flügelanzahl</label>
                <input
                  type="number"
                  min={0}
                  value={formData.wing_count}
                  onChange={(e) => handleFormChange('wing_count', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Hersteller</label>
                  {doorStammdatenListsEnabled && doorCatalog.door_manufacturers.length > 0 ? (
                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={manufacturerUseFreeText}
                        onChange={(e) => setManufacturerUseFreeText(e.target.checked)}
                        className="rounded border-slate-400 dark:border-slate-500 text-vico-primary focus:ring-vico-primary"
                      />
                      Freitext
                    </label>
                  ) : null}
                </div>
                {!doorStammdatenListsEnabled ||
                manufacturerUseFreeText ||
                doorCatalog.door_manufacturers.length === 0 ? (
                  <input
                    type="text"
                    value={formData.manufacturer}
                    onChange={(e) => handleFormChange('manufacturer', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                ) : (
                  <select
                    value={formData.manufacturer}
                    onChange={(e) => handleFormChange('manufacturer', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    aria-label="Hersteller aus Liste"
                  >
                    <option value="">— Bitte wählen —</option>
                    {doorCatalog.door_manufacturers.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="min-w-0">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Baujahr</label>
                <input
                  type="text"
                  value={formData.build_year}
                  onChange={(e) => handleFormChange('build_year', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Schließmittel Hersteller</label>
                  {doorStammdatenListsEnabled && doorCatalog.lock_manufacturers.length > 0 ? (
                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={lockManufacturerUseFreeText}
                        onChange={(e) => setLockManufacturerUseFreeText(e.target.checked)}
                        className="rounded border-slate-400 dark:border-slate-500 text-vico-primary focus:ring-vico-primary"
                      />
                      Freitext
                    </label>
                  ) : null}
                </div>
                {!doorStammdatenListsEnabled ||
                lockManufacturerUseFreeText ||
                doorCatalog.lock_manufacturers.length === 0 ? (
                  <input
                    type="text"
                    value={formData.lock_manufacturer}
                    onChange={(e) => handleFormChange('lock_manufacturer', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                ) : (
                  <select
                    value={formData.lock_manufacturer}
                    onChange={(e) => handleFormChange('lock_manufacturer', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    aria-label="Schließmittel Hersteller aus Liste"
                  >
                    <option value="">— Bitte wählen —</option>
                    {doorCatalog.lock_manufacturers.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Schließmittel Typ</label>
                  {doorStammdatenListsEnabled && doorCatalog.lock_types.length > 0 ? (
                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={lockTypeUseFreeText}
                        onChange={(e) => setLockTypeUseFreeText(e.target.checked)}
                        className="rounded border-slate-400 dark:border-slate-500 text-vico-primary focus:ring-vico-primary"
                      />
                      Freitext
                    </label>
                  ) : null}
                </div>
                {!doorStammdatenListsEnabled || lockTypeUseFreeText || doorCatalog.lock_types.length === 0 ? (
                  <input
                    type="text"
                    value={formData.lock_type}
                    onChange={(e) => handleFormChange('lock_type', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                ) : (
                  <select
                    value={formData.lock_type}
                    onChange={(e) => handleFormChange('lock_type', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    aria-label="Schließmittel Typ aus Liste"
                  >
                    <option value="">— Bitte wählen —</option>
                    {doorCatalog.lock_types.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div>
              <label className="flex items-center gap-2 text-slate-800 dark:text-slate-200"><input type="checkbox" checked={formData.has_hold_open} onChange={(e) => handleFormChange('has_hold_open', e.target.checked)} /> Feststellanlage vorhanden</label>
              {formData.has_hold_open && (
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input type="text" placeholder="Hersteller" value={formData.hold_open_manufacturer} onChange={(e) => handleFormChange('hold_open_manufacturer', e.target.value)} className="w-full min-w-0 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" />
                  <input type="text" placeholder="Typ" value={formData.hold_open_type} onChange={(e) => handleFormChange('hold_open_type', e.target.value)} className="w-full min-w-0 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" />
                  <input type="text" placeholder="Zulassungsnr." value={formData.hold_open_approval_no} onChange={(e) => handleFormChange('hold_open_approval_no', e.target.value)} className="w-full min-w-0 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" />
                  <input type="text" placeholder="Abnahme am" value={formData.hold_open_approval_date} onChange={(e) => handleFormChange('hold_open_approval_date', e.target.value)} className="w-full min-w-0 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" />
                </div>
              )}
            </div>
            {formData.has_hold_open ? (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Rauchmelder Anzahl
                </label>
                <input
                  type="number"
                  min={0}
                  value={formData.smoke_detector_count}
                  onChange={(e) => handleFormChange('smoke_detector_count', e.target.value)}
                  className="w-24 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  aria-label="Rauchmelder Anzahl"
                />
                {(() => {
                  const count = parseInt(formData.smoke_detector_count, 10) || 0
                  return count > 0 ? (
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {Array.from({ length: count }, (_, i) => (
                        <div key={i}>
                          <label htmlFor={`smoke-year-${i}`} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            RM{i + 1} Baujahr
                          </label>
                          <select
                            id={`smoke-year-${i}`}
                            value={formData.smoke_detector_build_years[i] ?? ''}
                            onChange={(e) => handleSmokeDetectorBuildYearChange(i, e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                            aria-label={`Rauchmelder ${i + 1} Baujahr`}
                          >
                            <option value="">–</option>
                            {YEAR_OPTIONS.map((y) => (
                              <option key={y} value={String(y)}>
                                {y}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  ) : null
                })()}
              </div>
            ) : null}
            {isEdit && protocolRowsEffective.length > 0 ? (
              <div className="rounded-lg border border-rose-200 dark:border-rose-900/45 bg-rose-50/50 dark:bg-rose-950/25 p-4 space-y-3">
                <h3 className="text-sm font-medium text-slate-800 dark:text-slate-100">Offene Mängel (Prüfprotokoll)</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Aus dem letzten abgeschlossenen Wartungsauftrag mit gespeicherter Checkliste. Änderung durch erneute
                  Wartung mit geändertem Prüfstand.
                </p>
                <ul className="space-y-3" aria-label="Offene Protokoll-Mängel">
                  {[...protocolRowsEffective]
                    .sort((a, b) => {
                      if (a.source === b.source) return 0
                      return a.source === 'tuer' ? -1 : 1
                    })
                    .map((row) => {
                      const photoKey = `${row.source === 'feststell' ? 'feststell' : 'door'}:${row.item_id}`
                      const thumbs = protocolPhotosByKey[photoKey] ?? []
                      const sourceLabel = row.source === 'feststell' ? 'Feststell' : 'Tür'
                      const dateLabel =
                        row.established_on && /^\d{4}-\d{2}-\d{2}/.test(row.established_on)
                          ? new Date(row.established_on.slice(0, 10) + 'T12:00:00').toLocaleDateString('de-DE')
                          : row.established_on || '—'
                      return (
                        <li
                          key={`${row.source}-${row.item_id}-${row.order_id}`}
                          className="rounded-lg border border-rose-100 dark:border-rose-900/40 bg-white/90 dark:bg-slate-900/60 px-3 py-2 space-y-2"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-rose-100 text-rose-900 dark:bg-rose-900/50 dark:text-rose-100">
                              {sourceLabel}
                            </span>
                            <time className="text-xs text-slate-500 dark:text-slate-400" dateTime={row.established_on}>
                              {dateLabel}
                            </time>
                            <Link
                              to={`/auftrag/${row.order_id}`}
                              className="text-xs font-medium text-vico-primary hover:underline dark:text-sky-400"
                              aria-label="Zum abgeschlossenen Wartungsauftrag (Protokoll)"
                            >
                              Zum Auftrag
                            </Link>
                          </div>
                          <p className="text-sm text-slate-800 dark:text-slate-100">
                            <span className="text-slate-500 dark:text-slate-400">{row.section_title}</span>
                            {row.section_title ? ' · ' : ''}
                            {row.label}
                          </p>
                          {row.note ? (
                            <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{row.note}</p>
                          ) : null}
                          {thumbs.length > 0 ? (
                            <div className="flex flex-wrap gap-2" aria-label="Fotos zum Mangel">
                              {thumbs.map((ph) => (
                                <a
                                  key={ph.id}
                                  href={getMaintenancePhotoUrl(ph.storage_path)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block shrink-0 rounded-md border border-slate-200 dark:border-slate-600 overflow-hidden focus:outline-none focus:ring-2 focus:ring-vico-primary"
                                  aria-label={ph.caption ? `Foto: ${ph.caption}` : 'Foto vergrößern'}
                                >
                                  <img
                                    src={getMaintenancePhotoUrl(ph.storage_path)}
                                    alt={ph.caption || ''}
                                    className="w-14 h-14 object-cover"
                                    loading="lazy"
                                  />
                                </a>
                              ))}
                            </div>
                          ) : null}
                        </li>
                      )
                    })}
                </ul>
              </div>
            ) : null}
            {isEdit && protocolDraftRowsFetched.length > 0 ? (
              <div className="rounded-lg border border-sky-200 dark:border-sky-800/60 bg-sky-50/60 dark:bg-sky-950/30 p-4 space-y-3">
                <h3 className="text-sm font-medium text-slate-800 dark:text-slate-100">
                  Entwurf (laufender Wartungsauftrag)
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Gespeicherter Prüfstand am noch nicht abgeschlossenen Auftrag. Er beeinflusst nicht die
                  Kundenliste / Zähler; maßgeblich bleibt der letzte abgeschlossene Wartungsbericht (siehe oben).
                </p>
                <ul className="space-y-3" aria-label="Protokoll-Mängel Entwurf laufender Auftrag">
                  {[...protocolDraftRowsFetched]
                    .sort((a, b) => {
                      if (a.source === b.source) return 0
                      return a.source === 'tuer' ? -1 : 1
                    })
                    .map((row) => {
                      const photoKey = `${row.source === 'feststell' ? 'feststell' : 'door'}:${row.item_id}`
                      const thumbs = protocolDraftPhotosByKey[photoKey] ?? []
                      const sourceLabel = row.source === 'feststell' ? 'Feststell' : 'Tür'
                      const dateLabel =
                        row.established_on && /^\d{4}-\d{2}-\d{2}/.test(row.established_on)
                          ? new Date(row.established_on.slice(0, 10) + 'T12:00:00').toLocaleDateString('de-DE')
                          : row.established_on || '—'
                      return (
                        <li
                          key={`draft-${row.source}-${row.item_id}-${row.order_id}`}
                          className="rounded-lg border border-sky-100 dark:border-sky-900/50 bg-white/90 dark:bg-slate-900/60 px-3 py-2 space-y-2"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-sky-100 text-sky-900 dark:bg-sky-900/50 dark:text-sky-100">
                              {sourceLabel}
                            </span>
                            <time className="text-xs text-slate-500 dark:text-slate-400" dateTime={row.established_on}>
                              {dateLabel}
                            </time>
                            <Link
                              to={`/auftrag/${row.order_id}`}
                              className="text-xs font-medium text-vico-primary hover:underline dark:text-sky-400"
                              aria-label="Zum laufenden Wartungsauftrag"
                            >
                              Zum Auftrag
                            </Link>
                          </div>
                          <p className="text-sm text-slate-800 dark:text-slate-100">
                            <span className="text-slate-500 dark:text-slate-400">{row.section_title}</span>
                            {row.section_title ? ' · ' : ''}
                            {row.label}
                          </p>
                          {row.note ? (
                            <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{row.note}</p>
                          ) : null}
                          {thumbs.length > 0 ? (
                            <div className="flex flex-wrap gap-2" aria-label="Fotos zum Mangel Entwurf">
                              {thumbs.map((ph) => (
                                <a
                                  key={ph.id}
                                  href={getMaintenancePhotoUrl(ph.storage_path)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block shrink-0 rounded-md border border-slate-200 dark:border-slate-600 overflow-hidden focus:outline-none focus:ring-2 focus:ring-vico-primary"
                                  aria-label={ph.caption ? `Foto: ${ph.caption}` : 'Foto vergrößern'}
                                >
                                  <img
                                    src={getMaintenancePhotoUrl(ph.storage_path)}
                                    alt={ph.caption || ''}
                                    className="w-14 h-14 object-cover"
                                    loading="lazy"
                                  />
                                </a>
                              ))}
                            </div>
                          ) : null}
                        </li>
                      )
                    })}
                </ul>
              </div>
            ) : null}
            {canEdit && formData.defect_entries.length === 0 && !defectPanelExpanded ? (
              <div className="py-1">
                <button
                  type="button"
                  onClick={() => setDefectPanelExpanded(true)}
                  className="text-sm font-medium text-vico-primary hover:underline dark:text-sky-400"
                  aria-label="Stammdaten-Mängel hinzufügen"
                >
                  + Mangel hinzufügen (Stammdaten)
                </button>
              </div>
            ) : null}
            {formData.defect_entries.length > 0 || defectPanelExpanded || !canEdit ? (
              <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-900/40 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100">Mängel (Stammdaten)</span>
                  <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showResolvedDefects}
                      onChange={(e) => setShowResolvedDefects(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-600"
                      aria-label="Erledigte Mängel anzeigen"
                    />
                    Erledigte Mängel anzeigen
                  </label>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Offene Mängel sind immer sichtbar. Erledigte werden nicht gelöscht und können hier wieder geöffnet
                  werden. Maximal 3 Fotos pro offenem Mangel (nach Speichern der Tür online oder bei Sync).
                </p>
                <ul className="space-y-3" aria-label="Liste Stammdaten-Mängel">
                  {(() => {
                    const open = formData.defect_entries.filter((e) => e.status === 'open')
                    const resolved = formData.defect_entries.filter((e) => e.status === 'resolved')
                    const rows = [...open, ...(showResolvedDefects ? resolved : [])]
                    if (rows.length === 0) {
                      return (
                        <li className="text-sm text-slate-500 dark:text-slate-400 py-2">Keine offenen Mängel erfasst.</li>
                      )
                    }
                    return rows.map((entry) => {
                      const photos = defectPhotosByEntryId[entry.id] ?? []
                      const canAddPhotos =
                        Boolean(canEdit && object?.id && entry.status === 'open' && photos.length < 3)
                      return (
                        <li
                          key={entry.id}
                          className={`rounded-lg border px-3 py-2 space-y-2 ${
                            entry.status === 'resolved'
                              ? 'border-slate-200 dark:border-slate-600 bg-white/70 dark:bg-slate-800/50 opacity-90'
                              : 'border-amber-200 dark:border-amber-900/50 bg-white dark:bg-slate-800'
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`text-xs font-medium px-2 py-0.5 rounded ${
                                entry.status === 'open'
                                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100'
                                  : 'bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-100'
                              }`}
                            >
                              {entry.status === 'open' ? 'Offen' : 'Erledigt'}
                            </span>
                            {entry.status === 'resolved' && entry.resolved_at ? (
                              <time
                                className="text-xs text-slate-500 dark:text-slate-400"
                                dateTime={entry.resolved_at}
                              >
                                Erledigt{' '}
                                {new Date(entry.resolved_at).toLocaleString('de-DE', {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                })}
                              </time>
                            ) : null}
                          </div>
                          <textarea
                            value={entry.text}
                            onChange={(e) => handleDefectTextChange(entry.id, e.target.value)}
                            disabled={!canEdit || entry.status === 'resolved'}
                            rows={entry.text.length > 120 ? 4 : 2}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 disabled:opacity-80 disabled:cursor-not-allowed"
                            aria-label={entry.status === 'open' ? 'Mangelbeschreibung' : 'Mangelbeschreibung (erledigt)'}
                          />
                          {photos.length > 0 ? (
                            <ul className="flex flex-wrap gap-2 list-none p-0 m-0" aria-label="Mangel-Fotos">
                              {photos.map((ph) => (
                                <li key={ph.id} className="relative group">
                                  <img
                                    src={getObjectDefectPhotoDisplayUrl(ph)}
                                    alt=""
                                    className="h-20 w-20 object-cover rounded-lg border border-slate-200 dark:border-slate-600"
                                  />
                                  {canEdit && entry.status === 'open' ? (
                                    <button
                                      type="button"
                                      onClick={() => void handleRemoveDefectPhoto(entry.id, ph)}
                                      className="absolute -top-1 -right-1 rounded-full bg-red-600 text-white text-xs w-6 h-6 leading-6 opacity-90 hover:opacity-100"
                                      aria-label="Foto entfernen"
                                    >
                                      ×
                                    </button>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          {canAddPhotos ? (
                            <div>
                              <label className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer inline-flex items-center gap-2">
                                <span className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800">
                                  Foto hinzufügen
                                </span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="sr-only"
                                  aria-label={`Foto zu Mangel hinzufügen, ${photos.length} von 3`}
                                  onChange={(ev) => void handleDefectPhotoInputChange(entry.id, ev)}
                                />
                              </label>
                            </div>
                          ) : null}
                          {!object?.id && entry.status === 'open' && canEdit ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Fotos sind verfügbar, sobald die Tür gespeichert wurde.
                            </p>
                          ) : null}
                          {canEdit ? (
                            <div className="flex flex-wrap gap-2">
                              {entry.status === 'open' ? (
                                <button
                                  type="button"
                                  onClick={() => handleMarkDefectResolved(entry.id)}
                                  disabled={!entry.text.trim()}
                                  className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                                  aria-label="Mangel als erledigt markieren"
                                >
                                  Als erledigt markieren
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleReopenDefect(entry.id)}
                                  className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                                  aria-label="Mangel wieder öffnen"
                                >
                                  Wieder öffnen
                                </button>
                              )}
                            </div>
                          ) : null}
                        </li>
                      )
                    })
                  })()}
                </ul>
                {canEdit ? (
                  <button
                    type="button"
                    onClick={handleAddDefectEntry}
                    className="text-sm font-medium text-vico-primary hover:underline dark:text-sky-400"
                    aria-label="Weiteren Mangel hinzufügen"
                  >
                    + Mangel hinzufügen
                  </button>
                ) : null}
              </div>
            ) : null}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="min-w-0">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Bemerkungen</label>
                <textarea
                  value={formData.remarks}
                  onChange={(e) => handleFormChange('remarks', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  rows={2}
                />
              </div>
              <div className="min-w-0">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Wartungsintervall (Monate)</label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={formData.maintenance_interval_months}
                  onChange={(e) => handleFormChange('maintenance_interval_months', e.target.value)}
                  placeholder="z. B. 12 für jährlich"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  aria-label="Wartungsintervall in Monaten"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Leer = keine Erinnerung. Beispiel: 12 = jährliche Wartung.</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Panikfunktion / Zubehör</label>
              <input
                type="text"
                value={formData.panic_function}
                onChange={(e) => handleFormChange('panic_function', e.target.value)}
                placeholder="Panikfunktion"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg mb-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
              <div className="space-y-2" role="group" aria-label="Weiteres Zubehör">
                {formData.accessories_lines.map((line, index) => (
                  <div key={index} className="flex gap-2 items-center min-w-0">
                    <input
                      type="text"
                      value={line}
                      onChange={(e) => handleAccessoryLineChange(index, e.target.value)}
                      placeholder={`Zubehör ${index + 1}`}
                      className="flex-1 min-w-0 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                      aria-label={`Weiteres Zubehör, Zeile ${index + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveAccessoryLine(index)}
                      disabled={formData.accessories_lines.length <= 1}
                      className="shrink-0 px-2 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label={`Zubehörzeile ${index + 1} entfernen`}
                    >
                      Entfernen
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddAccessoryLine}
                  className="text-sm text-vico-primary hover:underline font-medium"
                  aria-label="Weitere Zubehörzeile hinzufügen"
                >
                  + Weiteres Zubehör
                </button>
              </div>
            </div>
            {(editingId || !isEdit) && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Fotos</label>
                {!isEdit ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                    Bilder können schon jetzt ausgewählt werden; sie werden direkt nach dem Speichern der Tür/Tor
                    hochgeladen (offline: werden mit synchronisiert).
                  </p>
                ) : null}
                {canEdit && (
                  <div className="flex flex-col sm:flex-row flex-wrap gap-2 mb-2">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotoUpload}
                      disabled={isUploadingPhoto}
                      className="flex-1 min-w-0 text-sm text-slate-600 dark:text-slate-300 file:mr-2 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-100 dark:file:bg-slate-700 file:text-slate-700 dark:file:text-slate-200 hover:file:bg-slate-200 dark:hover:file:bg-slate-600 disabled:opacity-50"
                      aria-label="Objekt-Fotos aus Dateien wählen"
                    />
                    <button
                      type="button"
                      onClick={() => setCameraTarget('photo')}
                      disabled={isUploadingPhoto}
                      className="shrink-0 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-vico-primary focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                      aria-label="Foto mit Kamera aufnehmen"
                    >
                      Foto aufnehmen
                    </button>
                  </div>
                )}
                {isUploadingPhoto && <p className="text-xs text-slate-500 mb-2">Wird verarbeitet…</p>}
                {galleryDisplayItems.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {galleryDisplayItems.map((p) => (
                      <div key={p.id} className="relative group">
                        <button
                          type="button"
                          onClick={() => setExpandedPhoto(p)}
                          className="block w-20 h-20 rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden focus:outline-none focus:ring-2 focus:ring-vico-primary cursor-zoom-in"
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
                  <p className="text-xs text-slate-500 dark:text-slate-400">Keine Fotos vorhanden.</p>
                )}
              </div>
            )}
            {editingId && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                  Dokumente zur Tür / zum Tor (Zeichnungen, Zertifikate)
                </label>
                {canEdit && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    <select
                      value={documentUploadType}
                      onChange={(e) => setDocumentUploadType(e.target.value as ObjectDocumentType)}
                      className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
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
                      className="flex-1 min-w-[120px] px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400"
                      aria-label="Dokumenttitel"
                    />
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      multiple
                      onChange={handleDocumentUpload}
                      disabled={isUploadingDocument}
                      className="flex-1 min-w-[140px] text-sm text-slate-600 dark:text-slate-300 file:mr-2 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-100 dark:file:bg-slate-700 file:text-slate-700 dark:file:text-slate-200 hover:file:bg-slate-200 dark:hover:file:bg-slate-600 disabled:opacity-50"
                      aria-label="Dokument aus Datei hochladen"
                    />
                    <button
                      type="button"
                      onClick={() => setCameraTarget('document')}
                      disabled={isUploadingDocument}
                      className="shrink-0 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-vico-primary focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                      aria-label="Dokument als Foto mit Kamera aufnehmen"
                    >
                      Foto aufnehmen
                    </button>
                  </div>
                )}
                {isUploadingDocument && <p className="text-xs text-slate-500 mb-2">Wird hochgeladen…</p>}
                {objectDocuments.length > 0 ? (
                  <ul className="space-y-2">
                    {objectDocuments.map((doc) => (
                      <li
                        key={doc.id}
                        className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-800"
                      >
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 w-20 shrink-0">
                          {DOCUMENT_TYPE_LABELS[doc.document_type]}
                        </span>
                        <a
                          href={getDocumentDisplayUrl(doc)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 text-sm font-medium text-vico-primary dark:text-sky-300 hover:underline truncate"
                          aria-label={`${doc.title || doc.file_name || 'Dokument'} öffnen`}
                        >
                          {doc.title || doc.file_name || 'Dokument'}
                        </a>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => setConfirmDocumentDialog({ open: true, document: doc })}
                            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/70 focus:outline-none focus:ring-2 focus:ring-red-400/60"
                            aria-label="Dokument löschen"
                          >
                            ×
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">Keine Dokumente vorhanden.</p>
                )}
              </div>
            )}
            {formError && (
              <div className="text-sm text-red-600 dark:text-red-400">
                <p>{formError}</p>
                {formError.startsWith('RLS-Fehler') && (
                  <Link to="/einstellungen" className="mt-2 inline-block px-3 py-1.5 bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900 text-xs font-medium">→ Zu Einstellungen (RLS-Fix)</Link>
                )}
              </div>
            )}
            <div className="flex flex-col gap-2 pt-2">
              <div className="flex flex-nowrap gap-2 items-center">
                <button type="submit" disabled={isSaving || isArchiving} className="flex-1 min-w-0 py-2 bg-vico-button dark:bg-vico-primary text-slate-800 dark:text-white rounded-lg hover:bg-vico-button-hover dark:hover:opacity-90 disabled:opacity-50 border border-slate-300 dark:border-slate-600">
                  {isSaving ? 'Speichern...' : 'Speichern'}
                </button>
                <button type="button" onClick={onClose} disabled={isArchiving} className="shrink-0 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50">
                  Abbrechen
                </button>
              </div>
              {isEdit && canDelete && (
                <button
                  type="button"
                  disabled={isSaving || isArchiving}
                  onClick={() => setConfirmArchiveOpen(true)}
                  className="w-full py-2 text-sm text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/40 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-400/60 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                  aria-label="Tür oder Tor archivieren"
                >
                  Archivieren (aus Listen ausblenden, Historie bleibt)
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      <CameraCaptureModal
        open={cameraTarget !== null}
        onClose={() => setCameraTarget(null)}
        onCapture={handleCameraCapture}
        title={
          cameraTarget === 'document'
            ? 'Dokument fotografieren (JPEG)'
            : cameraTarget === 'profile'
              ? 'Profilfoto aufnehmen'
              : 'Foto für Tür/Tor aufnehmen'
        }
      />

      <ConfirmDialog
        open={confirmArchiveOpen}
        title="Tür/Tor archivieren"
        message="Dieses Tür/Tor aus den Stammdaten ausblenden? Wartungsprotokolle und Aufträge bleiben erhalten. Wiederherstellen eines ganzen Kunden: Kunden → Archiv. Einzelne Tür: in der Datenbank archived_at leeren (wenn der Kunde nicht archiviert ist)."
        confirmLabel="Archivieren"
        variant="danger"
        onConfirm={async () => {
          if (!editingId) {
            setConfirmArchiveOpen(false)
            return
          }
          setIsArchiving(true)
          const { error } = await archiveObject(editingId)
          setIsArchiving(false)
          setConfirmArchiveOpen(false)
          if (error) {
            showError(getSupabaseErrorMessage(error))
            return
          }
          onSuccess()
          onClose()
        }}
        onCancel={() => setConfirmArchiveOpen(false)}
      />

      <ConfirmDialog
        open={confirmProfileRemoveOpen}
        title="Profilfoto entfernen"
        message="Profilfoto wirklich entfernen?"
        confirmLabel="Entfernen"
        variant="danger"
        onConfirm={async () => {
          if (!editingId || !profilePhotoPathState) {
            setConfirmProfileRemoveOpen(false)
            return
          }
          setIsUploadingProfile(true)
          const { error } = await removeObjectProfilePhoto(editingId, profilePhotoPathState)
          setIsUploadingProfile(false)
          setConfirmProfileRemoveOpen(false)
          if (error) {
            showError(getSupabaseErrorMessage(error))
            return
          }
          setProfilePhotoPathState(null)
        }}
        onCancel={() => setConfirmProfileRemoveOpen(false)}
      />

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
            alt={expandedPhoto.caption || 'Tür/Tor-Foto vergrößert'}
            className="max-w-full max-h-full object-contain rounded-lg shadow-xl"
          />
        </div>
      )}
    </>
  )
}

export default ObjectFormModal
