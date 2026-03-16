import { useRef, useEffect, useState, useCallback } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import WebBluetoothReceiptPrinter from '@point-of-sale/webbluetooth-receipt-printer'
import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder'
const LOGO_SRC = '/logo_vico.png'
import type { Object as Obj } from './types'
import { getObjectDisplayName } from './lib/objectUtils'

type ObjectQRCodeModalProps = {
  object: Obj
  customerName: string
  bvName: string
  customerId: string
  bvId: string | null
  onClose: () => void
}

const getObjectUrl = (customerId: string, bvId: string | null, objectId: string): string => {
  const base = (window.location.origin + (import.meta.env.BASE_URL || '/')).replace(/\/$/, '')
  if (bvId) return `${base}/kunden?customerId=${customerId}&bvId=${bvId}&objectId=${objectId}`
  return `${base}/kunden?customerId=${customerId}&objectId=${objectId}`
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
  const printRef = useRef<HTMLDivElement>(null)
  const [btStatus, setBtStatus] = useState<'idle' | 'connecting' | 'printing' | 'done' | 'error'>('idle')
  const [btMessage, setBtMessage] = useState<string>('')

  const url = getObjectUrl(customerId, bvId, object.id)
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
          .line('Vico Türen & Tore')
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
  }, [url, customerName, bvName, displayName, roomInfo])

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
        className="bg-white rounded-xl shadow-xl max-w-sm w-full"
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
              <img src={LOGO_SRC} alt="Vico" className="h-10 object-contain" />
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
              className="flex-1 py-2 bg-vico-button text-slate-800 rounded-lg hover:bg-vico-button-hover font-medium border border-slate-300"
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
