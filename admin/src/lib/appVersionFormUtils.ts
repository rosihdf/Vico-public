import {
  APP_VERSION_KEYS,
  type AppVersionKey,
  type AppVersionsMap,
} from '../../../shared/appVersions'

export type AppVersionFormRow = { version: string; releaseLabel: string; releaseNotesText: string }

export type AppVersionRowsState = Record<AppVersionKey, AppVersionFormRow>

export const emptyAppVersionRow = (): AppVersionFormRow => ({
  version: '',
  releaseLabel: '',
  releaseNotesText: '',
})

export const initialAppVersionRows = (): AppVersionRowsState => {
  const init = {} as AppVersionRowsState
  for (const k of APP_VERSION_KEYS) init[k] = emptyAppVersionRow()
  return init
}

export const appVersionRowsToPayload = (rows: AppVersionRowsState): AppVersionsMap | null => {
  const out: AppVersionsMap = {}
  for (const k of APP_VERSION_KEYS) {
    const r = rows[k]
    const v = r.version.trim()
    const label = r.releaseLabel.trim()
    const notes = r.releaseNotesText.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
    if (v || label || notes.length > 0) {
      out[k] = {
        ...(v ? { version: v } : {}),
        ...(label ? { releaseLabel: label } : {}),
        ...(notes.length ? { releaseNotes: notes } : {}),
      }
    }
  }
  return Object.keys(out).length > 0 ? out : null
}

export const appVersionRowsFromJson = (av: Record<string, unknown> | null | undefined): AppVersionRowsState => {
  const next = {} as AppVersionRowsState
  for (const k of APP_VERSION_KEYS) {
    const raw = av?.[k]
    if (raw && typeof raw === 'object') {
      const o = raw as Record<string, unknown>
      const notesArr = Array.isArray(o.releaseNotes)
        ? o.releaseNotes
        : Array.isArray(o.release_notes)
          ? o.release_notes
          : []
      const notesText = notesArr.filter((x) => typeof x === 'string').join('\n')
      next[k] = {
        version: typeof o.version === 'string' ? o.version : '',
        releaseLabel:
          typeof o.releaseLabel === 'string'
            ? o.releaseLabel
            : typeof o.release_label === 'string'
              ? o.release_label
              : '',
        releaseNotesText: notesText,
      }
    } else {
      next[k] = emptyAppVersionRow()
    }
  }
  return next
}
