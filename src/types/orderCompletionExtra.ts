/** Struktur in order_completions.completion_extra (Version 1). */
export type OrderCompletionExtraV1 = {
  v: 1
  bericht_datum: string
  monteur_name: string
  primary: { start: string; end: string; pause_minuten: number }
  zusatz_monteure: Array<{
    profile_id?: string
    name: string
    start: string
    end: string
    pause_minuten: number
  }>
  material_lines: Array<{ anzahl: string; artikel: string }>
  parked?: boolean
  portal_teilen?: boolean
}

export const defaultOrderCompletionExtra = (monteurName: string): OrderCompletionExtraV1 => {
  const today = new Date().toISOString().slice(0, 10)
  return {
    v: 1,
    bericht_datum: today,
    monteur_name: monteurName,
    primary: { start: '', end: '', pause_minuten: 0 },
    zusatz_monteure: [],
    material_lines: [{ anzahl: '', artikel: '' }],
    parked: false,
    portal_teilen: false,
  }
}

export const parseOrderCompletionExtra = (raw: unknown, monteurNameFallback: string): OrderCompletionExtraV1 => {
  if (raw && typeof raw === 'object' && (raw as OrderCompletionExtraV1).v === 1) {
    const x = raw as OrderCompletionExtraV1
    return {
      v: 1,
      bericht_datum: x.bericht_datum || new Date().toISOString().slice(0, 10),
      monteur_name: x.monteur_name || monteurNameFallback,
      primary: {
        start: x.primary?.start ?? '',
        end: x.primary?.end ?? '',
        pause_minuten: Number(x.primary?.pause_minuten) || 0,
      },
      zusatz_monteure: Array.isArray(x.zusatz_monteure) ? x.zusatz_monteure : [],
      material_lines:
        Array.isArray(x.material_lines) && x.material_lines.length > 0
          ? x.material_lines.map((m) => ({ anzahl: String(m.anzahl ?? ''), artikel: String(m.artikel ?? '') }))
          : [{ anzahl: '', artikel: '' }],
      parked: Boolean(x.parked),
      portal_teilen: Boolean(x.portal_teilen),
    }
  }
  return defaultOrderCompletionExtra(monteurNameFallback)
}

export const materialLinesToText = (lines: OrderCompletionExtraV1['material_lines']): string =>
  lines
    .filter((l) => l.artikel.trim() || l.anzahl.trim())
    .map((l) => `${l.anzahl.trim() || '—'}× ${l.artikel.trim()}`.trim())
    .join('\n')
