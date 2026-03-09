import { describe, it, expect } from 'vitest'
import { getSupabaseErrorMessage } from './supabaseErrors'

describe('getSupabaseErrorMessage', () => {
  it('gibt API-Key-Hinweis bei invalid api key', () => {
    const result = getSupabaseErrorMessage({ message: 'Invalid API key' })
    expect(result).toContain('API-Key')
    expect(result).toContain('Supabase')
  })

  it('gibt Tabellen-Hinweis bei Schema-Fehler', () => {
    const result = getSupabaseErrorMessage({ message: 'Could not find the table' })
    expect(result).toContain('Tabelle')
    expect(result).toContain('supabase-complete.sql')
  })

  it('gibt RLS-Hinweis bei RLS-Fehler', () => {
    const result = getSupabaseErrorMessage({ message: 'violates row-level security' })
    expect(result).toContain('RLS')
    expect(result).toContain('eingeloggt')
  })

  it('gibt Session-Hinweis bei JWT/expired', () => {
    const result = getSupabaseErrorMessage({ message: 'JWT expired' })
    expect(result).toContain('Session')
    expect(result).toContain('einloggen')
  })

  it('gibt Netzwerk-Hinweis bei network/fetch', () => {
    const result = getSupabaseErrorMessage({ message: 'Network error' })
    expect(result).toContain('Netzwerk')
  })

  it('gibt Login-Hinweis bei invalid credentials', () => {
    const result = getSupabaseErrorMessage({ message: 'Invalid login credentials' })
    expect(result).toContain('Anmeldedaten')
  })

  it('gibt Original-Message zurück bei unbekanntem Fehler', () => {
    const msg = 'Custom error message'
    expect(getSupabaseErrorMessage({ message: msg })).toBe(msg)
  })

  it('behandelt Error-Instanzen', () => {
    expect(getSupabaseErrorMessage(new Error('Test'))).toBe('Test')
  })

  it('behandelt unbekannte Typen', () => {
    expect(getSupabaseErrorMessage('string error')).toBe('string error')
  })
})
