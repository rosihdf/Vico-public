import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../AuthContext'
import { useToast } from '../ToastContext'
import { isMandantSupabaseEnvConfigured } from '../supabase'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { AltberichtExpertEmbeddedImagesPanel } from '../components/altberichtImport/AltberichtExpertEmbeddedImagesPanel'
import { AltberichtStagingReviewRowEditor } from '../components/altberichtImport/AltberichtStagingReviewRowEditor'
import { fetchAllBvs, fetchAllObjects, fetchCustomers } from '../lib/dataService'
import type { Customer } from '../types/customer'
import type { BV } from '../types/bv'
import type { Object as Obj } from '../types/object'
import {
  applyAltberichtJobReviewCustomerBvDefaults,
  commitAltberichtC1Job,
  commitAltberichtC1StagingRow,
  commitAltberichtC2DefectsForStagingRow,
  createAltberichtImportJobWithPdfUploads,
  fetchAltberichtImportEventsForJob,
  fetchAltberichtEmbeddedImagesForJob,
  fetchAltberichtImportFilesForJob,
  fetchAltberichtImportStagingForJob,
  isAltberichtStagingRowC2Eligible,
  isAltberichtStagingRowCommitEligible,
  listAltberichtC2FindingRows,
  listAltberichtSoftDuplicateHints,
  listAltberichtImportJobs,
  patchAltberichtStagingReview,
  persistAltberichtMatchCandidatesForStaging,
  recomputeAltberichtStagingReviewForJob,
  recomputeAltberichtStagingReviewRow,
  deleteAltberichtImportJob,
  runAltberichtImportParseForFile,
  runAltberichtImportParseJobSequential,
} from '../lib/altberichtImport'
import { buildC1PositionCompare } from '../lib/altberichtImport/altberichtImportC1CompareReport'
import { fetchObjectsByIdsForCompare } from '../lib/altberichtImport/altberichtImportQueryService'
import type {
  AltberichtC1RowCommitOverrides,
  AltberichtC1RowCommitResult,
  AltberichtC2CommitItem,
  AltberichtImportEmbeddedImageRow,
  AltberichtImportEventRow,
  AltberichtImportFileRow,
  AltberichtImportJobRow,
  AltberichtImportStagingObjectRow,
  AltberichtStagingReviewPatch,
} from '../lib/altberichtImport'

type StagingFilter =
  | 'all'
  | 'needs_input'
  | 'blocked'
  | 'ready'
  | 'skipped'
  | 'open_validation'
  | 'committed'
  | 'commit_failed'

type ImportViewMode = 'standard' | 'expert'

type QuickEditDraft = {
  customerMode: 'existing' | 'new'
  newCustomerName: string
  review_customer_id: string
  bvMode: 'existing' | 'new'
  newBvName: string
  review_bv_id: string
  review_object_name: string
  review_object_type_text: string
  review_floor_text: string
  review_room_text: string
}

type StandardBulkTarget = 'all' | 'selected' | 'single'

type StandardRunResult = {
  c1Imported: number
  c1Failed: number
  c1Skipped: number
  c2ImportedRows: number
  c2ImportedItems: number
}

type StandardRowEval = {
  missingCodes: string[]
  blockingMissingCodes: string[]
  optionalMissingCodes: string[]
  isCommitted: boolean
  isDeferred: boolean
  hasLocalNewDraft: boolean
  isDirty: boolean
  isCommitReady: boolean
  showInStep3: boolean
  statusLabel: string
  statusTone: string
}

const suggestedBvNameFromRow = (row: AltberichtImportStagingObjectRow): string =>
  row.site_text?.trim() || ''

/** Reine Ziffernfolge (z. B. Parser-Müll „1“) nicht als BV-Bezeichnung ausgeben. */
const isLikelyRawNumericIdLabel = (s: string): boolean => /^[0-9]+$/.test(s.trim())

/**
 * DAU: verständlicher BV-Text — nie rohe IDs; Lookup kann fehlen oder Namen sein unbrauchbar.
 */
const resolveStandardBvDisplayLabel = (
  row: AltberichtImportStagingObjectRow,
  draft: QuickEditDraft | undefined,
  allBvs: BV[]
): string => {
  const bvIdStr =
    draft?.bvMode === 'existing'
      ? (draft.review_bv_id.trim() || row.review_bv_id || row.bv_id || '').trim() || null
      : (row.review_bv_id ?? row.bv_id ?? '').trim() || null

  if (bvIdStr) {
    const bv = allBvs.find((b) => b.id === bvIdStr)
    const n = bv?.name?.trim()
    if (n && !isLikelyRawNumericIdLabel(n)) return n
  }
  if (draft?.bvMode === 'new' && draft.newBvName.trim()) return draft.newBvName.trim()
  const site = row.site_text?.trim()
  if (site) return site
  return 'Nicht zugeordnet'
}

const buildNewCustomerOverride = (name: string): NonNullable<AltberichtC1RowCommitOverrides['newCustomer']> => ({
  name,
  street: null,
  house_number: null,
  postal_code: null,
  city: null,
  email: null,
  phone: null,
  contact_name: null,
  contact_email: null,
  contact_phone: null,
  maintenance_report_email: false,
  maintenance_report_email_address: null,
  maintenance_report_portal: false,
  monteur_report_internal_only: false,
  monteur_report_portal: false,
  demo_user_id: null,
  archived_at: null,
})

const buildNewBvOverride = (
  name: string,
  customerId?: string
): NonNullable<AltberichtC1RowCommitOverrides['newBv']> => ({
  name,
  customer_id: customerId,
  street: null,
  house_number: null,
  postal_code: null,
  city: null,
  email: null,
  phone: null,
  contact_name: null,
  contact_email: null,
  contact_phone: null,
  maintenance_report_email: false,
  maintenance_report_email_address: null,
  uses_customer_report_delivery: true,
  maintenance_report_portal: false,
  monteur_report_portal: false,
  monteur_report_internal_only: false,
  archived_at: null,
})

const humanMissingFieldLabel = (code: string): string => {
  switch (code) {
    case 'missing_customer':
      return 'Kunde auswählen'
    case 'missing_bv':
      return 'Bauvorhaben auswählen'
    case 'missing_object_name':
      return 'Objektname ergänzen'
    case 'missing_object_type':
      return 'Objekttyp ergänzen'
    case 'missing_location':
      return 'Etage oder Raum ergänzen'
    default:
      return 'Angaben ergänzen'
  }
}

const deriveStandardMissingCodes = (
  row: AltberichtImportStagingObjectRow,
  allBvs: BV[],
  draft?: QuickEditDraft
): string[] => {
  const codes = new Set(extractMissingCodes(row).filter((c) => c.startsWith('missing_')))
  const effectiveBvId =
    draft?.bvMode === 'existing'
      ? draft.review_bv_id.trim()
      : ((row.review_bv_id ?? row.bv_id ?? '').trim())
  const effectiveCustomerId =
    draft?.customerMode === 'existing'
      ? draft.review_customer_id.trim()
      : (row.review_customer_id ?? '').trim()
  const bvCustomerId =
    effectiveBvId && allBvs.find((b) => b.id === effectiveBvId)?.customer_id
      ? String(allBvs.find((b) => b.id === effectiveBvId)?.customer_id)
      : ''
  const hasPreparedNewCustomer = Boolean(draft?.customerMode === 'new' && draft.newCustomerName.trim())
  const hasPreparedNewBv = Boolean(draft?.bvMode === 'new' && draft.newBvName.trim())

  if (!effectiveCustomerId && !bvCustomerId && !hasPreparedNewCustomer) {
    codes.add('missing_customer')
  } else {
    codes.delete('missing_customer')
  }
  // DAU: BV optional — dient nur Stück-2/optional-Hinweisen, nicht blockierender Pflicht
  if (!effectiveBvId && !hasPreparedNewBv) {
    codes.add('missing_bv')
  } else {
    codes.delete('missing_bv')
  }
  return Array.from(codes)
}

const buildStandardRowOverridesMap = (
  rows: AltberichtImportStagingObjectRow[],
  quickEdits: Record<string, QuickEditDraft>
): Record<string, AltberichtC1RowCommitOverrides> => {
  const out: Record<string, AltberichtC1RowCommitOverrides> = {}
  for (const row of rows) {
    const d = quickEdits[row.id]
    if (!d) continue
    if (d.customerMode === 'new' && d.newCustomerName.trim()) {
      out[row.id] = {
        ...(out[row.id] ?? {}),
        newCustomer: buildNewCustomerOverride(d.newCustomerName.trim()),
      }
    }
    if (d.bvMode === 'new' && d.newBvName.trim()) {
      out[row.id] = {
        ...(out[row.id] ?? {}),
        newBv: buildNewBvOverride(
          d.newBvName.trim(),
          d.customerMode === 'existing' && d.review_customer_id.trim()
            ? d.review_customer_id.trim()
            : undefined
        ),
      }
    }
  }
  return out
}

const evaluateStandardRow = (params: {
  row: AltberichtImportStagingObjectRow
  draft?: QuickEditDraft
  allBvs: BV[]
  isDirty: boolean
  override?: AltberichtC1RowCommitOverrides
}): StandardRowEval => {
  const { row, draft, allBvs, isDirty, override } = params
  const rs = row.review_status ?? 'draft'
  const missingCodes = deriveStandardMissingCodes(row, allBvs, draft)
  const blockingMissingCodes = missingCodes.filter((c) => c === 'missing_customer')
  const optionalMissingCodes = missingCodes.filter((c) => c !== 'missing_customer')
  const isCommitted = Boolean(row.committed_at) || rs === 'committed'
  const isDeferred = rs === 'blocked' || rs === 'skipped'
  const hasLocalNewDraft = Boolean(draft && draft.customerMode === 'new')
  const isCommitReady =
    !isCommitted &&
    !isDeferred &&
    !isDirty &&
    blockingMissingCodes.length === 0 &&
    isAltberichtStagingRowCommitEligible(row, { ...override, allowMissingDetails: true })
  const showInStep3 = !isCommitted && !isDeferred && (blockingMissingCodes.length > 0 || hasLocalNewDraft || isDirty)

  let statusLabel = 'Kurz prüfen'
  let statusTone =
    'bg-slate-100 text-slate-800 dark:bg-slate-800/80 dark:text-slate-200 border border-slate-200/80 dark:border-slate-600/60'
  if (isCommitted) {
    statusLabel = 'Übernommen'
    statusTone =
      'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200 border border-emerald-200/80 dark:border-emerald-800/60'
  } else if (rs === 'blocked') {
    statusLabel = 'Zurückgestellt'
    statusTone =
      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/80 dark:border-slate-600/60'
  } else if (rs === 'skipped') {
    statusLabel = 'Übersprungen'
    statusTone =
      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/80 dark:border-slate-600/60'
  } else if (blockingMissingCodes.length > 0) {
    statusLabel = 'Eingabe nötig'
    statusTone =
      'bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-200 border border-red-200/80 dark:border-red-900/50'
  } else if (isCommitReady) {
    statusLabel = 'Bereit'
    statusTone =
      'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200 border border-emerald-200/80 dark:border-emerald-800/60'
  }

  return {
    missingCodes,
    blockingMissingCodes,
    optionalMissingCodes,
    isCommitted,
    isDeferred,
    hasLocalNewDraft,
    isDirty,
    isCommitReady,
    showInStep3,
    statusLabel,
    statusTone,
  }
}

const extractMissingCodes = (row: AltberichtImportStagingObjectRow): string[] => {
  const raw = row.validation_errors_json
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const code = (item as { code?: unknown }).code
    if (typeof code === 'string' && code.trim()) out.push(code.trim())
  }
  return out
}

const analysisTraceStringField = (trace: unknown, key: 'mode' | 'subMode'): string | null => {
  if (!trace || typeof trace !== 'object') return null
  const v = (trace as Record<string, unknown>)[key]
  return typeof v === 'string' && v.trim() ? v : null
}

/** Nur Parser-/Staging-Pipeline (keine Commit-/Match-Warnungen). */
const isParserPipelineDiagnosticEvent = (e: AltberichtImportEventRow): boolean => {
  if (e.level === 'warn' && (e.code.startsWith('parser.') || e.code.startsWith('import.parser.')))
    return true
  if (e.level === 'error' && e.code.startsWith('import.parser.')) return true
  return false
}

const AltberichtImportPage = () => {
  const { userRole, isLoading: authLoading, isAuthenticated } = useAuth()
  const { showError, showToast } = useToast()
  /** Session kann schon da sein, Rolle kommt async nach (AuthContext setzt isLoading oft vor Profil-RPC). */
  const roleHydrationPending = isAuthenticated && userRole === null
  const authPermissionKnown = !authLoading && !roleHydrationPending
  const canUse = userRole === 'admin' || userRole === 'mitarbeiter'
  const envOk = isMandantSupabaseEnvConfigured()

  const [jobs, setJobs] = useState<AltberichtImportJobRow[]>([])
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [files, setFiles] = useState<AltberichtImportFileRow[]>([])
  const [staging, setStaging] = useState<AltberichtImportStagingObjectRow[]>([])
  const [importJobEvents, setImportJobEvents] = useState<AltberichtImportEventRow[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [pickedFiles, setPickedFiles] = useState<FileList | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [allBvs, setAllBvs] = useState<BV[]>([])
  const [allObjects, setAllObjects] = useState<Obj[]>([])
  const [mastersLoading, setMastersLoading] = useState(false)
  const [stagingFilter, setStagingFilter] = useState<StagingFilter>('all')
  const [jobCustomerId, setJobCustomerId] = useState('')
  const [jobBvId, setJobBvId] = useState('')
  const [viewMode, setViewMode] = useState<ImportViewMode>('standard')
  const [lastCommitSummary, setLastCommitSummary] = useState<{
    results: AltberichtC1RowCommitResult[]
    label: string
  } | null>(null)
  const [quickEdits, setQuickEdits] = useState<Record<string, QuickEditDraft>>({})
  const [dirtyRowIds, setDirtyRowIds] = useState<Record<string, true>>({})
  const [standardIncludeC2, setStandardIncludeC2] = useState(false)
  const [standardRunResult, setStandardRunResult] = useState<StandardRunResult | null>(null)
  const [standardBulkTarget, setStandardBulkTarget] = useState<StandardBulkTarget>('all')
  const [selectedStandardRows, setSelectedStandardRows] = useState<Record<string, true>>({})
  const [singleStandardRowId, setSingleStandardRowId] = useState<string>('')
  /** Produktivobjekte, die per committed_object_id nicht in fetchAllObjects vorkamen (C1-Abgleich). */
  const [compareExtraObjects, setCompareExtraObjects] = useState<Obj[]>([])
  const [embeddedImages, setEmbeddedImages] = useState<AltberichtImportEmbeddedImageRow[]>([])
  const [embeddedImagesError, setEmbeddedImagesError] = useState<string | null>(null)

  const markRowDirty = useCallback((rowId: string) => {
    setDirtyRowIds((prev) => {
      if (prev[rowId]) return prev
      return { ...prev, [rowId]: true }
    })
  }, [])

  const clearRowDirty = useCallback((rowId: string) => {
    setDirtyRowIds((prev) => {
      if (!prev[rowId]) return prev
      const next = { ...prev }
      delete next[rowId]
      return next
    })
  }, [])

  const loadJobs = useCallback(async () => {
    setListLoading(true)
    const { jobs: j, error } = await listAltberichtImportJobs(50)
    setListLoading(false)
    if (error) {
      showError(error.message)
      return
    }
    setJobs(j)
  }, [showError])

  const loadJobDetail = useCallback(
    async (jobId: string) => {
      setDetailLoading(true)
      const [fRes, sRes, eRes] = await Promise.all([
        fetchAltberichtImportFilesForJob(jobId),
        fetchAltberichtImportStagingForJob(jobId),
        fetchAltberichtImportEventsForJob(jobId),
      ])
      setDetailLoading(false)
      if (fRes.error) showError(fRes.error.message)
      if (sRes.error) showError(sRes.error.message)
      if (eRes.error) {
        showError(eRes.error.message)
        setImportJobEvents([])
      } else {
        setImportJobEvents(eRes.events)
      }
      setFiles(fRes.files)
      setStaging(sRes.staging)
    },
    [showError]
  )

  const loadEmbeddedImages = useCallback(
    async (jobId: string) => {
      const imgRes = await fetchAltberichtEmbeddedImagesForJob(jobId)
      if (imgRes.error) {
        setEmbeddedImages([])
        setEmbeddedImagesError(imgRes.error.message)
        return
      }
      setEmbeddedImages(imgRes.images)
      setEmbeddedImagesError(null)
    },
    []
  )

  useEffect(() => {
    if (!envOk) {
      setListLoading(false)
      return
    }
    if (!authPermissionKnown) return
    if (!canUse) {
      setListLoading(false)
      return
    }
    void loadJobs()
  }, [envOk, authPermissionKnown, canUse, loadJobs])

  useEffect(() => {
    if (!selectedJobId || !envOk) {
      setFiles([])
      setStaging([])
      setEmbeddedImages([])
      setEmbeddedImagesError(null)
      return
    }
    if (!authPermissionKnown) return
    if (!canUse) {
      setFiles([])
      setStaging([])
      setEmbeddedImages([])
      setEmbeddedImagesError(null)
      return
    }
    void loadJobDetail(selectedJobId)
  }, [selectedJobId, authPermissionKnown, canUse, envOk, loadJobDetail])

  useEffect(() => {
    setJobCustomerId('')
    setJobBvId('')
  }, [selectedJobId])

  useEffect(() => {
    setCompareExtraObjects([])
  }, [selectedJobId])

  useEffect(() => {
    if (viewMode === 'standard') setCompareExtraObjects([])
  }, [viewMode])

  const embeddedReloadSig = useMemo(
    () => files.map((f) => `${f.id}:${f.parsed_at ?? ''}:${f.status}`).join('|'),
    [files]
  )

  useEffect(() => {
    if (viewMode === 'standard') {
      setEmbeddedImages([])
      setEmbeddedImagesError(null)
      return
    }
    if (viewMode !== 'expert' || !selectedJobId) return
    void loadEmbeddedImages(selectedJobId)
  }, [viewMode, selectedJobId, embeddedReloadSig, loadEmbeddedImages])

  useEffect(() => {
    if (viewMode !== 'expert' || !envOk || !authPermissionKnown || !canUse || !selectedJobId) return
    const ids = [
      ...new Set(
        staging
          .map((s) => s.committed_object_id?.trim())
          .filter((x): x is string => Boolean(x && x.length > 0))
      ),
    ]
    if (ids.length === 0) {
      setCompareExtraObjects([])
      return
    }
    const have = new Set(allObjects.map((o) => o.id))
    const need = ids.filter((id) => !have.has(id))
    if (need.length === 0) {
      setCompareExtraObjects([])
      return
    }
    let cancelled = false
    void (async () => {
      const { objects, error } = await fetchObjectsByIdsForCompare(need)
      if (cancelled) return
      if (error) {
        setCompareExtraObjects([])
        return
      }
      setCompareExtraObjects(objects)
    })()
    return () => {
      cancelled = true
    }
  }, [viewMode, envOk, authPermissionKnown, canUse, selectedJobId, staging, allObjects])

  useEffect(() => {
    if (!envOk || !authPermissionKnown || !canUse) return
    let cancelled = false
    ;(async () => {
      setMastersLoading(true)
      try {
        const [c, b, o] = await Promise.all([fetchCustomers(), fetchAllBvs(), fetchAllObjects()])
        if (!cancelled) {
          setCustomers(c)
          setAllBvs(b)
          setAllObjects(o)
        }
      } finally {
        if (!cancelled) setMastersLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authPermissionKnown, canUse, envOk])

  const jobBvs = jobCustomerId ? allBvs.filter((x) => x.customer_id === jobCustomerId) : allBvs

  const objectByIdForC1Compare = useMemo(() => {
    const m = new Map<string, Obj>()
    for (const o of allObjects) m.set(o.id, o)
    for (const o of compareExtraObjects) m.set(o.id, o)
    return m
  }, [allObjects, compareExtraObjects])


  const filteredStaging = useMemo(() => {
    return staging.filter((s) => {
      const rs = s.review_status ?? 'draft'
      const errs = Array.isArray(s.validation_errors_json) ? s.validation_errors_json : []
      switch (stagingFilter) {
        case 'all':
          return true
        case 'needs_input':
          return rs === 'needs_input'
        case 'blocked':
          return rs === 'blocked'
        case 'ready':
          return rs === 'ready'
        case 'skipped':
          return rs === 'skipped'
        case 'open_validation':
          return errs.length > 0
        case 'committed':
          return rs === 'committed' || Boolean(s.committed_at)
        case 'commit_failed':
          return Boolean(s.commit_last_error?.trim()) && !s.committed_at
        default:
          return true
      }
    })
  }, [staging, stagingFilter])

  const commitEligibleInJob = useMemo(
    () => staging.filter((s) => isAltberichtStagingRowCommitEligible(s)),
    [staging]
  )

  const commitEligibleInFiltered = useMemo(
    () => filteredStaging.filter((s) => isAltberichtStagingRowCommitEligible(s)),
    [filteredStaging]
  )

  const patchStagingRow = useCallback(
    async (id: string, patch: AltberichtStagingReviewPatch) => {
      setBusy(true)
      const { error } = await patchAltberichtStagingReview(id, patch)
      setBusy(false)
      if (error) {
        showError(error.message)
        return
      }
      showToast('Angaben wurden gespeichert.', 'success')
      if (selectedJobId) await loadJobDetail(selectedJobId)
    },
    [selectedJobId, loadJobDetail, showError, showToast]
  )

  const computeMatchForRow = useCallback(
    async (id: string) => {
      setBusy(true)
      const { error } = await persistAltberichtMatchCandidatesForStaging(id, allBvs, allObjects)
      setBusy(false)
      if (error) showError(error.message)
      else {
        showToast('Zuordnungsvorschläge wurden aktualisiert.', 'success')
        if (selectedJobId) await loadJobDetail(selectedJobId)
      }
    },
    [allBvs, allObjects, selectedJobId, loadJobDetail, showError, showToast]
  )

  const recomputeOneRow = useCallback(
    async (id: string) => {
      setBusy(true)
      const { error } = await recomputeAltberichtStagingReviewRow(id)
      setBusy(false)
      if (error) showError(error.message)
      else if (selectedJobId) await loadJobDetail(selectedJobId)
    },
    [selectedJobId, loadJobDetail, showError]
  )

  const handleCreateAndUpload = async () => {
    if (!pickedFiles?.length) {
      showError('Bitte mindestens eine PDF-Datei wählen.')
      return
    }
    const uploads = Array.from(pickedFiles).map((file) => ({ file }))
    setBusy(true)
    const res = await createAltberichtImportJobWithPdfUploads(
      { title: newTitle.trim() || null, notes: null, analysisMode: false },
      uploads
    )
    setBusy(false)
    if (res.error) {
      showError(res.error.message)
      return
    }
    showToast('Auftrag angelegt, PDF-Dateien sind hochgeladen.', 'success')
    setNewTitle('')
    setPickedFiles(null)
    await loadJobs()
    if (res.job?.id) setSelectedJobId(res.job.id)
  }

  const handleParseOne = async (fileId: string) => {
    setBusy(true)
    const { error } = await runAltberichtImportParseForFile(fileId)
    setBusy(false)
    if (error) {
      showError(error.message)
    } else {
      showToast('Der PDF-Text wurde neu ausgelesen und die Vorschau aktualisiert.', 'success')
    }
    if (selectedJobId) await loadJobDetail(selectedJobId)
    await loadJobs()
  }

  const handleRecomputeReview = async () => {
    if (!selectedJobId) return
    setBusy(true)
    const { error } = await recomputeAltberichtStagingReviewForJob(selectedJobId)
    setBusy(false)
    if (error) showError(error.message)
    else showToast('Alle Zeilen wurden auf Vollständigkeit geprüft.', 'success')
    await loadJobDetail(selectedJobId)
  }

  const handleParseAll = async () => {
    if (!selectedJobId) return
    setBusy(true)
    const { errors } = await runAltberichtImportParseJobSequential(selectedJobId)
    setBusy(false)
    if (errors.length) {
      showError(errors.map((e) => e.message).join(' · '))
    } else {
      showToast('Alle PDFs des Auftrags wurden erneut ausgelesen.', 'success')
    }
    await loadJobDetail(selectedJobId)
    await loadJobs()
  }

  const handleDeleteJob = async (jobId: string) => {
    const j = jobs.find((x) => x.id === jobId)
    const label = j?.title?.trim() || 'Ohne Titel'
    if (!window.confirm(`Import-Job „${label}“ wirklich löschen? Zugehörige Dateien, Staging und Protokoll werden entfernt.`)) {
      return
    }
    setBusy(true)
    const { error, storageRemoveErrors } = await deleteAltberichtImportJob(jobId)
    setBusy(false)
    if (error) {
      showError(error.message)
      return
    }
    if (storageRemoveErrors.length) {
      showToast(`Job gelöscht. Hinweis Storage: ${storageRemoveErrors.join(' ')}`, 'error')
    } else {
      showToast('Import-Job gelöscht.', 'success')
    }
    if (selectedJobId === jobId) setSelectedJobId(null)
    await loadJobs()
  }

  const handleCommitEntireJob = useCallback(async () => {
    if (!selectedJobId) return
    if (commitEligibleInJob.length === 0) {
      showError('Keine Zeilen sind bereit zum Speichern (prüfen Sie offene Eingaben).')
      return
    }
    setBusy(true)
    const { results, error } = await commitAltberichtC1Job(selectedJobId, {})
    setBusy(false)
    if (error) {
      showError(error.message)
      return
    }
    setLastCommitSummary({ results, label: 'Gesamter Job' })
    const ok = results.filter((r) => r.ok && !r.skipped).length
    const bad = results.filter((r) => !r.ok && !r.skipped).length
    const skipped = results.filter((r) => r.skipped).length
      showToast(
        `Stammdaten: ${ok} übernommen, ${bad} mit Fehler, ${skipped} übersprungen.`,
        bad ? 'error' : 'success'
      )
    await loadJobDetail(selectedJobId)
  }, [selectedJobId, commitEligibleInJob.length, loadJobDetail, showError, showToast])

  const handleCommitFilteredList = useCallback(async () => {
    if (!selectedJobId) return
    const ids = filteredStaging.map((s) => s.id)
    if (ids.length === 0) {
      showError('Keine Zeilen in der aktuellen Liste.')
      return
    }
    const eligibleIds = commitEligibleInFiltered.map((s) => s.id)
    if (eligibleIds.length === 0) {
      showError('In der aktuellen Ansicht ist keine Zeile zum Speichern bereit.')
      return
    }
    setBusy(true)
    const { results, error } = await commitAltberichtC1Job(selectedJobId, { stagingIds: ids })
    setBusy(false)
    if (error) {
      showError(error.message)
      return
    }
    setLastCommitSummary({ results, label: 'Aktuelle Filterliste' })
    const ok = results.filter((r) => r.ok && !r.skipped).length
    const bad = results.filter((r) => !r.ok && !r.skipped).length
    const skipped = results.filter((r) => r.skipped).length
    showToast(
      `Stammdaten (Liste): ${ok} übernommen, ${bad} mit Fehler, ${skipped} übersprungen.`,
      bad ? 'error' : 'success'
    )
    await loadJobDetail(selectedJobId)
  }, [
    selectedJobId,
    filteredStaging,
    commitEligibleInFiltered,
    loadJobDetail,
    showError,
    showToast,
  ])

  const commitC2ForRow = useCallback(
    async (row: AltberichtImportStagingObjectRow, items: AltberichtC2CommitItem[]) => {
      setBusy(true)
      const res = await commitAltberichtC2DefectsForStagingRow(row, items)
      setBusy(false)
      if (!res.ok) {
        showError(res.errorMessage ?? 'Mängel konnten nicht übernommen werden.')
        return
      }
      showToast(
        `${res.importedKeys?.length ?? items.length} Mängel in den Stammdaten ergänzt.`,
        'success'
      )
      if (selectedJobId) await loadJobDetail(selectedJobId)
    },
    [selectedJobId, loadJobDetail, showError, showToast]
  )

  const commitOneRow = useCallback(
    async (row: AltberichtImportStagingObjectRow) => {
      setBusy(true)
      const res = await commitAltberichtC1StagingRow(row, undefined)
      setBusy(false)
      setLastCommitSummary({ results: [res], label: `Zeile #${row.sequence}` })
      if (res.ok && !res.skipped) {
        showToast('Stammdaten für diese Zeile übernommen.', 'success')
      } else if (res.skipped && res.skipReason === 'already_committed') {
        showToast('Diese Zeile war bereits übernommen.', 'success')
      } else if (res.skipped && res.skipReason === 'ineligible') {
        showError(res.errorMessage ?? 'Diese Zeile kann noch nicht übernommen werden (Angaben unvollständig).')
      } else if (res.skipped && res.skipReason === 'offline') {
        showError(res.errorMessage ?? 'Offline.')
      } else if (!res.ok) {
        showError(res.errorMessage ?? 'Speichern in den Stammdaten fehlgeschlagen.')
      }
      if (selectedJobId) await loadJobDetail(selectedJobId)
    },
    [selectedJobId, loadJobDetail, showError, showToast]
  )

  const handleJobApplyBv = async (mode: 'all' | 'empty_bv_only') => {
    if (!selectedJobId) return
    setBusy(true)
    const { error, updatedCount } = await applyAltberichtJobReviewCustomerBvDefaults(
      selectedJobId,
      {
        review_customer_id: jobCustomerId.trim() ? jobCustomerId.trim() : null,
        review_bv_id: jobBvId.trim() ? jobBvId.trim() : null,
      },
      mode
    )
    setBusy(false)
    if (error) showError(error.message)
    else showToast(`${updatedCount} Zeile(n) aktualisiert.`, 'success')
    await loadJobDetail(selectedJobId)
  }

  const standardRowOverrides = useMemo(
    () => buildStandardRowOverridesMap(staging, quickEdits),
    [staging, quickEdits]
  )

  const standardRows = useMemo(() => {
    return staging.map((row) => {
      const draft = quickEdits[row.id]
      const bvLabel = resolveStandardBvDisplayLabel(row, draft, allBvs)
      const objectLabel =
        row.review_object_name?.trim() ||
        row.object_name?.trim() ||
        (row.review_object_id?.trim() ? `Objekt-ID ${row.review_object_id.slice(0, 8)}…` : 'Nicht erkannt')
      const dau = evaluateStandardRow({
        row,
        draft,
        allBvs,
        isDirty: Boolean(dirtyRowIds[row.id]),
        override: standardRowOverrides[row.id],
      })
      return { row, draft, bvLabel, objectLabel, dau }
    })
  }, [staging, quickEdits, allBvs, dirtyRowIds, standardRowOverrides])

  const standardRowsById = useMemo(() => {
    const m = new Map<string, (typeof standardRows)[number]>()
    for (const x of standardRows) m.set(x.row.id, x)
    return m
  }, [standardRows])

  /** Weiche Dublette (fachlicher Abgleich) — für kompakte Hinweise im Assistenten, ohne Blockade. */
  const standardSoftDuplicateRowIds = useMemo(() => {
    const ids = new Set<string>()
    const label = (o: Obj) => o.name?.trim() || o.internal_id?.trim() || `${o.id.slice(0, 8)}…`
    for (const s of staging) {
      if (s.committed_at) continue
      if (s.review_object_id?.trim()) continue
      if (!s.review_customer_id?.trim()) continue
      if (listAltberichtSoftDuplicateHints(s, allObjects, label).length > 0) ids.add(s.id)
    }
    return ids
  }, [staging, allObjects])

  const resolveStandardTargetRowIds = useCallback((): string[] => {
    if (standardBulkTarget === 'all') return standardRows.map((r) => r.row.id)
    if (standardBulkTarget === 'selected') {
      return standardRows.map((r) => r.row.id).filter((id) => Boolean(selectedStandardRows[id]))
    }
    return singleStandardRowId ? [singleStandardRowId] : []
  }, [standardBulkTarget, standardRows, selectedStandardRows, singleStandardRowId])

  const handleStandardCommit = useCallback(async () => {
    if (!selectedJobId) return
    const targetRowIds = resolveStandardTargetRowIds()
    if (targetRowIds.length === 0) {
        showError('Bitte wählen Sie, welche Positionen übernommen werden sollen (siehe Schritt 4).')
      return
    }

    const canCommitAtLeastOne = targetRowIds.some((id) => standardRowsById.get(id)?.dau.isCommitReady)
    if (!canCommitAtLeastOne) {
      showError('Zurzeit ist keine der gewählten Positionen vollständig – bitte zuerst die Pflichtangaben ergänzen.')
      return
    }

    setBusy(true)

    const { results, error } = await commitAltberichtC1Job(selectedJobId, {
      stagingIds: targetRowIds,
      rowOverrides: standardRowOverrides,
      allowMissingDetails: true,
    })
    if (error) {
      setBusy(false)
      showError(error.message)
      return
    }

    const c1Imported = results.filter((r) => r.ok && !r.skipped).length
    const c1Failed = results.filter((r) => !r.ok && !r.skipped).length
    const c1Skipped = results.filter((r) => r.skipped).length
    let c2ImportedRows = 0
    let c2ImportedItems = 0

    await loadJobDetail(selectedJobId)

    if (standardIncludeC2) {
      const { staging: newest, error: stagingErr } = await fetchAltberichtImportStagingForJob(selectedJobId)
      if (stagingErr) {
        setBusy(false)
        showError(stagingErr.message)
        return
      }
      for (const row of newest) {
        if (!isAltberichtStagingRowC2Eligible(row)) continue
        const items = listAltberichtC2FindingRows(row)
          .filter((x) => !x.alreadyImported && x.originalText.trim().length > 0)
          .map((x) => ({ key: x.key, text: x.originalText.trim() }))
        if (items.length === 0) continue
        const c2 = await commitAltberichtC2DefectsForStagingRow(row, items)
        if (c2.ok) {
          c2ImportedRows += 1
          c2ImportedItems += c2.importedKeys?.length ?? items.length
        }
      }
      await loadJobDetail(selectedJobId)
    }

    setBusy(false)
    setStandardRunResult({ c1Imported, c1Failed, c1Skipped, c2ImportedRows, c2ImportedItems })
    if (c1Failed > 0) {
        showToast(
        `Teilweise fertig: ${c1Imported} Positionen übernommen, ${c1Failed} sind fehlgeschlagen, ${c1Skipped} übersprungen.`,
        'error'
      )
    } else {
      showToast(
        standardIncludeC2
          ? `Stammdaten für ${c1Imported} Position(en) gespeichert. Mängel aus dem Bericht wurden bei ${c2ImportedRows} Objekt(en) ergänzt.`
          : `Stammdaten für ${c1Imported} Position(en) in der App gespeichert.`,
        'success'
      )
    }
  }, [
    selectedJobId,
    resolveStandardTargetRowIds,
    standardRowsById,
    standardRowOverrides,
    showError,
    standardIncludeC2,
    loadJobDetail,
    showToast,
  ])

  const stagingRowById = useMemo(() => {
    const m = new Map<string, AltberichtImportStagingObjectRow>()
    for (const s of staging) m.set(s.id, s)
    return m
  }, [staging])

  const fileById = useMemo(() => {
    const m = new Map<string, AltberichtImportFileRow>()
    for (const f of files) m.set(f.id, f)
    return m
  }, [files])

  const expertParserDiagnosticsByFileId = useMemo(() => {
    const byFile = new Map<
      string,
      {
        objectCount: number
        modeLabels: string[]
        subModeLabels: string[]
        parserPipelineEvents: AltberichtImportEventRow[]
      }
    >()
    const modeSets = new Map<string, Set<string>>()
    const subModeSets = new Map<string, Set<string>>()
    const counts = new Map<string, number>()
    for (const s of staging) {
      counts.set(s.file_id, (counts.get(s.file_id) ?? 0) + 1)
      const t = s.analysis_trace_json
      const m = analysisTraceStringField(t, 'mode')
      const sm = analysisTraceStringField(t, 'subMode')
      if (m) {
        if (!modeSets.has(s.file_id)) modeSets.set(s.file_id, new Set())
        modeSets.get(s.file_id)!.add(m)
      }
      if (sm) {
        if (!subModeSets.has(s.file_id)) subModeSets.set(s.file_id, new Set())
        subModeSets.get(s.file_id)!.add(sm)
      }
    }
    const eventsByFile = new Map<string, AltberichtImportEventRow[]>()
    for (const ev of importJobEvents) {
      if (!ev.file_id || !isParserPipelineDiagnosticEvent(ev)) continue
      const list = eventsByFile.get(ev.file_id)
      if (list) list.push(ev)
      else eventsByFile.set(ev.file_id, [ev])
    }
    for (const f of files) {
      const id = f.id
      byFile.set(id, {
        objectCount: counts.get(id) ?? 0,
        modeLabels: Array.from(modeSets.get(id) ?? []).sort(),
        subModeLabels: Array.from(subModeSets.get(id) ?? []).sort(),
        parserPipelineEvents: (eventsByFile.get(id) ?? []).sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ),
      })
    }
    return byFile
  }, [files, staging, importJobEvents])

  useEffect(() => {
    setQuickEdits((prev) => {
      const next: Record<string, QuickEditDraft> = {}
      for (const s of staging) {
        const draftBvId = s.review_bv_id ?? ''
        const draftCustomerId =
          s.review_customer_id ??
          (draftBvId ? allBvs.find((b) => b.id === draftBvId)?.customer_id ?? '' : '')
        const p = prev[s.id]
        if (p) {
          // Bereits vorhandene lokale Eingaben nicht durch Re-Renders/Reloads überschreiben.
          next[s.id] = p
        } else {
          next[s.id] = {
            customerMode: 'existing',
            newCustomerName: s.customer_text?.trim() || '',
            review_customer_id: draftCustomerId,
            bvMode: 'existing',
            newBvName: s.site_text?.trim() || '',
            review_bv_id: draftBvId,
            review_object_name: s.review_object_name ?? s.object_name ?? '',
            review_object_type_text: s.review_object_type_text ?? s.object_type_text ?? '',
            review_floor_text: s.review_floor_text ?? s.floor_text ?? '',
            review_room_text: s.review_room_text ?? s.room_text ?? '',
          }
        }
      }
      return next
    })
  }, [staging, allBvs])

  useEffect(() => {
    const alive = new Set(staging.map((s) => s.id))
    setDirtyRowIds((prev) => {
      let changed = false
      const next: Record<string, true> = {}
      for (const [k, v] of Object.entries(prev)) {
        if (alive.has(k)) next[k] = v
        else changed = true
      }
      return changed ? next : prev
    })
  }, [staging])

  if (authLoading || roleHydrationPending) {
    return (
      <div className="px-4 py-6 max-w-5xl mx-auto text-slate-800 dark:text-slate-100">
        <LoadingSpinner message="Berechtigung wird geprüft…" size="sm" className="py-10" />
      </div>
    )
  }

  if (!canUse) {
    return (
      <div className="px-4 py-6 text-slate-700 dark:text-slate-200">
        <p>Nur für Benutzer mit Stammdaten-Schreibrechten (Admin/Mitarbeiter).</p>
      </div>
    )
  }

  if (!envOk) {
    return (
      <div className="px-4 py-6 text-slate-700 dark:text-slate-200">
        <p>Mandanten-Supabase ist nicht konfiguriert (VITE_SUPABASE_URL / KEY).</p>
      </div>
    )
  }

  if (viewMode === 'standard') {
    const rows = standardRows
    const rowsNeedingInput = rows.filter((r) => r.dau.showInStep3)
    const rowsDeferred = rows.filter((r) => r.dau.isDeferred)
    const rowsCommitted = rows.filter((r) => r.dau.isCommitted)
    const rowsOpenAfterRun = rows.filter((r) => !r.dau.isCommitted && !r.dau.isDeferred)
    const targetRowIds = resolveStandardTargetRowIds()
    const targetRowIdSet = new Set(targetRowIds)
    const rowsInImportScope = rows.filter((r) => targetRowIdSet.has(r.row.id))
    const scopeReadyCount = rowsInImportScope.filter((r) => r.dau.isCommitReady).length
    const scopeNeedingInputCount = rowsInImportScope.filter((r) => r.dau.showInStep3).length
    const scopeDeferredCount = rowsInImportScope.filter((r) => r.dau.isDeferred).length
    const readyInTargetCount = targetRowIds.filter(
      (id) => standardRowsById.get(id)?.dau.isCommitReady
    ).length
    const isSinglePositionFocus = standardBulkTarget === 'single' && Boolean(singleStandardRowId)
    const rowsNeedingInputStep3 = isSinglePositionFocus
      ? rowsNeedingInput.filter((r) => r.row.id === singleStandardRowId)
      : rowsNeedingInput
    const focusedRowMeta = isSinglePositionFocus
      ? rows.find((r) => r.row.id === singleStandardRowId)
      : undefined

    return (
      <div className="px-4 py-4 max-w-5xl mx-auto text-slate-800 dark:text-slate-100">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold mb-1">Altberichte importieren</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
              PDFs hochladen, prüfen, fehlende Angaben ergänzen – danach erscheinen Türen/Objekte in Ihren
              Stammdaten. Für detaillierte Einstellungen:{' '}
              <button
                type="button"
                className="text-vico-primary dark:text-sky-400 hover:underline font-medium"
                onClick={() => setViewMode('expert')}
              >
                Expertenmodus
              </button>
              .
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">Schritte: Hochladen → Prüfen → Ergänzen → Übernehmen</p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80"
            onClick={() => setViewMode('expert')}
          >
            Expertenmodus
          </button>
        </div>

        <section className="mb-5 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-800/80 p-4 sm:p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-1">Schritt 1: PDFs hochladen</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">Wählen Sie einen bestehenden Auftrag oder legen Sie einen neuen an und laden Sie eine oder mehrere PDF-Dateien.</p>
          <label className="block text-sm mb-3">
            <span className="block text-slate-600 dark:text-slate-400 mb-1">Aktueller Auftrag</span>
            <select
              className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm"
              value={selectedJobId ?? ''}
              disabled={busy || listLoading}
              onChange={(e) => setSelectedJobId(e.target.value || null)}
            >
              <option value="">— Auftrag wählen —</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {(j.title || 'Ohne Titel') + ` · ${new Date(j.created_at).toLocaleString('de-DE')}`}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <label className="flex-1 text-sm">
              <span className="block text-slate-600 dark:text-slate-400 mb-1">Titel (optional)</span>
              <input
                className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </label>
            <label className="flex-1 text-sm">
              <span className="block text-slate-600 dark:text-slate-400 mb-1">PDF-Dateien</span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                multiple
                className="w-full text-sm"
                onChange={(e) => setPickedFiles(e.target.files)}
              />
            </label>
            <button
              type="button"
              disabled={busy}
              className="rounded bg-slate-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
              onClick={() => void handleCreateAndUpload()}
            >
              Hochladen
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80"
              disabled={busy || !selectedJobId}
              onClick={() => void handleParseAll()}
            >
              Text aus PDFs lesen
            </button>
            <button
              type="button"
              className="rounded border border-red-300 text-red-800 dark:border-red-800 dark:text-red-200 px-3 py-1.5 text-xs disabled:opacity-50"
              disabled={busy || !selectedJobId}
              onClick={() => void handleDeleteJob(selectedJobId!)}
            >
              Aktuellen Job löschen
            </button>
            <button
              type="button"
              className="text-xs text-slate-600 dark:text-slate-300 underline"
              onClick={() => void loadJobs()}
            >
              Jobs aktualisieren
            </button>
          </div>
        </section>

        <section className="mb-5 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-800/80 p-4 sm:p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-1">Schritt 2: Vorschau prüfen</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
            Pro PDF-Zeile eine erkannte Position. Status zeigt, ob Sie noch etwas eintragen müssen, bevor die Übernahme
            möglich ist.
          </p>
          {!selectedJobId ? (
            <p className="text-sm text-slate-500">Bitte wählen Sie in Schritt 1 einen Auftrag.</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-500">Noch keine Positionen – zuerst „Text aus PDFs lesen“ in Schritt 1.</p>
          ) : (
            <ul className="space-y-2.5">
              {rows.map(({ row, bvLabel, objectLabel, dau }) => (
                <li
                  key={row.id}
                  className={`rounded-lg border p-2.5 sm:p-3 ${
                    isSinglePositionFocus && singleStandardRowId === row.id
                      ? 'border-sky-400 dark:border-sky-500 ring-1 ring-sky-400/30 bg-sky-50/40 dark:bg-sky-950/25'
                      : 'border-slate-200/90 dark:border-slate-600/80 bg-white/60 dark:bg-slate-900/20'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm min-w-0">
                      <label className="inline-flex items-center gap-2 mr-2 align-middle">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 text-vico-primary"
                          title="Für die Übernahme markieren (siehe Schritt 4: „Nur markierte“)"
                          checked={Boolean(selectedStandardRows[row.id])}
                          onChange={(e) =>
                            setSelectedStandardRows((prev) => {
                              const next = { ...prev }
                              if (e.target.checked) next[row.id] = true
                              else delete next[row.id]
                              return next
                            })
                          }
                        />
                      </label>
                      <span className="font-medium text-slate-800 dark:text-slate-100">
                        {fileById.get(row.file_id)?.original_filename ?? 'Datei'}
                        <span className="font-normal text-slate-500"> · Zeile {row.sequence}</span>
                        {isSinglePositionFocus && singleStandardRowId === row.id ? (
                          <span className="ml-1.5 text-[11px] font-medium text-sky-700 dark:text-sky-300">· nur diese Position</span>
                        ) : null}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="rounded-md border border-slate-300 dark:border-slate-600 px-2 py-0.5 text-[11px] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                        title="Diese Zeile in Schritt 3 und 4 allein bearbeiten und übernehmen"
                        onClick={() => {
                          setStandardBulkTarget('single')
                          setSingleStandardRowId(row.id)
                          setSelectedStandardRows({ [row.id]: true })
                        }}
                      >
                        Nur diese Position
                      </button>
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${dau.statusTone}`}>
                        {dau.statusLabel}
                      </span>
                    </div>
                  </div>
                    <div className="mt-2 text-xs text-slate-600 dark:text-slate-300 space-y-0.5">
                    <div>
                      <span className="text-slate-500">Objekt:</span> {objectLabel}
                    </div>
                    <div>
                      <span className="text-slate-500">Bauvorhaben:</span> {bvLabel}
                    </div>
                    <div className="text-slate-500">
                      {dau.blockingMissingCodes.length > 0
                        ? `Noch nötig: ${dau.blockingMissingCodes.map(humanMissingFieldLabel).join(', ')}`
                        : dau.optionalMissingCodes.length > 0
                          ? 'Kann ergänzt werden: Etage, Raum, … (für die Vollständigkeit sinnvoll)'
                          : 'Mindestangaben vollständig'}
                    </div>
                  </div>
                    {row.proposed_internal_id?.trim() ? (
                      <div className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        Vorgeschlagene Kennung im System:{' '}
                        <span className="font-mono text-slate-700 dark:text-slate-200">
                          {row.proposed_internal_id.trim()}
                        </span>
                      </div>
                    ) : null}
                    {standardSoftDuplicateRowIds.has(row.id) ? (
                      <p className="text-xs text-amber-900/90 dark:text-amber-200/95 mt-2 leading-snug rounded-md bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/50 px-2 py-1.5">
                        <span className="font-medium">Hinweis:</span> Möglicherweise passend zu einem{' '}
                        <span className="font-medium">bestehenden Objekt</span> – im Expertenmodus Kandidaten prüfen oder
                        Zuordnung anpassen.
                      </p>
                    ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-800/80 p-4 sm:p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-1">Schritt 3: Angaben ergänzen</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
            <span className="font-medium text-slate-700 dark:text-slate-300">Pflicht</span> ist in der Regel der{' '}
            <span className="font-medium">Kunde</span>. Bauvorhaben, Etage und Raum sind{' '}
            <span className="font-medium">optional</span>, erhöhen aber die Treffsicherheit.
          </p>
          {isSinglePositionFocus && focusedRowMeta ? (
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
              Es wird nur die Position <span className="font-medium">Zeile {focusedRowMeta.row.sequence}</span> bearbeitet (
              {fileById.get(focusedRowMeta.row.file_id)?.original_filename ?? 'Datei'}
              ).
            </p>
          ) : null}
          {rowsNeedingInputStep3.length === 0 ? (
            isSinglePositionFocus && singleStandardRowId ? (
              focusedRowMeta ? (
                <p className="text-sm text-emerald-800 dark:text-emerald-200">
                  Hier ist nichts mehr offen. Im nächsten Schritt können Sie die Stammdaten übernehmen.
                </p>
              ) : (
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Die gewählte Position wurde nicht mehr gefunden. In Schritt 2 bitte erneut „Nur diese Position“
                  wählen oder in Schritt 4 die Zeile auswählen.
                </p>
              )
            ) : (
              <p className="text-sm text-emerald-800 dark:text-emerald-200">
                Keine fehlenden Pflichtangaben. Sie können mit Schritt 4 fortfahren.
              </p>
            )
          ) : (
            <ul className="space-y-3">
              {rowsNeedingInputStep3.map(({ row, dau }) => {
                const draft = quickEdits[row.id] ?? {
                  customerMode: 'existing',
                  newCustomerName: row.customer_text?.trim() || '',
                  review_customer_id: '',
                  bvMode: 'existing',
                  newBvName: row.site_text?.trim() || '',
                  review_bv_id: '',
                  review_object_name: '',
                  review_object_type_text: '',
                  review_floor_text: '',
                  review_room_text: '',
                }
                const bvsForDraftCustomer = draft.review_customer_id
                  ? allBvs.filter((b) => b.customer_id === draft.review_customer_id)
                  : allBvs
                return (
                  <li
                    key={row.id}
                    className="rounded-lg border border-amber-200/80 dark:border-amber-800/60 bg-amber-50/30 dark:bg-amber-950/15 p-3 sm:p-3.5"
                  >
                    <div className="text-sm font-medium mb-0.5 text-slate-800 dark:text-slate-100">
                      {fileById.get(row.file_id)?.original_filename ?? 'Datei'}
                      <span className="font-normal text-slate-500"> · Zeile {row.sequence}</span>
                    </div>
                    <div className="text-xs text-amber-950/90 dark:text-amber-200/95 mb-2.5">
                      {dau.blockingMissingCodes.length > 0
                        ? `Bitte ergänzen: ${dau.blockingMissingCodes.map(humanMissingFieldLabel).join(' · ')}`
                        : 'Änderungen sind noch nicht mit „Speichern & prüfen“ bestätigt.'}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="text-xs sm:col-span-2">
                        <span className="text-slate-600 dark:text-slate-400">Kunde</span>
                        <div className="mt-1 flex gap-2">
                          <button
                            type="button"
                            className={`rounded px-2 py-1 border text-xs ${
                              draft.customerMode === 'existing'
                                ? 'bg-slate-700 text-white border-slate-700'
                                : 'border-slate-300 dark:border-slate-600'
                            }`}
                          onClick={() => {
                            markRowDirty(row.id)
                              setQuickEdits((q) => ({
                                ...q,
                                [row.id]: { ...draft, customerMode: 'existing' },
                              }))
                          }}
                          >
                            Bestehenden Kunden wählen
                          </button>
                          <button
                            type="button"
                            className={`rounded px-2 py-1 border text-xs ${
                              draft.customerMode === 'new'
                                ? 'bg-slate-700 text-white border-slate-700'
                                : 'border-slate-300 dark:border-slate-600'
                            }`}
                          onClick={() => {
                            markRowDirty(row.id)
                              setQuickEdits((q) => ({
                                ...q,
                                [row.id]: {
                                  ...draft,
                                  customerMode: 'new',
                                  newCustomerName:
                                    draft.newCustomerName.trim() || row.customer_text?.trim() || '',
                                },
                              }))
                          }}
                          >
                            Neuen Kunden anlegen
                          </button>
                        </div>
                      </div>
                      <label className="block text-xs">
                        <span className="text-slate-600 dark:text-slate-400">
                          {draft.customerMode === 'new' ? 'Neuer Kundenname' : 'Kunde'}
                        </span>
                        {draft.customerMode === 'new' ? (
                          <input
                            className="mt-0.5 w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-sm"
                            value={draft.newCustomerName}
                            disabled={busy}
                            placeholder="z. B. Wette Center GmbH"
                            onChange={(e) => {
                              markRowDirty(row.id)
                              setQuickEdits((q) => ({
                                ...q,
                                [row.id]: { ...draft, newCustomerName: e.target.value },
                              }))
                            }}
                          />
                        ) : (
                          <select
                            className="mt-0.5 w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-sm"
                            value={draft.review_customer_id}
                            disabled={busy}
                            onChange={(e) => {
                              markRowDirty(row.id)
                              const nextCustomerId = e.target.value
                              const stillValidBv = allBvs.some(
                                (b) => b.id === draft.review_bv_id && b.customer_id === nextCustomerId
                              )
                              setQuickEdits((q) => ({
                                ...q,
                                [row.id]: {
                                  ...draft,
                                  review_customer_id: nextCustomerId,
                                  review_bv_id: stillValidBv ? draft.review_bv_id : '',
                                },
                              }))
                            }}
                          >
                            <option value="">—</option>
                            {customers.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </label>
                      <div className="text-xs sm:col-span-2">
                        <span className="text-slate-600 dark:text-slate-400">Bauvorhaben</span>
                        <div className="mt-1 flex gap-2">
                          <button
                            type="button"
                            className={`rounded px-2 py-1 border text-xs ${
                              draft.bvMode === 'existing'
                                ? 'bg-slate-700 text-white border-slate-700'
                                : 'border-slate-300 dark:border-slate-600'
                            }`}
                            onClick={() => {
                              markRowDirty(row.id)
                              setQuickEdits((q) => ({
                                ...q,
                                [row.id]: { ...draft, bvMode: 'existing' },
                              }))
                            }}
                          >
                            Bestehendes Bauvorhaben wählen
                          </button>
                          <button
                            type="button"
                            className={`rounded px-2 py-1 border text-xs ${
                              draft.bvMode === 'new'
                                ? 'bg-slate-700 text-white border-slate-700'
                                : 'border-slate-300 dark:border-slate-600'
                            }`}
                            onClick={() => {
                              markRowDirty(row.id)
                              setQuickEdits((q) => ({
                                ...q,
                                [row.id]: {
                                  ...draft,
                                  bvMode: 'new',
                                  newBvName:
                                    draft.newBvName.trim() || suggestedBvNameFromRow(row) || '',
                                },
                              }))
                            }}
                          >
                            Neues Bauvorhaben anlegen
                          </button>
                        </div>
                      </div>
                      <label className="block text-xs">
                        <span className="text-slate-600 dark:text-slate-400">
                          {draft.bvMode === 'new' ? 'Neuer BV-Name' : 'Bauvorhaben'}
                        </span>
                        {draft.bvMode === 'new' ? (
                          <>
                            <input
                              className="mt-0.5 w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-sm"
                              value={draft.newBvName}
                              disabled={busy}
                              placeholder={suggestedBvNameFromRow(row) || 'z. B. Wette Center Kornwestheim'}
                              onChange={(e) => {
                                markRowDirty(row.id)
                                setQuickEdits((q) => ({
                                  ...q,
                                  [row.id]: { ...draft, newBvName: e.target.value },
                                }))
                              }}
                            />
                            {suggestedBvNameFromRow(row) ? (
                              <p className="mt-1 text-[11px] text-slate-500">
                                Erkannt im PDF: <span className="font-medium">{suggestedBvNameFromRow(row)}</span>
                              </p>
                            ) : null}
                          </>
                        ) : (
                          <select
                            className="mt-0.5 w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-sm"
                            value={draft.review_bv_id}
                            disabled={busy}
                            onChange={(e) => {
                              markRowDirty(row.id)
                              const nextBvId = e.target.value
                              const bv = allBvs.find((b) => b.id === nextBvId)
                              setQuickEdits((q) => ({
                                ...q,
                                [row.id]: {
                                  ...draft,
                                  review_bv_id: nextBvId,
                                  review_customer_id: bv?.customer_id ?? draft.review_customer_id,
                                },
                              }))
                            }}
                          >
                            <option value="">—</option>
                            {bvsForDraftCustomer.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </label>
                      <label className="block text-xs">
                        <span className="text-slate-600 dark:text-slate-400">Objektname</span>
                        <input
                          className="mt-0.5 w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-sm"
                          value={draft.review_object_name}
                          disabled={busy}
                          onChange={(e) => {
                            markRowDirty(row.id)
                            setQuickEdits((q) => ({
                              ...q,
                              [row.id]: { ...draft, review_object_name: e.target.value },
                            }))
                          }}
                        />
                      </label>
                      <label className="block text-xs">
                        <span className="text-slate-600 dark:text-slate-400">Objekttyp</span>
                        <input
                          className="mt-0.5 w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-sm"
                          value={draft.review_object_type_text}
                          disabled={busy}
                          onChange={(e) => {
                            markRowDirty(row.id)
                            setQuickEdits((q) => ({
                              ...q,
                              [row.id]: { ...draft, review_object_type_text: e.target.value },
                            }))
                          }}
                        />
                      </label>
                      <label className="block text-xs">
                        <span className="text-slate-600 dark:text-slate-400">Etage</span>
                        <input
                          className="mt-0.5 w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-sm"
                          value={draft.review_floor_text}
                          disabled={busy}
                          onChange={(e) => {
                            markRowDirty(row.id)
                            setQuickEdits((q) => ({
                              ...q,
                              [row.id]: { ...draft, review_floor_text: e.target.value },
                            }))
                          }}
                        />
                      </label>
                      <label className="block text-xs">
                        <span className="text-slate-600 dark:text-slate-400">Raum</span>
                        <input
                          className="mt-0.5 w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-sm"
                          value={draft.review_room_text}
                          disabled={busy}
                          onChange={(e) => {
                            markRowDirty(row.id)
                            setQuickEdits((q) => ({
                              ...q,
                              [row.id]: { ...draft, review_room_text: e.target.value },
                            }))
                          }}
                        />
                      </label>
                    </div>
                    {row.proposed_internal_id?.trim() ? (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        Vorgeschlagene Kennung:{' '}
                        <span className="font-mono text-slate-700 dark:text-slate-200">
                          {row.proposed_internal_id.trim()}
                        </span>
                      </p>
                    ) : null}
                    {standardSoftDuplicateRowIds.has(row.id) && !row.review_object_id?.trim() ? (
                      <p className="text-xs text-amber-800 dark:text-amber-200 mt-1 leading-snug">
                        Hinweis: Mögliche Dublette im Bestand — im Expertenmodus vergleichen oder hier die
                        passende Objektzuordnung setzen.
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        className="rounded bg-slate-700 text-white px-3 py-1 text-xs font-medium disabled:opacity-50"
                        onClick={() =>
                          void (async () => {
                            await patchStagingRow(row.id, {
                              review_customer_id:
                                draft.customerMode === 'existing'
                                  ? draft.review_customer_id.trim() || null
                                  : null,
                              review_bv_id:
                                draft.bvMode === 'existing' ? draft.review_bv_id.trim() || null : null,
                              review_object_name: draft.review_object_name.trim() || null,
                              review_object_type_text: draft.review_object_type_text.trim() || null,
                              review_floor_text: draft.review_floor_text.trim() || null,
                              review_room_text: draft.review_room_text.trim() || null,
                            })
                            await recomputeOneRow(row.id)
                            clearRowDirty(row.id)
                          })()
                        }
                      >
                        Speichern & prüfen
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className="rounded border border-slate-300 dark:border-slate-600 px-3 py-1 text-xs disabled:opacity-50"
                        onClick={() => void computeMatchForRow(row.id)}
                      >
                        Zuordnung neu vorschlagen
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="mt-5 mb-5 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-800/80 p-4 sm:p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-1">Schritt 4: In Stammdaten speichern</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
            Es werden nur Zeilen mit dem Status <span className="font-medium">„Bereit“</span> gespeichert. Wählen Sie
            zuerst, ob alle Positionen, nur die in Schritt 2 angehakten oder genau eine Zeile betroffen sind.
          </p>
          {!selectedJobId ? (
            <p className="text-sm text-slate-500">Bitte wählen Sie in Schritt 1 einen Auftrag.</p>
          ) : (
            <>
              {isSinglePositionFocus && focusedRowMeta ? (
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                  Gilt für:{' '}
                  <span className="font-medium text-slate-800 dark:text-slate-200">nur Zeile {focusedRowMeta.row.sequence}</span>
                  · {fileById.get(focusedRowMeta.row.file_id)?.original_filename ?? 'Datei'}
                </p>
              ) : isSinglePositionFocus && singleStandardRowId && !focusedRowMeta ? (
                <p className="text-xs text-amber-800 dark:text-amber-200 mb-2">
                  Keine gültige Einzelposition. In Schritt 2 erneut „Nur diese Position“ wählen.
                </p>
              ) : null}
              <div className="text-sm text-slate-700 dark:text-slate-200 mb-2">
                <span className="font-medium text-emerald-800 dark:text-emerald-200">{scopeReadyCount}</span> bereit
                &nbsp;·{' '}
                <span className="font-medium text-amber-800/90 dark:text-amber-200">{scopeNeedingInputCount}</span> noch
                Eingabe nötig
                &nbsp;·{' '}
                <span className="font-medium text-slate-600 dark:text-slate-400">{scopeDeferredCount}</span> ausgesetzt
                {targetRowIds.length === 0 ? (
                  <span className="block mt-1.5 text-xs text-amber-800 dark:text-amber-200">
                    Wählen Sie in Schritt 2 eine Position (z. B. „Nur diese Position“) oder stellen Sie unten „Alle“ /
                    Markierte / eine Zeile ein.
                  </span>
                ) : isSinglePositionFocus ? (
                  <span className="text-xs text-slate-500"> (nur gewählte Zeile)</span>
                ) : null}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-500 mb-2">Umfang der Übernahme</p>
              <div className="mb-3 text-xs flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`rounded-md px-2.5 py-1.5 border ${
                    standardBulkTarget === 'all'
                      ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-100 dark:text-slate-900'
                      : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200'
                  }`}
                  onClick={() => setStandardBulkTarget('all')}
                >
                  Alle
                </button>
                <button
                  type="button"
                  className={`rounded-md px-2.5 py-1.5 border ${
                    standardBulkTarget === 'selected'
                      ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-100 dark:text-slate-900'
                      : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200'
                  }`}
                  onClick={() => setStandardBulkTarget('selected')}
                >
                  Nur markierte
                </button>
                <button
                  type="button"
                  className={`rounded-md px-2.5 py-1.5 border ${
                    standardBulkTarget === 'single'
                      ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-100 dark:text-slate-900'
                      : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200'
                  }`}
                  onClick={() => setStandardBulkTarget('single')}
                >
                  Eine wählen
                </button>
              </div>
              {standardBulkTarget === 'single' ? (
                <label className="block text-xs mb-3">
                  <span className="text-slate-600 dark:text-slate-400">Position</span>
                  <select
                    className="mt-0.5 w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-sm"
                    value={singleStandardRowId}
                    onChange={(e) => setSingleStandardRowId(e.target.value)}
                  >
                    <option value="">—</option>
                    {rows.map(({ row }) => (
                      <option key={row.id} value={row.id}>
                        Zeile #{row.sequence} · {fileById.get(row.file_id)?.original_filename ?? 'Datei'}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="flex items-start gap-2.5 text-sm mb-3 cursor-pointer max-w-prose">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-slate-300 text-vico-primary"
                  checked={standardIncludeC2}
                  disabled={busy}
                  onChange={(e) => setStandardIncludeC2(e.target.checked)}
                />
                <span>
                  <span className="font-medium">Optional:</span> erkannte Mängel aus dem Bericht-Text in die Objektakte
                  übernehmen
                </span>
              </label>
              <button
                type="button"
                disabled={busy || readyInTargetCount === 0}
                className="rounded-md bg-emerald-700 text-white px-4 py-2.5 text-sm font-medium disabled:opacity-50 shadow-sm"
                onClick={() => void handleStandardCommit()}
              >
                In Stammdaten speichern
              </button>
              {readyInTargetCount === 0 ? (
                <p className="mt-2 text-xs text-slate-500">
                  Im aktuellen Umfang ist keine Zeile mit Status „Bereit“. Bitte Schritt 3 abschließen.
                </p>
              ) : null}
            </>
          )}
        </section>

        <section className="rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-800/80 p-4 sm:p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-1">Schritt 5: Status</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
            Kurzüberblick über diesen Auftrag. Details und technische Ansicht finden Sie im Expertenmodus.
          </p>
          {!selectedJobId ? (
            <p className="text-sm text-slate-500">Bitte wählen Sie in Schritt 1 einen Auftrag.</p>
          ) : (
            <>
              <ul className="text-sm space-y-1.5 text-slate-700 dark:text-slate-200">
                <li>
                  In den Stammdaten gespeichert: <span className="font-semibold tabular-nums">{rowsCommitted.length}</span>
                </li>
                <li>
                  Noch nicht abgeschlossen: <span className="font-semibold tabular-nums">{rowsOpenAfterRun.length}</span>
                </li>
                <li>
                  Ausgesetzt oder übersprungen: <span className="font-semibold tabular-nums">{rowsDeferred.length}</span>
                </li>
              </ul>
              {standardRunResult ? (
                <div className="mt-4 rounded-lg border border-slate-200/80 dark:border-slate-600/50 bg-slate-50/80 dark:bg-slate-900/40 px-3 py-2.5 text-xs text-slate-700 dark:text-slate-200">
                  <div className="font-semibold text-slate-800 dark:text-slate-100 mb-1.5">Letzter Lauf</div>
                  <div>Erfolgreich gespeichert: {standardRunResult.c1Imported}</div>
                  <div>Fehlgeschlagen: {standardRunResult.c1Failed}</div>
                  <div>Übersprungen (z. B. nicht bereit): {standardRunResult.c1Skipped}</div>
                  {standardIncludeC2 ? (
                    <div className="mt-1">
                      Mängel mit übernommen: {standardRunResult.c2ImportedItems} Einträge in{' '}
                      {standardRunResult.c2ImportedRows} Objekt(en)
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200"
                  disabled={busy || !selectedJobId}
                  onClick={() => void loadJobDetail(selectedJobId)}
                >
                  Anzeige aktualisieren
                </button>
                <button
                  type="button"
                  className="rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200"
                  onClick={() => setViewMode('expert')}
                >
                  Expertenmodus (Details)
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    )
  }

  const filterButtons: { key: StagingFilter; label: string }[] = [
    { key: 'all', label: 'Alle' },
    { key: 'open_validation', label: 'Offene Prüfungen' },
    { key: 'needs_input', label: 'Eingabe offen' },
    { key: 'blocked', label: 'Zurückgestellt' },
    { key: 'ready', label: 'Bereit' },
    { key: 'commit_failed', label: 'Speichern fehlgeschlagen' },
    { key: 'committed', label: 'Übernommen' },
    { key: 'skipped', label: 'Übersprungen' },
  ]

  return (
    <div className="px-4 py-4 max-w-5xl mx-auto text-slate-800 dark:text-slate-100">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h2 className="text-xl font-bold">Altbericht-Import (Experte)</h2>
        <button
          type="button"
          className="rounded border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs"
          onClick={() => setViewMode('standard')}
        >
          Einfache Ansicht
        </button>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 max-w-3xl">
        Vollzugriff: PDF-Auswertung, Vorschauzeilen, Stammdaten-Übernahme und optionale Mängelübernahme. Technische
        Abläufe (u. a. C1/C2) bleiben unverändert; hier steuern Sie alle Details pro Auftrag.
      </p>

      <section className="mb-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800/80 p-4 shadow-sm">
        <h3 className="font-semibold mb-3">Neuer Job</h3>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <label className="flex-1 text-sm">
            <span className="block text-slate-600 dark:text-slate-400 mb-1">Titel (optional)</span>
            <input
              className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="z. B. Altberichte Q2"
            />
          </label>
          <label className="flex-1 text-sm">
            <span className="block text-slate-600 dark:text-slate-400 mb-1">PDF-Dateien</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              multiple
              className="w-full text-sm"
              onChange={(e) => setPickedFiles(e.target.files)}
            />
          </label>
          <button
            type="button"
            disabled={busy}
            className="rounded bg-slate-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            onClick={() => void handleCreateAndUpload()}
          >
            Anlegen &amp; hochladen
          </button>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800/80 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Jobs</h3>
            <button
              type="button"
              className="text-xs text-slate-600 dark:text-slate-400 underline"
              onClick={() => void loadJobs()}
            >
              Aktualisieren
            </button>
          </div>
          {listLoading ? (
            <LoadingSpinner message="Lade Jobs…" size="sm" className="py-6" />
          ) : jobs.length === 0 ? (
            <p className="text-sm text-slate-500">Noch keine Jobs.</p>
          ) : (
            <ul className="max-h-64 overflow-auto text-sm space-y-1">
              {jobs.map((j) => (
                <li key={j.id} className="flex items-stretch gap-1">
                  <button
                    type="button"
                    className={`flex-1 min-w-0 text-left rounded px-2 py-1.5 ${
                      selectedJobId === j.id
                        ? 'bg-slate-200 dark:bg-slate-700'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-700/50'
                    }`}
                    onClick={() => setSelectedJobId(j.id)}
                  >
                    <span className="font-medium">{j.title || 'Ohne Titel'}</span>
                    <span className="text-slate-500 dark:text-slate-400"> · {j.status}</span>
                    <span className="block text-xs text-slate-500">
                      {new Date(j.created_at).toLocaleString('de-DE')}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="shrink-0 self-center rounded border border-red-200 text-red-700 dark:border-red-900 dark:text-red-300 px-1.5 py-0.5 text-[11px] disabled:opacity-50"
                    disabled={busy}
                    title="Job löschen"
                    onClick={(e) => {
                      e.stopPropagation()
                      void handleDeleteJob(j.id)
                    }}
                  >
                    Löschen
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800/80 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Dateien</h3>
            {selectedJobId ? (
              <button
                type="button"
                disabled={busy}
                className="text-xs rounded bg-slate-600 text-white px-2 py-1 disabled:opacity-50"
                onClick={() => void handleParseAll()}
              >
                Alle Dateien verarbeiten
              </button>
            ) : null}
          </div>
          {!selectedJobId ? (
            <p className="text-sm text-slate-500">Job auswählen.</p>
          ) : detailLoading ? (
            <LoadingSpinner message="Lade Dateien…" size="sm" className="py-6" />
          ) : files.length === 0 ? (
            <p className="text-sm text-slate-500">Keine Dateien.</p>
          ) : (
            <ul className="text-sm space-y-2 max-h-72 overflow-auto">
              {files.map((f) => (
                <li
                  key={f.id}
                  className="border border-slate-100 dark:border-slate-700 rounded p-2 flex flex-col gap-1"
                >
                  <div className="font-medium break-all">{f.original_filename}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    Status: {f.status}
                    {f.byte_size != null ? ` · ${(f.byte_size / 1024).toFixed(1)} KB` : ''}
                  </div>
                  {f.parse_error_message ? (
                    <div className="text-xs text-red-600 dark:text-red-400">{f.parse_error_message}</div>
                  ) : null}
                  {(() => {
                    const d = expertParserDiagnosticsByFileId.get(f.id)
                    if (!d) return null
                    return (
                      <div className="mt-1.5 pt-1.5 border-t border-slate-200 dark:border-slate-600 text-[11px] leading-snug text-slate-600 dark:text-slate-400 space-y-1">
                        <div className="font-medium text-slate-500 dark:text-slate-500 uppercase tracking-wide">
                          Parser-Diagnose
                        </div>
                        <div className="font-mono">
                          <span className="text-slate-500 dark:text-slate-500">parser_version: </span>
                          {f.parser_version?.trim() ? f.parser_version : '—'}
                        </div>
                        <div className="font-mono">
                          <span className="text-slate-500">analysisTrace.mode: </span>
                          {d.modeLabels.length ? d.modeLabels.join(', ') : '—'}
                          <span className="text-slate-500"> · subMode: </span>
                          {d.subModeLabels.length ? d.subModeLabels.join(', ') : '—'}
                        </div>
                        <div className="font-mono">
                          <span className="text-slate-500">Staging-Objekte (Zahl): </span>
                          {d.objectCount}
                        </div>
                        {d.parserPipelineEvents.length > 0 ? (
                          <ul className="list-disc pl-4 space-y-0.5 text-amber-900 dark:text-amber-200/90 font-sans not-italic">
                            {d.parserPipelineEvents.map((ev) => (
                              <li key={ev.id}>
                                <span className="font-mono text-slate-500">
                                  [{ev.level}] {ev.code}:{' '}
                                </span>
                                {ev.message}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    )
                  })()}
                  {['pending', 'parse_failed', 'parsed', 'staged', 'parsing'].includes(f.status) ? (
                    <button
                      type="button"
                      disabled={busy}
                      className="self-start text-xs underline text-slate-700 dark:text-slate-300 disabled:opacity-50"
                      onClick={() => void handleParseOne(f.id)}
                    >
                      {f.status === 'staged' || f.status === 'parsing' ? 'Erneut parsen' : 'Parsen'}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {selectedJobId && staging.length > 0 ? (
        <section className="mt-6 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800/80 p-4 shadow-sm">
          <h3 className="font-semibold mb-2">Kunde & Bauvorhaben für den Auftrag</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
            Standard-Kunde und -Bauvorhaben für viele Zeilen auf einmal setzen (Kürzel für die Vorschau, nicht
            zwingend für jedes Objekt).
          </p>
          {mastersLoading ? (
            <LoadingSpinner message="Stammdaten…" size="sm" className="py-4" />
          ) : (
            <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
              <label className="flex-1 text-sm">
                <span className="block text-slate-600 dark:text-slate-400 mb-1">Kunde</span>
                <select
                  className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm"
                  value={jobCustomerId}
                  disabled={busy}
                  onChange={(e) => {
                    setJobCustomerId(e.target.value)
                    const ok = allBvs.some((b) => b.id === jobBvId && b.customer_id === e.target.value)
                    if (!ok) setJobBvId('')
                  }}
                >
                  <option value="">—</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex-1 text-sm">
                <span className="block text-slate-600 dark:text-slate-400 mb-1">Bauvorhaben (BV)</span>
                <select
                  className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm"
                  value={jobBvId}
                  disabled={busy}
                  onChange={(e) => {
                    const v = e.target.value
                    setJobBvId(v)
                    const bv = allBvs.find((b) => b.id === v)
                    if (bv) setJobCustomerId(bv.customer_id)
                  }}
                >
                  <option value="">—</option>
                  {jobBvs.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  className="rounded bg-slate-700 text-white px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                  onClick={() => void handleJobApplyBv('all')}
                >
                  Auf alle Zeilen
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="rounded border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs disabled:opacity-50"
                  onClick={() => void handleJobApplyBv('empty_bv_only')}
                >
                  Nur leere BV-Felder
                </button>
              </div>
            </div>
          )}
        </section>
      ) : null}

      {viewMode === 'expert' && selectedJobId ? (
        <AltberichtExpertEmbeddedImagesPanel
          jobId={selectedJobId}
          files={files}
          images={embeddedImages}
          staging={staging}
          imageLoadError={embeddedImagesError}
          busy={busy}
          onPatched={() => {
            if (selectedJobId) void loadEmbeddedImages(selectedJobId)
          }}
        />
      ) : null}

      <section className="mt-6 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800/80 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="font-semibold">Vorschau &amp; Bearbeitung</h3>
          {selectedJobId && staging.length > 0 ? (
            <button
              type="button"
              disabled={busy}
              className="text-xs rounded-md bg-slate-600 text-white px-2 py-1 disabled:opacity-50"
              onClick={() => void handleRecomputeReview()}
            >
              Alle Zeilen prüfen
            </button>
          ) : null}
        </div>

        {selectedJobId && staging.length > 0 ? (
          <div className="mb-4 rounded-lg border border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/80 dark:bg-emerald-950/40 px-3 py-2.5 text-sm">
            <div className="font-medium text-emerald-900 dark:text-emerald-100 mb-1">
              Stammdaten dauerhaft speichern
            </div>
            <p className="text-xs text-emerald-800 dark:text-emerald-200/90 mb-2">
              Es werden nur Zeilen mit Status <strong>„Bereit“</strong> und ohne offene Prüfungen übernommen.
              Blockierte oder übersprungene Zeilen bleiben unverändert.
            </p>
            <div className="flex flex-wrap gap-2 items-center">
              <button
                type="button"
                disabled={busy || commitEligibleInJob.length === 0}
                className="rounded-md bg-emerald-700 text-white px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                onClick={() => void handleCommitEntireJob()}
              >
                Gesamter Auftrag ({commitEligibleInJob.length} bereit)
              </button>
              <button
                type="button"
                disabled={busy || commitEligibleInFiltered.length === 0}
                className="rounded-md border border-emerald-700 text-emerald-900 dark:text-emerald-100 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                onClick={() => void handleCommitFilteredList()}
                title="Nur die aktuell durch den Filter sichtbaren Zeilen-IDs. Nicht speicherbare Zeilen erscheinen als übersprungen."
              >
                Gefilterte Ansicht ({commitEligibleInFiltered.length} von {filteredStaging.length} sichtbar)
              </button>
            </div>
          </div>
        ) : null}

        {lastCommitSummary && lastCommitSummary.results.length > 0 ? (
          <div className="mb-4 rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 px-3 py-2 text-xs">
            <div className="font-medium text-slate-800 dark:text-slate-100 mb-1">
              Letztes Ergebnis – Stammdaten ({lastCommitSummary.label})
            </div>
            <ul className="space-y-1 max-h-40 overflow-auto font-mono text-[11px]">
              {lastCommitSummary.results.map((r) => {
                const seq = stagingRowById.get(r.stagingObjectId)?.sequence
                const label = seq != null ? `#${seq}` : r.stagingObjectId.slice(0, 8)
                const status = r.skipped
                  ? `skipped (${r.skipReason ?? '—'})`
                  : r.ok
                    ? `ok → Objekt ${r.objectId?.slice(0, 8) ?? '—'}…`
                    : `Fehler: ${r.errorMessage ?? '—'}`
                return (
                  <li key={r.stagingObjectId}>
                    {label}: {status}
                  </li>
                )
              })}
            </ul>
            <button
              type="button"
              className="mt-2 text-slate-600 dark:text-slate-400 underline"
              onClick={() => setLastCommitSummary(null)}
            >
              Anzeige ausblenden
            </button>
          </div>
        ) : null}

        {selectedJobId && staging.length > 0 ? (
          <div className="flex flex-wrap gap-1 mb-4">
            {filterButtons.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                disabled={busy}
                className={`rounded px-2 py-1 text-xs ${
                  stagingFilter === key
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
                onClick={() => setStagingFilter(key)}
              >
                {label}
              </button>
            ))}
            <span className="text-xs text-slate-500 self-center ml-2">
              {filteredStaging.length} von {staging.length}
            </span>
          </div>
        ) : null}

        {!selectedJobId ? (
          <p className="text-sm text-slate-500">Job auswählen.</p>
        ) : staging.length === 0 ? (
          <p className="text-sm text-slate-500">Noch keine Staging-Objekte.</p>
        ) : filteredStaging.length === 0 ? (
          <p className="text-sm text-slate-500">Keine Zeilen für diesen Filter.</p>
        ) : (
          <ul className="space-y-4 max-h-[70vh] overflow-auto pr-1">
            {filteredStaging.map((s) => (
              <AltberichtStagingReviewRowEditor
                key={s.id}
                row={s}
                customers={customers}
                allBvs={allBvs}
                allObjects={allObjects}
                busy={busy}
                fileExtractedText={files.find((f) => f.id === s.file_id)?.extracted_text ?? null}
                c1PositionCompare={
                  viewMode === 'expert'
                    ? buildC1PositionCompare(
                        s,
                        s.committed_object_id?.trim()
                          ? objectByIdForC1Compare.get(s.committed_object_id.trim()) ?? null
                          : null
                      )
                    : null
                }
                onPatch={(patch) => patchStagingRow(s.id, patch)}
                onComputeMatch={() => computeMatchForRow(s.id)}
                onRecomputeRow={() => recomputeOneRow(s.id)}
                onCommitRow={
                  isAltberichtStagingRowCommitEligible(s) && !s.committed_at
                    ? () => commitOneRow(s)
                    : undefined
                }
                onCommitC2Defects={
                  isAltberichtStagingRowC2Eligible(s)
                    ? (items) => commitC2ForRow(s, items)
                    : undefined
                }
              />
            ))}
          </ul>
        )}
      </section>

    </div>
  )
}

export default AltberichtImportPage
