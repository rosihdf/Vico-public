/** Setzt --vico-primary und --vico-primary-hover am documentElement (Portale, optional andere Shells). */

const darkenHex = (hex: string, percent: number): string => {
  let c = hex.replace('#', '')
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2]
  }
  const factor = 1 - percent / 100
  const r = Math.min(255, Math.round(parseInt(c.slice(0, 2), 16) * factor))
  const g = Math.min(255, Math.round(parseInt(c.slice(2, 4), 16) * factor))
  const b = Math.min(255, Math.round(parseInt(c.slice(4, 6), 16) * factor))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

export const applyVicoPrimaryCssVars = (primaryColor: string | null | undefined): void => {
  const root = document.documentElement
  const primary = (primaryColor && primaryColor.trim()) || '#5b7895'
  root.style.setProperty('--vico-primary', primary)
  root.style.setProperty('--vico-primary-hover', darkenHex(primary, 12))
}

export const clearVicoPrimaryCssVars = (): void => {
  const root = document.documentElement
  root.style.removeProperty('--vico-primary')
  root.style.removeProperty('--vico-primary-hover')
}
