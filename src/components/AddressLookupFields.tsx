import { useState, useCallback, useRef, useEffect } from 'react'
import { lookupPlz, searchStreets } from '../lib/addressLookupService'

type AddressLookupFieldsProps = {
  street: string
  houseNumber: string
  postalCode: string
  city: string
  onStreetChange: (v: string) => void
  onHouseNumberChange: (v: string) => void
  onPostalCodeChange: (v: string) => void
  onCityChange: (v: string) => void
  streetId?: string
  houseNumberId?: string
  postalCodeId?: string
  cityId?: string
  streetLabel?: string
  houseNumberLabel?: string
  postalCodeLabel?: string
  cityLabel?: string
}

const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debouncedValue
}

const inputClass =
  'w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-vico-primary'

export const AddressLookupFields = ({
  street,
  houseNumber,
  postalCode,
  city,
  onStreetChange,
  onHouseNumberChange,
  onPostalCodeChange,
  onCityChange,
  streetId = 'street',
  houseNumberId = 'house_number',
  postalCodeId = 'postal_code',
  cityId = 'city',
  streetLabel = 'Straße',
  houseNumberLabel = 'Hausnummer',
  postalCodeLabel = 'PLZ',
  cityLabel = 'Ort',
}: AddressLookupFieldsProps) => {
  const [isPlzLoading, setIsPlzLoading] = useState(false)
  const [streetSuggestions, setStreetSuggestions] = useState<string[]>([])
  const [showStreetSuggestions, setShowStreetSuggestions] = useState(false)
  const [isStreetLoading, setIsStreetLoading] = useState(false)
  const streetInputRef = useRef<HTMLInputElement>(null)

  const debouncedStreet = useDebounce(street, 400)
  const plzReady = postalCode.replace(/\D/g, '').trim().length === 5

  const handlePlzBlur = useCallback(async () => {
    const clean = postalCode.replace(/\D/g, '').trim()
    if (clean.length !== 5) return
    setIsPlzLoading(true)
    try {
      const result = await lookupPlz(clean)
      if (result) onCityChange(result)
    } finally {
      setIsPlzLoading(false)
    }
  }, [postalCode, onCityChange])

  useEffect(() => {
    if (debouncedStreet.length < 1 || !plzReady) {
      setStreetSuggestions([])
      setShowStreetSuggestions(false)
      return
    }
    let cancelled = false
    const run = async () => {
      setIsStreetLoading(true)
      try {
        const results = await searchStreets(debouncedStreet, postalCode)
        if (!cancelled) {
          setStreetSuggestions(results)
          setShowStreetSuggestions(results.length > 0)
        }
      } finally {
        if (!cancelled) setIsStreetLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [debouncedStreet, plzReady, postalCode])

  const handleStreetSelect = useCallback(
    (s: string) => {
      onStreetChange(s)
      setShowStreetSuggestions(false)
      streetInputRef.current?.focus()
    },
    [onStreetChange]
  )

  const handleStreetBlur = useCallback(() => {
    setTimeout(() => setShowStreetSuggestions(false), 200)
  }, [])

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor={postalCodeId} className="block text-sm font-medium text-slate-700 mb-1">
            {postalCodeLabel}
          </label>
          <input
            id={postalCodeId}
            type="text"
            inputMode="numeric"
            maxLength={5}
            value={postalCode}
            onChange={(e) => onPostalCodeChange(e.target.value.replace(/\D/g, '').slice(0, 5))}
            onBlur={handlePlzBlur}
            className={inputClass}
            placeholder="12345"
            aria-label={postalCodeLabel}
          />
          {isPlzLoading && (
            <p className="mt-1 text-xs text-slate-500">Ort wird ermittelt…</p>
          )}
        </div>
        <div>
          <label htmlFor={cityId} className="block text-sm font-medium text-slate-700 mb-1">
            {cityLabel}
          </label>
          <input
            id={cityId}
            type="text"
            value={city}
            onChange={(e) => onCityChange(e.target.value)}
            className={inputClass}
            placeholder={plzReady ? 'Wird aus PLZ ermittelt' : 'Zuerst PLZ eingeben'}
            aria-label={cityLabel}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="relative">
          <label htmlFor={streetId} className="block text-sm font-medium text-slate-700 mb-1">
            {streetLabel}
          </label>
          <input
            ref={streetInputRef}
            id={streetId}
            type="text"
            value={street}
            onChange={(e) => onStreetChange(e.target.value)}
            onBlur={handleStreetBlur}
            className={inputClass}
            autoComplete="street-address"
            placeholder={
              !plzReady
                ? 'Zuerst PLZ eingeben'
                : 'Min. 1 Buchstabe für Vorschläge'
            }
            aria-label={streetLabel}
            aria-autocomplete="list"
            aria-controls={showStreetSuggestions ? 'street-suggestions' : undefined}
            aria-expanded={showStreetSuggestions}
          />
          {showStreetSuggestions && streetSuggestions.length > 0 && (
            <ul
              id="street-suggestions"
              className="absolute z-[100] mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
              role="listbox"
            >
              {streetSuggestions.map((s) => (
                <li
                  key={s}
                  role="option"
                  tabIndex={0}
                  className="px-3 py-2 text-sm cursor-pointer hover:bg-slate-100 first:rounded-t-lg last:rounded-b-lg"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    handleStreetSelect(s)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleStreetSelect(s)
                    }
                  }}
                >
                  {s}
                </li>
              ))}
            </ul>
          )}
          {isStreetLoading && (
            <span className="absolute right-3 top-9 text-xs text-slate-400">…</span>
          )}
        </div>
        <div>
          <label htmlFor={houseNumberId} className="block text-sm font-medium text-slate-700 mb-1">
            {houseNumberLabel}
          </label>
          <input
            id={houseNumberId}
            type="text"
            value={houseNumber}
            onChange={(e) => onHouseNumberChange(e.target.value)}
            className={inputClass}
            aria-label={houseNumberLabel}
          />
        </div>
      </div>
    </>
  )
}
