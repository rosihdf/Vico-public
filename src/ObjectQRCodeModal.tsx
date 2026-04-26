import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { Capacitor } from '@capacitor/core'
import { QRCodeCanvas } from 'qrcode.react'
import WebBluetoothReceiptPrinter from '@point-of-sale/webbluetooth-receipt-printer'
import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder'
import type { PrinterTargetV1 } from 'vico-zebra-label-printer'
import { ZebraLabelPrinter } from 'vico-zebra-label-printer'
import type { Object as Obj } from './types'
import { getObjectDisplayName } from './lib/objectUtils'
import { getObjectDeepLinkUrl } from './lib/objectQrUrl'
import { buildZplFromPayloadV1, mapZebraPluginCodeToUiMessage } from './lib/zebra'
import { getEtikettPresetDimensions } from './lib/etikettPreset'
import { useLicense } from './LicenseContext'

type ObjectQRCodeModalProps = {
  object: Obj
  customerName: string
  bvName: string
  customerId: string
  bvId: string | null
  onClose: () => void
}

const isWebBluetoothSupported = (): boolean =>
  typeof navigator !== 'undefined' && 'bluetooth' in navigator

const ObjectQRCodeModal = ({
  object,
  customerName,
  bvName,
  customerId,
  bvId,
  onClose,
}: ObjectQRCodeModalProps) => {
  const { design } = useLicense()
  const brandLine = useMemo(
    () => (design?.app_name ? `${design.app_name} Türen & Tore` : 'AMRtech Türen & Tore'),
    [design?.app_name]
  )
  const logoSrc = design?.logo_url?.trim() || ''
  const printRef = useRef<HTMLDivElement>(null)
  const [btStatus, setBtStatus] = useState<'idle' | 'connecting' | 'printing' | 'done' | 'error'>('idle')
  const [btMessage, setBtMessage] = useState<string>('')

  /** Zebra MVP (Android nativ): nur wenn isAvailable sinnvoll. */
  const [zebraUiPhase, setZebraUiPhase] = useState<'off' | 'loading' | 'ready' | 'na'>('off')
  const [zebraPaired, setZebraPaired] = useState<PrinterTargetV1[]>([])
  const [zebraSelectedId, setZebraSelectedId] = useState<string>('')
  const [zebraMsg, setZebraMsg] = useState<string>('')
  const [zebraBusy, setZebraBusy] = useState(false)

  const url = getObjectDeepLinkUrl(customerId, bvId, object.id)
  const displayName = getObjectDisplayName(object)
  const roomInfo = object.internal_id?.trim() && object.room ? ` · ${object.room}` : ''

  const handlePrint = () => {
    window.print()
  }

  const handleBluetoothPrint = useCallback(async () => {
    if (!isWebBluetoothSupported()) {
      setBtStatus('error')
      setBtMessage('Bluetooth wird von diesem Browser nicht unterstützt. Chrome/Edge verwenden.')
      return
    }
    setBtStatus('connecting')
    setBtMessage('Drucker auswählen…')
    const printer = new WebBluetoothReceiptPrinter()

    const handleConnected = (device?: { language?: string; codepageMapping?: string }) => {
      setBtStatus('printing')
      setBtMessage('Drucke…')
      try {
        const encoder = new ReceiptPrinterEncoder({
          language: device?.language ?? 'esc-pos',
          codepageMapping: device?.codepageMapping ?? 'epson',
        })
        const data = encoder
          .initialize()
          .align('center')
          .line(brandLine)
          .newline()
          .line(customerName)
          .line(bvName || '–')
          .line(`ID: ${displayName}${roomInfo}`)
          .newline()
          .qrcode(url, { size: 6, model: 2, errorlevel: 'm' })
          .newline()
          .line(displayName)
          .newline(2)
          .encode()
        printer.print(data).then(() => {
          setBtStatus('done')
          setBtMessage('Druck erfolgreich.')
          setTimeout(() => {
            setBtStatus('idle')
            setBtMessage('')
          }, 2000)
        }).catch(() => {
          setBtStatus('error')
          setBtMessage('Druck fehlgeschlagen.')
        })
      } catch {
        setBtStatus('error')
        setBtMessage('Druck fehlgeschlagen.')
      }
    }

    printer.addEventListener('connected', handleConnected)
    printer.connect().catch(() => {
      setBtStatus('error')
      setBtMessage('Verbindung abgebrochen oder fehlgeschlagen.')
    })
  }, [url, customerName, bvName, displayName, roomInfo, brandLine])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
        setZebraUiPhase('off')
        return
      }
      setZebraUiPhase('loading')
      try {
        const r = await ZebraLabelPrinter.isAvailable()
        if (cancelled) return
        if (r.available) {
          setZebraUiPhase('ready')
        } else {
          setZebraUiPhase('na')
        }
      } catch {
        if (!cancelled) setZebraUiPhase('na')
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  const buildZebraPayload = useCallback(() => {
    const labelSize = getEtikettPresetDimensions()
    const subtitleParts: string[] = []
    if (object.room?.trim()) subtitleParts.push(object.room.trim())
    if (object.internal_id?.trim()) subtitleParts.push(object.internal_id.trim())
    const subtitle = subtitleParts.length > 0 ? subtitleParts.join(' · ') : undefined
    return {
      qrContent: url,
      titleLine: brandLine,
      objectLabel: displayName,
      customerName,
      siteName: bvName?.trim() || undefined,
      subtitle,
      labelSize,
    }
  }, [url, brandLine, displayName, customerName, bvName, object.room, object.internal_id])

  const handleZebraLoadPaired = useCallback(async () => {
    setZebraMsg('')
    setZebraBusy(true)
    try {
      const r = await ZebraLabelPrinter.getPairedPrinters()
      if (!r.ok) {
        setZebraMsg(mapZebraPluginCodeToUiMessage(r.error.code, r.error.details))
        return
      }
      setZebraPaired(r.printers)
      if (r.printers.length === 0) {
        setZebraMsg('Keine gekoppelten Bluetooth-Geräte. Bitte in den Android-Einstellungen koppeln.')
        setZebraSelectedId('')
        return
      }
      setZebraSelectedId((prev) => (prev && r.printers.some((p) => p.id === prev) ? prev : r.printers[0].id))
    } finally {
      setZebraBusy(false)
    }
  }, [])

  const handleZebraSetDefault = useCallback(async () => {
    setZebraMsg('')
    const sel = zebraPaired.find((p) => p.id === zebraSelectedId)
    if (!sel) {
      setZebraMsg('Bitte zuerst gekoppelte Geräte laden und einen Drucker auswählen.')
      return
    }
    setZebraBusy(true)
    try {
      const r = await ZebraLabelPrinter.setDefaultPrinter({ target: sel })
      if (!r.ok) {
        setZebraMsg(mapZebraPluginCodeToUiMessage(r.error.code, r.error.details))
        return
      }
      setZebraMsg('Standard-Zebra-Drucker gespeichert.')
    } finally {
      setZebraBusy(false)
    }
  }, [zebraPaired, zebraSelectedId])

  const handleZebraPrint = useCallback(async () => {
    setZebraMsg('')
    setZebraBusy(true)
    try {
      const payload = buildZebraPayload()
      let zpl: string
      try {
        zpl = buildZplFromPayloadV1(payload)
      } catch (e) {
        setZebraMsg(e instanceof Error ? e.message : 'ZPL konnte nicht erzeugt werden.')
        return
      }
      const sel = zebraSelectedId ? zebraPaired.find((p) => p.id === zebraSelectedId) : undefined
      const printOptions = sel != null ? { target: sel, timeoutMs: 20_000 } : { timeoutMs: 20_000 }
      const r = await ZebraLabelPrinter.printLabel({
        payload,
        zpl,
        printOptions,
      })
      if (!r.ok) {
        setZebraMsg(mapZebraPluginCodeToUiMessage(r.error.code, r.error.details))
        return
      }
      setZebraMsg(`Zebra-Druck gesendet (${r.meta?.bytesSent ?? '?'} Bytes).`)
    } finally {
      setZebraBusy(false)
    }
  }, [buildZebraPayload, zebraPaired, zebraSelectedId])

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal
      aria-label="QR-Code für Tür/Tor"
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-sm w-full min-w-0"
        onClick={(e) => e.stopPropagation()}
        role="document"
      >
        <div className="p-4 flex flex-col items-center">
          <h3 className="text-lg font-bold text-slate-800 mb-2">QR-Code</h3>
          <p className="text-sm text-slate-600 mb-3 truncate w-full text-center">
            {displayName}
          </p>
          <div
            ref={printRef}
            className="print-content bg-white p-4 rounded-lg border border-slate-200 flex flex-col items-center print:border-0 print:p-0"
          >
            <div className="hidden print:flex print:justify-center print:mb-2">
              {logoSrc ? (
                <img src={logoSrc} alt={brandLine} className="h-10 object-contain max-w-[200px]" />
              ) : null}
            </div>
            <QRCodeCanvas
              value={url}
              size={200}
              level="M"
              includeMargin
              className="print:block"
              aria-hidden
            />
            <p className="mt-3 text-sm font-medium text-slate-800">
              {displayName}
            </p>
            <p className="text-xs text-slate-500">
              {customerName} · {bvName}
            </p>
            {object.room && (
              <p className="text-xs text-slate-500">{object.room}</p>
            )}
          </div>
          {btStatus === 'error' && (
            <p className="mt-2 text-sm text-red-600 text-center" role="alert">
              {btMessage}
            </p>
          )}
          {btStatus === 'connecting' && (
            <p className="mt-2 text-sm text-slate-600 text-center">{btMessage}</p>
          )}
          {btStatus === 'printing' && (
            <p className="mt-2 text-sm text-slate-600 text-center">{btMessage}</p>
          )}
          {btStatus === 'done' && (
            <p className="mt-2 text-sm text-green-600 text-center">{btMessage}</p>
          )}

          {zebraUiPhase === 'ready' && (
            <div className="mt-4 w-full border-t border-slate-200 dark:border-slate-600 pt-3 text-left space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Zebra ZQ220 (Test, Android)
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleZebraLoadPaired()}
                  disabled={zebraBusy}
                  className="text-xs py-1.5 px-2 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-600 disabled:opacity-50"
                >
                  Gekoppelte laden
                </button>
                <button
                  type="button"
                  onClick={() => void handleZebraSetDefault()}
                  disabled={zebraBusy || zebraPaired.length === 0 || !zebraSelectedId}
                  className="text-xs py-1.5 px-2 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-600 disabled:opacity-50"
                >
                  Als Standard
                </button>
                <button
                  type="button"
                  onClick={() => void handleZebraPrint()}
                  disabled={zebraBusy}
                  className="text-xs py-1.5 px-2 rounded-md bg-emerald-700 text-white border border-emerald-800 disabled:opacity-50"
                >
                  Zebra drucken
                </button>
              </div>
              {zebraPaired.length > 0 && (
                <label className="block text-xs text-slate-600 dark:text-slate-400">
                  <span className="sr-only">Zebra-Drucker wählen</span>
                  <select
                    className="mt-1 w-full text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1"
                    value={zebraSelectedId}
                    onChange={(e) => setZebraSelectedId(e.target.value)}
                    disabled={zebraBusy}
                  >
                    {zebraPaired.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.displayName} ({p.native.opaque})
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {zebraMsg ? (
                <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap" role="status">
                  {zebraMsg}
                </p>
              ) : null}
            </div>
          )}

          <div className="mt-4 flex flex-col sm:flex-row gap-2 w-full">
            {isWebBluetoothSupported() && (
              <button
                type="button"
                onClick={handleBluetoothPrint}
                disabled={btStatus === 'connecting' || btStatus === 'printing'}
                className="flex-1 py-2 bg-vico-primary text-white rounded-lg hover:bg-vico-primary-hover font-medium border border-slate-700 disabled:opacity-50"
                aria-label="Via Bluetooth drucken"
              >
                {btStatus === 'connecting' || btStatus === 'printing'
                  ? '…'
                  : 'Bluetooth drucken'}
              </button>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 py-2 bg-vico-button dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg hover:bg-vico-button-hover dark:hover:bg-slate-600 font-medium border border-slate-300 dark:border-slate-600"
              aria-label="QR-Code drucken"
            >
              Drucken
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              aria-label="Schließen"
            >
              Schließen
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ObjectQRCodeModal
