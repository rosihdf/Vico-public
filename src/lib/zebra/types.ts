/**
 * Zebra ZQ220 V1 – öffentliche Typen (API-Spezifikation).
 * Keine Native-/Capacitor-Abhängigkeit.
 * Plugin-Typen: `plugins/zebra-label-printer/src/definitions.ts` (manuell parallel halten).
 */

export type ZebraEncodingHintV1 = 'utf8' | 'latin1'

export type ZebraPrintPayloadV1 = {
  qrContent: string
  titleLine: string
  objectLabel: string
  customerName: string
  siteName?: string
  subtitle?: string
  labelSize: { widthMm: number; heightMm: number }
  encodingHint?: ZebraEncodingHintV1
}

export type PrinterTargetNativeV1 = {
  platform: 'android' | 'ios'
  /** Undurchsichtiger String, nur Native-Layer interpretiert ihn. */
  opaque: string
}

export type PrinterTargetV1 = {
  kind: 'zebra_zq220'
  id: string
  displayName: string
  lastFour?: string
  native: PrinterTargetNativeV1
}

export type ZebraPluginErrorCodeV1 =
  | 'NOT_NATIVE'
  | 'PLUGIN_NOT_LOADED'
  | 'BLUETOOTH_OFF'
  | 'BLUETOOTH_UNAUTHORIZED'
  | 'NO_DEFAULT_PRINTER'
  | 'PRINTER_NOT_FOUND'
  | 'CONNECTION_FAILED'
  | 'CONNECTION_TIMEOUT'
  | 'SEND_FAILED'
  | 'INVALID_PAYLOAD'
  | 'PLATFORM_MISMATCH'
  | 'SDK_ERROR'
  | 'UNSUPPORTED_OS_VERSION'

export type ZebraPluginErrorV1 = {
  code: ZebraPluginErrorCodeV1
  message: string
  details?: string
}

export type ZebraPrintOptionsV1 = {
  timeoutMs?: number
  target?: PrinterTargetV1 | null
}

export type ZebraPrintResultV1 =
  | { ok: true; meta?: { bytesSent?: number; durationMs?: number } }
  | { ok: false; error: ZebraPluginErrorV1 }

export type ZebraIsAvailableResultV1 = {
  available: boolean
  platform: 'android' | 'ios' | 'web'
  reason?: string
}

export type ZebraGetPairedPrintersResultV1 =
  | { ok: true; printers: PrinterTargetV1[] }
  | { ok: false; error: ZebraPluginErrorV1 }

export type ZebraGetDefaultPrinterResultV1 =
  | { ok: true; target: PrinterTargetV1 | null }
  | { ok: false; error: ZebraPluginErrorV1 }

export type ZebraSetDefaultPrinterResultV1 = { ok: true } | { ok: false; error: ZebraPluginErrorV1 }

/** Druckauftrag inkl. ZPL-String (von `buildZplFromPayloadV1`); siehe Plugin `ZebraPrintLabelCallV1`. */
export type ZebraPrintLabelCallV1 = {
  payload: ZebraPrintPayloadV1
  zpl: string
  printOptions?: ZebraPrintOptionsV1
}
