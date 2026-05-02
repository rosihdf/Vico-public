import { describe, expect, it } from 'vitest'

import {
  collectPagesMentionedOnStagingRow,
  resolveStagingRowPageHints,
} from './altberichtEmbeddedImageSuggest'
import { getStagingRowSkippedPages } from './altberichtImportSkippedPages'

const baseRow = (overrides: Partial<Parameters<typeof resolveStagingRowPageHints>[0]> = {}) => ({
  id: 'row-1',
  file_id: 'file-1',
  sequence: 3,
  source_refs_json: null as unknown,
  media_hints_json: [] as unknown,
  findings_json: [] as unknown,
  ...overrides,
})

describe('resolveStagingRowPageHints', () => {
  it('liefert Parser-Quelle, wenn source_refs_json Seiten enthält', () => {
    const row = baseRow({
      source_refs_json: [{ page: 7 }, { page: 9 }, { page: 7 }],
    })
    const hints = resolveStagingRowPageHints(row, [])
    expect(hints.source).toBe('parser')
    expect(hints.pages).toEqual([7, 9])
  })

  it('liefert Embedded-Quelle, wenn keine Parser-Anker, aber zugeordnete Bilder existieren', () => {
    const row = baseRow()
    const hints = resolveStagingRowPageHints(row, [
      {
        file_id: 'file-1',
        page_number: 4,
        linked_staging_object_id: 'row-1',
        suggested_staging_object_id: null,
      },
      {
        file_id: 'file-1',
        page_number: 5,
        linked_staging_object_id: null,
        suggested_staging_object_id: 'row-1',
      },
      {
        file_id: 'file-1',
        page_number: 99,
        linked_staging_object_id: 'row-other',
        suggested_staging_object_id: null,
      },
      {
        file_id: 'file-OTHER',
        page_number: 88,
        linked_staging_object_id: 'row-1',
        suggested_staging_object_id: null,
      },
    ])
    expect(hints.source).toBe('embedded')
    expect(hints.pages).toEqual([4, 5])
  })

  it('fällt auf row.sequence zurück, wenn weder Parser noch Embedded Hinweise liefern', () => {
    const row = baseRow({ sequence: 2 })
    const hints = resolveStagingRowPageHints(row, [])
    expect(hints.source).toBe('sequence')
    expect(hints.pages).toEqual([2])
  })

  it('liefert source `none` ohne sinnvolle Sequenz', () => {
    const row = baseRow({ sequence: 0 })
    const hints = resolveStagingRowPageHints(row, [])
    expect(hints.source).toBe('none')
    expect(hints.pages).toEqual([])
  })

  it('Standard-Modus-Szenario: Position 2 mit skippedPages [2,3,4] erzeugt Skip-Hinweis für Seite 2', () => {
    /**
     * Spiegelt ein gemeldetes Feld-Szenario: großes PDF, Bildscan-Timeout liefert
     * skippedPages [2,3,4]. Für Position 2 ohne Parser-/Embedded-Anker greift der
     * Sequenz-Fallback und liefert pages=[2]. Die Schnittmenge mit den skippedPages
     * der Datei ergibt [2] – dann muss der UI-Skip-Hinweis erscheinen.
     */
    const row = baseRow({ sequence: 2 })
    const hints = resolveStagingRowPageHints(row, [])
    expect(hints).toEqual({ pages: [2], source: 'sequence' })
    const skippedForRow = getStagingRowSkippedPages(new Set(hints.pages), [2, 3, 4])
    expect(skippedForRow).toEqual([2])
  })

  it('Standard-Modus-Szenario: Position 5 ohne Daten und ohne Skip-Liste liefert trotzdem pages=[5]', () => {
    const row = baseRow({ sequence: 5 })
    const hints = resolveStagingRowPageHints(row, [])
    expect(hints).toEqual({ pages: [5], source: 'sequence' })
    expect(getStagingRowSkippedPages(new Set(hints.pages), [])).toEqual([])
  })

  it('collectPagesMentionedOnStagingRow ignoriert ungültige Werte', () => {
    const pages = collectPagesMentionedOnStagingRow({
      id: 'row-x',
      file_id: 'file-x',
      sequence: 1,
      source_refs_json: [{ page: 0 }, { page: -3 }, { page: 'nope' as unknown as number }],
      media_hints_json: null,
      findings_json: [{ sourceRefs: [{ page: 12 }] }],
    })
    expect([...pages]).toEqual([12])
  })
})
