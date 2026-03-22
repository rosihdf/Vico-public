/**
 * Deep-Link zur Objekt-Ansicht (gleiche Logik wie QR-Modal).
 * Wird für Einzeldruck, Bluetooth und A4-Sammel-PDF genutzt.
 */
export const getObjectDeepLinkUrl = (
  customerId: string,
  bvId: string | null,
  objectId: string
): string => {
  const base = (window.location.origin + (import.meta.env.BASE_URL || '/')).replace(/\/$/, '')
  if (bvId) {
    return `${base}/kunden?customerId=${encodeURIComponent(customerId)}&bvId=${encodeURIComponent(bvId)}&objectId=${encodeURIComponent(objectId)}`
  }
  return `${base}/kunden?customerId=${encodeURIComponent(customerId)}&objectId=${encodeURIComponent(objectId)}`
}
