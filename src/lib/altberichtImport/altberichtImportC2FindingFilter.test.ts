import { describe, expect, it } from 'vitest'
import {
  altberichtC2FindingManualReviewHint,
  normalizeAltberichtC2FindingText,
  textShouldBeExcludedFromAltberichtC2Import,
} from './altberichtImportC2FindingFilter'

describe('altberichtImportC2FindingFilter', () => {
  it('schließt Dokumentkopf und reine Jahreszahl aus', () => {
    expect(textShouldBeExcludedFromAltberichtC2Import('Wartung 2025')).toBe(true)
    expect(textShouldBeExcludedFromAltberichtC2Import('Wartungsbericht')).toBe(true)
    expect(textShouldBeExcludedFromAltberichtC2Import('November')).toBe(true)
    expect(textShouldBeExcludedFromAltberichtC2Import('2025')).toBe(true)
    expect(textShouldBeExcludedFromAltberichtC2Import('BV: Musterbau')).toBe(true)
    expect(textShouldBeExcludedFromAltberichtC2Import('Bearbeitete Person Max Mustermann')).toBe(true)
    expect(textShouldBeExcludedFromAltberichtC2Import('Pos. Pos. intern Etage Raum')).toBe(true)
  })

  it('normalisiert führende Kopffragmente und behält Mangeltext', () => {
    expect(normalizeAltberichtC2FindingText('Wartung 2025 Brandgefahr am Rahmen')).toBe('Brandgefahr am Rahmen')
    expect(normalizeAltberichtC2FindingText('November Mörtelhinterfüllung fehlt')).toBe(
      'Mörtelhinterfüllung fehlt'
    )
    expect(textShouldBeExcludedFromAltberichtC2Import('Wartung 2025 Brandgefahr am Rahmen')).toBe(false)
  })

  it('entfernt angehängten Dokumenttitel', () => {
    expect(normalizeAltberichtC2FindingText('Laschen lose Wartung 2025')).toBe('Laschen lose')
  })

  it('entfernt Adressfragmente und führende Maße, behält Mangeltext', () => {
    expect(
      normalizeAltberichtC2FindingText(
        'Landhausstr. 7 in 71032 Böblingen Mörtelhinterfüllung fehlt komplett'
      )
    ).toBe('Mörtelhinterfüllung fehlt komplett')
    expect(
      normalizeAltberichtC2FindingText(
        '980x2000 wand Fluchtweg, Tür zum TH muss als Brandschutztür ausgeführt werden'
      )
    ).toBe('Tür zum TH muss als Brandschutztür ausgeführt werden')
    expect(normalizeAltberichtC2FindingText('278 Stromzähler sind Brandgefahr')).toBe(
      'Stromzähler sind Brandgefahr'
    )
    expect(textShouldBeExcludedFromAltberichtC2Import('Landhausstr. 7 in 71032 Böblingen')).toBe(true)
  })

  it('schließt echte Mängel nicht aus', () => {
    expect(textShouldBeExcludedFromAltberichtC2Import('Mörtelhinterfüllung fehlt komplett')).toBe(false)
    expect(textShouldBeExcludedFromAltberichtC2Import('ohne Zulassung montiert')).toBe(false)
  })

  it('liefert optionalen Prüfhinweis für kurze Texte ohne Schadenswort', () => {
    expect(altberichtC2FindingManualReviewHint('irgendwas kurz')).toMatch(/unplausibel/i)
    expect(altberichtC2FindingManualReviewHint('Dichtung fehlt')).toBeUndefined()
  })
})
