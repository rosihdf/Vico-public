/**
 * Mandanten-Favicon im Browser-Tab: <link rel="icon"> + shortcut + apple-touch-icon.
 * Hinweis: Storage-URLs haben oft Query-Parameter → Extension nicht mit endsWith('.webp') prüfen.
 */

const pathOnlyLower = (raw: string): string => {
  const t = raw.trim()
  if (!t) return ''
  try {
    if (t.startsWith('http://') || t.startsWith('https://') || t.startsWith('//')) {
      const u = new URL(t.startsWith('//') ? `https:${t}` : t)
      return u.pathname.toLowerCase()
    }
  } catch {
    /* ignore */
  }
  return t.split('?')[0]?.split('#')[0]?.toLowerCase() ?? ''
}

export const inferFaviconMimeType = (rawUrl: string): string | null => {
  const p = pathOnlyLower(rawUrl)
  if (p.endsWith('.svg')) return 'image/svg+xml'
  if (p.endsWith('.png')) return 'image/png'
  if (p.endsWith('.ico')) return 'image/x-icon'
  if (p.endsWith('.webp')) return 'image/webp'
  if (p.endsWith('.jpg') || p.endsWith('.jpeg')) return 'image/jpeg'
  return null
}

const resolveHref = (raw: string): string => {
  const t = raw.trim()
  if (!t) return ''
  if (t.startsWith('https://') || t.startsWith('http://')) return t
  if (t.startsWith('//') && typeof window !== 'undefined') {
    return `${window.location.protocol}${t}`
  }
  if (t.startsWith('/') && typeof window !== 'undefined') {
    return `${window.location.origin}${t}`
  }
  return t
}

/** Stabiler Query-Parameter: Browser-Tab-Favicon-Cache, ohne bei jedem Render zu wechseln. */
const withFaviconCacheBust = (href: string): string => {
  if (!href || typeof window === 'undefined') return href
  if (!href.startsWith('http://') && !href.startsWith('https://')) return href
  let h = 0
  for (let i = 0; i < href.length; i++) h = (Math.imul(31, h) + href.charCodeAt(i)) | 0
  const v = (h >>> 0).toString(36)
  const sep = href.includes('?') ? '&' : '?'
  return `${href}${sep}_fv=${v}`
}

const applyToLink = (link: HTMLLinkElement, href: string, mime: string | null): void => {
  link.href = href
  link.removeAttribute('sizes')
  if (mime) {
    link.type = mime
  } else {
    link.removeAttribute('type')
  }
}

/**
 * Setzt Tab-Favicon (alle vorhandenen `icon` / `shortcut icon` Links) + `apple-touch-icon`.
 * @param rawUrl Absolute oder relative URL; leer/null → Fallback `fallbackHref` (z. B. /favicon.svg).
 */
export const installDocumentFavicon = (rawUrl: string | null | undefined, fallbackHref = '/favicon.svg'): void => {
  if (typeof document === 'undefined') return
  const trimmed = rawUrl?.trim() ?? ''
  const resolved = trimmed ? resolveHref(trimmed) : ''
  const href = resolved ? withFaviconCacheBust(resolved) : fallbackHref
  const mime = resolved ? inferFaviconMimeType(trimmed) : inferFaviconMimeType(fallbackHref)

  const rels: Array<'icon' | 'shortcut icon'> = ['icon', 'shortcut icon']
  for (const rel of rels) {
    const nodes = document.querySelectorAll<HTMLLinkElement>(`link[rel="${rel}"]`)
    if (nodes.length === 0) {
      const link = document.createElement('link')
      link.rel = rel
      document.head.appendChild(link)
      applyToLink(link, href, mime)
    } else {
      nodes.forEach((link) => applyToLink(link, href, mime))
    }
  }

  let apple = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')
  if (!apple) {
    apple = document.createElement('link')
    apple.rel = 'apple-touch-icon'
    document.head.appendChild(apple)
  }
  applyToLink(apple, href, mime)
}
