/**
 * Etikettendrucker – Schnittstelle für QR-Etikettendruck aus der App.
 * Entscheidung: Capacitor-Wrapper (Option A, siehe docs/Entscheidungen-Offene-Punkte.md §9).
 *
 * In der nativen Capacitor-App wird ein Plugin (z. B. EtikettendruckerPlugin) diese API
 * implementieren und an das Bluetooth-SDK des Druckers anbinden.
 * Im Web/PWA: Aufruf ist No-Op oder öffnet ggf. einen Hinweis.
 */

export type EtikettendruckerResult = { ok: true } | { ok: false; error: string }

/** Gibt true zurück, wenn die App in einer Capacitor-Umgebung läuft und das Plugin verfügbar ist. */
export const isEtikettendruckerAvailable = (): boolean => {
  if (typeof window === 'undefined') return false
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  const plugins = (window as unknown as { Capacitor?: { Plugins?: { Etikettendrucker?: unknown } } }).Capacitor?.Plugins
  return Boolean(cap?.isNativePlatform?.() && plugins?.Etikettendrucker)
}

/**
 * Druckt ein QR-Etikett mit dem angegebenen Inhalt (z. B. Objekt-URL oder -ID).
 * In Capacitor: ruft natives Plugin auf; in PWA: No-Op, gibt { ok: false } zurück.
 */
export const printLabel = async (qrPayload: string): Promise<EtikettendruckerResult> => {
  if (!qrPayload?.trim()) {
    return { ok: false, error: 'Kein Inhalt zum Drucken.' }
  }
  if (typeof window === 'undefined') {
    return { ok: false, error: 'Nicht im Browser.' }
  }
  const cap = (window as unknown as { Capacitor?: { Plugins?: { Etikettendrucker?: { printLabel: (opts: { qrPayload: string }) => Promise<EtikettendruckerResult> } } } }).Capacitor
  const plugin = cap?.Plugins?.Etikettendrucker
  if (plugin?.printLabel) {
    try {
      return await plugin.printLabel({ qrPayload: qrPayload.trim() })
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }
  return { ok: false, error: 'Etikettendrucker-Plugin nicht verfügbar (nur in der nativen App).' }
}
