import { registerPlugin } from '@capacitor/core'

import type { ZebraLabelPrinterPlugin } from './definitions'
import { ZebraLabelPrinterWeb } from './web'

export * from './definitions'

export const ZebraLabelPrinter = registerPlugin<ZebraLabelPrinterPlugin>('ZebraLabelPrinter', {
  web: () => new ZebraLabelPrinterWeb(),
})
