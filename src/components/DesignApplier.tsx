import { useEffect } from 'react'
import { useLicense } from '../LicenseContext'

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

const inferFaviconType = (url: string): string | null => {
  const u = url.toLowerCase()
  if (u.endsWith('.svg')) return 'image/svg+xml'
  if (u.endsWith('.png')) return 'image/png'
  if (u.endsWith('.ico')) return 'image/x-icon'
  if (u.endsWith('.webp')) return 'image/webp'
  if (u.endsWith('.jpg') || u.endsWith('.jpeg')) return 'image/jpeg'
  return null
}

const setFavicon = (url: string) => {
  const type = inferFaviconType(url)
  const rels: Array<'icon' | 'shortcut icon'> = ['icon', 'shortcut icon']
  for (const rel of rels) {
    let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
    if (!link) {
      link = document.createElement('link')
      link.rel = rel
      document.head.appendChild(link)
    }
    link.href = url
    if (type) link.type = type
    else link.removeAttribute('type')
  }
}

const applyDesignToDom = (design: { app_name?: string; primary_color: string; favicon_url?: string | null }) => {
  const root = document.documentElement
  const primary = design.primary_color || '#5b7895'
  const primaryHover = darkenHex(primary, 12)
  root.style.setProperty('--vico-primary', primary)
  root.style.setProperty('--vico-primary-hover', primaryHover)

  const themeColorMeta = document.querySelector('meta[name="theme-color"]')
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', primary)
  }

  const displayName = design.app_name?.trim()
  if (displayName) {
    document.title = displayName
  } else {
    document.title = 'Vico'
  }

  setFavicon(design.favicon_url?.trim() ? design.favicon_url.trim() : '/favicon.svg')
}

const clearDesignFromDom = () => {
  const root = document.documentElement
  root.style.removeProperty('--vico-primary')
  root.style.removeProperty('--vico-primary-hover')

  document.title = 'Vico'

  const themeColorMeta = document.querySelector('meta[name="theme-color"]')
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', '#5b7895')
  }

  setFavicon('/favicon.svg')
}

const DesignApplier = () => {
  const { design } = useLicense()

  useEffect(() => {
    if (design) {
      applyDesignToDom(design)
    } else {
      clearDesignFromDom()
    }
    return () => clearDesignFromDom()
  }, [design])

  return null
}

export default DesignApplier
