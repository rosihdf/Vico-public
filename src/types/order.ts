export type OrderType = 'wartung' | 'reparatur' | 'montage' | 'sonstiges'
export type OrderStatus = 'offen' | 'in_bearbeitung' | 'erledigt' | 'storniert'
export type OrderBillingStatus = 'open' | 'prepared' | 'billed' | 'cancelled'

export type Order = {
  id: string
  customer_id: string
  bv_id: string | null
  /** Optionale Verknüpfung auf fachlich zusammenhängenden Auftrag (Modell C). */
  related_order_id?: string | null
  object_id: string | null
  /** Mehrere Türen/Tore (optional); object_id bleibt erste ID für Abwärtskompatibilität */
  object_ids?: string[] | null
  order_date: string
  order_time: string | null
  order_type: OrderType
  status: OrderStatus
  /** Optional: Zielbild für spätere Buchhaltungs-Schnittstelle. */
  billing_status?: OrderBillingStatus | null
  description: string | null
  assigned_to: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type OrderFormData = {
  customer_id: string
  bv_id: string | null
  object_id: string
  order_date: string
  order_type: OrderType
  status: OrderStatus
  description: string
  assigned_to: string
}

export type OrderCompletion = {
  id: string
  order_id: string
  ausgeführte_arbeiten: string | null
  material: string | null
  arbeitszeit_minuten: number | null
  completion_extra?: unknown | null
  monteur_pdf_path?: string | null
  unterschrift_mitarbeiter_path: string | null
  unterschrift_mitarbeiter_name: string | null
  unterschrift_mitarbeiter_date: string | null
  unterschrift_kunde_path: string | null
  unterschrift_kunde_name: string | null
  unterschrift_kunde_date: string | null
  created_at: string
  updated_at: string
}
