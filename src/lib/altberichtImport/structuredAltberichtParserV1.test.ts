import { describe, expect, it } from 'vitest'
import { textShouldBeExcludedFromAltberichtC2Import } from './altberichtImportC2FindingFilter'
import {
  ALTBERICHT_STATUS_REVIEW_PLACEHOLDER_TEXT,
  parseStructuredAltberichtPlainTextV1,
} from './structuredAltberichtParserV1'

describe('parseStructuredAltberichtPlainTextV1 – WEG wiederholte Pos.-Blöcke', () => {
  it('erzeugt mehrere Staging-Objekte bei mehrfachem Pos./Etage/Raum-Header', () => {
    const sample = `
Kunde: WEG Muster
Bauvorhaben: Landhausstr. 7

Pos. Pos. intern Etage Raum
UG TG Schleuse
Art Fl. Anforderung Hersteller
Tür Stahl
Schließmittel FSA
weiteres Zubehör Status
1
i.O.

Pos. Pos. intern Etage Raum
EG Keller Flur
Art Fl. Anforderung Hersteller
Glas
2
i.O.

Pos. Pos. intern
Etage Raum
EG TH Zählerraum
3
Bemerkung
`

    const r = parseStructuredAltberichtPlainTextV1(sample, {
      originalFilename: 'Wartung 2025 WEG Landhausstr. 7 in 71032 Böblingen.pdf',
    })

    expect(r.objects.length).toBe(3)
    expect(r.warnings.some((w) => w.code === 'parser.repeated_pos_blocks')).toBe(true)
    expect(r.objects[0]!.analysisTrace).toMatchObject({
      subMode: 'we_repeated_pos_table',
      wegWartung: { headerCount: 3, splitStrategy: 'repeated_header' },
    })
    expect(r.objects[0]!.floorText).toBe('UG')
    expect(r.objects[0]!.roomText).toContain('Schleuse')
    expect(r.objects[1]!.sequence).toBe(2)
    expect(r.objects[1]!.floorText).toBe('EG')
    expect(r.objects[2]!.roomText).toContain('Zählerraum')
    expect(r.objects[0]!.findings.length).toBe(0)
    expect(r.objects[1]!.findings.length).toBe(0)
  })

  it('WEG: nur echte Befunde in findings (C2), nicht i.O. und nicht Stammdaten-Zeilen', () => {
    const r = parseStructuredAltberichtPlainTextV1(
      `
Kunde: W
Pos. Pos. intern Etage Raum
UG RaumX
Art Fl. Anforderung Hersteller
Tür 1
Schließmittel FSA
weiteres Zubehör Status
1
Mangel: Dichtung fehlt am Blendrahmen
EG Keller
Art Fl. Anforderung Hersteller
Glas
2
i.O.
`,
      { originalFilename: 'Wartung 2025 WEG x in 12345 Y.pdf' }
    )
    expect(r.objects.length).toBe(2)
    const f0 = r.objects[0]!.findings
    expect(f0.length).toBe(1)
    expect(f0[0]!.text).toContain('Dichtung')
    expect(f0.some((x) => x.text.includes('Art:'))).toBe(false)
    expect(r.objects[1]!.findings.length).toBe(0)
    expect(textShouldBeExcludedFromAltberichtC2Import('Art: Tür')).toBe(true)
    expect(textShouldBeExcludedFromAltberichtC2Import('Dichtung fehlt am Blendrahmen')).toBe(false)
  })

  it('WEG: erkennt Mangeltext inline aus dem Status-Feld als C2-Kandidat', () => {
    const r = parseStructuredAltberichtPlainTextV1(
      `
Kunde: W
Pos. intern Etage Raum
UG Technik Art Fl. Anforderung Hersteller Tür 1 T30 Teckentrupp Schließmittel FSA/Antrieb Anzahl RM FTT TS89 weiteres Zubehör Status 12 Dichtung beschädigt, Tür schließt nicht vollständig
`,
      { originalFilename: 'Wartung WEG Status rot.pdf' }
    )

    expect(r.objects.length).toBe(1)
    const findings = r.objects[0]!.findings
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      source: 'status',
      sequence: 1,
      text: 'Dichtung beschädigt, Tür schließt nicht vollständig',
    })
    expect(findings[0]!.confidence).toBeGreaterThanOrEqual(0.6)
  })

  it('WEG: reine Maßangabe im Status erzeugt kein Status-Finding', () => {
    const r = parseStructuredAltberichtPlainTextV1(
      `
Kunde: W
Pos. Pos. intern Etage Raum
UG Keller
Art Fl. Anforderung Hersteller
Tür 1
Schließmittel FSA
weiteres Zubehör Status
875x2010
`,
      { originalFilename: 'Wartung 2025 WEG x.pdf' }
    )
    expect(r.objects.length).toBe(1)
    expect(r.objects[0]!.findings.filter((f) => f.source === 'status')).toHaveLength(0)
    const dbg = r.objects[0]!.analysisTrace?.statusFindingsDebug
    expect(dbg?.rejectedReason).toBe('harmless_measure_or_numeric')
  })

  it('WEG: nach Header+BV in erster Statuszeile Mangel in Folgezeile (Anker-Fallback)', () => {
    const r = parseStructuredAltberichtPlainTextV1(
      `
Kunde: W
Pos. Pos. intern Etage Raum
EG Keller
Art Fl. Anforderung Hersteller
Tür 1
Schließmittel FSA
weiteres Zubehör Status
Wartung 2025 November BV: Projekt X
Mörtelhinterfüllung fehlt komplett Putz? Laschen nicht tragend
`,
      { originalFilename: 'WEG.pdf' }
    )
    expect(r.objects.length).toBe(1)
    const statusFindings = r.objects[0]!.findings.filter((f) => f.source === 'status')
    expect(
      statusFindings.some((f) => f.text.includes('Mörtelhinterfüllung fehlt komplett Putz'))
    ).toBe(true)
    expect(statusFindings.some((f) => /Wartung\s*2025|November|^BV:/i.test(f.text))).toBe(false)
  })

  it('WEG: reiner Dokumenttitel „Wartung 2025“ im Status erzeugt kein Finding', () => {
    const r = parseStructuredAltberichtPlainTextV1(
      `
Kunde: W
Pos. Pos. intern Etage Raum
EG Keller
Art Fl. Anforderung Hersteller
Tür 1
Schließmittel FSA
weiteres Zubehör Status
Wartung 2025
`,
      { originalFilename: 'WEG.pdf' }
    )
    expect(r.objects.length).toBe(1)
    expect(r.objects[0]!.findings.filter((f) => f.source === 'status')).toHaveLength(0)
    const dbg = r.objects[0]!.analysisTrace?.statusFindingsDebug
    expect(dbg?.rejectedReason).toBe('document_header_only')
    expect(dbg?.statusCandidate).toBe('Wartung 2025')
  })

  it('WEG: nach Dokumentkopf nur echter Mangeltext als Status-Finding', () => {
    const r = parseStructuredAltberichtPlainTextV1(
      `
Kunde: W
Pos. intern Etage Raum
EG X Art Fl. Anforderung Hersteller Tür Schließmittel FTT weiteres Zubehör Status Wartung 2025 Mörtelhinterfüllung fehlt komplett Laschen ohne Zulassung
`,
      { originalFilename: 'WEG.pdf' }
    )
    expect(r.objects.length).toBe(1)
    const texts = r.objects[0]!.findings.filter((f) => f.source === 'status').map((f) => f.text)
    expect(texts.some((t) => /Wartung\s*2025/i.test(t))).toBe(false)
    expect(texts.some((t) => /Mörtelhinterfüllung|Laschen|Zulassung/i.test(t))).toBe(true)
  })

  it('WEG: Status wird an Dokument-Stoppmarken begrenzt und Mängel getrennt', () => {
    const r = parseStructuredAltberichtPlainTextV1(
      `
Kunde: W
Pos. intern Etage Raum
EG Raum Art Fl. Anforderung Hersteller Glas Schließmittel FTT weiteres Zubehör Status Dichtung undicht. Mörtelhinterfüllung fehlt komplett Bearbeitete Person Mustermann Wartung 2025 Rest
`,
      { originalFilename: 'WEG.pdf' }
    )
    expect(r.objects.length).toBe(1)
    const texts = r.objects[0]!.findings.filter((f) => f.source === 'status').map((f) => f.text)
    expect(texts.some((t) => t.includes('Bearbeitete'))).toBe(false)
    expect(texts.some((t) => t.includes('Wartung 2025'))).toBe(false)
    expect(texts.length).toBeGreaterThanOrEqual(2)
    expect(texts.some((t) => /Dichtung|undicht/i.test(t))).toBe(true)
    expect(texts.some((t) => /Mörtelhinterfüllung/i.test(t))).toBe(true)
  })

  it('trennt WEG-Block intern (Etage/Raum, Art, Schließmittel) auch bei in einer Zeile verklebten Markern', () => {
    const sample = `
Kunde: WEG
Pos. Pos. intern Etage Raum
UG TG Schleuse Art Fl. Anforderung Hersteller
Tür 1 T30 Teckentrupp
Schließmittel FSA/Antrieb Anzahl RM FTT
TS89
weiteres Zubehör Status
1
i.O.
Pos. Pos. intern Etage Raum
EG Keller Flur
Art Fl. Anforderung Hersteller
Glas
2
i.O.
`
    const r = parseStructuredAltberichtPlainTextV1(sample, {
      originalFilename: 'Wartung 2025 WEG Landhausstr. 7 in 71032 Böblingen.pdf',
    })
    expect(r.objects.length).toBe(2)
    const o0 = r.objects[0]!
    expect(o0.floorText).toBe('UG')
    expect(o0.roomText).toBe('TG Schleuse')
    expect(o0.roomText).not.toMatch(/Art|Anforderung|Hersteller|Schließmittel|Zubehör/i)
    expect(o0.objectTypeText).toBe('Tür')
    expect(o0.objectName).toContain('TG Schleuse')
    expect(o0.objectName).not.toMatch(/Art Fl\.?|Anforderung|weiteres Zubehör|Schließmittel FSA|T30|Teckentrupp/i)
    const art0 = o0.catalogCandidates.find((c) => c.field === 'art')
    expect(art0?.raw).toBe('Tür')
    const fl0 = o0.catalogCandidates.find((c) => c.field === 'fluegel')
    expect(fl0?.raw).toBe('1')
    const sch0 = o0.catalogCandidates.find((c) => c.field === 'schliessmittel_typ')
    expect(sch0?.raw).toMatch(/^TS89/)
    const anf0 = o0.catalogCandidates.find((c) => c.field === 'anforderung')
    expect(anf0?.raw).toBe('T30')
    const h0 = o0.catalogCandidates.find((c) => c.field === 'hersteller')
    expect(h0?.raw).toBe('Teckentrupp')
    const tr = o0.analysisTrace as {
      schliessmittelDebug?: { blockSnippet?: string; schliessmittelHeaderLine?: string; parsedTypSourceLine?: string }
    }
    expect(tr.schliessmittelDebug?.schliessmittelHeaderLine).toMatch(/Schließmittel FSA/i)
    expect(tr.schliessmittelDebug?.parsedTypSourceLine).toMatch(/TS89/)
    expect(tr.schliessmittelDebug?.blockSnippet).toMatch(/TS89/)
  })

  it('fällt auf einen Einzelblock zurück, wenn der Header nur einmal vorkommt', () => {
    const r = parseStructuredAltberichtPlainTextV1(
      'Pos. Pos. intern Etage Raum\n1 EG Raum1\nKunde: A',
      { originalFilename: 'einfach.pdf' }
    )
    expect(r.objects.length).toBe(1)
  })

  it('zerlegt bei nur einem Tabellenkopf in mehrere Blöcke (Etage/Raum-Startzeilen)', () => {
    const oneHeader = `
Kunde: WEG
Pos. Pos. intern Etage Raum
UG TG Schleuse
Art Fl. Anforderung Hersteller
Tür A
1
i.O.
EG Keller Flur
Art Fl. Anforderung Hersteller
Tür B
2
i.O.
EG TH Zählerraum
Art Fl. Anforderung Hersteller
Tür C
3
i.O.
`
    const r = parseStructuredAltberichtPlainTextV1(oneHeader, {
      originalFilename: 'Wartung 2025 WEG Landhausstr. 7 in 71032 Böblingen.pdf',
    })
    expect(r.objects.length).toBe(3)
    expect(r.warnings.some((w) => w.code === 'parser.weg_single_header_floor_blocks')).toBe(true)
    expect(r.objects[0]!.analysisTrace).toMatchObject({
      subMode: 'weg_floor_line_after_single_header',
      wegWartung: { headerCount: 1, splitStrategy: 'floor_line' },
    })
  })

  it('erkennt Tabellenkopf „Pos. intern Etage Raum“ (ohne doppeltes Pos.) + Referenzblock vollständig', () => {
    const sample = `
Kunde: WEG Ref
Pos. intern Etage Raum
UG TG Schleuse
Art Fl. Anforderung Hersteller
Tür 1 T30 Teckentrupp
Schließmittel FSA/Antrieb Anzahl RM FTT
TS89
weiteres Zubehör Status
1
i.O.
`
    const r = parseStructuredAltberichtPlainTextV1(sample, { originalFilename: 'Wartung WEG.pdf' })
    expect(r.warnings.some((w) => w.code === 'parser.weg_single_header_floor_blocks')).toBe(true)
    expect(r.objects.length).toBe(1)
    const o = r.objects[0]!
    expect(o.floorText).toBe('UG')
    expect(o.roomText).toBe('TG Schleuse')
    expect(o.objectTypeText).toBe('Tür')
    const cat = (f: string) => o.catalogCandidates.find((c) => c.field === f)?.raw
    expect(cat('art')).toBe('Tür')
    expect(cat('fluegel')).toBe('1')
    expect(cat('anforderung')).toBe('T30')
    expect(cat('hersteller')).toBe('Teckentrupp')
    expect(cat('schliessmittel_typ')).toMatch(/^TS89/)
  })

  it('Schließmittel-Typ: ganzer Positionsblock als eine Zeile (FTT … TS89 … weiteres Zubehör Status)', () => {
    const oneLine = `UG TG Schleuse Art Fl. Anforderung Hersteller Tür 1 T30 Teckentrupp Schließmittel FSA/Antrieb Anzahl RM FTT TS89 weiteres Zubehör Status`
    const r = parseStructuredAltberichtPlainTextV1(
      `Kunde: W\nPos. intern Etage Raum\n${oneLine}\n1\ni.O.\n`,
      { originalFilename: 'Wartung WEG kollabiert.pdf' }
    )
    expect(r.objects.length).toBe(1)
    const sch = r.objects[0]!.catalogCandidates.find((c) => c.field === 'schliessmittel_typ')
    expect(sch?.raw).toBe('TS89')
  })

  it('liest Schließmittel-Typ in derselben Zeile wie den Spaltenkopf (TS89 angeklebt)', () => {
    const sample = `
Kunde: W
Pos. Pos. intern Etage Raum
UG X
Art Fl. Anforderung Hersteller
Tür 1
Schließmittel FSA/Antrieb Anzahl RM FTT TS89
weiteres Zubehör Status
1
i.O.
`
    const r = parseStructuredAltberichtPlainTextV1(sample, { originalFilename: 'a.pdf' })
    expect(r.objects.length).toBe(1)
    const sch = r.objects[0]!.catalogCandidates.find((c) => c.field === 'schliessmittel_typ')
    expect(sch?.raw).toMatch(/^TS89/)
  })

  it('WEG: komplexer FSA-Block (Antrib) — ISM TS5000, Geze, R ISM, RM; Art-Zeile RS vs Hersteller Hörmann', () => {
    const sample = `
Kunde: WEG
Pos. Pos. intern Etage Raum
EG Flur
Art Fl. Anforderung Hersteller
Tür 2 RS Hörmann
Schließmittel FSA/Antrib Anzahl RM FTT ISM TS5000 Geze R ISM 3
weiteres Zubehör Status
20
i.O.
`
    const r = parseStructuredAltberichtPlainTextV1(sample, { originalFilename: 'Wartung FSA complex.pdf' })
    expect(r.objects.length).toBe(1)
    const o = r.objects[0]!
    const cat = (f: string) => o.catalogCandidates.find((c) => c.field === f)?.raw
    expect(cat('art')).toBe('Tür')
    expect(cat('fluegel')).toBe('2')
    expect(cat('anforderung')).toBe('RS')
    expect(cat('hersteller')).toBe('Hörmann')
    expect(cat('schliessmittel_typ')).toBe('ISM TS5000')
    expect(cat('fsa_hersteller')).toBe('Geze')
    expect(cat('fsa_typ')).toBe('R ISM')
    expect(cat('rauchmelder')).toBe('3')
    const tr = o.analysisTrace as {
      schliessmittelDebug?: { complexFsa?: { schliessmittel_typ: string; fsa_hersteller: string | null } }
    }
    expect(tr.schliessmittelDebug?.complexFsa).toEqual({
      schliessmittel_typ: 'ISM TS5000',
      fsa_hersteller: 'Geze',
      fsa_typ: 'R ISM',
      rauchmelder: '3',
    })
  })

  it('Beispiel-Baustelle: kollabierte Zeile T30 RS + Hörmann, Schließmittel HDC 35', () => {
    const oneLine = `302 2 Mschinenraum Art Fl. Anforderung Hersteller Tür 1 T30 RS Hörmann Schließmittel FSA/Antrib Anzahl RM FTT HDC 35 weiteres Zubehör Status`
    const r = parseStructuredAltberichtPlainTextV1(
      `Kunde: W\nPos. intern Etage Raum\n${oneLine}\n1\ni.O.\n`,
      { originalFilename: 'Beispielauftrag Wartung.pdf' }
    )
    expect(r.objects.length).toBe(1)
    const o = r.objects[0]!
    expect(o.floorText).toBe('2')
    expect(o.roomText).toBe('Mschinenraum')
    expect(o.objectName).toContain('302')
    expect(o.objectName).toContain('2')
    expect(o.objectName).toContain('Mschinenraum')
    const cat = (f: string) => o.catalogCandidates.find((c) => c.field === f)?.raw
    expect(cat('art')).toBe('Tür')
    expect(cat('fluegel')).toBe('1')
    expect(cat('anforderung')).toBe('T30 RS')
    expect(cat('hersteller')).toBe('Hörmann')
    expect(cat('schliessmittel_typ')?.replace(/\s+/g, ' ').trim()).toMatch(/^HDC 35$/i)
  })

  it('Layout dreistellige Positionsnummern: 304/54/104 Positionszeilen — 1. Zahl = Pos, 2. = Etage, Rest = Raum', () => {
    const r304 = parseStructuredAltberichtPlainTextV1(
      `Kunde: X\nPos. intern Etage Raum\n304 2 kita Zugang Art Fl. Anforderung Hersteller Tür 1 T30\n1\nok\n`
    )
    expect(r304.objects[0]!.floorText).toBe('2')
    expect(r304.objects[0]!.roomText).toBe('kita Zugang')
    const r54 = parseStructuredAltberichtPlainTextV1(
      `Kunde: Y\nPos. intern Etage Raum\n54 -1 TG Art Fl. Anforderung Hersteller Tür 1 T30\n1\nok\n`
    )
    expect(r54.objects[0]!.floorText).toBe('-1')
    expect(r54.objects[0]!.roomText).toBe('TG')
    const r104 = parseStructuredAltberichtPlainTextV1(
      `Kunde: Z\nPos. intern Etage Raum\n104 0 Laden EG Art Fl. Anforderung Hersteller Tür 1 T30\n1\nok\n`
    )
    expect(r104.objects[0]!.floorText).toBe('0')
    expect(r104.objects[0]!.roomText).toBe('Laden EG')
  })

  it('Schließmittel nach FTT: TS 61 und TS4000 SFR vollständig', () => {
    const doc61 = `
Kunde: T
Pos. intern Etage Raum
EG R
Art Fl. Anforderung Hersteller
Tür 1
Schließmittel FSA/Antrieb Anzahl RM FTT TS 61 weiteres Zubehör Status
1
i.O.
`
    const r61 = parseStructuredAltberichtPlainTextV1(doc61, { originalFilename: 'ts61.pdf' })
    const sm61 = r61.objects[0]!.catalogCandidates.find((c) => c.field === 'schliessmittel_typ')?.raw
    expect(sm61?.replace(/\s+/g, ' ').trim()).toMatch(/^TS 61$|^TS61$/i)

    const docSFR = `
Kunde: T
Pos. intern Etage Raum
EG R
Art Fl. Anforderung Hersteller
Tür 1
Schließmittel FSA/Antrieb Anzahl RM FTT TS4000 SFR weiteres Zubehör Status
1
i.O.
`
    const rSfr = parseStructuredAltberichtPlainTextV1(docSFR, { originalFilename: 'ts4000sfr.pdf' })
    const smSfr = rSfr.objects[0]!.catalogCandidates.find((c) => c.field === 'schliessmittel_typ')?.raw
    expect(smSfr?.replace(/\s+/g, ' ').trim()).toBe('TS4000 SFR')
  })
})

describe('parseStructuredAltberichtPlainTextV1 – globale Mängelliste & Status-Platzhalter', () => {
  it('nachgelagerte Indexzeile (1…5) + Absätze → Zuordnung zu Positionen', () => {
    const doc = `
Kunde: WEG
Pos. Pos. intern Etage Raum
UG A1
Art Fl. Anforderung Hersteller
Tür
Schließmittel FSA
weiteres Zubehör Status
1

EG B2
Art Fl. Anforderung Hersteller
Tür
Schließmittel FSA
weiteres Zubehör Status
2

EG C3
Art Fl. Anforderung Hersteller
Tür
Schließmittel FSA
weiteres Zubehör Status
3

EG D4
Art Fl. Anforderung Hersteller
Tür
Schließmittel FSA
weiteres Zubehör Status
4

EG E5
Art Fl. Anforderung Hersteller
Tür
Schließmittel FSA
weiteres Zubehör Status
5

Feststellungen

1 2 3 4 5

Dichtung undicht erste Tür

Rahmen beschädigt zweite Position

Schloss klemmt dritte Position

Klinke lose vierte Position

Anschlag fehlt fünfte Position
`
    const r = parseStructuredAltberichtPlainTextV1(doc, { originalFilename: 'weg-liste.pdf' })
    expect(r.objects.length).toBe(5)
    expect(r.objects[0]!.findings.some((f) => f.text.includes('Dichtung undicht'))).toBe(true)
    expect(r.objects[1]!.findings.some((f) => f.text.includes('Rahmen beschädigt'))).toBe(true)
    expect(r.objects[2]!.findings.some((f) => f.text.includes('Schloss klemmt'))).toBe(true)
    const tr = r.objects[0]!.analysisTrace as { documentDefectListMerge?: { matchedPos?: number } }
    expect(tr.documentDefectListMerge?.matchedPos).toBe(1)
  })

  it('Status-Marker am Zeilenende ohne Folgetext → Platzhalter-Finding (no_candidate_after_status)', () => {
    const doc = `
Kunde: W
Pos. intern Etage Raum
UG Keller Art Fl. Anforderung Hersteller Tür Schließmittel FTT weiteres Zubehör Status
`
    const r = parseStructuredAltberichtPlainTextV1(doc, { originalFilename: 'status-leer.pdf' })
    expect(r.objects.length).toBe(1)
    const o = r.objects[0]!
    expect(o.findings.some((f) => f.text === ALTBERICHT_STATUS_REVIEW_PLACEHOLDER_TEXT)).toBe(true)
    const dbg = o.analysisTrace?.statusFindingsDebug as { statusPlaceholderApplied?: boolean } | undefined
    expect(dbg?.statusPlaceholderApplied).toBe(true)
  })
})
