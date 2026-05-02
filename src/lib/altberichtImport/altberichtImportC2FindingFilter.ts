/**
 * C2: Harte Filter für produktive Mängelübernahme (kein DB-Bezug).
 * Dokumenttitel und Kopfzeilen dürfen niemals als Mangel importiert werden.
 */

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim()

const MONTHS_DE_LEAD =
  /^(Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\b\s*[.,;:]?\s*/i

const MONTHS_DE_TRAIL =
  /\s+(Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\b\s*$/i

/** Wiederholtes Entfernen typischer Kopffragmente am Anfang (gleiche Logik wie Parser-Status). */
export const stripLeadingAltberichtDocumentHeaderForC2 = (value: string): string => {
  let v = norm(value)
  for (let guard = 0; guard < 24; guard += 1) {
    const before = v
    v = v
      .replace(/^(Wartungs?bericht)\b\s*[.,;:]?\s*/i, '')
      .replace(/^(Wartung\s*20\d{2})\b\s*[.,;:]?\s*/i, '')
      .replace(MONTHS_DE_LEAD, '')
      .replace(/^(BV\s*:\s*\S+)\s*/i, '')
      .replace(/^(Bearbeitete\s+Person(?:\s+\S+){0,3})\s*[.,;:]?\s*/i, '')
      .replace(/^(Prüf[- ]?bericht)\b\s*[.,;:]?\s*/i, '')
      .trim()
    v = norm(v)
    if (v === before) break
  }
  return v
}

const stripTrailingDocumentNoiseFromC2 = (value: string): string => {
  let v = norm(value)
  for (let guard = 0; guard < 12; guard += 1) {
    const before = v
    v = v
      .replace(/\s+Wartungs?bericht\b\s*$/i, '')
      .replace(/\s+Wartung\s*20\d{2}\b\s*$/i, '')
      .replace(MONTHS_DE_TRAIL, '')
      .replace(/\s+Bearbeitete\s+Person(?:\s+\S+){0,3}\s*$/i, '')
      .replace(/\s+BV\s*:\s*\S+\s*$/i, '')
      .replace(/\s+in\s+\d{5}\s+[\wäöüÄÖÜß.-]+\s*$/i, '')
      .replace(
        /\s+[A-ZÄÖÜa-zäöüß][\wäöüß.-]{0,52}(?:str\.?|straße|Strasse|gasse|weg|platz|allee|ring|damm)\.?\s+\d+[a-z]?\s*$/i,
        ''
      )
      .trim()
    v = norm(v)
    if (v === before) break
  }
  return v
}

/** Straße + Nr. + „in“ + PLZ + Ort; PLZ + Ort; führendes „in PLZ Ort“. */
const stripLeadingGermanAddressFragments = (value: string): string => {
  let v = norm(value)
  for (let guard = 0; guard < 10; guard += 1) {
    const before = v
    v = v
      .replace(
        /^[A-ZÄÖÜa-zäöüß][\wäöüß.-]{0,52}(?:str\.?|straße|Strasse|gasse|weg|platz|allee|ring|damm)\.?\s+\d+[a-z]?\s+in\s+\d{5}\s+[\wäöüÄÖÜß.-]+\s*[.,;:]?\s*/i,
        ''
      )
      .replace(/^\d{5}\s+[\wäöüÄÖÜß.-]+\s*[.,;:]?\s*/i, '')
      .replace(/^in\s+\d{5}\s+[\wäöüÄÖÜß.-]+\s*[.,;:]?\s*/i, '')
      .trim()
    v = norm(v)
    if (v === before) break
  }
  return v
}

const stripLeadingMeasureTokens = (value: string): string => {
  let v = norm(value)
  for (let guard = 0; guard < 12; guard += 1) {
    const before = v
    v = v
      .replace(/^\d{2,4}\s*[x×]\s*\d{2,4}(?:\s*mm)?\s*[.,;:]?\s*/i, '')
      .trim()
    v = norm(v)
    if (v === before) break
  }
  return v
}

/** Nach Maßen oft „wand“, „Fluchtweg“ o. Ä. vor dem eigentlichen Befund. */
const stripLeadingLowValueWords = (value: string): string => {
  let v = norm(value)
  for (let guard = 0; guard < 8; guard += 1) {
    const before = v
    v = v
      .replace(/^(wand|fluchtweg|maße?|mass|lichtmaß|lichtmass)\b\s*[.,;:]?\s*/i, '')
      .trim()
    v = norm(v)
    if (v === before) break
  }
  return v
}

/** Führende reine Zahl(en), ggf. mit Komma/Leerzeichen (z. B. Pos.-Rest). */
const stripLeadingNumberTokens = (value: string): string => {
  let v = norm(value)
  for (let guard = 0; guard < 14; guard += 1) {
    const before = v
    v = v.replace(/^(\d{1,4}\s+)+/, '').replace(/^(\d{1,4}\s*,\s*)+/, '').trim()
    v = norm(v)
    if (v === before) break
  }
  return v
}

const RE_DEFECTISH =
  /mangel|defekt|undicht|fehlt|fehlen|beschädig|riss|dichtung|brand|gefahr|zulassung|laschen|mörtel|hinterfüllung|korros|schließ|schlies|nicht\s+in\s*ordnung|n\s*\.?\s*i\s*\.?\s*o\.?|kritisch|ersetz|nacharbeit|undicht|einrei|verzogen|lose|locker/i

/** Erster inhaltlicher Mangelbeginn (fachliche Schlüsselwörter). */
const RE_MANGEL_ANCHOR =
  /\b(Tür|Mörtelhinterfüllung|Mörtel|Laschen|Brandgefahr|Stromzähler|Brandschutztür|ohne\s+Zulassung|fehlt|fehlen|beschädigt|defekt|\bmuss\b)\b/i

const isLikelyAddressOrMeasurePrefix = (prefix: string): boolean => {
  const p = norm(prefix)
  if (!p) return false
  if (/^\d{2,4}\s*[x×]\s*\d{2,4}/i.test(p)) return true
  if (
    /^[A-ZÄÖÜa-zäöüß][\wäöüß.-]{0,52}(?:str\.?|straße|Strasse|gasse|weg|platz)\.?\s+\d+[a-z]?\s+in\s+\d{5}\b/i.test(
      p
    )
  ) {
    return true
  }
  if (/^\d{5}\s+[\wäöüÄÖÜß.-]+$/i.test(p)) return true
  if (/^in\s+\d{5}\s+[\wäöüÄÖÜß.-]+/i.test(p)) return true
  if (/^[\d\s,;.]+$/.test(p)) return true
  if (/^(?:wand|fluchtweg)\b/i.test(p) && p.length < 72) return true
  return false
}

/**
 * Entfernt Vorspann vor dem ersten klaren Mangelanker, wenn der Vorspann wie Adresse/Maß/Zahl aussieht
 * und keine eigenen Schadensbegriffe enthält (schützt z. B. „Dichtung beschädigt“).
 */
const preferDefectAnchorPrefixRemoval = (value: string): string => {
  const s = norm(value)
  if (!s) return s
  const m = RE_MANGEL_ANCHOR.exec(s)
  if (!m || m.index === undefined || m.index <= 0) return s
  const prefix = s.slice(0, m.index).trim()
  if (!prefix) return s
  if (RE_DEFECTISH.test(prefix)) return s
  if (/\bDichtung\b/i.test(prefix)) return s
  if (isLikelyAddressOrMeasurePrefix(prefix) || /^[\d\s,;.]+$/.test(prefix)) {
    return norm(s.slice(m.index))
  }
  return s
}

/**
 * Bereinigter Text für C2-Liste und Commit (Kopf vorne/hinten entfernt).
 */
export const normalizeAltberichtC2FindingText = (raw: string): string | null => {
  let v = norm(raw)
  if (!v) return null
  v = stripLeadingAltberichtDocumentHeaderForC2(v)
  v = stripLeadingGermanAddressFragments(v)
  v = stripLeadingMeasureTokens(v)
  v = stripLeadingLowValueWords(v)
  v = stripLeadingNumberTokens(v)
  v = stripLeadingMeasureTokens(v)
  v = stripLeadingLowValueWords(v)
  v = preferDefectAnchorPrefixRemoval(v)
  v = stripTrailingDocumentNoiseFromC2(v)
  v = stripLeadingGermanAddressFragments(v)
  v = stripLeadingAltberichtDocumentHeaderForC2(v)
  for (let i = 0; i < 8; i += 1) {
    const b = v
    v = norm(v.replace(/^[.,;:\-–—(]+\s*/, ''))
    if (v === b) break
  }
  v = norm(v)
  if (!v) return null
  return v
}

/** Nur Dokument-/Listenkopf, kein Mangelinhalt (nach Normalisierung). */
export const isAltberichtC2DocumentHeaderOnlyToken = (value: string): boolean => {
  const s = norm(value)
  if (!s) return true
  if (/^Wartung\s*20\d{2}\.?$/i.test(s)) return true
  if (/^Wartungs?bericht\.?$/i.test(s)) return true
  if (/^(Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\.?$/i.test(s))
    return true
  if (/^BV\s*:\s*\S+(\s+\S+)?\.?$/i.test(s)) return true
  if (/^Bearbeitete\s+Person(\s+\S+){0,3}\.?$/i.test(s)) return true
  if (/^(Pos\.\s*){1,2}intern(\s+Etage\s+Raum)?\.?$/i.test(s)) return true
  if (/^intern\s+etage\s+raum\.?$/i.test(s)) return true
  if (/^20\d{2}$/.test(s)) return true
  if (/^\d{1,2}[./-]\d{1,2}([./-]20\d{2})?$/.test(s)) return true
  if (/^20\d{2}[./-]\d{1,2}[./-]\d{1,2}$/.test(s)) return true
  if (
    /^[A-ZÄÖÜa-zäöüß][\wäöüß.-]{0,52}(?:str\.?|straße|Strasse|gasse|weg|platz)\.?\s+\d+[a-z]?\s+in\s+\d{5}\s+[\wäöüÄÖÜß.-]+\.?$/i.test(
      s
    )
  ) {
    return true
  }
  if (/^\d{5}\s+[\wäöüÄÖÜß.-]+\.?$/i.test(s)) return true
  return false
}

const isPureMeasureOrPositionNumber = (t: string): boolean => {
  const s = norm(t)
  if (!s) return true
  if (/^\d{1,2}$/.test(s)) {
    const n = parseInt(s, 10)
    if (n >= 1 && n <= 50) return true
  }
  if (/^\d{2,4}\s*[x×]\s*\d{2,4}(\s*mm)?\.?$/i.test(s)) return true
  if (/^[\d\s.,x×]{3,24}$/i.test(s) && /[x×]/.test(s) && !/[a-zäöüß]/i.test(s)) return true
  if (/^\d+([.,]\d+)?\s*(mm|cm|m)\b\.?$/i.test(s)) return true
  if (/^\d+([.,]\d+)?$/i.test(s) && s.replace(/[.,]/g, '').length <= 5) return true
  return false
}

/**
 * Hinweis für UI: inhaltlich unsicher, manuelle Prüfung empfohlen (blockiert den Commit nicht).
 */
export const altberichtC2FindingManualReviewHint = (text: string): string | undefined => {
  const n = normalizeAltberichtC2FindingText(text) ?? norm(text)
  if (!n) return undefined
  if (n.length > 280 && !RE_DEFECTISH.test(n)) {
    return 'Kandidat unplausibel: langer Text ohne typische Mangelbegriffe – bitte manuell prüfen.'
  }
  if (n.length >= 8 && n.length <= 48 && !RE_DEFECTISH.test(n)) {
    return 'Kandidat unplausibel: bitte Inhalt prüfen (kein typischer Mangelbegriff).'
  }
  return undefined
}

/**
 * `true` = niemals produktiv übernehmen (Blacklist / Stammdaten-Rauschen / reiner Kopf).
 */
export const textShouldBeExcludedFromAltberichtC2Import = (text: string): boolean => {
  const t0 = text.trim()
  if (!t0) return true
  if (t0.length > 800) return true
  const n = normalizeAltberichtC2FindingText(t0)
  if (!n) return true
  if (isAltberichtC2DocumentHeaderOnlyToken(n)) return true
  if (isPureMeasureOrPositionNumber(n)) return true
  if (/^(Art|Anforderung|Hersteller|Schließmittel|Schliessmittel|Status)\s*:/i.test(n)) return true
  if (/\bArt\s+Fl\.\s*Anforderung\s+Hersteller\b/i.test(n)) return true
  if (/(?:EG|UG|OG|KG|DG)\s+TG\s+.+Art\s+Fl\./i.test(n)) return true
  if (/\bSchließmittel\b.*\b(FSA|Antrieb|Anzahl|RM|FTT)\b/i.test(n) && n.length > 50) return true
  if (/^in\s+\d{5}\b/i.test(n) && n.length < 80) return true
  return false
}
