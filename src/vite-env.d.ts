/// <reference types="vite/client" />

declare const __APP_VERSION__: string

declare module '@point-of-sale/webbluetooth-receipt-printer' {
  export default class WebBluetoothReceiptPrinter {
    connect(): Promise<void>
    print(data: Uint8Array | number[]): Promise<void>
    addEventListener(event: string, cb: (device?: { language?: string; codepageMapping?: string }) => void): void
  }
}

declare module '@point-of-sale/receipt-printer-encoder' {
  export default class ReceiptPrinterEncoder {
    constructor(options?: { language?: string; codepageMapping?: string })
    initialize(): this
    align(align: 'left' | 'center' | 'right'): this
    line(text: string): this
    newline(count?: number): this
    qrcode(data: string, options?: { size?: number; model?: number; errorlevel?: string }): this
    encode(): Uint8Array
  }
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}
