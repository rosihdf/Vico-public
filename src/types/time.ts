export type TimeEntry = {
  id: string
  user_id: string
  date: string
  start: string
  end: string | null
  notes: string | null
  order_id: string | null
  created_at: string
  updated_at: string
}

export type TimeBreak = {
  id: string
  time_entry_id: string
  start: string
  end: string | null
  created_at: string
}
