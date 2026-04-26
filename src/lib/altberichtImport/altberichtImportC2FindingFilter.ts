/**
 * C2: Kandidatenfilter ohne DB/Supabase-Abhängigkeit (Tests + Parser-Consumer).
 * Schließt Sammel-/Stammdaten-Texte aus, die keine produktiven Mängel sind.
 */
export const textShouldBeExcludedFromAltberichtC2Import = (text: string): boolean => {
  const t = text.trim()
  if (!t) return true
  if (t.length > 800) return true
  if (/^(Art|Anforderung|Hersteller|Schließmittel|Schliessmittel|Status)\s*:/i.test(t)) return true
  if (/\bArt\s+Fl\.\s*Anforderung\s+Hersteller\b/i.test(t)) return true
  if (/(?:EG|UG|OG|KG|DG)\s+TG\s+.+Art\s+Fl\./i.test(t)) return true
  if (/\bSchließmittel\b.*\b(FSA|Antrieb|Anzahl|RM|FTT)\b/i.test(t) && t.length > 50) return true
  return false
}
