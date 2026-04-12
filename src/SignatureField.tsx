import { useRef, useCallback } from 'react'
import SignatureCanvas from 'react-signature-canvas'

type SignatureFieldProps = {
  label: string
  value: string | null
  onChange: (dataUrl: string | null) => void
  disabled?: boolean
  printedName?: string
  onPrintedNameChange?: (name: string) => void
}

const SignatureField = ({ label, value: _value, onChange, disabled, printedName, onPrintedNameChange }: SignatureFieldProps) => {
  const padRef = useRef<SignatureCanvas>(null)

  const handleClear = useCallback(() => {
    padRef.current?.clear()
    onChange(null)
  }, [onChange])

  const handleEnd = useCallback(() => {
    if (padRef.current?.isEmpty()) {
      onChange(null)
      return
    }
    const dataUrl = padRef.current?.toDataURL('image/png') ?? null
    onChange(dataUrl)
  }, [onChange])

  return (
    <div className="min-w-0 w-full">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">{label}</label>
      <div
        className={`border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden bg-white dark:bg-slate-900 max-w-full ${disabled ? 'pointer-events-none opacity-60' : ''}`}
      >
        <SignatureCanvas
          ref={padRef}
          canvasProps={{
            className: 'w-full h-32 touch-none',
            style: { touchAction: 'none' },
          }}
          onEnd={handleEnd}
          penColor="black"
          backgroundColor="white"
        />
      </div>
      <button
        type="button"
        onClick={handleClear}
        disabled={disabled}
        className="mt-1 text-sm text-slate-600 hover:text-slate-800 disabled:opacity-50"
      >
        Löschen
      </button>
      {onPrintedNameChange !== undefined && (
        <input
          type="text"
          value={printedName ?? ''}
          onChange={(e) => onPrintedNameChange(e.target.value)}
          placeholder="Name in Druckschrift"
          disabled={disabled}
          className="mt-2 w-full min-w-0 max-w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 disabled:opacity-50"
          aria-label={`${label} – Name in Druckschrift`}
        />
      )}
    </div>
  )
}

export default SignatureField
