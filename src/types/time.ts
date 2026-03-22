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
  approval_status?: 'submitted' | 'approved' | 'rejected' | null
  approved_by?: string | null
  approved_at?: string | null
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
  /** null bei manuellem Neuanlage-Eintrag (Arbeitszeit-Portal) */
  old_start: string | null
  old_end: string | null
  new_start: string
  new_end: string | null
}

/** Zeile aus get_time_entry_edit_log (RPC) für LOG-Übersicht */
export type TimeEntryEditLogRow = TimeEntryEditLogEntry & {
  entry_user_id: string
  entry_date: string
  editor_display_name: string | null
}
