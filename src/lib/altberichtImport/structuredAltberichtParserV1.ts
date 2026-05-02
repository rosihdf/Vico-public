/**
 * Heuristischer Parser für typische deutschsprachige Altbericht-/Prüf-PDFs (Textlage).
 * Optimiert auf einfache Feldmarken und Listen; sonst ein Sammelobjekt mit Rohtext-Finding.
 */
import type {
  AltberichtParserCatalogCandidateV1,
  AltberichtParserFindingCandidateV1,
  AltberichtParserResultV1,
  AltberichtParserStagingObjectV1,
} from './parserContractV1'
import {
  isAltberichtC2DocumentHeaderOnlyToken,
  normalizeAltberichtC2FindingText,
  stripLeadingAltberichtDocumentHeaderForC2,
  textShouldBeExcludedFromAltberichtC2Import,
} from './altberichtImportC2FindingFilter'

export const STRUCTURED_ALTBERICHT_PARSER_VERSION = 'vico-altbericht-structured/1.3.5'

/** Einfachmodus / C2: prüfpflichtig, kein automatischer Produktiv-Import ohne Nutzeraktion. */
export const ALTBERICHT_STATUS_REVIEW_PLACEHOLDER_TEXT =
  'Mangel laut Bericht vorhanden – bitte Text prüfen'

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim()

const matchField = (text: string, label: RegExp): string | undefined => {
  const m = text.match(label)
  return m?.[1] ? norm(m[1]) : undefined
}

const isFloorToken = (token: string): boolean => {
  const t = token.trim()
  if (!t) return false
  if (/^-?\d+$/.test(t)) return true
  if (/^(?:eg|ug|kg|dg|og)$/i.test(t)) return true
  if (/^\d+\s*\.?\s*og$/i.test(t)) return true
  return false
}

/**
 * Bekanntes Positionslayout (PDF gescannt): eine Datenzeile „<Pos. 2–4 Ziffern> <Etage> <Rest Raum>“ in einer Zeile
 * (nicht: Erste Zahl = Etage). Z. B. 302 2 Mschinenraum, 54 -1 TG, 104 0 Laden EG
 */
const isWettePosEtageRoomTripletLine = (line: string): boolean => {
  const raw = line.replace(/\s+/g, ' ').trim()
  if (!raw) return false
  const tokens = raw.split(/\s+/).filter(Boolean)
  if (tokens.length < 3) return false
  if (!/^\d{2,4}$/.test(tokens[0]!)) return false
  if (!isFloorToken(tokens[1]!)) return false
  return true
}

const parseWettePosEtageRoomFromTruncatedLine = (truncatedLine: string): { floor: string; room: string } | null => {
  const tokens = truncatedLine.split(/\s+/).filter(Boolean)
  if (tokens.length < 3) return null
  if (!/^\d{2,4}$/.test(tokens[0]!)) return null
  if (!isFloorToken(tokens[1]!)) return null
  const room = tokens.slice(2).join(' ').trim()
  if (!room) return null
  return { floor: tokens[1]!.trim(), room }
}

const parseWetteLeadingPosRefFromBlock = (block: string): number | null => {
  const lines = blockLines(block)
  const first = lines[0]
  if (!first) return null
  const tr = truncateLineAtWegSectionMarkers(first)
  if (!isWettePosEtageRoomTripletLine(tr)) return null
  const t0 = tr.split(/\s+/).filter(Boolean)[0]!
  const n = parseInt(t0, 10)
  if (!Number.isFinite(n) || n < 1) return null
  return n
}

const parseFloorRoomFromPosTable = (text: string): { floorText?: string; roomText?: string } => {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const headerIdx = lines.findIndex((line) => {
    const lower = line.toLowerCase()
    return lower.includes('pos') && lower.includes('etage') && lower.includes('raum')
  })
  if (headerIdx < 0) return {}

  for (let i = headerIdx + 1; i < Math.min(lines.length, headerIdx + 12); i += 1) {
    const line = lines[i]!
    const tokens = line.split(/\s+/).filter(Boolean)
    if (tokens.length < 3) continue
    if (!/^\d+$/.test(tokens[0]!)) continue
    const forTriplet = norm(truncateLineAtWegSectionMarkers(line) || line)
    if (isWettePosEtageRoomTripletLine(forTriplet)) {
      const w = parseWettePosEtageRoomFromTruncatedLine(forTriplet)
      if (w) return { floorText: w.floor, roomText: w.room }
    }

    const candidateIdx: number[] = []
    for (let ti = 1; ti <= Math.min(3, tokens.length - 2); ti += 1) {
      if (isFloorToken(tokens[ti]!)) candidateIdx.push(ti)
    }
    if (candidateIdx.length === 0) continue

    // Bei "Pos intern Etage Raum" kann Spalte 2 numerisch sein; daher den letzten plausiblen Floor-Token nehmen.
    const floorIdx = candidateIdx[candidateIdx.length - 1]!
    const floorText = tokens[floorIdx]!
    const roomText = tokens.slice(floorIdx + 1).join(' ').trim()
    if (!roomText) continue
    return { floorText, roomText }
  }

  return {}
}

/**
 * Wiederholter Tabellenkopf wie „Wartung 2025 WEG …“-PDFs: mehrere Positionen, Etage/Raum
 * in der Zeile *unter* dem Kopf, Positionsindex oft erst später im Block.
 * Header darf in einer oder mehreren Textzeilen stehen.
 */
/**
 * Typische WEG-Tabellenkopfzeilen. Variante *ohne* doppeltes „Pos.“ kommt in Praxis-PDFs häufig vor
 * (nur „Pos. intern Etage Raum“). Muss mit collectWegHeaderMatches (global) und tryParseWegMaintenance konsistent sein.
 */
const WE_REPEATED_POS_TABLE_HEADER =
  /(?:Pos\.\s+Pos\.\s+intern|Pos\.\s+intern)(?:[ \t]+|\s*\n\s*)Etage(?:[ \t]+|\s*\n\s*)Raum/gi

/**
 * Start einer Positionszeile im WEG-Ein-Header-Layout: typ. EG/UG/OG/…, nicht Positionsindex (1…30) als erste Spalte.
 */
const isWegFloorBlockStartLine = (line: string): boolean => {
  const raw = line.replace(/\s+/g, ' ').trim()
  if (!raw) return false
  const tokens = raw.split(/\s+/).filter(Boolean)
  if (tokens.length < 2) return false
  /** Blockgrenze wie classische Etagenzeile, inkl. „302 2 …“-Positionszeile (typ. Layout) */
  if (isWettePosEtageRoomTripletLine(raw)) return true
  const a = tokens[0]!
  if (/^(eg|ug|og|kg|dg)$/i.test(a)) return true
  if (/^dach(?:geschoss)?$/i.test(a)) return true
  if (/^\d{1,2}\s*\.\s*og$/i.test(a)) return true
  if (/^\d{1,2}$/.test(a)) {
    const n = parseInt(a, 10)
    if (n >= 1 && n <= 30) return false
  }
  if (/^\d+\s*\.?\s*og$/i.test(a)) return true
  if (/^\d{1,2}\s*\.?\s*og$/i.test(a)) return true
  if (isFloorToken(a) && !/^\d{1,2}$/.test(a)) return true
  return false
}

/**
 * Teilt den Bereich *nach* dem Tabellenkopf in Blöcke, beginnend an jeder Etage/Raum-Startzeile.
 */
const splitWegBodyByFloorStartLines = (body: string): string[] => {
  const lines = body.split(/\r?\n/)
  const starts: number[] = []
  for (let i = 0; i < lines.length; i += 1) {
    if (isWegFloorBlockStartLine(lines[i]!)) starts.push(i)
  }
  if (starts.length === 0) return []
  if (starts.length === 1) {
    const chunk = lines.slice(starts[0]!, lines.length).join('\n').trim()
    return chunk ? [chunk] : []
  }
  const blocks: string[] = []
  for (let j = 0; j < starts.length; j += 1) {
    const a = starts[j]!
    const b = j + 1 < starts.length ? starts[j + 1]! : lines.length
    blocks.push(lines.slice(a, b).join('\n').trim())
  }
  return blocks.filter((s) => s.length > 0)
}

const blockLines = (block: string): string[] =>
  block
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

/**
 * Reiner Diagnose-Text: 3–8 Zeilen im WEG-Block um die erste Schließmittel-Zeile (für UI/Experten-Debug;
 * kein Einfluss auf Katalog-Logik).
 */
const extractSchliessmittelBlockContextSnippet = (block: string, maxLines = 8): string => {
  const lines = blockLines(block)
  const idx = lines.findIndex((l) => /(?:Schließ|Schliess)mittel/i.test(l))
  if (idx < 0) {
    if (lines.length === 0) return ''
    return lines.slice(Math.max(0, lines.length - Math.min(maxLines, 8))).join('\n')
  }
  const start = Math.max(0, idx - 1)
  return lines.slice(start, start + maxLines).join('\n')
}

const findFirstSchliessmittelLineInBlock = (block: string): string | undefined => {
  for (const l of blockLines(block)) {
    if (/^(?:Schließ|Schliess)mittel\b/i.test(l)) return l
  }
  for (const l of blockLines(block)) {
    if (/(?:Schließ|Schliess)mittel/i.test(l)) return l
  }
  return undefined
}

/** Zeilen, die wie Aufzählungspunkte aussehen (für Befund-Snippets) */
const bulletLines = (block: string): string[] => {
  const lines = block.split(/\n+/).map((l) => l.trim()).filter(Boolean)
  const out: string[] = []
  for (const line of lines) {
    const stripped = line.replace(/^[-–—•*]\s*/, '').replace(/^\d+[).]\s*/, '').trim()
    if (stripped.length >= 3) out.push(stripped)
  }
  return out
}

/** Kürzt eine Etage/Raum-Textzeile am ersten bekannten Abschnittsmarker (PDF mischt oft alles in eine Zeile). */
const truncateLineAtWegSectionMarkers = (line: string): string => {
  const s = line.replace(/\s+/g, ' ').trim()
  if (!s) return ''
  const patterns: RegExp[] = [
    /\bArt\s+Fl\.\s*Anforderung\s+Hersteller\b/i,
    /\bArt\s+Fl\./i,
    /\bAnforderung\s+Hersteller\b/i,
    /\bSchließmittel\b/i,
    /\bSchliessmittel\b/i,
    /\bweiteres\s+Zubeh/i,
  ]
  let cut = s.length
  for (const re of patterns) {
    re.lastIndex = 0
    const m = re.exec(s)
    if (m && m.index > 0 && m.index < cut) cut = m.index
  }
  return norm(s.slice(0, cut))
}

const isPlausibleWegEtageFirstToken = (first: string, rest: string[]): boolean => {
  if (isWettePosEtageRoomTripletLine([first, ...rest].join(' '))) return false
  if (isWegFloorBlockStartLine([first, ...rest].join(' '))) return true
  if (/^([1-9]|1[0-9]|2[0-9]|30)$/.test(first) && rest[0] && /^(eg|ug|og|kg|dg)$/i.test(rest[0]!)) {
    return false
  }
  return isFloorToken(first)
}

const parseFloorRoomLineAfterWegHeader = (block: string): { floor: string; room: string } | null => {
  const lines = blockLines(block)
  const scan = lines.slice(0, 12)
  for (const line of scan) {
    const truncated = truncateLineAtWegSectionMarkers(line)
    if (!truncated) continue
    if (isWettePosEtageRoomTripletLine(truncated)) {
      const w = parseWettePosEtageRoomFromTruncatedLine(truncated)
      if (w) return w
    }
    if (!isWegFloorBlockStartLine(line) && !isWegFloorBlockStartLine(truncated)) continue
    const tokens = truncated.split(/\s+/).filter(Boolean)
    if (tokens.length < 2) continue
    return { floor: tokens[0]!.trim(), room: tokens.slice(1).join(' ').trim() }
  }
  for (const line of lines.slice(0, 10)) {
    const truncated = truncateLineAtWegSectionMarkers(line)
    if (!truncated) continue
    const tokens = truncated.split(/\s+/).filter(Boolean)
    if (tokens.length < 2) continue
    if (!isPlausibleWegEtageFirstToken(tokens[0]!, tokens.slice(1))) continue
    return { floor: tokens[0]!.trim(), room: tokens.slice(1).join(' ').trim() }
  }
  return null
}

const extractArtDataLineAfterWegHeader = (block: string): string | undefined => {
  const lines = blockLines(block)
  const headerIdx = lines.findIndex((l) => /\bArt\s+Fl\.\s*Anforderung\s+Hersteller\b/i.test(l))
  if (headerIdx >= 0) {
    const headerLine = lines[headerIdx]!
    /** Kolumnentitel und Daten in einer (!) gescannten Zeile (typ. Positionslayout). */
    const sameLineM = headerLine.match(
      /\bArt\s+Fl\.\s*Anforderung\s+Hersteller\s+(.+?)(?=\s+(?:Schließ|Schliess)mittel\b|weiteres\s+Zubeh\b|\s+Art\s+Fl\.\s+Anforderung|$)/i
    )
    if (sameLineM?.[1]) {
      const s = sameLineM[1]!.trim()
      if (s.length > 0 && !/^(?:Schließ|Schliess)mittel\b/i.test(s)) {
        return s
      }
    }
    for (let j = headerIdx + 1; j < lines.length; j += 1) {
      const L = lines[j]!.trim()
      if (!L) continue
      if (/^(?:Schließ|Schliess)mittel\b/i.test(L)) break
      if (/^weiteres\s+Zubeh/i.test(L)) break
      if (/\bArt\s+Fl\.\s*Anforderung\s+Hersteller\b/i.test(L)) break
      if (/\bArt\s+Fl\./i.test(L) && /Hersteller/i.test(L)) continue
      return L
    }
  }
  const b = block.replace(/\r\n/g, '\n')
  return (
    matchField(
      b,
      /Art\s+Fl\.\s*Anforderung\s+Hersteller[\s\n]+([^\n]+?)(?=\n\s*(?:Schließ|Schliess)mittel|weiteres|Art\s+Fl\.|Schließ|\n\s*\d{1,2}\s*\n)/i
    ) ?? matchField(b, /Anforderung\s+Hersteller[\s\n]+([^\n]+?)(?=\n|\s*(?:Schließ|Schliess)mittel)/i)
  )
}

const ANF_WORD = /^(Stahl|Alu|Holz|Glas|Metall|Kunststoff|Keller|Dämm|Verzink)$/i

const looksLikeAnforderungToken = (t: string): boolean => {
  if (!t) return false
  if (/^T[0-9]{1,2}$/i.test(t)) return true
  if (/^RS$/i.test(t)) return true
  if (/^EI[0-9]{2,3}$/i.test(t)) return true
  if (/^Rauch/i.test(t) && t.length >= 4) return true
  if (/^RC[-\dA-Z]*$/i.test(t) && t.length <= 20) return true
  if (/^F\d+$/i.test(t)) return true
  if (ANF_WORD.test(t)) return true
  if (/^[A-Z]{1,3}\d{2,4}(-[A-Z0-9]+)?$/i.test(t)) return true
  return false
}

/** Wahrscheinlicher Herstellername (Katalognamen); schließt typische Anforderungs-Kürzel aus. */
const isLikelyHerstellerNameToken = (t: string): boolean => {
  if (!t || t.length < 2) return false
  if (/^RS$/i.test(t)) return false
  if (looksLikeAnforderungToken(t)) return false
  if (/^fluchtweg$/i.test(t)) return false
  return /^[A-ZÄÖÜ][a-zäöüß-]{1,20}$/u.test(t)
}

const parseWegArtAnforderungHersteller = (artDataLine: string | undefined): {
  art: string
  fluegel?: string
  anforderung?: string
  hersteller?: string
} => {
  if (!artDataLine) return { art: 'Wartung / Prüfung' }
  const s = norm(artDataLine)
  if (!s) return { art: 'Wartung / Prüfung' }
  const stop = s.search(/\b(Art|Schließ|Schliess)mittel|weiteres\s+Zubeh/i)
  const use = (stop > 0 ? s.slice(0, stop) : s).trim()
  const tokens = use.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return { art: 'Wartung / Prüfung' }
  let i = 1
  const art = tokens[0]!
  let fluegel: string | undefined
  if (i < tokens.length && /^(fl\.?|flügel)$/i.test(tokens[i]!)) {
    if (i + 1 < tokens.length && /^\d{1,2}$/.test(tokens[i + 1]!)) {
      fluegel = tokens[i + 1]!
      i += 2
    } else {
      i += 1
    }
  } else if (i < tokens.length && /^\d{1,2}$/.test(tokens[i]!)) {
    const n = parseInt(tokens[i]!, 10)
    const next = i + 1 < tokens.length ? tokens[i + 1]! : null
    const nextOk =
      n >= 1 &&
      n <= 30 &&
      next &&
      (looksLikeAnforderungToken(next) ||
        /^T\d{1,2}$/i.test(next) ||
        /^[A-ZÄÖÜ][a-zäöüß]+/.test(next) ||
        /^[A-Z]{2,}/.test(next))
    if (nextOk) {
      fluegel = String(n)
      i += 1
    }
  }
  if (fluegel === undefined && i === tokens.length - 1 && /^\d{1,2}$/.test(tokens[i]!)) {
    const n = parseInt(tokens[i]!, 10)
    if (n >= 1 && n <= 30) {
      fluegel = tokens[i]!
      i += 1
    }
  }
  const anfParts: string[] = []
  while (i < tokens.length) {
    const t = tokens[i]!
    if (anfParts.length === 0) {
      if (looksLikeAnforderungToken(t) || /^[A-Z]{1,3}\d{2,4}(-[A-Z0-9]+)?$/.test(t)) {
        anfParts.push(t)
        i += 1
        continue
      }
      break
    }
    const last = anfParts[anfParts.length - 1]!
    if (/^T[0-9]{1,2}$/i.test(last) && /^RS$/i.test(t)) {
      anfParts.push(t)
      i += 1
      continue
    }
    if (/^RC[-\dA-Z]*$/i.test(last) && /^fluchtweg$/i.test(t)) {
      anfParts.push(t)
      i += 1
      continue
    }
    if (isLikelyHerstellerNameToken(t)) {
      break
    }
    if (looksLikeAnforderungToken(t) && !isLikelyHerstellerNameToken(t)) {
      anfParts.push(t)
      i += 1
      continue
    }
    if (/^[A-Z]{1,3}\d{2,4}(-[A-Z0-9]+)?$/.test(t)) {
      anfParts.push(t)
      i += 1
      continue
    }
    break
  }
  const anforderung = anfParts.length > 0 ? anfParts.join(' ') : undefined
  const hersteller = i < tokens.length ? tokens.slice(i).join(' ').trim() : undefined
  return { art: art || 'Wartung / Prüfung', fluegel, anforderung, hersteller }
}

/**
 * Schließmittel-Typ steht in manchen PDFs am Ende derselben Zeile wie die Spaltenüberschrift
 * („… Anzahl RM FTT TS89“), die Folgezeile ist dann leer oder „weiteres Zubehör“.
 */
const extractSchliessmittelTypFromSameLine = (line: string): string | undefined => {
  const s = norm(line.replace(/\s+/g, ' '))
  if (!/^(?:Schließ|Schliess)mittel\b/i.test(s)) return undefined
  const afterLabel = s.replace(/^(?:Schließ|Schliess)mittel\b/i, '').trim()
  if (!afterLabel) return undefined
  const m = afterLabel.match(/\b(TS-?\s*\d{2,5}|[A-Z]{1,3}\d{2,4}(?:\s*\/\s*[A-Z0-9]{1,6})?)\s*$/i)
  if (m?.[1] && afterLabel.length > 12) {
    return norm(m[1]!.replace(/\s+/g, ' ').trim())
  }
  return undefined
}

/** Kandidat nur übernehmen, wenn kurz und als Typcode plausibel (kein Kolumnentitel, kein langer Rest). */
const isPlausibleSchliessmittelTypToken = (raw: string): boolean => {
  const x = norm(raw)
  if (!x || x.length < 2 || x.length > 28) return false
  if (/weiteres|zubeh[oö]?r|status|schlie(ß|ss)mittel/i.test(x)) return false
  if (/^(fsa|ftt|rm|tt|antrieb|anzahl)$/i.test(x)) return false
  if (/^TS-?\d{2,4}$/i.test(x)) return true
  if (/^TS\s+\d{2,3}$/i.test(x)) return true
  if (/^[A-Z]{1,3}\d{2,4}(-[A-Z0-9]+)?$/i.test(x)) return true
  if (/^[A-Z]{2,5}\s+\d{2,3}$/i.test(x)) return true
  if (/^TS\d{3,5}\s+[A-Z]{1,5}$/i.test(x)) return true
  if (/^[A-Z0-9][A-Z0-9._/-]{0,18}$/i.test(x)) return true
  return false
}

const pickSchliessmittelTypFromBetweenFttAndZubeh = (between: string): string | undefined => {
  const t = norm(between)
  if (!t) return undefined
  const tsJoined = t.replace(/\s+/g, ' ')
  const mTs = tsJoined.match(/\bTS-?\s*\d{2,4}\b/i)
  if (mTs) {
    const compact = mTs[0]!.replace(/\s+/g, '')
    if (isPlausibleSchliessmittelTypToken(compact)) return compact
  }
  const tokens = t.split(/\s+/).filter(Boolean)
  for (let i = tokens.length - 1; i > 0; i -= 1) {
    const a = tokens[i - 1]!
    const b = tokens[i]!
    if (/^TS$/i.test(a) && /^\d{2,3}$/.test(b)) {
      const spaced = `TS ${b}`
      if (isPlausibleSchliessmittelTypToken(spaced.replace(/\s+/g, '')) || isPlausibleSchliessmittelTypToken(spaced))
        return norm(spaced)
    }
    if (
      /^\d{2,3}$/.test(b) &&
      /^[A-Z]{2,5}$/i.test(a) &&
      !/^TS$/i.test(a) &&
      (isPlausibleSchliessmittelTypToken(`${a} ${b}`) || /^[A-Z]{2,5}\s+\d{2,3}$/i.test(`${a} ${b}`))
    ) {
      return norm(`${a} ${b}`)
    }
    if (
      /^[A-Z]{1,5}$/i.test(b) &&
      /^TS\d{3,5}$/i.test(a) &&
      b.length <= 5 &&
      isPlausibleSchliessmittelTypToken(`${a} ${b}`)
    ) {
      return norm(`${a} ${b}`)
    }
  }
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    if (isPlausibleSchliessmittelTypToken(tokens[i]!)) return norm(tokens[i]!)
  }
  if (isPlausibleSchliessmittelTypToken(t)) return t
  return undefined
}

/**
 * FSA-Balken: gescannte Texte nutzen u. a. „Antrib“; gleiche fachliche Kolumne wie Antrieb.
 */
const RE_SCHLIESS_FSA_BIS_FTT =
  /(?:Schließ|Schliess)mittel\s+FSA\/Antr(?:ib|ieb|rieb)\s+Anzahl\s+RM\s+FTT/i

const parseFsaDataTail = (
  between: string
): {
  schliessmittel_typ: string
  fsa_hersteller?: string
  fsa_typ?: string
  rauchmelder?: string
} | null => {
  const w0 = norm(between).split(/\s+/).filter(Boolean)
  if (w0.length === 0) return null

  let rauch: string | undefined
  let w = w0
  const last = w[w.length - 1]!
  if (w.length > 1 && /^\d{1,2}$/.test(last)) {
    const n = parseInt(last, 10)
    if (n >= 0 && n <= 30) {
      rauch = last
      w = w.slice(0, -1)
    }
  }
  if (w.length === 0) {
    return rauch ? { schliessmittel_typ: '', rauchmelder: rauch } : null
  }
  if (w.length === 1) {
    return { schliessmittel_typ: w[0]!, rauchmelder: rauch }
  }

  const a0 = w[0]!
  const a1 = w.length > 1 ? w[1]! : ''
  let schEnd = 1
  if (/^ISM$/i.test(a0) && w.length > 1 && /^TS-?\d{2,5}$/i.test(a1)) {
    schEnd = 2
  } else if (w.length > 1 && /^TS$/i.test(a0) && /^\d{2,3}$/.test(a1)) {
    schEnd = 2
  } else if (
    w.length > 1 &&
    /^TS\d{3,5}$/i.test(a0) &&
    /^[A-Z]{1,5}$/i.test(a1) &&
    a1.length <= 5 &&
    !/^\d/.test(a1)
  ) {
    schEnd = 2
  } else if (w.length > 1 && /^[A-Z]{2,5}$/i.test(a0) && /^\d{2,3}$/.test(a1) && !/^TS$/i.test(a0)) {
    schEnd = 2
  } else if (w.length > 1 && /^[A-Z]{2,4}$/i.test(a0) && /^TS-?\d{2,5}$/i.test(a1)) {
    schEnd = 2
  } else if (/^TS-?\d{2,5}$/i.test(a0)) {
    schEnd = 1
  }

  const schTyp = w.slice(0, schEnd).join(' ').trim()
  const rem = w.slice(schEnd)
  if (!schTyp) return null

  let fsa_hersteller: string | undefined
  let fsa_typ: string | undefined
  if (rem.length > 0) {
    if (/^[A-ZÄÖÜ][a-zäöüß-]{1,24}$/u.test(rem[0]!)) {
      fsa_hersteller = rem[0]
      const r2 = rem.slice(1)
      if (r2.length === 2) {
        fsa_typ = `${r2[0]} ${r2[1]}`
      } else if (r2.length === 1) {
        fsa_typ = r2[0]
      } else if (r2.length > 2) {
        fsa_typ = r2.join(' ')
      }
    } else {
      fsa_typ = rem.join(' ')
    }
  }

  const o: {
    schliessmittel_typ: string
    fsa_hersteller?: string
    fsa_typ?: string
    rauchmelder?: string
  } = { schliessmittel_typ: schTyp }
  if (fsa_hersteller) o.fsa_hersteller = fsa_hersteller
  if (fsa_typ) o.fsa_typ = fsa_typ
  if (rauch) o.rauchmelder = rauch
  return o
}

const tryParseComplexFsaBlock = (block: string): ReturnType<typeof parseFsaDataTail> | null => {
  const t = norm(block.replace(/\r\n/g, ' '))
  if (!t) return null
  const m = t.match(RE_SCHLIESS_FSA_BIS_FTT)
  if (!m || m.index === undefined) return null
  const afterFtt = t.slice(m.index + m[0].length)
  let end = afterFtt.length
  const z = /weiteres\s+Zubeh[öo]r\s*Status/i.exec(afterFtt)
  if (z && z.index != null) end = z.index
  else {
    const artM = /\bArt\s+Fl\.\s*Anforderung/i.exec(afterFtt)
    if (artM && artM.index > 0) end = artM.index
    end = Math.min(end, 320)
  }
  const between = afterFtt.slice(0, end).trim()
  if (!between) return null
  const p = parseFsaDataTail(between)
  if (!p || !p.schliessmittel_typ) return null
  return p
}

/**
 * Positionsblock als eine Zeile: nach FTT bis „weiteres Zubehör“ — Fallback nur Typsiebung (z. B. TS89).
 */
const extractSchliessmittelTypInlineFttToZubeh = (block: string): string | undefined => {
  const t = norm(block.replace(/\r\n/g, ' '))
  if (!t) return undefined
  const m = t.match(RE_SCHLIESS_FSA_BIS_FTT)
  if (!m || m.index === undefined) return undefined
  const afterFtt = t.slice(m.index + m[0].length)
  const z = /weiteres\s+Zubeh[öo]r\s*Status/i.exec(afterFtt)
  if (!z || z.index < 0) return undefined
  const between = afterFtt.slice(0, z.index).trim()
  return pickSchliessmittelTypFromBetweenFttAndZubeh(between)
}

/** Ohne FSA-Mehrfeld-Parsing (Folgezeilen / reines FTT-Inline-Fallback). */
const extractSchliessmittelDataLineLegacy = (block: string): string | undefined => {
  const fromInlineFttZubeh = extractSchliessmittelTypInlineFttToZubeh(block)
  if (fromInlineFttZubeh) return fromInlineFttZubeh

  const lines = blockLines(block)
  const idx = lines.findIndex((l) => /^(?:Schließ|Schliess)mittel\b/i.test(l))
  if (idx < 0) {
    const b = block.replace(/\r\n/g, '\n')
    return matchField(
      b,
      /(?:Schließ|Schliess)mittel(?:[^\n]*)\n+\s*([^\n]+?)(?=\n\s*weiteres|Status|\n\s*\d{1,2}\s*$)/i
    )
  }
  const fromSame = extractSchliessmittelTypFromSameLine(lines[idx]!)
  if (fromSame) return fromSame
  for (let j = idx + 1; j < Math.min(idx + 8, lines.length); j += 1) {
    const L = lines[j]!.trim()
    if (!L) continue
    if (/^weiteres\s+Zubeh/i.test(L)) break
    if (/^weiteres$/i.test(L)) break
    if (/\bStatus$/i.test(L) && L.length < 20) break
    if (/\bArt\s+Fl\./i.test(L)) break
    if (/\bSchließ|\bSchliessmittel\b/i.test(L) && j > idx) break
    if (L.length > 2 && L.length <= 72) return L
  }
  return undefined
}

/**
 * Liest die erste inhaltliche Statuszeile nach „weiteres Zubehör Status“ (ohne restlichen Block-Text,
 * vgl. ehem. `[\s\S]+`-Match).
 */
const extractWegZubehörStatusValue = (b: string): string | undefined => {
  const bi = b.search(/weiteres\s+Zubeh[öo]r\s*Status/i)
  if (bi < 0) return undefined
  const from = b.slice(bi)
  const lines = from.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim())
  if (lines.length < 2) return undefined
  let i = 1
  while (i < lines.length) {
    const L = lines[i]!
    if (!L) {
      i += 1
      continue
    }
    if (/^weiteres\s+Zubeh[öo]r\s*Status/i.test(L)) {
      i += 1
      continue
    }
    if (/^(Pos\.\s*)?(Pos\.\s*)?intern|Art\s+Fl\.|Etage\s+Raum/i.test(L)) break
    if (/^\d{1,2}$/.test(L)) {
      i += 1
      continue
    }
    if (/^(i\.?\s*O\.?|n\.?i\.?O\.?|o\.?k\.?|n\.?o\.?k\.?|in\s*ordnung)/i.test(L)) return L
    if (L.length > 0) return L
    i += 1
  }
  return undefined
}

/** Schnitt vor Folge-/Kopfzeilen und Dokumentfragmenten (Status nicht mit nächstem Block zusammenziehen). */
const STATUS_VALUE_CUT_MARKERS: RegExp[] = [
  /\b(?:Pos\.\s*)?(?:Pos\.\s*)?intern\s+Etage\s+Raum\b/i,
  /\bPos\.\s+Pos\.\s+intern\b/i,
  /\bArt\s+Fl\.\s*Anforderung\s+Hersteller\b/i,
  /\b(?:Schließ|Schliess)mittel\b/i,
  /\bweiteres\s+Zubeh[öo]r\s*Status\b/i,
  /\bWartung\s+20\d{2}\b/i,
  /\bNovember\b/i,
  /\bBV\s*:/i,
  /\bBearbeitete\s+Person\b/i,
]

const cutStatusValueAtMarkers = (value: string): string => {
  let cut = value.length
  for (const re of STATUS_VALUE_CUT_MARKERS) {
    const m = re.exec(value)
    /** Index 0 nicht abschneiden: wäre leerer String; führende Kopffragmente entfernt stripLeadingDocumentNoiseFromStatus */
    if (m && m.index > 0 && m.index < cut) cut = m.index
  }
  return norm(value.slice(0, cut))
}

const stripLeadingDocumentNoiseFromStatus = stripLeadingAltberichtDocumentHeaderForC2

/**
 * Kein C2-Kandidat: reine Maße, Zahlenangaben, kurze reine Positionsnummern.
 */
const isHarmlessMeasureOrNumericStatus = (value: string): boolean => {
  const t = norm(value)
  if (!t) return true
  if (/^\d{1,2}$/.test(t)) {
    const n = parseInt(t, 10)
    if (n >= 1 && n <= 50) return true
  }
  if (/^\d{2,4}\s*[x×]\s*\d{2,4}(\s*mm)?\.?$/i.test(t)) return true
  if (/^[\d\s.,x×]{3,24}$/i.test(t) && /[x×]/.test(t) && !/[a-zäöüß]/i.test(t)) return true
  if (/^\d+([.,]\d+)?\s*(mm|cm|m)\b\.?$/i.test(t)) return true
  if (/^\d+([.,]\d+)?$/i.test(t) && t.replace(/[.,]/g, '').length <= 5) return true
  return false
}

const STATUS_CANDIDATE_MAX_LEN = 320

const cleanInlineStatusValue = (raw: string): string | undefined => refineParsedStatusText(raw)

/** Einheitliche Nachbearbeitung für alle Status-Quellen (Zeile, Inline, Regex-Fallback). */
const refineParsedStatusText = (raw: string | undefined): string | undefined => {
  if (!raw?.trim()) return undefined
  let value = norm(raw)
  value = stripLeadingDocumentNoiseFromStatus(value)
  value = cutStatusValueAtMarkers(value)
  value = stripLeadingDocumentNoiseFromStatus(value)
  value = norm(value.replace(/^\d{1,3}\s+/, ''))
  value = stripLeadingDocumentNoiseFromStatus(value)
  if (!value || /^Status$/i.test(value)) return undefined
  if (isAltberichtC2DocumentHeaderOnlyToken(value)) return undefined
  if (isHarmlessMeasureOrNumericStatus(value)) return undefined
  if (value.length > STATUS_CANDIDATE_MAX_LEN) value = `${value.slice(0, STATUS_CANDIDATE_MAX_LEN).trim()}…`
  return value
}

const extractWegStatusValueInline = (b: string): string | undefined => {
  const collapsed = norm(b.replace(/\r?\n/g, ' '))
  const marker = /weiteres\s+Zubeh[öo]r\s*Status\b/i.exec(collapsed)
  if (marker?.index != null) {
    return cleanInlineStatusValue(collapsed.slice(marker.index + marker[0].length))
  }
  const statusMarker = /\bStatus\s*[:\-]?\s+/i.exec(collapsed)
  if (statusMarker?.index != null) {
    return cleanInlineStatusValue(collapsed.slice(statusMarker.index + statusMarker[0].length))
  }
  return undefined
}

const extractStatusDebugSnippet = (block: string): string | null => {
  const compact = norm(block.replace(/\r?\n/g, ' '))
  const marker = /\bStatus\b/i.exec(compact)
  if (!marker?.index && marker?.index !== 0) return null
  const start = Math.max(0, marker.index - 140)
  const end = Math.min(compact.length, marker.index + 420)
  return compact.slice(start, end)
}

const blockDebugPreview = (block: string): string => {
  const compact = norm(block.replace(/\r?\n/g, ' '))
  return compact.length > 900 ? `${compact.slice(0, 900)}…` : compact
}

const statusCandidateRejectReason = (candidate: string | undefined): string | null => {
  if (!candidate?.trim()) return 'no_candidate_after_status'
  const value = norm(candidate)
  if (isWegInOrdnungOrTrivialStatus(value)) return 'trivial_ok_status'
  if (isHarmlessMeasureOrNumericStatus(value)) return 'harmless_measure_or_numeric'
  const n = normalizeAltberichtC2FindingText(value)
  if (!n || isAltberichtC2DocumentHeaderOnlyToken(n)) return 'document_header_only'
  if (value.length >= 500) return 'candidate_too_long'
  return null
}

/** Text nach „weiteres Zubehör Status“ bzw. „Status …“ (eine Zeile / kollabiert). */
const extractPostStatusTextTailRaw = (block: string): string | null => {
  const collapsed = norm(block.replace(/\r?\n/g, ' '))
  let idx = -1
  const wz = /weiteres\s+Zubeh[öo]r\s*Status\b/i.exec(collapsed)
  if (wz?.index != null) idx = wz.index + wz[0].length
  else {
    const st = /\bStatus\s*[:\-]?\s*/i.exec(collapsed)
    if (st?.index != null) idx = st.index + st[0].length
  }
  if (idx < 0) return null
  const tail = collapsed.slice(idx).trim()
  return tail || null
}

/**
 * Wenn refineParsedStatusText wegen Kopf/BV:-Schnitt leer bleibt: im Post-Status-Rest ab erstem Mangelanker lesen.
 * Kein erneutes cutStatusValueAtMarkers (würde nach „BV:“ den Befund verwerfen).
 */
const RE_DEFECT_ANCHOR_IN_WEG_BLOCK =
  /\b(Mörtelhinterfüllung|Mörtel|Laschen|Brandgefahr|ohne\s+Zulassung|fehlt|fehlen|beschädigt|defekt|Stromzähler|Brandschutztür|Tür\b|\bmuss\b)\b/i

const primaryStatusTextHasDefectSignal = (s: string): boolean => {
  const t = norm(s)
  if (!t) return false
  if (RE_DEFECT_ANCHOR_IN_WEG_BLOCK.test(t)) return true
  return /\b(undicht|dichtung|riss|mängel|mangel|korros|schließ|schlies|eingeriss|verzogen)\b/i.test(t)
}

const extractStatusFromDefectAnchorInPostStatusTail = (block: string): string | undefined => {
  const tail = extractPostStatusTextTailRaw(block)
  if (!tail) return undefined
  const m = RE_DEFECT_ANCHOR_IN_WEG_BLOCK.exec(tail)
  if (!m || m.index == null) return undefined
  let segment = norm(tail.slice(m.index))
  const nextHeader = /\b(?:Pos\.\s*){1,2}intern\s+Etage\s+Raum\b/i.exec(segment)
  if (nextHeader && nextHeader.index > 12) segment = norm(segment.slice(0, nextHeader.index))
  if (segment.length > STATUS_CANDIDATE_MAX_LEN) segment = `${segment.slice(0, STATUS_CANDIDATE_MAX_LEN).trim()}…`
  if (!segment || isHarmlessMeasureOrNumericStatus(segment)) return undefined
  if (/^i\.?\s*o\.?$/i.test(segment) || /^o\.?k\.?$/i.test(segment) || /^in\s*ordnung\.?$/i.test(segment)) {
    return undefined
  }
  const refined = normalizeAltberichtC2FindingText(segment) ?? segment
  if (!refined || isAltberichtC2DocumentHeaderOnlyToken(refined)) return undefined
  if (textShouldBeExcludedFromAltberichtC2Import(refined)) return undefined
  return refined
}

const parseWegBlockFields = (block: string): {
  artDataLine?: string
  artParts: ReturnType<typeof parseWegArtAnforderungHersteller>
  schliessRow?: string
  /** Nach Schnitt/Filter für Findings/Katalog; `statusTextCoarse` ist der Rohkandidat davor (Debug/Reject-Grund). */
  statusText?: string
  statusTextCoarse?: string
  catalog: AltberichtParserCatalogCandidateV1[]
  /** Nur gesetzt, wenn FSA-Mehrfeld-Zeile (nach FTT) erkannt wurde. */
  complexFsa: ReturnType<typeof tryParseComplexFsaBlock> | null
} => {
  const b = block.replace(/\r\n/g, '\n')
  const artDataLine = extractArtDataLineAfterWegHeader(block)
  const artParts = parseWegArtAnforderungHersteller(artDataLine)
  const fsa = tryParseComplexFsaBlock(b)
  const schliessRow =
    (fsa?.schliessmittel_typ && fsa.schliessmittel_typ.trim()) ||
    extractSchliessmittelDataLineLegacy(block)
  const catalog: AltberichtParserCatalogCandidateV1[] = []
  if (artParts.art && artParts.art !== 'Wartung / Prüfung') {
    catalog.push({ field: 'art', raw: artParts.art, confidence: 0.55 })
  }
  if (artParts.fluegel) {
    catalog.push({ field: 'fluegel', raw: artParts.fluegel, confidence: 0.52 })
  }
  if (artParts.anforderung) {
    catalog.push({ field: 'anforderung', raw: artParts.anforderung, confidence: 0.55 })
  }
  if (artParts.hersteller) {
    catalog.push({ field: 'hersteller', raw: artParts.hersteller, confidence: 0.55 })
  }
  if (schliessRow) {
    const sm = norm(schliessRow).replace(/\s+/g, ' ').trim()
    catalog.push({ field: 'schliessmittel_typ', raw: sm.slice(0, 200), confidence: 0.5 })
  }
  if (fsa) {
    if (fsa.fsa_hersteller) {
      const x = fsa.fsa_hersteller.trim()
      if (x) catalog.push({ field: 'fsa_hersteller', raw: x.slice(0, 120), confidence: 0.48 })
    }
    if (fsa.fsa_typ) {
      const x = fsa.fsa_typ.replace(/\s+/g, ' ').trim()
      if (x) catalog.push({ field: 'fsa_typ', raw: x.slice(0, 200), confidence: 0.46 })
    }
    if (fsa.rauchmelder) {
      catalog.push({ field: 'rauchmelder', raw: fsa.rauchmelder, confidence: 0.45 })
    }
  }
  let statusTextCoarse: string | undefined
  const z = extractWegZubehörStatusValue(b) ?? extractWegStatusValueInline(b)
  if (z) statusTextCoarse = norm(z)
  else {
    const st = b.match(/Status[\s:]*\n*([^\n]+)/i)
    if (st) statusTextCoarse = norm(st[1] ?? '')
  }
  if (statusTextCoarse && statusTextCoarse.length > 2000) {
    statusTextCoarse = statusTextCoarse.slice(0, 2000)
  }
  let statusText = refineParsedStatusText(statusTextCoarse)
  const fromDefectAnchor = extractStatusFromDefectAnchorInPostStatusTail(b)
  if (fromDefectAnchor && (!statusText || !primaryStatusTextHasDefectSignal(statusText))) {
    statusText = fromDefectAnchor
  }
  if (statusText) catalog.push({ field: 'status', raw: statusText.slice(0, 400), confidence: 0.4 })
  return { artDataLine, artParts, schliessRow, statusText, statusTextCoarse, catalog, complexFsa: fsa }
}

const isWegInOrdnungOrTrivialStatus = (s: string): boolean => {
  const t = s.trim()
  if (!t) return true
  if (t.length <= 3 && /^[.\sNOinoIk.\s-]+$/i.test(t)) return true
  if (/^i\.?\s*O\.?$/i.test(t)) return true
  if (/^o\.?k\.?$/i.test(t)) return true
  if (/^in\s*ordnung\.?$/i.test(t)) return true
  if (/^keine\s*m(äa)ngel/i.test(t)) return true
  if (/^ohne\s+befund/i.test(t)) return true
  if (/^nicht\s+relevant/i.test(t)) return true
  return false
}

const wegBulletIsNoiseOrStammdaten = (line: string): boolean => {
  const t = line.trim()
  if (t.length < 3) return true
  if (t.length > 500) return true
  if (/\bArt\s+Fl\.\b/i.test(t)) return true
  if (/\bAnforderung\s+Hersteller\b/i.test(t)) return true
  if (/^Schließmittel\s+/i.test(t) && t.length > 50) return true
  if (/^weiteres\s+Zubeh/i.test(t)) return true
  if (/^Pos\.\s+Pos\./i.test(t)) return true
  if (/^UG\s+|^EG\s+/i.test(t) && t.length < 4) return true
  if (/^Art\s*:/i.test(t)) return true
  if (/^Anforderung\s*:/i.test(t)) return true
  if (/^Hersteller\s*:/i.test(t)) return true
  if (/^Schließmittel\s*:/i.test(t)) return true
  if (/^Status\s*:/i.test(t)) return true
  if (/^T(ür|or)\b/i.test(t) && /T\d+/.test(t) && t.length < 8) return true
  if (/^Bemerkung$/i.test(t)) return true
  return false
}

const isWegInOrdnungTextRaw = (s: string): boolean =>
  isWegInOrdnungOrTrivialStatus(s.replace(/^[–—-]\s*/, '').trim())

const dedupeIntsPreserveOrder = (nums: number[]): number[] => {
  const seen = new Set<number>()
  const out: number[] = []
  for (const n of nums) {
    if (seen.has(n)) continue
    seen.add(n)
    out.push(n)
  }
  return out
}

const parseIndexLinePositions = (line: string): number[] => {
  const parts = line.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  const out: number[] = []
  for (const p of parts) {
    if (!/^\d{1,2}$/.test(p)) continue
    const n = parseInt(p, 10)
    if (n >= 1 && n <= 99) out.push(n)
  }
  return dedupeIntsPreserveOrder(out)
}

const isLikelyPositionIndexLine = (line: string): boolean => {
  const parts = line.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  if (parts.length < 5) return false
  let numTok = 0
  for (const p of parts) {
    if (!/^\d{1,2}$/.test(p)) continue
    const n = parseInt(p, 10)
    if (n >= 1 && n <= 50) numTok += 1
  }
  return numTok >= 5 && numTok >= Math.ceil(parts.length * 0.65)
}

const shouldStopDefectListParagraphScan = (line: string): boolean => {
  const L = line.trim()
  if (/^(Pos\.|Pos\.\s*intern)/i.test(L) && /Etage|Raum/i.test(L)) return true
  if (/^Wartungs?bericht\b/i.test(L)) return true
  if (/^Seite\s+\d+/i.test(L)) return true
  return false
}

const collectParagraphsAfterIndexLine = (lines: string[], startIdx: number): string[] => {
  const paras: string[] = []
  let buf: string[] = []
  for (let i = startIdx; i < lines.length; i += 1) {
    const raw = lines[i] ?? ''
    const L = raw.replace(/\s+/g, ' ').trim()
    if (!L) {
      if (buf.length) {
        paras.push(norm(buf.join(' ')))
        buf = []
      }
      continue
    }
    if (shouldStopDefectListParagraphScan(L)) break
    if (isLikelyPositionIndexLine(L)) break
    if (/^\d{1,2}[.)]\s+\S/.test(L) && buf.length > 0) {
      paras.push(norm(buf.join(' ')))
      buf = [L]
      continue
    }
    buf.push(L)
  }
  if (buf.length) paras.push(norm(buf.join(' ')))
  return paras.filter((p) => p.length > 0)
}

const tryBuildPosToDefectMapFromDocument = (fullText: string): Map<number, string> => {
  const map = new Map<number, string>()
  const lines = fullText.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim())
  const tailStart = Math.max(0, Math.floor(lines.length * 0.3))
  let bestLineIdx = -1
  let bestLen = 0
  for (let i = tailStart; i < lines.length; i += 1) {
    const L = lines[i]!
    if (!isLikelyPositionIndexLine(L)) continue
    const pos = parseIndexLinePositions(L)
    if (pos.length <= bestLen) continue
    bestLen = pos.length
    bestLineIdx = i
  }
  if (bestLineIdx < 0 || bestLen < 5) return map

  const positions = parseIndexLinePositions(lines[bestLineIdx]!)
  const paras = collectParagraphsAfterIndexLine(lines, bestLineIdx + 1)
  if (paras.length === positions.length && positions.length >= 5) {
    for (let j = 0; j < positions.length; j += 1) {
      const txt = paras[j]!
      if (txt && !isWegInOrdnungTextRaw(txt)) map.set(positions[j]!, txt)
    }
    return map
  }
  for (const para of paras) {
    const m = /^(\d{1,2})[.)]\s+(.+)$/.exec(para)
    if (m) {
      const n = parseInt(m[1]!, 10)
      const rest = norm(m[2]!)
      if (n >= 1 && n <= 99 && rest && !isWegInOrdnungTextRaw(rest)) map.set(n, rest)
    }
  }
  return map
}

/**
 * Nachgelagerte Mängelliste (z. B. Zeile „1 2 3 … 10“, danach Absätze) auf Staging-Positionen (parsedPos) mappen.
 */
const mergeDocumentTailPosNumberedFindings = (
  fullText: string,
  objects: AltberichtParserStagingObjectV1[]
): void => {
  if (objects.length === 0) return
  const posMap = tryBuildPosToDefectMapFromDocument(fullText)
  if (posMap.size === 0) return

  for (const obj of objects) {
    const trace = obj.analysisTrace as {
      parsedPos?: number
      documentDefectListMerge?: { matchedPos?: number; strategy?: string }
    }
    const pos = trace?.parsedPos ?? obj.sequence
    const t = posMap.get(pos)
    if (t === undefined) continue

    const useText = normalizeAltberichtC2FindingText(t) ?? t.trim()
    if (!useText || textShouldBeExcludedFromAltberichtC2Import(useText)) {
      const hasPlaceholder = obj.findings.some(
        (f) => f.text === ALTBERICHT_STATUS_REVIEW_PLACEHOLDER_TEXT
      )
      if (!hasPlaceholder) {
        obj.findings.push({
          text: ALTBERICHT_STATUS_REVIEW_PLACEHOLDER_TEXT,
          source: 'document_defect_list_review_required',
          confidence: 0.11,
          sequence: pos,
        })
      }
      if (trace) {
        trace.documentDefectListMerge = { matchedPos: pos, strategy: 'placeholder_after_filter' }
      }
      continue
    }

    if (obj.findings.some((f) => f.text === useText)) continue
    obj.findings.push({
      text: useText,
      source: 'document_defect_list',
      confidence: 0.52,
      sequence: pos,
    })
    if (trace) {
      trace.documentDefectListMerge = { matchedPos: pos, strategy: 'index_zip_or_numbered' }
    }
  }
}

/** Starke Schadens-/Mangelindikatoren → höhere confidence; lange unsichere Reste → niedriger. */
const RE_STATUS_STRONG_DEFECT = /mangel|defekt|undicht|fehlt|beschädig|riss|nicht\s+schlie|schließt\s+nicht|dichtung|korros|unzureichend|nacharbeit|ersetz|bruch|lose|locker|verschlei|eingeriss|verzogen|korrodiert|funktionsunfähig/i

const confidenceForStatusFindingChunk = (chunk: string): number => {
  const len = chunk.length
  const strong = RE_STATUS_STRONG_DEFECT.test(chunk)
  if (strong && len <= 120) return 0.78
  if (strong && len <= 220) return 0.64
  if (strong) return 0.52
  if (len <= 72) return 0.42
  if (len <= 160) return 0.32
  return 0.24
}

const splitStatusIntoFindingTexts = (st: string): string[] => {
  const normSt = norm(stripLeadingDocumentNoiseFromStatus(st))
  if (
    !normSt ||
    isHarmlessMeasureOrNumericStatus(normSt) ||
    isAltberichtC2DocumentHeaderOnlyToken(normSt)
  ) {
    return []
  }
  let pieces = normSt
    .split(/\s*[.;]\s+/)
    .flatMap((p) => (p.length > 100 && p.includes(',') ? p.split(',').map(norm) : [norm(p)]))
    .map((p) => stripLeadingDocumentNoiseFromStatus(p))
    .map(norm)
    .filter(Boolean)

  const filtered = pieces.filter(
    (p) =>
      p.length >= 6 &&
      !isHarmlessMeasureOrNumericStatus(p) &&
      !isAltberichtC2DocumentHeaderOnlyToken(p)
  )
  const normStClean = stripLeadingDocumentNoiseFromStatus(normSt)
  const use =
    filtered.length > 0
      ? filtered
      : !isHarmlessMeasureOrNumericStatus(normStClean) &&
          !isAltberichtC2DocumentHeaderOnlyToken(normStClean)
        ? [normStClean]
        : []

  const deduped: string[] = []
  const seen = new Set<string>()
  for (const p of use) {
    if (seen.has(p)) continue
    seen.add(p)
    deduped.push(p)
  }
  const maxChunks = 8
  return deduped.slice(0, maxChunks).map((p) => (p.length > 240 ? `${p.slice(0, 237).trim()}…` : p))
}

const buildWegDefectFindingsOnly = (
  block: string,
  statusTextForBlock: string | undefined,
  sequence: number
): AltberichtParserFindingCandidateV1[] => {
  const out: AltberichtParserFindingCandidateV1[] = []
  if (statusTextForBlock) {
    const st = norm(statusTextForBlock)
    if (st && !isWegInOrdnungOrTrivialStatus(st) && st.length < 500) {
      for (const chunk of splitStatusIntoFindingTexts(st)) {
        if (!chunk || isHarmlessMeasureOrNumericStatus(chunk)) continue
        if (textShouldBeExcludedFromAltberichtC2Import(chunk)) continue
        const useText = normalizeAltberichtC2FindingText(chunk) ?? chunk
        const conf = confidenceForStatusFindingChunk(useText)
        out.push({ source: 'status', text: useText, confidence: conf, sequence })
      }
    }
  }
  const b = block.replace(/\r\n/g, '\n')
  const mBem = b.match(
    /(?:Bemerkung|Feststellungen?|Mängel|Maengel|Defekt|Prüf[- ]?ergebnis)\s*[:;]\s*([^\n]+)/i
  )
  if (mBem) {
    const t = norm(mBem[1] ?? '')
    if (
      t.length >= 3 &&
      t.length < 800 &&
      !wegBulletIsNoiseOrStammdaten(t) &&
      !textShouldBeExcludedFromAltberichtC2Import(t)
    ) {
      const useText = normalizeAltberichtC2FindingText(t) ?? t
      if (!out.some((x) => x.text === useText)) out.push({ text: useText, confidence: 0.52, sequence })
    }
  }
  const tailBefundLike =
    /mangel|defekt|undicht|fehlt|beschädig|riss|n\.?\s*i\.?\s*o|nicht\s+in\s*ordnung|kritisch|unzureichend|ausfall|nacharbeit|ersetz|keil|sicherheit|spiel|korrosion|fehlend|defekte|dichtung/i
  const tail = block.slice(Math.max(0, block.length - 1000))
  for (const raw of bulletLines(tail)) {
    if (wegBulletIsNoiseOrStammdaten(raw)) continue
    if (isWegInOrdnungTextRaw(raw)) continue
    if (!tailBefundLike.test(raw)) continue
    if (textShouldBeExcludedFromAltberichtC2Import(raw)) continue
    const bulletText = normalizeAltberichtC2FindingText(raw) ?? raw
    if (!out.some((x) => x.text === bulletText) && out.length < 6) {
      out.push({ text: bulletText, confidence: 0.4 })
    }
  }
  return out
}

const extractStandalonePositionNumbers = (block: string): number[] => {
  const lines = block.split(/\r?\n/).map((l) => l.trim())
  const out: number[] = []
  for (const l of lines) {
    if (!/^\d{1,2}$/.test(l)) continue
    const n = parseInt(l, 10)
    if (n >= 1 && n <= 50) out.push(n)
  }
  return out
}

const pickPositionIndexForBlock = (block: string, blockIndex0: number): number => {
  const nums = extractStandalonePositionNumbers(block)
  if (nums.length === 1) return nums[0]!
  if (nums.length > 1) {
    if (nums.includes(blockIndex0 + 1)) return blockIndex0 + 1
    return nums[nums.length - 1]!
  }
  return blockIndex0 + 1
}

const buildWegStagingObjectsFromBlockStrings = (
  blockTexts: string[],
  docMeta: { customerText?: string; siteText?: string; originalFilename?: string },
  subMode: 'we_repeated_pos_table' | 'weg_floor_line_after_single_header',
  wegTrace: { headerCount: number; splitStrategy: 'repeated_header' | 'floor_line' }
): { objects: AltberichtParserStagingObjectV1[]; warning: { code: string; message: string } } => {
  const objects: AltberichtParserStagingObjectV1[] = []
  for (let bi = 0; bi < blockTexts.length; bi += 1) {
    const block = blockTexts[bi]!
    const fr = parseFloorRoomLineAfterWegHeader(block)
    const wettePos = parseWetteLeadingPosRefFromBlock(block)
    const posN = wettePos ?? pickPositionIndexForBlock(block, bi)
    const { artParts, statusText, statusTextCoarse, catalog: catExtra, schliessRow, complexFsa } =
      parseWegBlockFields(block)
    const locationRule: 'floor' | 'room' | 'unknown' =
      fr && fr.floor && fr.room ? 'room' : fr?.floor ? 'floor' : 'unknown'

    let findings: AltberichtParserFindingCandidateV1[] = buildWegDefectFindingsOnly(block, statusText, bi + 1)
    const statusRawAround = extractStatusDebugSnippet(block)
    const statusRejectReason =
      statusRawAround == null
        ? 'no_status_marker'
        : statusCandidateRejectReason(statusText ?? statusTextCoarse)
    const statusFindingAccepted = findings.some((f) => f.source === 'status')
    const statusCandidateForDebug = statusText ?? statusTextCoarse ?? null

    let statusPlaceholderApplied = false
    if (
      findings.length === 0 &&
      statusRawAround != null &&
      (statusRejectReason === 'no_candidate_after_status' || statusRejectReason === 'candidate_too_long')
    ) {
      findings = [
        {
          text: ALTBERICHT_STATUS_REVIEW_PLACEHOLDER_TEXT,
          source: 'status_review_required',
          confidence: 0.12,
          sequence: bi + 1,
        },
      ]
      statusPlaceholderApplied = true
    }

    const locBits = [fr ? `${fr.floor} · ${fr.room}` : null].filter(
      (x): x is string => Boolean(x && x.length > 0)
    )
    let objectName = ['Pos. ' + String(posN), ...locBits].filter(Boolean).join(' · ')
    if (objectName.length > 200) objectName = `${objectName.slice(0, 197)}…`

    const objectTypeText = artParts.art

    objects.push({
      sequence: bi + 1,
      status: 'ready_for_review' as const,
      customerText: docMeta.customerText,
      siteText: docMeta.siteText,
      objectName,
      objectTypeText,
      floorText: fr?.floor ?? null,
      roomText: fr?.room ?? null,
      locationRule,
      findings,
      catalogCandidates: catExtra,
      mediaHints: [],
      parserConfidence: { overall: 0.6 },
      analysisTrace: {
        mode: 'structured_altbericht_v1',
        subMode,
        wegWartung: wegTrace,
        blockIndex0: bi,
        parsedPos: posN,
        statusFindingsDebug: {
          sequence: bi + 1,
          blockRawPreview: blockDebugPreview(block),
          statusRawAround,
          statusCandidate: statusCandidateForDebug,
          rejectedReason:
            statusFindingAccepted && !statusPlaceholderApplied ? null : statusRejectReason,
          findingsFilled: findings.length > 0,
          statusFindingAccepted,
          findingsCount: findings.length,
          statusPlaceholderApplied,
        },
        schliessmittelDebug: {
          blockSnippet: extractSchliessmittelBlockContextSnippet(block, 8),
          schliessmittelHeaderLine: findFirstSchliessmittelLineInBlock(block) ?? null,
          /** Ergebniszeile des Schließmittel-Typs (wie extractSchliessmittelDataLine), nicht Spaltenkopf allein. */
          parsedTypSourceLine: schliessRow ?? null,
          complexFsa:
            complexFsa == null
              ? null
              : {
                  schliessmittel_typ: complexFsa.schliessmittel_typ,
                  fsa_hersteller: complexFsa.fsa_hersteller ?? null,
                  fsa_typ: complexFsa.fsa_typ ?? null,
                  rauchmelder: complexFsa.rauchmelder ?? null,
                },
        },
      },
    })
  }

  const warning =
    subMode === 'we_repeated_pos_table'
      ? {
          code: 'parser.repeated_pos_blocks' as const,
          message: `${objects.length} Positionsblöcke (wiederholter Tabellenkopf)`,
        }
      : {
          code: 'parser.weg_single_header_floor_blocks' as const,
          message: `${objects.length} Positionsblöcke (Etage/Raum-Zeilen nach einmaligem „Pos. … Etage Raum“)`,
        }

  return { objects, warning }
}

const collectWegHeaderMatches = (fullText: string): RegExpExecArray[] => {
  const reExec = new RegExp(WE_REPEATED_POS_TABLE_HEADER.source, 'gi')
  const matches: RegExpExecArray[] = []
  let m: RegExpExecArray | null
  while ((m = reExec.exec(fullText)) !== null) {
    matches.push(m)
  }
  return matches
}

/**
 * WEG-/Wartung: Mehrfach-Header, oder einmaliger Header + gesplitte Blöcke an EG/UG/…-Zeilen.
 */
const tryParseWegMaintenance = (
  fullText: string,
  docMeta: { customerText?: string; siteText?: string; originalFilename?: string }
): { objects: AltberichtParserStagingObjectV1[]; warning: { code: string; message: string } } | null => {
  const matches = collectWegHeaderMatches(fullText)
  if (matches.length === 0) return null

  if (matches.length >= 2) {
    const blockTexts: string[] = []
    for (let i = 0; i < matches.length; i += 1) {
      const start = (matches[i]!.index ?? 0) + matches[i]![0]!.length
      const end = i + 1 < matches.length ? (matches[i + 1]!.index as number) : fullText.length
      blockTexts.push(fullText.slice(start, end).trim())
    }
    if (blockTexts.length < 2) return null
    return buildWegStagingObjectsFromBlockStrings(blockTexts, docMeta, 'we_repeated_pos_table', {
      headerCount: matches.length,
      splitStrategy: 'repeated_header',
    })
  }

  const m0 = matches[0]!
  const afterHeader = fullText.slice((m0.index ?? 0) + m0[0]!.length)
  const byFloor = splitWegBodyByFloorStartLines(afterHeader)
  if (byFloor.length >= 1) {
    return buildWegStagingObjectsFromBlockStrings(byFloor, docMeta, 'weg_floor_line_after_single_header', {
      headerCount: 1,
      splitStrategy: 'floor_line',
    })
  }
  const singleBlock = afterHeader.trim()
  if (singleBlock.length > 0) {
    return buildWegStagingObjectsFromBlockStrings([singleBlock], docMeta, 'weg_floor_line_after_single_header', {
      headerCount: 1,
      splitStrategy: 'floor_line',
    })
  }
  return null
}

const findFindingsBlock = (text: string): string | undefined => {
  const lower = text.toLowerCase()
  const markers = [
    'feststellungen',
    'mängel',
    'maengel',
    'bemerkungen',
    'ergebnis der prüfung',
    'prüfergebnis',
    'defekte',
  ]
  for (const m of markers) {
    const i = lower.indexOf(m)
    if (i >= 0) return text.slice(i)
  }
  return undefined
}

/**
 * Erzeugt AltberichtParserResultV1 aus extrahiertem PDF-Text.
 */
export const parseStructuredAltberichtPlainTextV1 = (
  fullText: string,
  opts?: { originalFilename?: string }
): AltberichtParserResultV1 => {
  const text = fullText.trim()
  const warnings: AltberichtParserResultV1['warnings'] = []

  if (!text) {
    return {
      parserVersion: STRUCTURED_ALTBERICHT_PARSER_VERSION,
      documentMeta: {},
      objects: [],
      warnings: [
        {
          code: 'parser.empty_text',
          message: 'Kein Text aus dem PDF extrahiert (evtl. nur Bilder oder leeres Dokument)',
        },
      ],
      extractedText: '',
    }
  }

  if (text.length < 20) {
    warnings.push({
      code: 'parser.text_too_short',
      message: 'Sehr wenig Text extrahiert – evtl. gescanntes Bild-PDF ohne Textlayer',
    })
  }

  const customerText =
    matchField(text, /(?:kunde|auftraggeber|kundenname)\s*[:]\s*([^\n]+)/i) ??
    matchField(text, /(?:kunde|auftraggeber)\s+([A-ZÄÖÜa-zäöüß][^\n]{2,80})/i)

  const siteText =
    matchField(text, /(?:standort|objektadresse|adresse|liegenschaft)\s*[:]\s*([^\n]+)/i) ??
    matchField(text, /(?:bauvorhaben|objekt\s*standort)\s*[:]\s*([^\n]+)/i)

  const wegMaintenance = tryParseWegMaintenance(text, {
    customerText,
    siteText,
    originalFilename: opts?.originalFilename,
  })
  if (wegMaintenance && wegMaintenance.objects.length > 0) {
    mergeDocumentTailPosNumberedFindings(text, wegMaintenance.objects)
    warnings.push(wegMaintenance.warning)
    return {
      parserVersion: STRUCTURED_ALTBERICHT_PARSER_VERSION,
      documentMeta: {
        customerText,
        siteText,
        extra: opts?.originalFilename ? { originalFilename: opts.originalFilename } : undefined,
      },
      objects: wegMaintenance.objects,
      warnings,
      extractedText: text.length > 120_000 ? `${text.slice(0, 120_000)}…` : text,
    }
  }

  const objectName =
    matchField(text, /(?:objekt|anlage|tür|tor|anlagenbezeichnung)\s*[:]\s*([^\n]+)/i) ??
    (opts?.originalFilename ? norm(opts.originalFilename.replace(/\.pdf$/i, '')) : 'Unbenanntes Objekt')

  const objectTypeText =
    matchField(text, /(?:objektart|anlagenart|typ)\s*[:]\s*([^\n]+)/i) ?? ''

  const posTableLoc = parseFloorRoomFromPosTable(text)
  const floorText = matchField(text, /(?:geschoss|etage|stockwerk)\s*[:]\s*([^\n]+)/i) ?? posTableLoc.floorText
  const roomText = matchField(text, /(?:raum|bereich|raumnummer)\s*[:]\s*([^\n]+)/i) ?? posTableLoc.roomText

  let locationRule: 'floor' | 'room' | 'unknown' = 'unknown'
  if (floorText && roomText) locationRule = 'room'
  else if (floorText || roomText) locationRule = floorText ? 'floor' : 'room'

  const block = findFindingsBlock(text)
  let findings: AltberichtParserFindingCandidateV1[] = []
  if (block) {
    const bullets = bulletLines(block)
    findings = bullets.map((t) => ({ text: t, confidence: 0.6 }))
  }
  let usedFallbackFinding = false
  if (findings.length === 0 && text.length > 0) {
    const snippet = text.length > 4000 ? `${text.slice(0, 4000)}…` : text
    findings = [{ text: snippet, confidence: 0.35 }]
    usedFallbackFinding = true
    warnings.push({
      code: 'parser.fallback_single_finding',
      message: 'Keine strukturierte Feststellungsliste erkannt – gesamter Text als ein Finding übernommen',
    })
  }

  const stagingStatus = usedFallbackFinding ? 'incomplete' : 'ready_for_review'

  return {
    parserVersion: STRUCTURED_ALTBERICHT_PARSER_VERSION,
    documentMeta: {
      customerText,
      siteText,
      extra: opts?.originalFilename ? { originalFilename: opts.originalFilename } : undefined,
    },
    objects: [
      {
        sequence: 1,
        status: stagingStatus,
        customerText,
        siteText,
        objectName,
        objectTypeText,
        floorText: floorText ?? null,
        roomText: roomText ?? null,
        locationRule,
        findings,
        catalogCandidates: [],
        mediaHints: [],
        parserConfidence: { overall: findings.length ? 0.55 : 0.25 },
        analysisTrace: { mode: 'structured_altbericht_v1' },
      },
    ],
    warnings,
    extractedText: text.length > 120_000 ? `${text.slice(0, 120_000)}…` : text,
  }
}
