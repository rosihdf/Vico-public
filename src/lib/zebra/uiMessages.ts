import type { ZebraPluginErrorCodeV1 } from './types'

const MESSAGES: Record<ZebraPluginErrorCodeV1, string> = {
  NOT_NATIVE: 'Zebra-Druck ist in dieser Umgebung nicht verfügbar.',
  PLUGIN_NOT_LOADED: 'Zebra-Plugin nicht geladen.',
  BLUETOOTH_OFF: 'Bluetooth ist ausgeschaltet.',
  BLUETOOTH_UNAUTHORIZED: 'Bluetooth-Berechtigung fehlt (Einstellungen prüfen).',
  NO_DEFAULT_PRINTER: 'Kein Standard-Zebra-Drucker gespeichert.',
  PRINTER_NOT_FOUND: 'Drucker nicht gekoppelt oder nicht in Reichweite.',
  CONNECTION_FAILED: 'Verbindung zum Drucker fehlgeschlagen.',
  CONNECTION_TIMEOUT: 'Zeitüberschreitung beim Verbinden.',
  SEND_FAILED: 'Daten konnten nicht gesendet werden.',
  INVALID_PAYLOAD: 'Ungültige Druckdaten.',
  PLATFORM_MISMATCH: 'Dieser Drucker passt nicht zur Plattform.',
  SDK_ERROR: 'Druckerschnittstelle meldet einen Fehler.',
  UNSUPPORTED_OS_VERSION: 'Dieses Gerät unterstützt den Druckweg nicht.',
}

export const mapZebraPluginCodeToUiMessage = (code: ZebraPluginErrorCodeV1, detail?: string): string => {
  const base = MESSAGES[code] ?? 'Druck fehlgeschlagen.'
  if (detail?.trim()) {
    return `${base} (${detail.trim()})`
  }
  return base
}
