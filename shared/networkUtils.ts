/** Prüft, ob die App online ist (Browser-Kontext). */
export const isOnline = (): boolean =>
  typeof navigator !== 'undefined' && navigator.onLine
