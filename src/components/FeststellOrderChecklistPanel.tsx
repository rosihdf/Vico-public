import type { ChecklistDisplayMode, ChecklistItemStatus } from '../lib/doorMaintenanceChecklistCatalog'
import {
  FESTSTELL_CHECKLIST_SECTIONS,
  FESTSTELL_MELDER_INTERVAL_ITEM_ID,
  countFeststellIncompleteItems,
  getFeststellChecklistItemIdsForMode,
  type FeststellChecklistItemState,
} from '../lib/feststellChecklistCatalog'
import { getMaintenancePhotoUrl } from '../lib/dataService'
import type { ChecklistDefectPhoto } from '../types/maintenance'

const STATUS_OPTIONS: { value: ChecklistItemStatus; label: string }[] = [
  { value: 'ok', label: 'OK' },
  { value: 'mangel', label: 'Mangel' },
  { value: 'nicht_geprueft', label: 'Nicht geprüft' },
  { value: 'entfaellt', label: 'Entfällt' },
]

const MELDER_OPTIONS: {
  value: NonNullable<FeststellChecklistItemState['melder_interval']>
  label: string
}[] = [
  { value: 'ohne_5j', label: 'Ohne Nachführung max. 5 Jahre' },
  { value: 'mit_8j', label: 'Mit Nachführung max. 8 Jahre' },
  { value: 'nicht_beurteilt', label: 'Nicht beurteilt' },
  { value: 'entfaellt', label: 'Entfällt' },
]

const INTERVAL_SECTION_ID = 'sec-fst-intervall'

const MANGEL_NOTE_INPUT_CLASS =
  'mt-2 w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400'

const isImageStoragePath = (storagePath: string | null): boolean => {
  if (!storagePath) return false
  return /\.(png|jpe?g|webp|gif|bmp|svg|heic|heif)$/i.test(storagePath)
}

const getStorageFileName = (storagePath: string | null): string => {
  if (!storagePath) return 'Datei'
  const chunks = storagePath.split('/')
  return chunks[chunks.length - 1] || 'Datei'
}

type FeststellOrderChecklistPanelProps = {
  mode: ChecklistDisplayMode
  items: Record<string, FeststellChecklistItemState>
  onChangeItem: (itemId: string, patch: Partial<FeststellChecklistItemState>) => void
  savedAt: string | undefined
  onSave: () => void
  saving: boolean
  saveError: string | null
  defectPhotosByItem: Record<string, ChecklistDefectPhoto[]>
  onUploadDefectPhoto: (itemId: string, file: File) => Promise<void>
  onDeleteDefectPhoto: (itemId: string, photoId: string, storagePath: string | null) => Promise<void>
  uploadingItemId: string | null
  showSaveControls?: boolean
}

const FeststellOrderChecklistPanel = ({
  mode,
  items,
  onChangeItem,
  savedAt,
  onSave,
  saving,
  saveError,
  defectPhotosByItem,
  onUploadDefectPhoto,
  onDeleteDefectPhoto,
  uploadingItemId,
  showSaveControls = true,
}: FeststellOrderChecklistPanelProps) => {
  const ids = getFeststellChecklistItemIdsForMode(mode)

  const renderMelderRadios = () => (
    <div className="flex flex-col gap-2 mt-2">
      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Rauchmelder-Austausch</span>
      <div className="flex flex-wrap gap-2">
        {MELDER_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer"
          >
            <input
              type="radio"
              name="feststell-melder-interval"
              checked={items[FESTSTELL_MELDER_INTERVAL_ITEM_ID]?.melder_interval === opt.value}
              onChange={() =>
                onChangeItem(FESTSTELL_MELDER_INTERVAL_ITEM_ID, { melder_interval: opt.value })
              }
              className="rounded-full border-slate-400 text-vico-primary"
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  )

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Feststellanlage (DIN 14677)
        </h3>
        {savedAt && (
          <span className="text-xs text-emerald-700 dark:text-emerald-300" role="status">
            Gespeichert {new Date(savedAt).toLocaleString('de-DE')}
          </span>
        )}
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Normen (Hinweis): DIN 14677-1, DIN 14677-2; EN 14637 nur Referenz.
      </p>

      <div className="space-y-4 pr-1">
        {mode === 'detail'
          ? FESTSTELL_CHECKLIST_SECTIONS.map((sec, secIdx) => {
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
                      return d.id === FESTSTELL_MELDER_INTERVAL_ITEM_ID ? (
                        <li key={d.id} className="text-sm">
                          <p className="text-slate-800 dark:text-slate-100 mb-1">
                            <span className="font-medium tabular-nums text-slate-600 dark:text-slate-400">
                              {sectionNum}.{subNum}
                            </span>{' '}
                            {d.label}
                          </p>
                          {renderMelderRadios()}
                        </li>
                      ) : (
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
                                  name={`fst-${d.id}`}
                                  checked={items[d.id]?.status === opt.value}
                                  onChange={() => onChangeItem(d.id, { status: opt.value })}
                                  className="rounded-full border-slate-400 text-vico-primary"
                                />
                                {opt.label}
                              </label>
                            ))}
                          </div>
                          {items[d.id]?.status === 'mangel' && (
                            <div className="space-y-2">
                              <textarea
                                value={items[d.id]?.note ?? ''}
                                onChange={(e) => onChangeItem(d.id, { note: e.target.value })}
                                placeholder="Mangelbeschreibung (Pflicht)"
                                rows={2}
                                className={MANGEL_NOTE_INPUT_CLASS}
                                aria-label={`Mangelbeschreibung ${d.label}`}
                              />
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                                <input
                                  id={`fst-photo-${d.id}`}
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  className="sr-only"
                                  disabled={uploadingItemId === d.id}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file) void onUploadDefectPhoto(d.id, file)
                                    e.currentTarget.value = ''
                                  }}
                                />
                                <label
                                  htmlFor={`fst-photo-${d.id}`}
                                  className="inline-flex px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 cursor-pointer"
                                >
                                  Foto aufnehmen
                                </label>
                                <input
                                  id={`fst-file-${d.id}`}
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
                                  htmlFor={`fst-file-${d.id}`}
                                  className="inline-flex px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 cursor-pointer"
                                >
                                  Datei hinzufügen
                                </label>
                                <span>optional (max. 3)</span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {(defectPhotosByItem[d.id] ?? []).map((p) => (
                                  <div key={p.id} className="relative">
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
                                      onClick={() => void onDeleteDefectPhoto(d.id, p.id, p.storage_path)}
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
              return FESTSTELL_CHECKLIST_SECTIONS.map((sec) => {
                secNum += 1
                const n = secNum
                return sec.id === INTERVAL_SECTION_ID ? (
                  <div
                    key={sec.id}
                    className="border border-slate-200 dark:border-slate-600 rounded-lg p-3 bg-white dark:bg-slate-800/60"
                  >
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 mb-2">
                      <span className="font-medium tabular-nums text-slate-600 dark:text-slate-400">{n}.</span> {sec.title}
                    </p>
                    {renderMelderRadios()}
                  </div>
                ) : (
                  <div
                    key={sec.id}
                    className="border border-slate-200 dark:border-slate-600 rounded-lg p-3 bg-white dark:bg-slate-800/60"
                  >
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 mb-2">
                      <span className="font-medium tabular-nums text-slate-600 dark:text-slate-400">{n}.</span> {sec.title}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {STATUS_OPTIONS.map((opt) => (
                        <label
                          key={opt.value}
                          className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer"
                        >
                          <input
                            type="radio"
                            name={`fst-sec-${sec.id}`}
                            checked={items[sec.id]?.status === opt.value}
                            onChange={() => onChangeItem(sec.id, { status: opt.value })}
                            className="rounded-full border-slate-400 text-vico-primary"
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                    {items[sec.id]?.status === 'mangel' && (
                      <div className="space-y-2">
                        <textarea
                          value={items[sec.id]?.note ?? ''}
                          onChange={(e) => onChangeItem(sec.id, { note: e.target.value })}
                          placeholder="Mangelbeschreibung (Pflicht)"
                          rows={2}
                          className={MANGEL_NOTE_INPUT_CLASS}
                          aria-label={`Mangelbeschreibung ${sec.title}`}
                        />
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                          <input
                            id={`fst-photo-${sec.id}`}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="sr-only"
                            disabled={uploadingItemId === sec.id}
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) void onUploadDefectPhoto(sec.id, file)
                              e.currentTarget.value = ''
                            }}
                          />
                          <label
                            htmlFor={`fst-photo-${sec.id}`}
                            className="inline-flex px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 cursor-pointer"
                          >
                            Foto aufnehmen
                          </label>
                          <input
                            id={`fst-file-${sec.id}`}
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
                            htmlFor={`fst-file-${sec.id}`}
                            className="inline-flex px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 cursor-pointer"
                          >
                            Datei hinzufügen
                          </label>
                          <span>optional (max. 3)</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(defectPhotosByItem[sec.id] ?? []).map((p) => (
                            <div key={p.id} className="relative">
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
                                onClick={() => void onDeleteDefectPhoto(sec.id, p.id, p.storage_path)}
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
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500 disabled:opacity-50"
          >
            {saving ? 'Speichern…' : 'Feststellanlage speichern (Protokoll)'}
          </button>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Wird im gleichen Wartungsprotokoll wie die Tür-Checkliste gespeichert.
          </p>
        </>
      )}
      <p className="text-xs text-slate-400 dark:text-slate-500">
        Offene Prüfpunkte: {countFeststellIncompleteItems(mode, items)} / {ids.length}
      </p>
    </div>
  )
}

export default FeststellOrderChecklistPanel
