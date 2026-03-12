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

  if (design.app_name) {
    document.title = `${design.app_name} Türen & Tore`
  }

  let faviconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (design.favicon_url) {
    if (!faviconLink) {
      faviconLink = document.createElement('link')
      faviconLink.rel = 'icon'
      document.head.appendChild(faviconLink)
    }
    faviconLink.href = design.favicon_url
  } else if (faviconLink) {
    faviconLink.href = '/favicon.svg'
  }
}

const clearDesignFromDom = () => {
  const root = document.documentElement
  root.style.removeProperty('--vico-primary')
  root.style.removeProperty('--vico-primary-hover')

  document.title = 'Vico Türen & Tore'

  const themeColorMeta = document.querySelector('meta[name="theme-color"]')
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', '#5b7895')
  }

  const faviconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (faviconLink) {
    faviconLink.href = '/favicon.svg'
  }
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
