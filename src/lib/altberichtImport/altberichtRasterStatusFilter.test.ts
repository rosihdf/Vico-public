import { describe, expect, it } from 'vitest'
import { filterAltberichtRasterBlockStatusText } from './altberichtRasterStatusFilter'

describe('filterAltberichtRasterBlockStatusText', () => {
  it('lehnt mangelfrei / i.O. ohne Finding ab', () => {
    expect(filterAltberichtRasterBlockStatusText('mangelfrei').kind).toBe('reject')
    expect(filterAltberichtRasterBlockStatusText('i.O.').kind).toBe('reject')
    expect(filterAltberichtRasterBlockStatusText('in Ordnung').kind).toBe('reject')
    expect(filterAltberichtRasterBlockStatusText('ohne Befund').kind).toBe('reject')
  })

  it('lehnt reine Maßangaben ab', () => {
    expect(filterAltberichtRasterBlockStatusText('875x2010').kind).toBe('reject')
    expect(filterAltberichtRasterBlockStatusText('980 x 2000').kind).toBe('reject')
  })

  it('akzeptiert klaren Mangeltext', () => {
    const r = filterAltberichtRasterBlockStatusText('SF Schloss defekt')
    expect(r.kind).toBe('accept')
    if (r.kind === 'accept') expect(r.text.toLowerCase()).toContain('schloss')
  })

  it('klassifiziert Mörtelhinterfüllung als klaren Mangel', () => {
    const r = filterAltberichtRasterBlockStatusText(
      'Mörtelhinterfüllung fehlt komplett Putz?'
    )
    expect(r.kind).toBe('accept')
  })

  it('Reparatur + mangelfrei als prüfpflichtig (suspect)', () => {
    const r = filterAltberichtRasterBlockStatusText(
      'Drücker und Schloss blockiert -> wurde repariert nun mangelfrei'
    )
    expect(r.kind).toBe('suspect')
    if (r.kind === 'suspect') expect(r.reason).toContain('gemischt')
  })
})
