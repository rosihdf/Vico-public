export type OrderType = 'wartung' | 'reparatur' | 'montage' | 'sonstiges'
export type OrderStatus = 'offen' | 'in_bearbeitung' | 'erledigt' | 'storniert'

export type Order = {
  id: string
  customer_id: string
  bv_id: string
  object_id: string | null
  order_date: string
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
