/**
 * Spiegelt die Server-Regeln aus supabase-license-portal/functions/_shared/mailTemplateRender.ts
 * (nur für Vitest im Admin; bei Änderung der Regex dort hier abstimmen).
 */
import { describe, expect, it } from 'vitest'

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g

const getByPath = (obj: unknown, path: string): unknown => {
  const parts = path.split('.').filter(Boolean)
  let cur: unknown = obj
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined
    if (typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur
}

const applyPlaceholders = (template: string, ctx: Record<string, unknown>): string =>
  template.replace(PLACEHOLDER_RE, (_full, key: string) => {
    const v = getByPath(ctx, key)
    if (v === null || v === undefined) return ''
    if (typeof v === 'string') return v
    if (typeof v === 'number' || typeof v === 'boolean') return String(v)
    return ''
  })

describe('Mail-Platzhalter (Admin-Spiegel zur LP Edge Logic)', () => {
  it('ersetzt verschachtelte Platzhalter', () => {
    const ctx = { mandant: { name: 'ACME' }, bericht: { datum: '2026-01-02' } }
    expect(applyPlaceholders('Hallo {{mandant.name}} am {{bericht.datum}}', ctx)).toBe('Hallo ACME am 2026-01-02')
  })

  it('ersetzt unbekannte Platzhalter durch leeren String', () => {
    expect(applyPlaceholders('{{nix.da}}!', {})).toBe('!')
  })
})
