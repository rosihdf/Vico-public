import { useState } from 'react'
import type { ChecklistDisplayMode, ChecklistItemStatus } from '../lib/doorMaintenanceChecklistCatalog'
import {
  DOOR_MAINTENANCE_CHECKLIST_SECTIONS,
  getChecklistItemIdsForMode,
  getSectionAndLabelForItemId,
} from '../lib/doorMaintenanceChecklistCatalog'
import type { WartungChecklistItemState } from '../types/orderCompletionExtra'
import type { Object as Obj } from '../types'
import { getMaintenancePhotoUrl } from '../lib/dataService'
import { getObjectDisplayName } from '../lib/objectUtils'
import type { ChecklistMangelPhoto } from '../types/maintenance'
import type { WartungChecklistObjectUiStatus } from '../lib/wartungOrderChecklistUiStatus'
import CameraCaptureModal from './CameraCaptureModal'

const MANGEL_NOTE_INPUT_CLASS =
  'mt-2 w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400'

const STATUS_OPTIONS: { value: ChecklistItemStatus; label: string }[] = [
  { value: 'ok', label: 'OK' },
  { value: 'mangel', label: 'Mangel' },
  { value: 'nicht_geprueft', label: 'Nicht geprüft' },
  { value: 'entfaellt', label: 'Entfällt' },
]

const isImageStoragePath = (storagePath: string | null): boolean => {
  if (!storagePath) return false
  return /\.(png|jpe?g|webp|gif|bmp|svg|heic|heif)$/i.test(storagePath)
}

const getStorageFileName = (storagePath: string | null): string => {
  if (!storagePath) return 'Datei'
  const chunks = storagePath.split('/')
  return chunks[chunks.length - 1] || 'Datei'
}

type WartungOrderChecklistPanelProps = {
  mode: ChecklistDisplayMode
  objectIds: string[]
  objectsById: Record<string, Obj | undefined>
  selectedObjectId: string | null
  onSelectObjectId: (id: string) => void
  items: Record<string, WartungChecklistItemState>
  onChangeItem: (itemId: string, patch: Partial<WartungChecklistItemState>) => void
  savedAtForSelection: string | undefined
  onSave: () => void
  saving: boolean
  saveError: string | null
  defectPhotosByItem: Record<string, ChecklistMangelPhoto[]>
  onUploadDefectPhoto: (itemId: string, file: File) => Promise<void>
  onDeleteDefectPhoto: (
    itemId: string,
    photoId: string,
    storagePath: string | null,
    isDraft?: boolean
  ) => Promise<void>
  uploadingItemId: string | null
  showSaveControls?: boolean
  /** Pro Tür: einheitlicher Status (Tür- + ggf. Feststell-Checkliste) für Dropdown/Badge */
  doorStatusByObjectId?: Record<string, WartungChecklistObjectUiStatus>
}

const doorStatusOptionSuffix = (s: WartungChecklistObjectUiStatus | undefined): string => {
  if (!s) return ''
  if (s.kind === 'ok') return ' — ✓ ohne Mängel'
  if (s.kind === 'mangel') {
    return ` — ✕ ${s.count} ${s.count === 1 ? 'Mangel' : 'Mängel'}`
  }
  return ' — unvollständig'
}

const DoorChecklistStatusBadge = ({ status }: { status: WartungChecklistObjectUiStatus }) => {
  if (status.kind === 'ok') {
    return (
      <span
        className="inline-flex items-center gap-1 shrink-0 text-xs font-medium text-emerald-700 dark:text-emerald-300"
        role="status"
      >
        <span className="text-base leading-none" aria-hidden>
          ✓
        </span>
        ohne Mängel
      </span>
    )
  }
  if (status.kind === 'mangel') {
    return (
      <span
        className="inline-flex items-center gap-1 shrink-0 text-xs font-medium text-red-700 dark:text-red-300"
        role="status"
      >
        <span className="text-base leading-none" aria-hidden>
          ✕
        </span>
        {status.count} {status.count === 1 ? 'Mangel' : 'Mängel'}
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1 shrink-0 text-xs font-medium text-amber-800 dark:text-amber-200"
      role="status"
    >
      <span className="text-base leading-none" aria-hidden>
        ○
      </span>
      unvollständig
    </span>
  )
}

const WartungOrderChecklistPanel = ({
  mode,
  objectIds,
  objectsById,
  selectedObjectId,
  onSelectObjectId,
  items,
  onChangeItem,
  savedAtForSelection,
  onSave,
  saving,
  saveError,
  defectPhotosByItem,
  onUploadDefectPhoto,
  onDeleteDefectPhoto,
  uploadingItemId,
  showSaveControls = true,
  doorStatusByObjectId,
}: WartungOrderChecklistPanelProps) => {
  const [cameraTargetItemId, setCameraTargetItemId] = useState<string | null>(null)
  const ids = getChecklistItemIdsForMode(mode)
  const handleCameraCapture = async (file: File) => {
    if (!cameraTargetItemId) return false
    await onUploadDefectPhoto(cameraTargetItemId, file)
    setCameraTargetItemId(null)
    return true
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-900/40 p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Wartungs-Checkliste (Brandschutztür)
        </h3>
        {savedAtForSelection && (
          <span className="text-xs text-emerald-700 dark:text-emerald-300" role="status">
            Gespeichert {new Date(savedAtForSelection).toLocaleString('de-DE')}
          </span>
        )}
      </div>

      {objectIds.length > 1 && (
        <div>
          <label htmlFor="wartung-checklist-door" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
            Tür/Tor für Checkliste
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 max-w-full">
            <select
              id="wartung-checklist-door"
              value={selectedObjectId ?? ''}
              onChange={(e) => onSelectObjectId(e.target.value)}
              className="w-full max-w-md px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm"
              aria-label={
                selectedObjectId && doorStatusByObjectId?.[selectedObjectId]
                  ? (() => {
                      const st = doorStatusByObjectId[selectedObjectId]
                      const tail =
                        st.kind === 'ok'
                          ? 'aktuell ohne Mängel'
                          : st.kind === 'mangel'
                            ? `aktuell ${st.count} dokumentierte Mängel`
                            : 'aktuell unvollständig'
                      return `Tür oder Tor für die Wartungscheckliste wählen; ${tail}`
                    })()
                  : 'Tür oder Tor für die Wartungscheckliste wählen'
              }
            >
              {objectIds.map((oid) => {
                const o = objectsById[oid]
                const label = o ? getObjectDisplayName(o) : 'Unbenannte Tür/Tor'
                const suff = doorStatusOptionSuffix(doorStatusByObjectId?.[oid])
                return (
                  <option key={oid} value={oid}>
                    {label}
                    {suff}
                  </option>
                )
              })}
            </select>
            {selectedObjectId && doorStatusByObjectId?.[selectedObjectId] ? (
              <DoorChecklistStatusBadge status={doorStatusByObjectId[selectedObjectId]} />
            ) : null}
          </div>
        </div>
      )}

      {objectIds.length === 1 && selectedObjectId && doorStatusByObjectId?.[selectedObjectId] ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium text-slate-600 dark:text-slate-300">Checklistenstatus (diese Tür):</span>
          <DoorChecklistStatusBadge status={doorStatusByObjectId[selectedObjectId]} />
        </div>
      ) : null}

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Normen (Hinweis): DIN EN 1634, DIN EN 16034, DIN 4102, DIN 18040
      </p>

      <div className="space-y-4 pr-1">
        {mode === 'detail'
          ? DOOR_MAINTENANCE_CHECKLIST_SECTIONS.map((sec, secIdx) => {
              const sectionNum = secIdx + 1
              return (
                <section
                  key={sec.id}
                  className="border border-slate-200 dark:border-slate-600 rounded-lg p-3 bg-white dark:bg-slate-800/60"
                >
                  <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2">
                    <span className="font-medium tabular-nums text-slate-600 dark:text-slate-400">{sectionNum}.</span>{' '}
                    {sec.title}
                  </h4>
                  <ul className="space-y-3">
                    {sec.details.map((d, dIdx) => {
                      const subNum = dIdx + 1
                      return (
                        <li key={d.id} className="text-sm">
                          <p className="text-slate-800 dark:text-slate-100 mb-1">
                            <span className="font-medium tabular-nums text-slate-600 dark:text-slate-400">
                              {sectionNum}.{subNum}
                            </span>{' '}
                            {d.label}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {STATUS_OPTIONS.map((opt) => (
                              <label
                                key={opt.value}
                                className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer"
                              >
                                <input
                                  type="radio"
                                  name={`chk-${d.id}`}
                                  checked={items[d.id]?.status === opt.value}
                                  onChange={() => onChangeItem(d.id, { status: opt.value })}
                                  className="rounded-full border-slate-400 text-vico-primary"
                                />
                                {opt.label}
                              </label>
                            ))}
                          </div>
                          <label className="mt-2 inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(items[d.id]?.advisory)}
                              onChange={(e) => onChangeItem(d.id, { advisory: e.target.checked })}
                              className="rounded border-slate-400 text-vico-primary"
                            />
                            Hinweis / empfohlene Maßnahme (ohne Mangel)
                          </label>
                          {(items[d.id]?.status === 'mangel' || items[d.id]?.advisory) && (
                            <div className="space-y-2">
                              {items[d.id]?.status === 'mangel' && (
                                <textarea
                                  value={items[d.id]?.note ?? ''}
                                  onChange={(e) => onChangeItem(d.id, { note: e.target.value })}
                                  placeholder="Mangelbeschreibung (Pflicht)"
                                  rows={2}
                                  className={MANGEL_NOTE_INPUT_CLASS}
                                  aria-label={`Mangelbeschreibung ${d.label}`}
                                />
                              )}
                              {items[d.id]?.advisory && (
                                <textarea
                                  value={items[d.id]?.advisory_note ?? ''}
                                  onChange={(e) => onChangeItem(d.id, { advisory_note: e.target.value })}
                                  placeholder="Hinweis / empfohlene Maßnahme (Pflicht)"
                                  rows={2}
                                  className={MANGEL_NOTE_INPUT_CLASS}
                                  aria-label={`Hinweis ${d.label}`}
                                />
                              )}
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                                <button
                                  type="button"
                                  onClick={() => setCameraTargetItemId(d.id)}
                                  disabled={uploadingItemId === d.id}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-vico-primary text-vico-primary hover:bg-vico-primary/10 disabled:opacity-50"
                                  aria-label="Foto aufnehmen"
                                  title="Foto aufnehmen"
                                >
                                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                                    <path d="M4 7h3l1.2-2h7.6L17 7h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" />
                                    <circle cx="12" cy="13" r="4" />
                                  </svg>
                                </button>
                                <input
                                  id={`door-file-${d.id}`}
                                  type="file"
                                  accept="image/*,.pdf,.doc,.docx,.txt"
                                  className="sr-only"
                                  disabled={uploadingItemId === d.id}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file) void onUploadDefectPhoto(d.id, file)
                                    e.currentTarget.value = ''
                                  }}
                                />
                                <label
                                  htmlFor={`door-file-${d.id}`}
                                  className="inline-flex px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 cursor-pointer"
                                >
                                  Hochladen
                                </label>
                                <span>optional (max. 3)</span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {(defectPhotosByItem[d.id] ?? []).map((p) => (
                                  <div key={p.id} className="relative">
                                    {p.isDraft ? (
                                      <span className="absolute -bottom-1 left-0 z-[1] rounded bg-amber-100 dark:bg-amber-900/80 px-0.5 text-[9px] font-medium text-amber-950 dark:text-amber-100">
                                        Entwurf
                                      </span>
                                    ) : null}
                                    {isImageStoragePath(p.storage_path) ? (
                                      <img
                                        src={getMaintenancePhotoUrl(p.storage_path)}
                                        alt={p.caption || 'Mangelfoto'}
                                        className="w-14 h-14 object-cover rounded border border-slate-300 dark:border-slate-600"
                                      />
                                    ) : (
                                      <a
                                        href={getMaintenancePhotoUrl(p.storage_path)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex max-w-[160px] px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-[11px] text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800"
                                      >
                                        {getStorageFileName(p.storage_path)}
                                      </a>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => void onDeleteDefectPhoto(d.id, p.id, p.storage_path, p.isDraft)}
                                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] leading-none"
                                      aria-label="Mangelfoto löschen"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })
          : (() => {
              let secNum = 0
              return DOOR_MAINTENANCE_CHECKLIST_SECTIONS.map((sec) => {
                secNum += 1
                return (
                  <div
                    key={sec.id}
                    className="border border-slate-200 dark:border-slate-600 rounded-lg p-3 bg-white dark:bg-slate-800/60"
                  >
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 mb-2">
                      <span className="font-medium tabular-nums text-slate-600 dark:text-slate-400">{secNum}.</span> {sec.title}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {STATUS_OPTIONS.map((opt) => (
                        <label
                          key={opt.value}
                          className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer"
                        >
                          <input
                            type="radio"
                            name={`chk-sec-${sec.id}`}
                            checked={items[sec.id]?.status === opt.value}
                            onChange={() => onChangeItem(sec.id, { status: opt.value })}
                            className="rounded-full border-slate-400 text-vico-primary"
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                    <label className="mt-2 inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(items[sec.id]?.advisory)}
                        onChange={(e) => onChangeItem(sec.id, { advisory: e.target.checked })}
                        className="rounded border-slate-400 text-vico-primary"
                      />
                      Hinweis / empfohlene Maßnahme (ohne Mangel)
                    </label>
                    {(items[sec.id]?.status === 'mangel' || items[sec.id]?.advisory) && (
                      <div className="space-y-2">
                        {items[sec.id]?.status === 'mangel' && (
                          <textarea
                            value={items[sec.id]?.note ?? ''}
                            onChange={(e) => onChangeItem(sec.id, { note: e.target.value })}
                            placeholder="Mangelbeschreibung (Pflicht)"
                            rows={2}
                            className={MANGEL_NOTE_INPUT_CLASS}
                            aria-label={`Mangelbeschreibung ${sec.title}`}
                          />
                        )}
                        {items[sec.id]?.advisory && (
                          <textarea
                            value={items[sec.id]?.advisory_note ?? ''}
                            onChange={(e) => onChangeItem(sec.id, { advisory_note: e.target.value })}
                            placeholder="Hinweis / empfohlene Maßnahme (Pflicht)"
                            rows={2}
                            className={MANGEL_NOTE_INPUT_CLASS}
                            aria-label={`Hinweis ${sec.title}`}
                          />
                        )}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                          <button
                            type="button"
                            onClick={() => setCameraTargetItemId(sec.id)}
                            disabled={uploadingItemId === sec.id}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-vico-primary text-vico-primary hover:bg-vico-primary/10 disabled:opacity-50"
                            aria-label="Foto aufnehmen"
                            title="Foto aufnehmen"
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                              <path d="M4 7h3l1.2-2h7.6L17 7h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" />
                              <circle cx="12" cy="13" r="4" />
                            </svg>
                          </button>
                          <input
                            id={`door-file-${sec.id}`}
                            type="file"
                            accept="image/*,.pdf,.doc,.docx,.txt"
                            className="sr-only"
                            disabled={uploadingItemId === sec.id}
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) void onUploadDefectPhoto(sec.id, file)
                              e.currentTarget.value = ''
                            }}
                          />
                          <label
                            htmlFor={`door-file-${sec.id}`}
                            className="inline-flex px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 cursor-pointer"
                          >
                            Hochladen
                          </label>
                          <span>optional (max. 3)</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(defectPhotosByItem[sec.id] ?? []).map((p) => (
                            <div key={p.id} className="relative">
                              {p.isDraft ? (
                                <span className="absolute -bottom-1 left-0 z-[1] rounded bg-amber-100 dark:bg-amber-900/80 px-0.5 text-[9px] font-medium text-amber-950 dark:text-amber-100">
                                  Entwurf
                                </span>
                              ) : null}
                              {isImageStoragePath(p.storage_path) ? (
                                <img
                                  src={getMaintenancePhotoUrl(p.storage_path)}
                                  alt={p.caption || 'Mangelfoto'}
                                  className="w-14 h-14 object-cover rounded border border-slate-300 dark:border-slate-600"
                                />
                              ) : (
                                <a
                                  href={getMaintenancePhotoUrl(p.storage_path)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex max-w-[160px] px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-[11px] text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800"
                                >
                                  {getStorageFileName(p.storage_path)}
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => void onDeleteDefectPhoto(sec.id, p.id, p.storage_path, p.isDraft)}
                                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] leading-none"
                                aria-label="Mangelfoto löschen"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            })()}
      </div>

      {showSaveControls && (
        <>
          {saveError && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {saveError}
            </p>
          )}

          <button
            type="button"
            onClick={onSave}
            disabled={saving || !selectedObjectId}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-vico-primary text-white hover:bg-vico-primary-hover disabled:opacity-50"
          >
            {saving ? 'Speichern…' : 'Checkliste speichern (Protokoll)'}
          </button>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Mit Speichern wird das Wartungsprotokoll für diese Tür aktualisiert. Der Monteursbereich wird danach freigegeben
            (für die gewählte Tür).
          </p>
        </>
      )}
      <p className="text-xs text-slate-400 dark:text-slate-500">
        Offene Prüfpunkte: {ids.filter((id) => !items[id]?.status).length} / {ids.length}
      </p>
      <CameraCaptureModal
        open={cameraTargetItemId !== null}
        onClose={() => setCameraTargetItemId(null)}
        onCapture={handleCameraCapture}
        title="Foto aufnehmen"
      />
    </div>
  )
}

export default WartungOrderChecklistPanel

export const initEmptyChecklistItems = (
  mode: ChecklistDisplayMode
): Record<string, WartungChecklistItemState> => {
  const o: Record<string, WartungChecklistItemState> = {}
  for (const id of getChecklistItemIdsForMode(mode)) {
    o[id] = {}
  }
  return o
}

export { getSectionAndLabelForItemId }
