import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { supabase } from './supabase'

const OBJEKTE_PATH_REGEX = /\/kunden\/([a-f0-9-]+)\/bvs\/([a-f0-9-]+)\/objekte(\?.*)?$/i
const BVS_PATH_REGEX = /\/kunden\/([a-f0-9-]+)\/bvs\/?$/i
const UUID_REGEX = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i

const parseScannedContent = (raw: string): { path: string } | { customerId: string; bvId?: string; objectId?: string } | null => {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const pathForMatch = trimmed.startsWith('/') ? trimmed : `/${trimmed}`

  try {
    if (trimmed.startsWith('http')) {
      const url = new URL(trimmed)
      const pathMatch = url.pathname.match(OBJEKTE_PATH_REGEX)
      if (pathMatch) {
        const [, customerId, bvId] = pathMatch
        const objectId = url.searchParams.get('objectId') ?? undefined
        return { customerId, bvId, objectId }
      }
      if (url.pathname === '/kunden' || url.pathname.endsWith('/kunden')) {
        const customerId = url.searchParams.get('customerId')
        const bvId = url.searchParams.get('bvId') ?? undefined
        const objectId = url.searchParams.get('objectId') ?? undefined
        if (customerId) return { customerId, bvId, objectId }
      }
      const bvsMatch = url.pathname.match(BVS_PATH_REGEX)
      if (bvsMatch) {
        const [, customerId] = bvsMatch
        return { customerId, bvId: undefined, objectId: undefined }
      }
    }
  } catch {
    // Keine gültige URL
  }

  const objMatch = pathForMatch.match(OBJEKTE_PATH_REGEX)
  if (objMatch) {
    const [, customerId, bvId] = objMatch
    return { customerId, bvId }
  }
  const bvsMatch = pathForMatch.match(BVS_PATH_REGEX)
  if (bvsMatch) {
    const [, customerId] = bvsMatch
    return { customerId, bvId: undefined }
  }

  return { path: trimmed }
}

const Scan = () => {
  const navigate = useNavigate()
  const [status, setStatus] = useState<'idle' | 'requesting' | 'scanning' | 'scanned' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const lastScannedRef = useRef<string>('')

  const handleScanSuccess = async (decodedText: string) => {
    if (lastScannedRef.current === decodedText) return
    lastScannedRef.current = decodedText
    setStatus('scanned')

    const parsed = parseScannedContent(decodedText)
    if (!parsed) {
      setMessage('Unbekanntes Format. Erwarte: Kunden/BV/Objekte-Pfad oder Objekt-ID.')
      return
    }

    if ('path' in parsed) {
      const pathOrId = parsed.path
      if (!UUID_REGEX.test(pathOrId) && !pathOrId.trim()) {
        setMessage('Unbekannter Inhalt.')
        return
      }
      const { data, error } = await supabase.rpc('resolve_object_to_navigation', { identifier: pathOrId })
      if (error) {
        setMessage('Objekt-Suche fehlgeschlagen.')
        return
      }
      if (Array.isArray(data) && data.length > 0) {
        const row = data[0] as { customer_id: string; bv_id: string | null; object_id: string }
        const params = new URLSearchParams({ customerId: row.customer_id, objectId: row.object_id })
        if (row.bv_id) params.set('bvId', row.bv_id)
        navigate(`/kunden?${params.toString()}`)
      } else {
        setMessage('Objekt nicht gefunden.')
      }
      return
    }

    const { customerId, bvId, objectId } = parsed
    const params = new URLSearchParams()
    params.set('customerId', customerId)
    if (bvId) params.set('bvId', bvId)
    if (objectId) params.set('objectId', objectId)
    navigate(`/kunden?${params.toString()}`)
  }

  const handleStartScan = async () => {
    setCameraError(null)
    setMessage(null)
    setStatus('requesting')
    lastScannedRef.current = ''

    await new Promise((r) => setTimeout(r, 100))

    const qrEl = document.getElementById('qr-reader')
    if (!qrEl) return

    const scanner = new Html5Qrcode('qr-reader')
    scannerRef.current = scanner

    try {
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 5,
          qrbox: { width: 250, height: 250 },
        },
        handleScanSuccess,
        () => {}
      )
      setStatus('scanning')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setCameraError(msg)
      setStatus('error')
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop()
        } catch {
          // ignore
        }
        scannerRef.current = null
      }
    }
  }

  const handleStopScan = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
      } catch {
        // ignore
      }
      scannerRef.current = null
    }
    setStatus('idle')
    setMessage(null)
    setCameraError(null)
  }

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
        scannerRef.current = null
      }
    }
  }, [])

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold text-slate-800">QR-Scan</h2>
      <p className="mt-1 text-sm text-slate-600">
        Scanne einen Objekt-QR-Code, um direkt zum Objekt zu gelangen.
      </p>

      {status === 'idle' && (
        <button
          type="button"
          onClick={handleStartScan}
          className="mt-4 px-6 py-3 bg-vico-button text-slate-800 rounded-lg font-medium hover:bg-vico-button-hover border border-slate-300"
          aria-label="Kamera starten"
        >
          Kamera starten
        </button>
      )}

      <div
        ref={containerRef}
        className={`mt-4 space-y-3 ${status !== 'idle' && status !== 'error' ? '' : 'hidden'}`}
      >
        <div
          id="qr-reader"
          className="rounded-lg overflow-hidden border border-slate-200 bg-black min-h-[250px]"
          aria-label="QR-Code Scanner"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleStopScan}
            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 font-medium"
            aria-label="Scanner beenden"
          >
            Beenden
          </button>
        </div>
      </div>

      {status === 'error' && cameraError && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          <p className="font-medium">Kamera fehlgeschlagen</p>
          <p className="mt-1">{cameraError}</p>
          <p className="mt-2 text-slate-600">
            Stelle sicher, dass die Kamera freigegeben ist und die Seite über HTTPS läuft.
          </p>
        </div>
      )}

      {message && (
        <p className="mt-4 text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">{message}</p>
      )}
    </div>
  )
}

export default Scan
