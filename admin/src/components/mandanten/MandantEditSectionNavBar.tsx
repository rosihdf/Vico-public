import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { SetURLSearchParams } from 'react-router-dom'

/** Volle Liste inkl. Deployment; Deployment-Chip wird nur bei Bedarf angezeigt (gleiche Bedingung wie TenantDeploymentPanel). */
const ALL_MANDANT_EDIT_NAV_SECTIONS = [
  { id: 'mandant-section-uebersicht', label: 'Übersicht', param: 'uebersicht' },
  { id: 'mandant-section-lizenz', label: 'Lizenz', param: 'lizenz' },
  { id: 'mandant-section-stammdaten', label: 'Stammdaten', param: 'stammdaten' },
  { id: 'mandant-section-supabase', label: 'Hosting', param: 'hosting' },
  { id: 'mandant-section-mail', label: 'Mailversand', param: 'mail' },
  { id: 'mandant-section-mailvorlagen', label: 'Mailvorlagen', param: 'mailvorlagen' },
  { id: 'mandant-section-branding', label: 'Branding', param: 'branding' },
  { id: 'mandant-section-app', label: 'Releases', param: 'releases' },
  { id: 'mandant-section-wartung', label: 'Wartung', param: 'wartung' },
  { id: 'mandant-section-rechtliches', label: 'Rechtliches', param: 'rechtliches' },
  { id: 'mandant-section-deployment', label: 'Deployment', param: 'deployment' },
] as const

export type MandantEditSectionNavBarProps = {
  enabled: boolean
  /** Wechsel bei anderem Mandanten (Deep-Link erneut auswerten). */
  tenantKey: string
  /** Nur wenn der Deployment-Abschnitt gerendert wird (`tenantLicenses.length > 0`). */
  showDeploymentChip: boolean
  /** Von `MandantForm` übergeben: gleiche Hook-Reihenfolge wie Router-Parent (kein `useSearchParams` hier). */
  searchParams: URLSearchParams
  setSearchParams: SetURLSearchParams
}

/**
 * Scroll erfolgt im Lizenzadmin auf `#main-content` (`flex-1 overflow-auto`), nicht auf `window`.
 * `position: sticky` klebt nur innerhalb dieses Scrollcontainers; mit verschachtelten Flex-/Overflow-Kontexten
 * war die Leiste unzuverlässig. Daher `position: fixed` relativ zum Viewport unterhalb des App-Headers.
 */
const MAIN_SCROLL_SELECTOR = '#main-content'

/** Gleicher top-Wert wie `<header>` (`Layout.tsx`): fixe Leiste direkt unter der Kopfzeile. */
const FIXED_NAV_TOP_STYLE = {
  top: 'calc(3.5rem + env(safe-area-inset-top, 0px))',
} as const

/**
 * Unter Overlay (z-40) und Drawer (z-45), über scrollendem Seiteninhalt; Kopfzeile bleibt z-50.
 */
const FIXED_NAV_Z_CLASS = 'z-[35]'

/** Fallback-Höhe vor Messung / wenn ResizeObserver nicht greift */
const NAV_BAR_FLOW_SPACER_FALLBACK_MIN_PX = 56

/** Abstand von der Viewport-Oberkante für Scroll-Spy: Header + feste Leiste + Puffer */
const SCROLL_SPY_OFFSET_PX = 120

export const MandantEditSectionNavBar = ({
  enabled,
  tenantKey,
  showDeploymentChip,
  searchParams,
  setSearchParams,
}: MandantEditSectionNavBarProps) => {

  const visibleSections = useMemo(
    () =>
      ALL_MANDANT_EDIT_NAV_SECTIONS.filter(
        (s) => s.param !== 'deployment' || showDeploymentChip,
      ),
    [showDeploymentChip],
  )

  const [activeId, setActiveId] = useState<string | null>(() => visibleSections[0]?.id ?? null)
  const [navFlowHeightPx, setNavFlowHeightPx] = useState(0)
  const navBarElRef = useRef<HTMLElement | null>(null)
  const skipSpyUntilRef = useRef(0)
  const lastDeepLinkRef = useRef<{ tenantKey: string; param: string } | null>(null)

  useLayoutEffect(() => {
    if (!enabled) return
    const el = navBarElRef.current
    if (!el || typeof ResizeObserver === 'undefined') return

    const syncHeight = () => {
      const h = Math.ceil(el.getBoundingClientRect().height)
      setNavFlowHeightPx((prev) => (prev === h ? prev : h))
    }

    syncHeight()
    const ro = new ResizeObserver(syncHeight)
    ro.observe(el)
    return () => ro.disconnect()
  }, [enabled, visibleSections.length])

  useEffect(() => {
    setActiveId((prev) => {
      if (prev && visibleSections.some((s) => s.id === prev)) return prev
      return visibleSections[0]?.id ?? null
    })
  }, [visibleSections])

  const scrollToSection = useCallback(
    (sectionId: string, syncUrl: boolean) => {
      const sec = visibleSections.find((s) => s.id === sectionId)
      if (!sec) return
      skipSpyUntilRef.current = Date.now() + 750
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveId(sectionId)
      if (syncUrl) {
        lastDeepLinkRef.current = { tenantKey, param: sec.param }
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            next.set('section', sec.param)
            return next
          },
          { replace: true },
        )
      }
    },
    [setSearchParams, tenantKey, visibleSections],
  )

  const handleNavKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, sectionId: string) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault()
      scrollToSection(sectionId, true)
    },
    [scrollToSection],
  )

  useEffect(() => {
    if (!enabled) return

    const mainEl = document.querySelector<HTMLElement>(MAIN_SCROLL_SELECTOR)
    if (!mainEl) return

    const updateActiveFromScroll = () => {
      if (Date.now() < skipSpyUntilRef.current) return
      let current = visibleSections[0]?.id
      for (const s of visibleSections) {
        const el = document.getElementById(s.id)
        if (!el) continue
        const top = el.getBoundingClientRect().top
        if (top <= SCROLL_SPY_OFFSET_PX) current = s.id
      }
      if (current) setActiveId(current)
    }

    mainEl.addEventListener('scroll', updateActiveFromScroll, { passive: true })
    window.addEventListener('resize', updateActiveFromScroll, { passive: true })
    updateActiveFromScroll()
    return () => {
      mainEl.removeEventListener('scroll', updateActiveFromScroll)
      window.removeEventListener('resize', updateActiveFromScroll)
    }
  }, [enabled, tenantKey, visibleSections])

  useEffect(() => {
    if (!enabled || !tenantKey) return
    const param = searchParams.get('section')
    if (!param) {
      lastDeepLinkRef.current = null
      return
    }
    const prev = lastDeepLinkRef.current
    if (prev?.tenantKey === tenantKey && prev?.param === param) return

    const sec = visibleSections.find((s) => s.param === param)
    if (!sec) return

    lastDeepLinkRef.current = { tenantKey, param }
    skipSpyUntilRef.current = Date.now() + 600

    const t = window.setTimeout(() => {
      const el = document.getElementById(sec.id)
      if (!el) {
        lastDeepLinkRef.current = null
        return
      }
      el.scrollIntoView({ behavior: 'auto', block: 'start' })
      setActiveId(sec.id)
    }, 100)
    return () => window.clearTimeout(t)
  }, [enabled, tenantKey, searchParams, visibleSections])

  if (!enabled) return null

  return (
    <>
      <nav
        ref={navBarElRef}
        className={`fixed left-0 right-0 ${FIXED_NAV_Z_CLASS} border-b border-slate-200 bg-white shadow-sm`}
        style={FIXED_NAV_TOP_STYLE}
        aria-label="Bereiche Mandant"
      >
        {/* Volle Content-Spur wie `MandantForm`: gleiches horizontales Padding wie `#main-content`, gleiche max Breite */}
        <div className="box-border w-full min-w-0 max-w-5xl px-3 sm:px-4">
          {/*
            Mobil: eine Zeile, horizontal scrollen.
            Desktop (sm+): umbrechen, keine horizontale Scrollbar, volle Zeilenbreite.
          */}
          <div className="-mx-1 flex min-w-0 gap-2 px-1 py-2.5 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:overflow-y-hidden max-sm:[scrollbar-width:thin] max-sm:[-webkit-overflow-scrolling:touch] sm:flex-wrap sm:overflow-x-visible sm:overflow-y-visible">
            {visibleSections.map((section) => {
              const isActive = activeId === section.id
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => scrollToSection(section.id, true)}
                  onKeyDown={(e) => handleNavKeyDown(e, section.id)}
                  aria-current={isActive ? 'true' : undefined}
                  className={`rounded-full px-2.5 py-2 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-vico-primary focus-visible:ring-offset-2 max-sm:min-h-[44px] max-sm:shrink-0 max-sm:whitespace-nowrap max-sm:px-3 max-sm:py-1.5 max-sm:text-sm sm:min-h-0 sm:min-w-0 sm:max-w-full sm:basis-auto sm:self-start sm:text-left sm:text-balance sm:whitespace-normal sm:px-2.5 sm:py-1.5 md:text-sm ${
                    isActive ? 'bg-vico-primary text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {section.label}
                </button>
              )
            })}
          </div>
        </div>
      </nav>
      {/* Höhe der fixed-Leiste (inkl. Umbruch) — sonst überdeckt der Inhalt */}
      <div
        className="mb-4 shrink-0"
        style={{
          minHeight: `${NAV_BAR_FLOW_SPACER_FALLBACK_MIN_PX}px`,
          height: navFlowHeightPx > 0 ? `${navFlowHeightPx}px` : undefined,
        }}
        aria-hidden
      />
    </>
  )
}
