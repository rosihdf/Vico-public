import { useState, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'
import { getSupabaseErrorMessage } from './supabaseErrors'
import {
  fetchCustomers,
  fetchBvs,
  createCustomer,
  createBv,
} from './lib/dataService'
import { parseCsv } from './lib/csvParse'
import type { BV } from './types'
import { LoadingSpinner } from './components/LoadingSpinner'

const MAPPING_OPTIONS = [
  { value: '', label: '– Ignorieren' },
  { value: 'name', label: 'Firma' },
  { value: 'postal_code', label: 'PLZ' },
  { value: 'street', label: 'Straße' },
  { value: 'house_number', label: 'Hausnummer' },
  { value: 'city', label: 'Stadt' },
  { value: 'email', label: 'Mail' },
  { value: 'phone', label: 'Tel' },
  { value: 'contact_name', label: 'Ansprechpartner' },
  { value: 'bv_name', label: 'Objekt/BV' },
] as const

type MappingKey = (typeof MAPPING_OPTIONS)[number]['value']

const Import = () => {
  const { userRole } = useAuth()
  const { showError } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [columnMapping, setColumnMapping] = useState<Record<number, MappingKey>>({})
  const [createUnknownBv, setCreateUnknownBv] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<{
    customersCreated: number
    bvsCreated: number
    errors: { row: number; message: string }[]
  } | null>(null)

  const canWrite = userRole === 'admin' || userRole === 'mitarbeiter'

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setResult(null)
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      const { headers: h, rows: r } = parseCsv(text)
      setHeaders(h)
      setRows(r)
      setColumnMapping({})
    }
    reader.readAsText(f, 'UTF-8')
    e.target.value = ''
  }, [])

  const handleMappingChange = (colIndex: number, value: MappingKey) => {
    setColumnMapping((prev) => ({ ...prev, [colIndex]: value }))
  }

  const getRowValue = (row: string[], key: MappingKey): string => {
    const colIndex = Object.entries(columnMapping).find(([, v]) => v === key)?.[0]
    if (colIndex === undefined) return ''
    const val = row[Number(colIndex)]?.trim() ?? ''
    return val
  }

  const handleStartImport = async () => {
    if (!file || rows.length === 0) return
    const nameCol = Object.entries(columnMapping).find(([, v]) => v === 'name')?.[0]
    if (nameCol === undefined) {
      showError('Bitte mindestens die Spalte „Firma“ zuordnen.')
      return
    }
    setIsProcessing(true)
    setResult(null)
    const errors: { row: number; message: string }[] = []
    let customersCreated = 0
    let bvsCreated = 0

    const bvsByCustomerId = new Map<string, BV[]>()
    try {
      const customers = await fetchCustomers()
      for (const c of customers) {
        const list = await fetchBvs(c.id)
        bvsByCustomerId.set(c.id, list)
      }

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const rowNum = i + 2
        const name = getRowValue(row, 'name')
        if (!name) {
          errors.push({ row: rowNum, message: 'Firma fehlt' })
          continue
        }
        let customer = customers.find((c) => c.name.trim().toLowerCase() === name.toLowerCase())
        if (!customer) {
          const payload = {
            name,
            street: getRowValue(row, 'street') || null,
            house_number: getRowValue(row, 'house_number') || null,
            postal_code: getRowValue(row, 'postal_code') || null,
            city: getRowValue(row, 'city') || null,
            email: getRowValue(row, 'email') || null,
            phone: getRowValue(row, 'phone') || null,
            contact_name: getRowValue(row, 'contact_name') || null,
            contact_email: null,
            contact_phone: null,
            maintenance_report_email: true,
            maintenance_report_email_address: null,
          }
          const { data: newCustomer, error } = await createCustomer(payload)
          if (error) {
            errors.push({ row: rowNum, message: getSupabaseErrorMessage(error) })
            continue
          }
          if (newCustomer) {
            customer = newCustomer
            customers.push(customer)
            customersCreated++
            bvsByCustomerId.set(customer.id, [])
          }
        }
        if (!customer) continue

        const bvName = getRowValue(row, 'bv_name')
        if (bvName) {
          let bvList = bvsByCustomerId.get(customer.id) ?? []
          let bv = bvList.find((b) => b.name.trim().toLowerCase() === bvName.toLowerCase())
          if (!bv) {
            if (!createUnknownBv) {
              errors.push({ row: rowNum, message: `Objekt/BV „${bvName}“ nicht gefunden und Anlegen deaktiviert` })
              continue
            }
            const { data: newBv, error } = await createBv({
              customer_id: customer.id,
              name: bvName,
              street: null,
              house_number: null,
              postal_code: null,
              city: null,
              email: null,
              phone: null,
              contact_name: null,
              contact_email: null,
              contact_phone: null,
              maintenance_report_email: true,
              maintenance_report_email_address: null,
            })
            if (error) {
              errors.push({ row: rowNum, message: getSupabaseErrorMessage(error) })
              continue
            }
            if (newBv) {
              bv = newBv
              bvList = [...bvList, bv]
              bvsByCustomerId.set(customer.id, bvList)
              bvsCreated++
            }
          }
        }
      }

      setIsProcessing(false)
      setResult({ customersCreated, bvsCreated, errors })
    } catch {
      errors.push({ row: 0, message: 'Stammdaten konnten nicht geladen werden.' })
      setIsProcessing(false)
      setResult({ customersCreated: 0, bvsCreated: 0, errors })
    }
  }

  if (!canWrite) {
    return (
      <div className="p-4">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Import</h2>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Sie haben keine Berechtigung zum Import von Stammdaten.
        </p>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-3xl">
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Stammdaten importieren</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        CSV-Datei mit Kopfzeile hochladen und Spalten den Feldern zuordnen. Fehlerzeilen werden übersprungen und am Ende aufgelistet.
      </p>

      <div className="mt-6">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          CSV-Datei
        </label>
        <input
          type="file"
          accept=".csv,.txt"
          onChange={handleFileChange}
          className="w-full text-sm text-slate-600 file:mr-2 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-vico-button file:text-slate-800 hover:file:bg-vico-button-hover"
          aria-label="CSV-Datei auswählen"
        />
      </div>

      {headers.length > 0 && (
        <>
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Spaltenzuordnung</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
              Ordnen Sie jede Spalte einem Feld zu. Mindestens „Firma“ ist erforderlich.
            </p>
            <div className="space-y-2">
              {headers.map((header, colIndex) => (
                <div
                  key={colIndex}
                  className="flex flex-wrap items-center gap-2 py-2 border-b border-slate-200 dark:border-slate-600 last:border-0"
                >
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 min-w-[120px] truncate" title={header}>
                    {header || `Spalte ${colIndex + 1}`}
                  </span>
                  <select
                    value={columnMapping[colIndex] ?? ''}
                    onChange={(e) => handleMappingChange(colIndex, e.target.value as MappingKey)}
                    className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm"
                    aria-label={`${header || 'Spalte'} zuordnen`}
                  >
                    {MAPPING_OPTIONS.map((opt) => (
                      <option key={opt.value || 'ignore'} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={createUnknownBv}
                onChange={(e) => setCreateUnknownBv(e.target.checked)}
                className="rounded border-slate-300"
                aria-label="Unbekannte Objekte/BV anlegen"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                Unbekannte Objekte/BV anlegen (wenn Spalte „Objekt/BV“ zugeordnet ist)
              </span>
            </label>
          </div>

          <div className="mt-6 flex gap-2">
            <button
              type="button"
              onClick={handleStartImport}
              disabled={isProcessing || rows.length === 0}
              className="px-4 py-2.5 bg-vico-button text-slate-800 rounded-lg hover:bg-vico-button-hover font-medium border border-slate-300 disabled:opacity-50"
            >
              {isProcessing ? 'Import läuft…' : `Import starten (${rows.length} Zeilen)`}
            </button>
          </div>
        </>
      )}

      {isProcessing && (
        <div className="mt-4">
          <LoadingSpinner message="Import wird ausgeführt…" size="sm" />
        </div>
      )}

      {result && !isProcessing && (
        <div className="mt-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Ergebnis</h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {result.customersCreated} Kunden angelegt, {result.bvsCreated} Objekte/BV angelegt.
          </p>
          {result.errors.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                {result.errors.length} Fehler (Zeilen übersprungen):
              </p>
              <ul className="mt-2 max-h-48 overflow-y-auto space-y-1 text-sm text-slate-600 dark:text-slate-400">
                {result.errors.map((err, idx) => (
                  <li key={idx}>
                    Zeile {err.row}: {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Import
