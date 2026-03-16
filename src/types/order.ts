export type OrderType = 'wartung' | 'reparatur' | 'montage' | 'sonstiges'
export type OrderStatus = 'offen' | 'in_bearbeitung' | 'erledigt' | 'storniert'

export type Order = {
  id: string
  customer_id: string
  bv_id: string
  object_id: string | null
  order_date: string
  order_time: string | null
  order_type: OrderType
  status: OrderStatus
  description: string | null
  assigned_to: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type OrderFormData = {
  customer_id: string
  bv_id: string
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
  unterschrift_mitarbeiter_path: string | null
  unterschrift_mitarbeiter_name: string | null
  unterschrift_mitarbeiter_date: string | null
  unterschrift_kunde_path: string | null
  unterschrift_kunde_name: string | null
  unterschrift_kunde_date: string | null
  created_at: string
  updated_at: string
}
