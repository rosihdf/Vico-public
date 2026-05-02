import { describe, expect, it } from 'vitest'

import {
  altberichtBulkResultToastType,
  altberichtToastTypeForCode,
} from './altberichtImportToastMap'

describe('altberichtToastTypeForCode', () => {
  it('mappt Erfolgs-Codes auf "success"', () => {
    expect(altberichtToastTypeForCode('imported')).toBe('success')
    expect(altberichtToastTypeForCode('committed')).toBe('success')
    expect(altberichtToastTypeForCode('saved')).toBe('success')
    expect(altberichtToastTypeForCode('reused')).toBe('success')
    expect(altberichtToastTypeForCode('parsed')).toBe('success')
    expect(altberichtToastTypeForCode('uploaded')).toBe('success')
  })

  it('mappt idempotente Codes auf "info"', () => {
    expect(altberichtToastTypeForCode('already_imported')).toBe('info')
    expect(altberichtToastTypeForCode('already_committed')).toBe('info')
    expect(altberichtToastTypeForCode('no_changes')).toBe('info')
    expect(altberichtToastTypeForCode('skipped_idempotent')).toBe('info')
  })

  it('mappt Warnungs-Codes auf "warning"', () => {
    expect(altberichtToastTypeForCode('skipped')).toBe('warning')
    expect(altberichtToastTypeForCode('partial')).toBe('warning')
    expect(altberichtToastTypeForCode('page_skipped')).toBe('warning')
    expect(altberichtToastTypeForCode('image_scan_timeout')).toBe('warning')
    expect(altberichtToastTypeForCode('fallback_used')).toBe('warning')
  })

  it('mappt Fehler-Codes auf "error"', () => {
    expect(altberichtToastTypeForCode('failed')).toBe('error')
    expect(altberichtToastTypeForCode('parser_failed')).toBe('error')
    expect(altberichtToastTypeForCode('commit_failed')).toBe('error')
    expect(altberichtToastTypeForCode('invalid_input')).toBe('error')
    expect(altberichtToastTypeForCode('no_object')).toBe('error')
    expect(altberichtToastTypeForCode('object_archived')).toBe('error')
  })

  it('liefert für unbekannte/leere Codes "info" – nichts wird mehr versehentlich rot', () => {
    expect(altberichtToastTypeForCode(undefined)).toBe('info')
    expect(altberichtToastTypeForCode(null)).toBe('info')
    expect(altberichtToastTypeForCode('')).toBe('info')
    expect(altberichtToastTypeForCode('   ')).toBe('info')
    expect(altberichtToastTypeForCode('something_unknown')).toBe('info')
  })
})

describe('altberichtBulkResultToastType', () => {
  it('reine Erfolge → success', () => {
    expect(altberichtBulkResultToastType({ ok: 5, bad: 0, skipped: 0 })).toBe('success')
    expect(altberichtBulkResultToastType({ ok: 5, bad: 0, skipped: 2 })).toBe('success')
  })

  it('Erfolge + Fehler → warning (Teilerfolg)', () => {
    expect(altberichtBulkResultToastType({ ok: 5, bad: 1, skipped: 0 })).toBe('warning')
    expect(altberichtBulkResultToastType({ ok: 1, bad: 5, skipped: 3 })).toBe('warning')
  })

  it('reine Fehler → error', () => {
    expect(altberichtBulkResultToastType({ ok: 0, bad: 3, skipped: 0 })).toBe('error')
  })

  it('nur idempotent übersprungen → info', () => {
    expect(altberichtBulkResultToastType({ ok: 0, bad: 0, skipped: 7 })).toBe('info')
    expect(altberichtBulkResultToastType({ ok: 0, bad: 0, skipped: 0 })).toBe('info')
  })
})
