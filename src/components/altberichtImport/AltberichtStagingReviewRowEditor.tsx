import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Customer } from '../../types/customer'
import type { BV } from '../../types/bv'
import type { Object as Obj } from '../../types/object'
import type { AltberichtImportStagingObjectRow } from '../../lib/altberichtImport/altberichtImportQueryService'
import type { AltberichtStagingReviewPatch } from '../../lib/altberichtImport/altberichtImportReviewTypes'
import type { AltberichtImportEmbeddedImageRow, AltberichtImportFileRow } from '../../lib/altberichtImport'
import { AltberichtStagingRowEmbeddedImages } from './AltberichtStagingRowEmbeddedImages'
import {
  collectAltberichtNameSuggestions,
  isAltberichtMatchPayloadV1,
} from '../../lib/altberichtImport/altberichtStagingMatchCandidates'
import {
  isAltberichtStagingRowCommitEligible,
  isAltberichtStagingRowC2Eligible,
  listAltberichtC2FindingRows,
  type AltberichtC2CommitItem,
} from '../../lib/altberichtImport'
import { getAltberichtCatalogFieldRaw } from '../../lib/altberichtImport/altberichtImportC1ObjectFields'
import type { C1PositionCompare } from '../../lib/altberichtImport/altberichtImportC1CompareReport'
import { listAltberichtSoftDuplicateHints } from '../../lib/altberichtImport/altberichtImportMatchKey'
import { AltberichtC1CompareRowInline } from './AltberichtC1CompareRowInline'

const catalogValueOrMissing = (v: string | null): string =>
  v != null && String(v).trim().length > 0 ? String(v).trim() : '— nicht erkannt'

type SchliessmittelDebugTrace = {
  blockSnippet?: string
  schliessmittelHeaderLine?: string | null
  parsedTypSourceLine?: string | null
}

type StatusFindingsDebugTrace = {
  sequence?: number
  blockRawPreview?: string | null
  statusRawAround?: string | null
  statusCandidate?: string | null
  rejectedReason?: string | null
  findingsFilled?: boolean
  statusFindingAccepted?: boolean
  findingsCount?: number
}

const readSchliessmittelDebugFromTrace = (trace: unknown): SchliessmittelDebugTrace | null => {
  if (!trace || typeof trace !== 'object') return null
  const raw = (trace as { schliessmittelDebug?: unknown }).schliessmittelDebug
  if (!raw || typeof raw !== 'object') return null
  return raw as SchliessmittelDebugTrace
}

const readStatusFindingsDebugFromTrace = (trace: unknown): StatusFindingsDebugTrace | null => {
  if (!trace || typeof trace !== 'object') return null
  const raw = (trace as { statusFindingsDebug?: unknown }).statusFindingsDebug
  if (!raw || typeof raw !== 'object') return null
  return raw as StatusFindingsDebugTrace
}

const isWegStructuredTrace = (trace: unknown): boolean => {
  if (!trace || typeof trace !== 'object') return false
  const t = trace as { mode?: unknown; wegWartung?: unknown; subMode?: unknown }
  if (t.mode !== 'structured_altbericht_v1') return false
  if (t.wegWartung != null) return true
  const sm = String(t.subMode ?? '')
  return sm.includes('weg') || sm.startsWith('we_')
}

/**
 * Fallback, wenn `analysis_trace_json.schliessmittelDebug` fehlt (alte Staging-Zeilen): n-te
 * Schließmittel-Zeile in `extracted_text` der Datei (n = `sequence`).
 */
const schliessmittelContextFromFileExtracted = (fileText: string, occurrence1Based: number, maxLines = 8): string => {
  const t = fileText.trim()
  if (!t) return ''
  const lines = t.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim())
  const hits: number[] = []
  for (let i = 0; i < lines.length; i += 1) {
    if (/(?:Schließ|Schliess)mittel/i.test(lines[i]!)) hits.push(i)
  }
  if (hits.length === 0) return ''
  const pick = Math.min(Math.max(occurrence1Based, 1), hits.length) - 1
  const idx = hits[pick]!
  const start = Math.max(0, idx - 1)
  return lines.slice(start, start + maxLines).join('\n')
}

const formatObjectPickerLabel = (o: Obj): string => {
  const name = o.name?.trim() || o.internal_id?.trim() || 'Ohne Namen'
  const loc = [o.floor?.trim(), o.room?.trim()].filter(Boolean).join(' · ') || '—'
  return `${name} (${loc})`
}

export type AltberichtStagingReviewRowEditorProps = {
  row: AltberichtImportStagingObjectRow
  customers: Customer[]
  allBvs: BV[]
  allObjects: Obj[]
  busy: boolean
  onPatch: (patch: AltberichtStagingReviewPatch) => Promise<void>
  onComputeMatch: () => Promise<void>
  onRecomputeRow: () => Promise<void>
  /** Paket C1: einzelne Zeile committen (nur wenn Parent gesetzt). */
  onCommitRow?: () => void | Promise<void>
  /** Paket C2: Mängel aus findings_json übernehmen (nur nach C1, mit expliziter Auswahl). */
  onCommitC2Defects?: (items: AltberichtC2CommitItem[]) => void | Promise<void>
  /** Optional: Volltext der Datei (für Schließmittel-Debug, nur Experten-View). */
  fileExtractedText?: string | null
  /** Experte: C1 Staging ↔ Produktiv pro Zeile (null = ausblenden). */
  c1PositionCompare?: C1PositionCompare | null
  /** Experte: Zielobjekt für committed/review-Objekt-ID wurde geladen. */
  c1ProductiveObjectLoaded?: boolean
  /** PDF-Bilder, die dieser Staging-Zeile zugeordnet sind (Review). */
  rowEmbeddedImages?: AltberichtImportEmbeddedImageRow[]
  rowEmbeddedFile?: AltberichtImportFileRow | null
  allJobEmbeddedImages?: AltberichtImportEmbeddedImageRow[]
  /** Alle Bildeinträge dieser Datei (gleiche file_id). */
  fileEmbeddedImageTotal?: number
  /** Als vermutliches Logo/Kopf ausgeblendete Einträge dieser Datei. */
  fileLikelyLogoCount?: number
  /** Übersprungene PDF-Seiten dieser Datei (Bildscan-Timeout). */
  fileSkippedPages?: number[]
  /** Scrollcontainer der Staging-Liste (IntersectionObserver für Foto-Thumbnails). */
  stagingScrollIntersectionRoot?: HTMLElement | null
  /** Öffnet die PDF-Vollvorschau auf einer bestimmten Seite (nutzt vorhandenes Overlay). */
  onOpenPagePreview?: (fileRow: AltberichtImportFileRow, pageNumber: number) => void
  onEmbeddedImagesChanged?: () => void
}

const validationEntries = (row: AltberichtImportStagingObjectRow): { code: string; message: string }[] => {
  const raw = row.validation_errors_json
  if (!Array.isArray(raw)) return []
  return raw
    .map((x) => {
      if (x && typeof x === 'object' && 'code' in x && 'message' in x) {
        return {
          code: String((x as { code: unknown }).code),
          message: String((x as { message: unknown }).message),
        }
      }
      return null
    })
    .filter((x): x is { code: string; message: string } => x != null)
}

export function AltberichtStagingReviewRowEditor({
  row,
  customers,
  allBvs,
  allObjects,
  busy,
  onPatch,
  onComputeMatch,
  onRecomputeRow,
  onCommitRow,
  onCommitC2Defects,
  fileExtractedText,
  c1PositionCompare,
  c1ProductiveObjectLoaded,
  rowEmbeddedImages,
  rowEmbeddedFile,
  allJobEmbeddedImages,
  fileEmbeddedImageTotal,
  fileLikelyLogoCount,
  fileSkippedPages,
  stagingScrollIntersectionRoot,
  onOpenPagePreview,
  onEmbeddedImagesChanged,
}: AltberichtStagingReviewRowEditorProps) {
  const [reviewCustomerId, setReviewCustomerId] = useState(row.review_customer_id ?? '')
  const [reviewBvId, setReviewBvId] = useState(row.review_bv_id ?? '')
  const [reviewObjectName, setReviewObjectName] = useState(
    row.review_object_name ?? row.object_name ?? ''
  )
  const [reviewObjectType, setReviewObjectType] = useState(
    row.review_object_type_text ?? row.object_type_text ?? ''
  )
  const [reviewFloor, setReviewFloor] = useState(row.review_floor_text ?? row.floor_text ?? '')
  const [reviewRoom, setReviewRoom] = useState(row.review_room_text ?? row.room_text ?? '')
  const [blockedReason, setBlockedReason] = useState(row.review_blocked_reason ?? '')
  const [reviewObjectId, setReviewObjectId] = useState(row.review_object_id?.trim() ?? '')
  const [objectLinkQuery, setObjectLinkQuery] = useState('')

  useEffect(() => {
    setReviewCustomerId(row.review_customer_id ?? '')
    setReviewBvId(row.review_bv_id ?? '')
    setReviewObjectName(row.review_object_name ?? row.object_name ?? '')
    setReviewObjectType(row.review_object_type_text ?? row.object_type_text ?? '')
    setReviewFloor(row.review_floor_text ?? row.floor_text ?? '')
    setReviewRoom(row.review_room_text ?? row.room_text ?? '')
    setBlockedReason(row.review_blocked_reason ?? '')
    setReviewObjectId(row.review_object_id?.trim() ?? '')
  }, [
    row.id,
    row.updated_at,
    row.review_customer_id,
    row.review_bv_id,
    row.review_object_id,
    row.review_object_name,
    row.review_object_type_text,
    row.review_floor_text,
    row.review_room_text,
    row.review_blocked_reason,
    row.object_name,
    row.object_type_text,
    row.floor_text,
    row.room_text,
  ])

  const bvsForCustomer = reviewCustomerId
    ? allBvs.filter((b) => b.customer_id === reviewCustomerId)
    : allBvs

  const effectiveBvForObjects = useMemo(
    () => reviewBvId.trim() || row.review_bv_id?.trim() || row.bv_id?.trim() || '',
    [reviewBvId, row.review_bv_id, row.bv_id]
  )

  const linkedObject = useMemo(
    () => (reviewObjectId ? allObjects.find((o) => o.id === reviewObjectId) : undefined),
    [allObjects, reviewObjectId]
  )

  const bvMismatch = Boolean(
    linkedObject &&
      effectiveBvForObjects &&
      linkedObject.bv_id &&
      linkedObject.bv_id !== effectiveBvForObjects
  )

  const objectsForPicker = useMemo(() => {
    const bv = effectiveBvForObjects
    const customer = reviewCustomerId.trim() || row.review_customer_id?.trim() || ''
    const customerBvIds = new Set(allBvs.filter((b) => b.customer_id === customer).map((b) => b.id))
    const q = objectLinkQuery.trim().toLowerCase()
    let list = allObjects.filter((o) => {
      if (o.archived_at) return false
      if (bv) return o.bv_id === bv
      if (customer) {
        return o.customer_id === customer || o.bv_id == null || (o.bv_id ? customerBvIds.has(o.bv_id) : false)
      }
      return false
    })
    if (q) {
      list = list.filter((o) => {
        const label = formatObjectPickerLabel(o).toLowerCase()
        return (
          label.includes(q) ||
          (o.internal_id?.toLowerCase().includes(q) ?? false) ||
          (o.name?.toLowerCase().includes(q) ?? false) ||
          o.id.toLowerCase().includes(q)
        )
      })
    }
    if (reviewObjectId && !list.some((o) => o.id === reviewObjectId)) {
      const cur = allObjects.find((o) => o.id === reviewObjectId)
      if (cur) list = [...list, cur]
    }
    return [...list].sort((a, b) =>
      formatObjectPickerLabel(a).localeCompare(formatObjectPickerLabel(b), 'de')
    )
  }, [allBvs, allObjects, effectiveBvForObjects, objectLinkQuery, reviewCustomerId, row.review_customer_id, reviewObjectId])

  const applyReviewObjectLink = useCallback(
    async (id: string | null) => {
      const next = id?.trim() || null
      setReviewObjectId(next ?? '')
      await onPatch({ review_object_id: next })
    },
    [onPatch]
  )

  const nameSuggestions = collectAltberichtNameSuggestions(row)
  const structuredCatalogForRow = useMemo(() => {
    const cat = row.catalog_candidates_json
    const art = getAltberichtCatalogFieldRaw(cat, 'art')
    const fluegel = getAltberichtCatalogFieldRaw(cat, 'fluegel')
    const anforderung = getAltberichtCatalogFieldRaw(cat, 'anforderung')
    const hersteller = getAltberichtCatalogFieldRaw(cat, 'hersteller')
    const schliessmittelTyp =
      getAltberichtCatalogFieldRaw(cat, 'schliessmittel_typ') ??
      getAltberichtCatalogFieldRaw(cat, 'schliessmittel')
    return { art, fluegel, anforderung, hersteller, schliessmittelTyp }
  }, [row.catalog_candidates_json])

  const schliessmittelDebugPanel = useMemo(() => {
    if (!isWegStructuredTrace(row.analysis_trace_json)) return null
    const fromTrace = readSchliessmittelDebugFromTrace(row.analysis_trace_json) ?? {}
    const fromFile =
      fileExtractedText && fileExtractedText.trim()
        ? schliessmittelContextFromFileExtracted(fileExtractedText, row.sequence, 8)
        : ''
    const snippet = (fromTrace.blockSnippet?.trim() || fromFile).trim() || null
    return {
      fromTrace,
      snippet,
      usedFileOnly: Boolean(fromFile) && !fromTrace.blockSnippet?.trim(),
    }
  }, [row.analysis_trace_json, row.sequence, fileExtractedText])

  const statusFindingsDebug = useMemo(
    () => readStatusFindingsDebugFromTrace(row.analysis_trace_json),
    [row.analysis_trace_json]
  )

  const findingsJsonPreview = useMemo(() => {
    try {
      return JSON.stringify(row.findings_json ?? [], null, 2)
    } catch {
      return String(row.findings_json ?? '')
    }
  }, [row.findings_json])

  const c2Candidates = useMemo(
    () => listAltberichtC2FindingRows(row),
    [row.id, row.updated_at, row.findings_json, row.c2_defects_imported_keys]
  )
  const c2Eligible = isAltberichtStagingRowC2Eligible(row)
  const [c2Draft, setC2Draft] = useState<Record<string, string>>({})
  const [c2Selected, setC2Selected] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const nextDraft: Record<string, string> = {}
    const nextSel: Record<string, boolean> = {}
    for (const c of listAltberichtC2FindingRows(row)) {
      nextDraft[c.key] = c.commitText
      nextSel[c.key] = false
    }
    setC2Draft(nextDraft)
    setC2Selected(nextSel)
  }, [row.id, row.updated_at, row.findings_json, row.c2_defects_imported_keys])

  const handleC2Commit = useCallback(async () => {
    if (!onCommitC2Defects) return
    const items: AltberichtC2CommitItem[] = []
    for (const c of c2Candidates) {
      if (c.alreadyImported) continue
      if (!c2Selected[c.key]) continue
      const text = (c2Draft[c.key] ?? '').trim()
      if (!text) continue
      items.push({ key: c.key, text })
    }
    if (items.length === 0) return
    await onCommitC2Defects(items)
  }, [onCommitC2Defects, c2Candidates, c2Selected, c2Draft])

  const matchPayload = isAltberichtMatchPayloadV1(row.match_candidates_json) ? row.match_candidates_json : null
  const valErrs = validationEntries(row)
  const rs = row.review_status ?? 'draft'
  const hasCommittedObjectId = Boolean(row.committed_object_id?.trim())
  const hasCommittedState = Boolean(row.committed_at) || rs === 'committed'
  const committedObjectLoaded = c1ProductiveObjectLoaded ?? true
  const isCommitted =
    hasCommittedObjectId && hasCommittedState && committedObjectLoaded
  const hasIncompleteCommit =
    hasCommittedState && (!hasCommittedObjectId || !committedObjectLoaded)
  const canTryCommit =
    Boolean(onCommitRow) && isAltberichtStagingRowCommitEligible(row, { allowMissingDetails: true }) && !isCommitted

  const handleSave = useCallback(async () => {
    const effBv =
      reviewBvId.trim() || row.review_bv_id?.trim() || row.bv_id?.trim() || null
    const effCustomer = reviewCustomerId.trim() || row.review_customer_id?.trim() || null
    let objectIdToSave: string | null = reviewObjectId.trim() || null
    if (objectIdToSave) {
      const o = allObjects.find((x) => x.id === objectIdToSave)
      if (
        !o ||
        o.archived_at ||
        (effBv && o.bv_id !== effBv) ||
        (!effBv && effCustomer && o.customer_id != null && o.customer_id !== effCustomer)
      ) {
        objectIdToSave = null
      }
    }
    await onPatch({
      review_customer_id: reviewCustomerId.trim() ? reviewCustomerId.trim() : null,
      review_bv_id: reviewBvId.trim() ? reviewBvId.trim() : null,
      review_object_id: objectIdToSave,
      review_object_name: reviewObjectName.trim() || null,
      review_object_type_text: reviewObjectType.trim() || null,
      review_floor_text: reviewFloor.trim() || null,
      review_room_text: reviewRoom.trim() || null,
      review_blocked_reason: blockedReason.trim() || null,
    })
  }, [
    allObjects,
    blockedReason,
    onPatch,
    reviewBvId,
    reviewCustomerId,
    reviewFloor,
    reviewObjectId,
    reviewObjectName,
    reviewObjectType,
    reviewRoom,
    row.bv_id,
    row.review_bv_id,
    row.review_customer_id,
  ])

  const applyBvCandidate = async (id: string) => {
    const bv = allBvs.find((b) => b.id === id)
    setReviewBvId(id)
    setReviewCustomerId(bv?.customer_id ?? reviewCustomerId)
    await onPatch({
      review_customer_id: bv?.customer_id ?? (reviewCustomerId.trim() || null),
      review_bv_id: id,
    })
  }

  const applyObjectTexts = async (o: Obj) => {
    const typeParts: string[] = []
    if (o.type_freitext?.trim()) typeParts.push(o.type_freitext.trim())
    else {
      if (o.type_tuer) typeParts.push('Tür')
      if (o.type_sektionaltor) typeParts.push('Sektionaltor')
      if (o.type_schiebetor) typeParts.push('Schiebetor')
    }
    const typeStr = typeParts.join(', ') || reviewObjectType
    const nameStr = o.name?.trim() || o.internal_id?.trim() || reviewObjectName
    setReviewObjectName(nameStr)
    setReviewObjectType(typeStr)
    await onPatch({
      review_object_name: nameStr || null,
      review_object_type_text: typeStr || null,
      review_floor_text: o.floor?.trim() || reviewFloor.trim() || null,
      review_room_text: o.room?.trim() || reviewRoom.trim() || null,
    })
  }

  /**
   * Nach „Review speichern“: Parent liefert frisches `c1PositionCompare`, aber der Abgleich-Block soll
   * einmalig neu mounten, damit Kurztext/Details sofort dem gespeicherten Staging-Stand folgen
   * (vermeidet stehen gebliebene Anzeige bei gleichem `row.id`-Listen-Key).
   */
  const c1AbgleichRemountKey = useMemo(
    () =>
      [
        row.updated_at,
        row.reviewed_at ?? '',
        row.review_status ?? '',
        row.review_object_id ?? '',
        row.review_object_name ?? '',
        row.review_object_type_text ?? '',
        row.review_floor_text ?? '',
        row.review_room_text ?? '',
        row.review_bv_id ?? '',
        row.review_customer_id ?? '',
        row.committed_object_id ?? '',
        row.committed_at ?? '',
        row.proposed_internal_id ?? '',
        row.import_match_key ?? '',
        JSON.stringify(row.validation_errors_json ?? null),
      ].join('\u001f'),
    [
      row.updated_at,
      row.reviewed_at,
      row.review_status,
      row.review_object_id,
      row.review_object_name,
      row.review_object_type_text,
      row.review_floor_text,
      row.review_room_text,
      row.review_bv_id,
      row.review_customer_id,
      row.committed_object_id,
      row.committed_at,
      row.proposed_internal_id,
      row.import_match_key,
      row.validation_errors_json,
    ]
  )

  const softDuplicateHints = useMemo(
    () => listAltberichtSoftDuplicateHints(row, allObjects, formatObjectPickerLabel).slice(0, 5),
    [row, allObjects]
  )

  return (
    <li className="border border-slate-200 dark:border-slate-600 rounded-lg p-3 text-sm bg-white/90 dark:bg-slate-900/40 space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="font-medium text-slate-800 dark:text-slate-100">
            Zeile #{row.sequence}
          </span>
          <span className="text-slate-500 dark:text-slate-400 ml-2">
            Auswertung: {row.status} · Prüfung: {rs}
          </span>
        </div>
        <span className="text-xs text-slate-500">Datei {row.file_id.slice(0, 8)}…</span>
      </div>

      <div className="text-xs text-slate-600 dark:text-slate-300 space-y-0.5">
        <div>
          <span className="text-slate-500">Vorgeschlagene interne ID (Kennung): </span>
          <span className="font-mono text-slate-800 dark:text-slate-100">
            {row.proposed_internal_id?.trim() || '—'}
          </span>
        </div>
        {c1PositionCompare && row.import_match_key?.trim() ? (
          <details className="text-[10px] text-slate-500 dark:text-slate-400 group">
            <summary className="cursor-pointer list-none pl-0 text-slate-500 dark:text-slate-400 hover:underline">
              Technische Merkmale (für Dubletten-Abgleich, optional)
            </summary>
            <p className="mt-1 font-mono break-all m-0 opacity-90" title="Import-Match-Key; getrennt von der sichtbaren Kennung">
              {row.import_match_key}
            </p>
          </details>
        ) : null}
      </div>

      {softDuplicateHints.length > 0 && !row.review_object_id?.trim() ? (
        <div className="text-xs text-amber-900 dark:text-amber-100 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded px-2 py-1.5">
          <div className="font-medium">Mögliche Dublette: passendes Objekt im Bestand</div>
          <p className="mt-0.5 m-0">
            Kandidaten: {softDuplicateHints.map((h) => h.label).join(' · ')}. Bitte prüfen, ob Sie ein
            bestehendes Objekt verknüpfen möchten, oder trotzdem eine neue Objektkarte anlegen. Es gibt
            keine Sperre.
          </p>
        </div>
      ) : null}

      {valErrs.length > 0 ? (
        <ul className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/30 rounded px-2 py-1 list-disc list-inside">
          {valErrs.map((e) => (
            <li key={e.code}>
              {e.message} <span className="opacity-70">({e.code})</span>
            </li>
          ))}
        </ul>
      ) : null}

      {row.commit_last_error?.trim() && !isCommitted ? (
        <div className="text-xs text-red-800 dark:text-red-200 bg-red-50 dark:bg-red-950/40 rounded px-2 py-1">
          <span className="font-medium">Fehler beim letzten Speichern:</span> {row.commit_last_error}
        </div>
      ) : null}

      {hasIncompleteCommit ? (
        <div className="text-xs text-red-800 dark:text-red-200 bg-red-50 dark:bg-red-950/40 rounded px-2 py-1">
          <span className="font-medium">Commit unvollständig:</span>{' '}
          {!hasCommittedObjectId
            ? 'Es wurde kein Produktiv-Objekt verifiziert.'
            : 'Das Produktiv-Objekt konnte für den Rückabgleich nicht geladen werden.'}{' '}
          Bitte Protokoll prüfen und Ansicht aktualisieren.
        </div>
      ) : null}

      {isCommitted ? (
        <div className="text-xs text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 rounded px-2 py-1">
          Produktiv übernommen
          {row.committed_at ? ` · ${new Date(row.committed_at).toLocaleString('de-DE')}` : ''}
          {row.committed_object_id ? (
            <span className="block font-mono mt-0.5 opacity-90">
              Objekt-ID: {row.committed_object_id}
            </span>
          ) : null}
        </div>
      ) : null}

      {c1PositionCompare ? (
        <AltberichtC1CompareRowInline key={c1AbgleichRemountKey} compare={c1PositionCompare} />
      ) : null}

      <div
        className="rounded border border-dashed border-slate-200 dark:border-slate-600 bg-slate-50/60 dark:bg-slate-800/40 px-2 py-1.5 text-[11px] leading-snug"
        title="Nur Staging-Abgleich: Werte aus catalog_candidates_json (strukturierter Parser)"
      >
        <div className="font-medium text-slate-600 dark:text-slate-400 mb-0.5">Aus dem Bericht (automatisch gelesen)</div>
        <dl className="grid grid-cols-[5.5rem_1fr] sm:grid-cols-[6.5rem_1fr] gap-x-2 gap-y-0.5 text-slate-700 dark:text-slate-300">
          <dt className="text-slate-500 shrink-0">Art</dt>
          <dd className="min-w-0 break-words">{catalogValueOrMissing(structuredCatalogForRow.art)}</dd>
          <dt className="text-slate-500 shrink-0">Flügel</dt>
          <dd className="min-w-0 break-words">{catalogValueOrMissing(structuredCatalogForRow.fluegel)}</dd>
          <dt className="text-slate-500 shrink-0">Anforderung</dt>
          <dd className="min-w-0 break-words">{catalogValueOrMissing(structuredCatalogForRow.anforderung)}</dd>
          <dt className="text-slate-500 shrink-0">Hersteller</dt>
          <dd className="min-w-0 break-words">{catalogValueOrMissing(structuredCatalogForRow.hersteller)}</dd>
          <dt className="text-slate-500 shrink-0">Schließmittel Typ</dt>
          <dd className="min-w-0 break-words">
            {catalogValueOrMissing(structuredCatalogForRow.schliessmittelTyp)}
          </dd>
        </dl>
      </div>

      {schliessmittelDebugPanel ? (
        <div
          className="rounded border border-amber-200/80 dark:border-amber-800/50 bg-amber-50/40 dark:bg-amber-950/20 px-2 py-1.5 text-[10px] leading-tight text-slate-700 dark:text-slate-300"
          title="Nur Diagnose: Blockausschnitt und Parser-Zeilen, kein fachlicher Status"
        >
          <div className="font-medium text-amber-900 dark:text-amber-200/95 mb-0.5">Schließmittel (Parser-Debug)</div>
          {schliessmittelDebugPanel.usedFileOnly ? (
            <p className="text-amber-800/90 dark:text-amber-200/80 mb-1">
              Ausschnitt aus Datei-Volltext (n-te Schließmittel-Zeile), kein Block-Snippet in
              <code className="mx-0.5">analysis_trace</code> (neu parsen für volle Spur).
            </p>
          ) : null}
          {schliessmittelDebugPanel.fromTrace.schliessmittelHeaderLine ? (
            <p className="mb-0.5">
              <span className="text-slate-500">Scan-Start (Kopfzeile):</span>{' '}
              <span className="font-mono break-all">{schliessmittelDebugPanel.fromTrace.schliessmittelHeaderLine}</span>
            </p>
          ) : null}
          {schliessmittelDebugPanel.fromTrace.parsedTypSourceLine ? (
            <p className="mb-0.5">
              <span className="text-slate-500">Erkannte Typ-Quelle:</span>{' '}
              <span className="font-mono break-all">{schliessmittelDebugPanel.fromTrace.parsedTypSourceLine}</span>
            </p>
          ) : null}
          <p className="text-slate-500 mb-0.5">Ausschnitt um Schließmittel (max. 8 Zeilen):</p>
          <pre className="whitespace-pre-wrap break-words font-mono text-[10px] bg-white/50 dark:bg-slate-900/40 border border-amber-100 dark:border-amber-900/40 rounded px-1.5 py-1 max-h-40 overflow-auto">
            {schliessmittelDebugPanel.snippet?.trim() ||
              '— kein Schließmittel-Marker in diesem Block-Text / kein Volltext geladen.'}
          </pre>
        </div>
      ) : null}

      <div
        className="rounded border border-sky-200/80 dark:border-sky-800/50 bg-sky-50/40 dark:bg-sky-950/20 px-2 py-1.5 text-[10px] leading-tight text-slate-700 dark:text-slate-300"
        title="Nur Diagnose: C2-Mängelerkennung aus Status-Feld und gespeichertes findings_json"
      >
        <div className="font-medium text-sky-900 dark:text-sky-200/95 mb-0.5">C2 Status-Mängel (Parser-Debug)</div>
        {statusFindingsDebug ? (
          <div className="space-y-0.5">
            <p>
              <span className="text-slate-500">Sequence:</span>{' '}
              <span className="font-mono">{statusFindingsDebug.sequence ?? row.sequence}</span>
            </p>
            <p>
              <span className="text-slate-500">Status-Kandidat:</span>{' '}
              <span className="font-mono break-all">{statusFindingsDebug.statusCandidate || '—'}</span>
            </p>
            <p>
              <span className="text-slate-500">Verworfen:</span>{' '}
              <span className="font-mono break-all">{statusFindingsDebug.rejectedReason || 'nein'}</span>
            </p>
            <p>
              <span className="text-slate-500">findings_json befüllt:</span>{' '}
              {statusFindingsDebug.findingsFilled ? 'ja' : 'nein'} · Status-Fund:{' '}
              {statusFindingsDebug.statusFindingAccepted ? 'ja' : 'nein'} · Anzahl:{' '}
              {statusFindingsDebug.findingsCount ?? c2Candidates.length}
            </p>
            <p className="text-slate-500 mb-0.5">Rohtext um Status:</p>
            <pre className="whitespace-pre-wrap break-words font-mono text-[10px] bg-white/50 dark:bg-slate-900/40 border border-sky-100 dark:border-sky-900/40 rounded px-1.5 py-1 max-h-32 overflow-auto">
              {statusFindingsDebug.statusRawAround || '— kein Status-Marker im Positionsblock erkannt'}
            </pre>
            <p className="text-slate-500 mb-0.5">Rohtext des Positionsblocks (gekürzt):</p>
            <pre className="whitespace-pre-wrap break-words font-mono text-[10px] bg-white/50 dark:bg-slate-900/40 border border-sky-100 dark:border-sky-900/40 rounded px-1.5 py-1 max-h-32 overflow-auto">
              {statusFindingsDebug.blockRawPreview || '— kein Block-Rohtext im Debug gespeichert'}
            </pre>
          </div>
        ) : (
          <p className="text-slate-500">
            Kein Status-Debug in <code>analysis_trace_json</code>. Bitte Datei mit aktueller Parser-Version neu parsen.
          </p>
        )}
        <details className="mt-1">
          <summary className="cursor-pointer text-slate-600 dark:text-slate-300">findings_json Rohwert anzeigen</summary>
          <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[10px] bg-white/50 dark:bg-slate-900/40 border border-sky-100 dark:border-sky-900/40 rounded px-1.5 py-1 max-h-36 overflow-auto">
            {findingsJsonPreview}
          </pre>
        </details>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-xs">
          <span className="text-slate-600 dark:text-slate-400">Kunde</span>
          <select
            className="mt-0.5 w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-sm"
            value={reviewCustomerId}
            disabled={busy || isCommitted}
            onChange={(e) => {
              const v = e.target.value
              setReviewCustomerId(v)
              const stillOk = allBvs.some((b) => b.id === reviewBvId && b.customer_id === v)
              if (!stillOk) setReviewBvId('')
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
        <label className="block text-xs">
          <span className="text-slate-600 dark:text-slate-400">Bauvorhaben</span>
          <select
            className="mt-0.5 w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-sm"
            value={reviewBvId}
            disabled={busy || isCommitted}
            onChange={(e) => {
              const v = e.target.value
              setReviewBvId(v)
              const bv = allBvs.find((b) => b.id === v)
              if (bv) setReviewCustomerId(bv.customer_id)
            }}
          >
            <option value="">—</option>
            {bvsForCustomer.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded border border-slate-100 dark:border-slate-700 p-2 space-y-2 text-xs">
        <div className="font-medium text-slate-700 dark:text-slate-200">
          Bestehendes Objekt (Produktiv, optional)
        </div>
        {objectsForPicker.length === 0 && !reviewObjectId ? (
          <p className="text-slate-500">
            Keine passenden Produktiv-Objekte gefunden. Ohne BV wird nach Kunde gesucht; Commit legt bei
            Bedarf ein neues Objekt an.
          </p>
        ) : null}
        <>
            {reviewObjectId ? (
              <div className="rounded bg-slate-50 dark:bg-slate-800/50 px-2 py-1 space-y-0.5">
                <div>
                  <span className="text-slate-500">Zugeordnet:</span>{' '}
                  {linkedObject ? (
                    <span className="font-medium text-slate-800 dark:text-slate-100">
                      {formatObjectPickerLabel(linkedObject)}
                    </span>
                  ) : (
                    <span className="font-mono text-slate-700 dark:text-slate-200">
                      ID {reviewObjectId.slice(0, 8)}… (nicht in lokaler Liste)
                    </span>
                  )}
                </div>
                <div className="font-mono text-[10px] text-slate-500 break-all">{reviewObjectId}</div>
              </div>
            ) : (
              <p className="text-slate-500">Keine Produktiv-Zuordnung – Commit legt bei Bedarf ein neues Objekt an.</p>
            )}
            {bvMismatch ? (
              <p className="text-amber-800 dark:text-amber-200">
                Dieses Objekt gehört nicht zum gewählten BV. Bitte Zuordnung entfernen oder das passende BV
                wählen.
              </p>
            ) : null}
            <label className="block">
              <span className="text-slate-600 dark:text-slate-400">Objekt suchen (Name, Raum, ID)</span>
              <input
                className="mt-0.5 w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-sm"
                value={objectLinkQuery}
                disabled={busy || isCommitted}
                onChange={(e) => setObjectLinkQuery(e.target.value)}
                placeholder="Filter …"
              />
            </label>
            <label className="block">
              <span className="text-slate-600 dark:text-slate-400">Objekt auswählen</span>
              <select
                className="mt-0.5 w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-sm"
                value={reviewObjectId}
                disabled={busy || isCommitted}
                onChange={(e) => {
                  const v = e.target.value
                  void applyReviewObjectLink(v || null)
                }}
              >
                <option value="">— keine Zuordnung —</option>
                {objectsForPicker.map((o) => (
                  <option key={o.id} value={o.id}>
                    {formatObjectPickerLabel(o)}
                  </option>
                ))}
              </select>
            </label>
            {reviewObjectId ? (
              <button
                type="button"
                disabled={busy || isCommitted}
                className="rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-xs disabled:opacity-50"
                onClick={() => void applyReviewObjectLink(null)}
              >
                Zuordnung entfernen
              </button>
            ) : null}
        </>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-xs sm:col-span-2">
          <span className="text-slate-600 dark:text-slate-400">Objektname</span>
          <input
            className="mt-0.5 w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-sm"
            value={reviewObjectName}
            disabled={busy || isCommitted}
            onChange={(e) => setReviewObjectName(e.target.value)}
          />
        </label>
        {nameSuggestions.length > 0 ? (
          <div className="sm:col-span-2 flex flex-wrap gap-1 items-center text-xs">
            <span className="text-slate-500">Vorschläge:</span>
            {nameSuggestions.map((n) => (
              <button
                key={n}
                type="button"
                disabled={busy || isCommitted}
                className="rounded bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 hover:bg-slate-300 dark:hover:bg-slate-600"
                onClick={() => setReviewObjectName(n)}
              >
                {n.length > 40 ? `${n.slice(0, 40)}…` : n}
              </button>
            ))}
          </div>
        ) : null}
        <label className="block text-xs sm:col-span-2">
          <span className="text-slate-600 dark:text-slate-400">Objekttyp</span>
          <input
            className="mt-0.5 w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-sm"
            value={reviewObjectType}
            disabled={busy || isCommitted}
            onChange={(e) => setReviewObjectType(e.target.value)}
          />
        </label>
        <label className="block text-xs">
          <span className="text-slate-600 dark:text-slate-400">Etage</span>
          <input
            className="mt-0.5 w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-sm"
            value={reviewFloor}
            disabled={busy || isCommitted}
            onChange={(e) => setReviewFloor(e.target.value)}
          />
        </label>
        <label className="block text-xs">
          <span className="text-slate-600 dark:text-slate-400">Raum</span>
          <input
            className="mt-0.5 w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-sm"
            value={reviewRoom}
            disabled={busy || isCommitted}
            onChange={(e) => setReviewRoom(e.target.value)}
          />
        </label>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Parser: {row.customer_text || '—'} / {row.site_text || '—'}
      </p>

      {matchPayload ? (
        <div className="rounded border border-slate-100 dark:border-slate-700 p-2 space-y-2 text-xs">
          <div className="font-medium text-slate-700 dark:text-slate-200">Matching (manuell übernehmen)</div>
          {matchPayload.bv_candidates.length > 0 ? (
            <div>
              <div className="text-slate-500 mb-1">BV-Kandidaten</div>
              <ul className="space-y-1">
                {matchPayload.bv_candidates.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-2">
                    <span>
                      {c.label}{' '}
                      <span className="text-slate-500">
                        ({c.score}: {c.reasons.join('; ')})
                      </span>
                    </span>
                    <button
                      type="button"
                      disabled={busy || isCommitted}
                      className="text-sky-700 dark:text-sky-300 underline"
                      onClick={() => void applyBvCandidate(c.id)}
                    >
                      BV setzen
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {matchPayload.object_candidates.length > 0 ? (
            <div>
              <div className="text-slate-500 mb-1">
                Objekt-Kandidaten (nur nach Klick übernehmen – keine automatische Zuordnung)
              </div>
              <ul className="space-y-1">
                {matchPayload.object_candidates.map((c) => {
                  const o = allObjects.find((x) => x.id === c.id)
                  if (!o) return null
                  const canLinkToObject =
                    !o.archived_at &&
                    (effectiveBvForObjects
                      ? o.bv_id === effectiveBvForObjects
                      : Boolean(reviewCustomerId.trim()) &&
                        (o.customer_id === reviewCustomerId.trim() ||
                          o.bv_id == null ||
                          (o.bv_id
                            ? allBvs.some((b) => b.id === o.bv_id && b.customer_id === reviewCustomerId.trim())
                            : false)))
                  return (
                    <li key={c.id} className="flex flex-wrap items-center gap-2">
                      <span>
                        {c.label}{' '}
                        <span className="text-slate-500">
                          ({c.score}: {c.reasons.join('; ')})
                        </span>
                      </span>
                      <button
                        type="button"
                        disabled={busy || isCommitted || !canLinkToObject}
                        title={
                          !reviewCustomerId.trim() && !effectiveBvForObjects
                            ? 'Zuerst Kunde wählen'
                            : !canLinkToObject
                              ? 'Kandidat passt nicht zur Auswahl oder ist archiviert'
                              : undefined
                        }
                        className="text-sky-700 dark:text-sky-300 underline disabled:opacity-40 disabled:no-underline"
                        onClick={() => void applyReviewObjectLink(c.id)}
                      >
                        Produktiv zuordnen
                      </button>
                      <button
                        type="button"
                        disabled={busy || isCommitted}
                        className="text-sky-700 dark:text-sky-300 underline"
                        onClick={() => void applyObjectTexts(o)}
                      >
                        Nur Texte übernehmen
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {rowEmbeddedFile && onEmbeddedImagesChanged ? (
        <AltberichtStagingRowEmbeddedImages
          row={row}
          fileRow={rowEmbeddedFile}
          images={rowEmbeddedImages ?? []}
          allJobEmbeddedImages={allJobEmbeddedImages ?? rowEmbeddedImages ?? []}
          fileEmbeddedImageTotal={fileEmbeddedImageTotal ?? 0}
          fileLikelyLogoCount={fileLikelyLogoCount ?? 0}
          fileSkippedPages={fileSkippedPages ?? []}
          stagingScrollIntersectionRoot={stagingScrollIntersectionRoot}
          onOpenPagePreview={onOpenPagePreview}
          allObjects={allObjects}
          busy={busy}
          onReload={onEmbeddedImagesChanged}
        />
      ) : null}

      {isCommitted && onCommitC2Defects && c2Eligible ? (
        <div className="rounded border border-violet-200 dark:border-violet-800 bg-violet-50/40 dark:bg-violet-950/30 p-2 space-y-2 text-xs">
          <div className="font-medium text-violet-900 dark:text-violet-100">Paket C2: Mängel (optional)</div>
          <p className="text-slate-600 dark:text-slate-400">
            Auswahl und Bearbeitung im Staging; Produktiv werden nur neue <strong>offene</strong> Einträge in
            den Stammdaten-Mängeln angehängt. Keine automatische Übernahme; PDF bleibt Quelle. Bereits
            übernommene Kandidaten sind idempotent gesperrt. Dokumentkopfzeilen (z. B. „Wartung 2025“) werden
            nicht übernommen; erkannte Kopffragmente werden im Textfeld entfernt.
          </p>
          {row.c2_defects_last_import_at ? (
            <p className="text-emerald-800 dark:text-emerald-200 text-[11px]">
              Zuletzt C2 übernommen:{' '}
              {new Date(row.c2_defects_last_import_at).toLocaleString('de-DE')}
            </p>
          ) : null}
          {row.c2_defects_last_error?.trim() ? (
            <div className="text-amber-900 dark:text-amber-100 bg-amber-50 dark:bg-amber-900/40 rounded px-2 py-1">
              <span className="font-medium">Letzter C2-Fehler (Retry möglich):</span>{' '}
              {row.c2_defects_last_error}
            </div>
          ) : null}
          {c2Candidates.length === 0 ? (
            <p className="text-slate-500">Keine Mangelkandidaten in den Parser-Funden (findings_json).</p>
          ) : (
            <ul className="space-y-2 max-h-64 overflow-auto pr-1">
              {c2Candidates.map((c) => (
                <li
                  key={c.key}
                  className="border border-slate-200 dark:border-slate-600 rounded p-2 space-y-1 bg-white/80 dark:bg-slate-900/40"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={busy || c.alreadyImported}
                        checked={Boolean(c2Selected[c.key]) && !c.alreadyImported}
                        onChange={(e) =>
                          setC2Selected((s) => ({ ...s, [c.key]: e.target.checked }))
                        }
                      />
                      <span className="font-mono text-[10px] text-slate-500">{c.key}</span>
                    </label>
                    {c.alreadyImported ? (
                      <span className="text-emerald-700 dark:text-emerald-300 text-[10px] font-medium">
                        Bereits übernommen
                      </span>
                    ) : null}
                  </div>
                  <textarea
                    className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-xs min-h-[4rem]"
                    disabled={busy || c.alreadyImported}
                    value={c2Draft[c.key] ?? ''}
                    onChange={(e) => setC2Draft((d) => ({ ...d, [c.key]: e.target.value }))}
                  />
                  {c.reviewHint ? (
                    <p className="text-amber-800 dark:text-amber-200 text-[11px] leading-snug">{c.reviewHint}</p>
                  ) : null}
                  {c.commitText !== c.originalText.trim() ? (
                    <p className="text-slate-500 dark:text-slate-400 text-[10px] leading-snug">
                      Parser-Roh:{' '}
                      {c.originalText.length > 160 ? `${c.originalText.slice(0, 160)}…` : c.originalText}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            disabled={
              busy ||
              c2Candidates.every((c) => c.alreadyImported) ||
              !c2Candidates.some(
                (c) =>
                  !c.alreadyImported && c2Selected[c.key] && (c2Draft[c.key] ?? '').trim().length > 0
              )
            }
            className="rounded bg-violet-700 text-white px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            onClick={() => void handleC2Commit()}
          >
            Mängel produktiv übernehmen (C2)
          </button>
        </div>
      ) : null}

      <label className="block text-xs">
        <span className="text-slate-600 dark:text-slate-400">Blockier-Grund (nur diese Zeile)</span>
        <input
          className="mt-0.5 w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-sm"
          value={blockedReason}
          disabled={busy || isCommitted}
          onChange={(e) => setBlockedReason(e.target.value)}
          placeholder="Optional"
        />
      </label>

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          disabled={busy || isCommitted}
          className="rounded bg-slate-700 text-white px-3 py-1 text-xs font-medium disabled:opacity-50"
          onClick={() => void handleSave()}
        >
          Review speichern
        </button>
        <button
          type="button"
          disabled={busy || isCommitted}
          className="rounded border border-slate-300 dark:border-slate-600 px-3 py-1 text-xs disabled:opacity-50"
          onClick={() => void onComputeMatch()}
        >
          Vorschläge berechnen
        </button>
        <button
          type="button"
          disabled={busy || isCommitted}
          className="rounded border border-slate-300 dark:border-slate-600 px-3 py-1 text-xs disabled:opacity-50"
          onClick={() => void onRecomputeRow()}
        >
          Validierung
        </button>
        {onCommitRow ? (
          <button
            type="button"
            disabled={busy || !canTryCommit}
            className="rounded bg-emerald-700 text-white px-3 py-1 text-xs font-medium disabled:opacity-50"
            onClick={() => void onCommitRow()}
          >
            {row.commit_last_error?.trim()
              ? 'Commit erneut versuchen (C1)'
              : 'Produktiv übernehmen (C1)'}
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy || isCommitted}
          className="rounded border border-amber-600 text-amber-800 dark:text-amber-200 px-3 py-1 text-xs disabled:opacity-50"
          onClick={() =>
            void onPatch({
              review_status: 'blocked',
              review_blocked_reason: blockedReason.trim() || 'Blockiert',
            })
          }
        >
          Blockieren
        </button>
        <button
          type="button"
          disabled={busy || isCommitted}
          className="rounded border border-slate-300 dark:border-slate-600 px-3 py-1 text-xs disabled:opacity-50"
          onClick={() =>
            void onPatch({
              review_status: 'needs_input',
              review_blocked_reason: null,
            })
          }
        >
          Entblocken
        </button>
        <button
          type="button"
          disabled={busy || isCommitted}
          className="rounded border border-slate-300 dark:border-slate-600 px-3 py-1 text-xs disabled:opacity-50"
          onClick={() => void onPatch({ review_status: 'skipped' })}
        >
          Überspringen
        </button>
      </div>
    </li>
  )
}
