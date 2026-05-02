import { useEffect } from 'react'
import { installDocumentFavicon } from '../../shared/installDocumentFavicon'
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
    document.title = 'ArioVan'
  }

  installDocumentFavicon(design.favicon_url?.trim() ? design.favicon_url.trim() : null, '/favicon.svg')
}

const clearDesignFromDom = () => {
  const root = document.documentElement
  root.style.removeProperty('--vico-primary')
  root.style.removeProperty('--vico-primary-hover')

  document.title = 'ArioVan'

  const themeColorMeta = document.querySelector('meta[name="theme-color"]')
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', '#5b7895')
  }

  installDocumentFavicon(null, '/favicon.svg')
}

const DesignApplier = () => {
  const { design } = useLicense()

  useEffect(() => {
    if (design) {
      applyDesignToDom(design)
    } else {
      clearDesignFromDom()
    }
    // Kein clear im Cleanup bei jedem design-Wechsel: sonst kurz Standard-Favicon + Tab bricht Update oft ab.
  }, [design])

  useEffect(() => {
    return () => {
      clearDesignFromDom()
    }
  }, [])

  return null
}

export default DesignApplier
