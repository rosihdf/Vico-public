/**
 * Zebra ZQ220 V1 – Web/TS-Schicht (Typen + ZPL).
 * Capacitor-Plugin: Paket `vico-zebra-label-printer`.
 */

export type {
  PrinterTargetNativeV1,
  PrinterTargetV1,
  ZebraEncodingHintV1,
  ZebraGetDefaultPrinterResultV1,
  ZebraGetPairedPrintersResultV1,
  ZebraIsAvailableResultV1,
  ZebraPluginErrorCodeV1,
  ZebraPluginErrorV1,
  ZebraPrintLabelCallV1,
  ZebraPrintOptionsV1,
  ZebraPrintPayloadV1,
  ZebraPrintResultV1,
  ZebraSetDefaultPrinterResultV1,
} from './types'

export { buildZplFromPayloadV1 } from './zplBuilder'
export { mapZebraPluginCodeToUiMessage } from './uiMessages'
