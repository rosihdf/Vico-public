/**
 * §11.20 / WP-REL-02: Haupt-App registriert hier den PWA-`registerSW`-Callback;
 * Portale ohne PWA lassen den Handler leer → `executeMandantenReleaseReload` nutzt `location.reload()`.
 */

let pwaReload: (() => Promise<void>) | null = null

export const registerMandantenReleasePwaReload = (fn: (() => Promise<void>) | null): void => {
  pwaReload = fn
}

export const executeMandantenReleaseReload = async (): Promise<void> => {
  try {
    if (pwaReload) {
      await pwaReload()
      return
    }
  } catch {
    /* PWA-Update fehlgeschlagen → harter Reload */
  }
  window.location.reload()
}
