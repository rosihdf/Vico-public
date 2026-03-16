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
  location_start_lat?: number | null
  location_start_lon?: number | null
  location_end_lat?: number | null
  location_end_lon?: number | null
}

export type TimeBreak = {
  id: string
  time_entry_id: string
  start: string
  end: string | null
  created_at: string
}

export type TimeEntryEditLogEntry = {
  id: string
  time_entry_id: string
  edited_by: string
  edited_at: string
  reason: string
  reason_code: string | null
  old_start: string
  old_end: string | null
  new_start: string
  new_end: string | null
}

export type TimeEntryEditLogRow = TimeEntryEditLogEntry & {
  entry_user_id: string
  entry_date: string
  editor_display_name: string | null
}
