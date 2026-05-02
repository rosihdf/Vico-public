import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AltberichtImportStagingObjectRow } from '../../lib/altberichtImport/altberichtImportQueryService'
import {
  altberichtC2FindingKey,
  commitAltberichtC2DefectsForStagingRow,
  isAltberichtStagingRowC2Eligible,
  listAltberichtC2FindingRows,
  parseAltberichtC2ImportedKeys,
  textShouldBeExcludedFromAltberichtC2Import,
  type AltberichtC2CommitItem,
} from '../../lib/altberichtImport'
import { normalizeAltberichtC2FindingText } from '../../lib/altberichtImport/altberichtImportC2DefectService'
import { patchAltberichtStagingReview } from '../../lib/altberichtImport/altberichtImportReviewService'
import { useToast } from '../../ToastContext'

const isFindingRecord = (x: unknown): x is { text: string } =>
  Boolean(x && typeof x === 'object' && typeof (x as { text?: unknown }).text === 'string')

const draftLinesFromRow = (row: AltberichtImportStagingObjectRow): string[] => {
  if (!Array.isArray(row.findings_json)) return []
  const lines: string[] = []
  for (const x of row.findings_json) {
    if (isFindingRecord(x) && String(x.text).trim().length > 0) {
      lines.push(String(x.text))
    }
  }
  return lines
}

const buildNextFindingsJson = (
  row: AltberichtImportStagingObjectRow,
  draftLines: string[]
): unknown[] => {
  const raw = Array.isArray(row.findings_json) ? row.findings_json : []
  const next: unknown[] = []
  let rawConsume = 0
  for (const line of draftLines) {
    const t = line.trim()
    if (!t) continue
    while (rawConsume < raw.length && !isFindingRecord(raw[rawConsume])) rawConsume += 1
    const prev = rawConsume < raw.length ? raw[rawConsume] : null
    rawConsume += 1
    if (prev && typeof prev === 'object' && isFindingRecord(prev)) {
      next.push({ ...(prev as object), text: t })
    } else {
      next.push({ text: t })
    }
  }
  return next
}

const findingsEqual = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a ?? []) === JSON.stringify(b ?? [])

const buildC2CommitItems = (
  findingsArray: unknown[],
  imported: Set<string>
): AltberichtC2CommitItem[] => {
  const items: AltberichtC2CommitItem[] = []
  if (!Array.isArray(findingsArray)) return items
  findingsArray.forEach((raw, index) => {
    if (!isFindingRecord(raw)) return
    const normalized =
      normalizeAltberichtC2FindingText(String(raw.text).trim()) ?? String(raw.text).trim()
    if (!normalized || textShouldBeExcludedFromAltberichtC2Import(normalized)) return
    const key = altberichtC2FindingKey(index)
    if (imported.has(key)) return
    items.push({ key, text: normalized })
  })
  return items
}

const rowHasDisplayableFindings = (row: AltberichtImportStagingObjectRow): boolean =>
  draftLinesFromRow(row).length > 0

export type AltberichtStandardRowFindingsSectionProps = {
  row: AltberichtImportStagingObjectRow
  busy: boolean
  canRun: boolean
  onReloadJob: () => Promise<void>
}

export const AltberichtStandardRowFindingsSection = ({
  row,
  busy,
  canRun,
  onReloadJob,
}: AltberichtStandardRowFindingsSectionProps) => {
  const { showError, showToast } = useToast()
  const [draftLines, setDraftLines] = useState<string[]>(() => draftLinesFromRow(row))
  const [localBusy, setLocalBusy] = useState(false)

  const blockingBusy = busy || localBusy

  useEffect(() => {
    setDraftLines(draftLinesFromRow(row))
  }, [row.id, row.updated_at, row.findings_json])

  const hadParserFindings = useMemo(() => rowHasDisplayableFindings(row), [row])

  const c2Eligible = isAltberichtStagingRowC2Eligible(row)
  const c2PreviewCount = useMemo(() => listAltberichtC2FindingRows(row).length, [row])

  const nextFindingsJson = useMemo(
    () => buildNextFindingsJson(row, draftLines),
    [row, draftLines]
  )

  const dirty = !findingsEqual(nextFindingsJson, row.findings_json ?? [])

  const handleDiscardLocal = useCallback(() => {
    setDraftLines(draftLinesFromRow(row))
  }, [row])

  const handlePrimaryAction = useCallback(async () => {
    if (!canRun) return
    setLocalBusy(true)
    try {
      let workRow = row

      if (dirty) {
        const next = buildNextFindingsJson(row, draftLines)
        const { error, row: updated } = await patchAltberichtStagingReview(row.id, { findings_json: next })
        if (error) {
          showError(error.message)
          return
        }
        await onReloadJob()
        if (updated) workRow = updated
      }

      if (!isAltberichtStagingRowC2Eligible(workRow)) {
        if (dirty) {
          showToast('Mängel wurden im Auftrag gespeichert. Übernahme in die Objektakte folgt nach Schritt 4.', 'success')
        } else {
          showToast(
            'Keine offenen Änderungen. Sobald die Stammdaten gespeichert sind, können Sie Mängel in die Objektakte übernehmen.',
            'info'
          )
        }
        return
      }

      const imported = parseAltberichtC2ImportedKeys(workRow)
      const items = buildC2CommitItems(
        Array.isArray(workRow.findings_json) ? workRow.findings_json : [],
        imported
      )
      if (items.length === 0) {
        showToast(
          c2PreviewCount > 0
            ? 'Keine neuen Mängel zum Übernehmen (bereits importiert oder ausgeschlossen).'
            : 'Keine übernehmbaren Mängel im aktuellen Text.',
          'info'
        )
        return
      }

      const res = await commitAltberichtC2DefectsForStagingRow(workRow, items)
      if (!res.ok) {
        showError(res.errorMessage ?? 'Mängel konnten nicht übernommen werden.')
        return
      }
      showToast(
        `${res.importedKeys?.length ?? items.length} Mangel/Mängel in der Objektakte gespeichert.`,
        'success'
      )
      await onReloadJob()
    } finally {
      setLocalBusy(false)
    }
  }, [canRun, row, draftLines, dirty, showError, showToast, onReloadJob, c2PreviewCount])

  if (!hadParserFindings && draftLines.length === 0) return null

  return (
    <div className="mt-3 rounded-lg border border-violet-200/80 dark:border-violet-800/60 bg-violet-50/40 dark:bg-violet-950/20 px-2.5 py-2.5 sm:px-3 sm:py-3">
      <div className="text-xs font-semibold text-violet-950 dark:text-violet-100 mb-2">Erkannte Mängel</div>
      <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 mb-2 leading-snug">
        Texte prüfen und anpassen. Übernahme in die Objektakte ist nach dem Speichern der Stammdaten für diese Zeile
        möglich (Schritt 4).
      </p>
      <ul className="space-y-2">
        {draftLines.map((line, idx) => (
          <li
            key={`${row.id}-f-${idx}`}
            className="rounded-md border border-slate-200/90 dark:border-slate-600/80 bg-white/90 dark:bg-slate-900/35 p-2"
          >
            <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Mangel {idx + 1}</label>
            <textarea
              className="w-full min-h-[4.5rem] sm:min-h-[3.75rem] rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100"
              value={line}
              disabled={blockingBusy}
              onChange={(e) => {
                const v = e.target.value
                setDraftLines((prev) => prev.map((p, i) => (i === idx ? v : p)))
              }}
              aria-label={`Mangel ${idx + 1}, Freitext`}
            />
            <div className="mt-1.5">
              <button
                type="button"
                disabled={blockingBusy}
                className="text-xs text-red-700 dark:text-red-300 underline disabled:opacity-50"
                onClick={() => setDraftLines((prev) => prev.filter((_, i) => i !== idx))}
              >
                Entfernen
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-2">
        <button
          type="button"
          disabled={blockingBusy}
          className="w-full sm:w-auto rounded border border-violet-300 dark:border-violet-700 px-3 py-1.5 text-xs font-medium text-violet-900 dark:text-violet-100 disabled:opacity-50"
          onClick={() => setDraftLines((prev) => [...prev, ''])}
        >
          Weiteren Mangel hinzufügen
        </button>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          disabled={blockingBusy || !canRun}
          title={
            !c2Eligible
              ? 'Speichert Änderungen am Auftrag. Nach Stammdaten (Schritt 4) können Mängel in die Objektakte übernommen werden.'
              : 'Speichert ggf. Änderungen und übernimmt neue Mängel in die Objektakte.'
          }
          className="w-full sm:w-auto rounded bg-emerald-700 text-white px-3 py-2.5 text-sm font-medium disabled:opacity-50 min-h-[44px] sm:min-h-0"
          onClick={() => void handlePrimaryAction()}
        >
          In Objektakte übernehmen
        </button>
        <button
          type="button"
          disabled={blockingBusy || !dirty}
          className="w-full sm:w-auto rounded border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 disabled:opacity-50 min-h-[44px] sm:min-h-0"
          onClick={handleDiscardLocal}
        >
          Noch nicht übernehmen
        </button>
      </div>
    </div>
  )
}
