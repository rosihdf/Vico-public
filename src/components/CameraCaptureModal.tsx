import { useEffect, useRef, useState, useCallback } from 'react'

export type CameraCaptureModalProps = {
  open: boolean
  onClose: () => void
  /** Liefert true, wenn die Datei übernommen wurde (Modal schließt nur bei true). */
  onCapture: (file: File) => boolean | Promise<boolean>
  title?: string
}

/**
 * Öffnet die Gerätekamera, zeigt Live-Vorschau, Auslösen erzeugt ein JPEG und ruft onCapture auf.
 */
const CameraCaptureModal = ({
  open,
  onClose,
  onCapture,
  title = 'Foto aufnehmen',
}: CameraCaptureModalProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isShuttering, setIsShuttering] = useState(false)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  useEffect(() => {
    if (!open) {
      stopStream()
      setStreamError(null)
      setIsReady(false)
      return
    }

    let cancelled = false
    setStreamError(null)
    setIsReady(false)

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) setStreamError('Kamera wird in diesem Browser nicht unterstützt.')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const el = videoRef.current
        if (el) {
          el.srcObject = stream
          await el.play().catch(() => {})
        }
        if (!cancelled) setIsReady(true)
      } catch {
        if (!cancelled) {
          setStreamError(
            'Kamera konnte nicht geöffnet werden. Bitte Berechtigung erteilen oder ein Foto über „Hochladen“ hinzufügen.'
          )
        }
      }
    }

    void start()

    return () => {
      cancelled = true
      stopStream()
    }
  }, [open, stopStream])

  const handleClose = useCallback(() => {
    stopStream()
    onClose()
  }, [stopStream, onClose])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, handleClose])

  const handleCapture = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.videoWidth === 0 || isShuttering) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)

    setIsShuttering(true)
    canvas.toBlob(
      async (blob) => {
        try {
          if (!blob) {
            setIsShuttering(false)
            return
          }
          const file = new File([blob], `tuer-tor-${Date.now()}.jpg`, { type: 'image/jpeg' })
          const ok = await Promise.resolve(onCapture(file))
          if (ok) handleClose()
        } finally {
          setIsShuttering(false)
        }
      },
      'image/jpeg',
      0.92
    )
  }

  const handleCaptureKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    handleCapture()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      onClick={handleClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-lg w-full min-w-0 p-4 border border-slate-200 dark:border-slate-600"
        role="dialog"
        aria-modal
        aria-labelledby="camera-capture-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="camera-capture-title" className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3">
          {title}
        </h3>

        {streamError ? (
          <p className="text-sm text-red-600 dark:text-red-400 mb-4" role="alert">
            {streamError}
          </p>
        ) : (
          <div className="rounded-lg overflow-hidden bg-black aspect-[4/3] mb-4">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              aria-label="Kameravorschau"
            />
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" aria-hidden />

        <div className="flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            aria-label="Abbrechen"
          >
            Abbrechen
          </button>
          {!streamError && (
            <button
              type="button"
              onClick={handleCapture}
              onKeyDown={handleCaptureKeyDown}
              disabled={!isReady || isShuttering}
              className="px-4 py-2 rounded-lg bg-vico-primary text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              aria-label="Foto aufnehmen und übernehmen"
            >
              {isShuttering ? 'Speichern…' : 'Aufnehmen'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default CameraCaptureModal
