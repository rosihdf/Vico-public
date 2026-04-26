import { WebPlugin } from '@capacitor/core'

import type {
  ZebraGetDefaultPrinterResultV1,
  ZebraGetPairedPrintersResultV1,
  ZebraIsAvailableResultV1,
  ZebraLabelPrinterPlugin,
  ZebraPrintPayloadV1,
  ZebraPrintResultV1,
  ZebraSetDefaultPrinterResultV1,
  PrinterTargetV1,
  ZebraPrintOptionsV1,
} from './definitions'

const notNativePrint = (): ZebraPrintResultV1 => ({
  ok: false,
  error: {
    code: 'NOT_NATIVE',
    message: 'Zebra-Druck nur in der nativen App verfügbar.',
  },
})

const errPair: ZebraGetPairedPrintersResultV1 = {
  ok: false,
  error: {
    code: 'NOT_NATIVE',
    message: 'Zebra-Druck nur in der nativen App verfügbar.',
  },
}

const errDef: ZebraGetDefaultPrinterResultV1 = {
  ok: false,
  error: {
    code: 'NOT_NATIVE',
    message: 'Zebra-Druck nur in der nativen App verfügbar.',
  },
}

const errSet: ZebraSetDefaultPrinterResultV1 = {
  ok: false,
  error: {
    code: 'NOT_NATIVE',
    message: 'Zebra-Druck nur in der nativen App verfügbar.',
  },
}

export class ZebraLabelPrinterWeb extends WebPlugin implements ZebraLabelPrinterPlugin {
  async isAvailable(): Promise<ZebraIsAvailableResultV1> {
    return {
      available: false,
      platform: 'web',
      reason: 'NOT_NATIVE',
    }
  }

  async getPairedPrinters(): Promise<ZebraGetPairedPrintersResultV1> {
    return errPair
  }

  async setDefaultPrinter(_options: { target: PrinterTargetV1 | null }): Promise<ZebraSetDefaultPrinterResultV1> {
    return errSet
  }

  async getDefaultPrinter(): Promise<ZebraGetDefaultPrinterResultV1> {
    return errDef
  }

  async printLabel(_options: {
    payload: ZebraPrintPayloadV1
    zpl: string
    printOptions?: ZebraPrintOptionsV1
  }): Promise<ZebraPrintResultV1> {
    return notNativePrint()
  }
}
