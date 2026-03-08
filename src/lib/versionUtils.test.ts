import { describe, it, expect } from 'vitest'
import { isNewerVersion } from './versionUtils'

describe('isNewerVersion', () => {
  it('gibt true zurück wenn latest größer als current', () => {
    expect(isNewerVersion('1.0.0', '1.0.1')).toBe(true)
    expect(isNewerVersion('1.0.0', '1.1.0')).toBe(true)
    expect(isNewerVersion('1.0.0', '2.0.0')).toBe(true)
    expect(isNewerVersion('1.2.3', '1.2.4')).toBe(true)
    expect(isNewerVersion('0.9.9', '1.0.0')).toBe(true)
  })

  it('gibt false zurück wenn latest gleich oder kleiner als current', () => {
    expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false)
    expect(isNewerVersion('1.0.1', '1.0.0')).toBe(false)
    expect(isNewerVersion('1.1.0', '1.0.0')).toBe(false)
    expect(isNewerVersion('2.0.0', '1.0.0')).toBe(false)
  })

  it('gibt false zurück bei leeren oder ungültigen Versionen', () => {
    expect(isNewerVersion('', '1.0.0')).toBe(false)
    expect(isNewerVersion('1.0.0', '')).toBe(false)
    expect(isNewerVersion('', '')).toBe(false)
    expect(isNewerVersion('1.0.0', 'invalid')).toBe(false)
    expect(isNewerVersion('invalid', '1.0.0')).toBe(false)
  })

  it('ignoriert Whitespace', () => {
    expect(isNewerVersion(' 1.0.0 ', ' 1.0.1 ')).toBe(true)
  })
})
