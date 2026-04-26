import { supabase } from '../../supabase'
import { isOnline } from '../../../shared/networkUtils'

export const fetchMaintenanceReportIdByOrderObject = async (
  orderId: string,
  objectId: string
): Promise<string | null> => {
  if (!isOnline()) return null
  const { data, error } = await supabase
    .from('maintenance_reports')
    .select('id')
    .eq('source_order_id', orderId)
    .eq('object_id', objectId)
    .maybeSingle()
  if (error || !data?.id) return null
  return String(data.id)
}

/** Für Prüfprotokoll-PDF: Report-UUID und laufende Nummer (nach Migration immer gesetzt). */
export const fetchMaintenanceReportPruefprotokollMetaForOrderObject = async (
  orderId: string,
  objectId: string
): Promise<{ id: string; pruefprotokoll_laufnummer: number | null } | null> => {
  if (!isOnline()) return null
  const { data, error } = await supabase
    .from('maintenance_reports')
    .select('id, pruefprotokoll_laufnummer')
    .eq('source_order_id', orderId)
    .eq('object_id', objectId)
    .maybeSingle()
  if (error || !data?.id) return null
  const n = data.pruefprotokoll_laufnummer
  const num = typeof n === 'number' ? n : n != null ? Number(n) : NaN
  if (!Number.isFinite(num) || num <= 0) return { id: String(data.id), pruefprotokoll_laufnummer: null }
  return { id: String(data.id), pruefprotokoll_laufnummer: Math.trunc(num) }
}

/** Gespeicherter Pfad zum Checklisten-Prüfprotokoll-PDF (Storage), falls vorhanden. */
export const fetchPruefprotokollPdfPathForOrderObject = async (
  orderId: string,
  objectId: string
): Promise<string | null> => {
  if (!isOnline()) return null
  const { data, error } = await supabase
    .from('maintenance_reports')
    .select('pruefprotokoll_pdf_path')
    .eq('source_order_id', orderId)
    .eq('object_id', objectId)
    .maybeSingle()
  if (error || !data?.pruefprotokoll_pdf_path) return null
  const p = String(data.pruefprotokoll_pdf_path).trim()
  return p || null
}
