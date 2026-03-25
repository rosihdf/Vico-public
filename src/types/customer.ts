export type Customer = {
  id: string
  name: string
  street: string | null
  house_number: string | null
  postal_code: string | null
  city: string | null
  email: string | null
  phone: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  maintenance_report_email: boolean
  maintenance_report_email_address: string | null
  /** true: Monteursbericht nur intern (PDF am Auftrag/Tür-Tor), kein E-Mail- und kein Portal-Versand */
  monteur_report_internal_only: boolean
  /** false: nie Kundenportal für Monteursberichte dieses Kunden (auch wenn Firmen-Einstellung Portal) */
  monteur_report_portal: boolean
  demo_user_id?: string | null
  /** gesetzt = aus Stammdaten-Listen ausgeblendet; Historie (Aufträge, Protokolle) bleibt erhalten */
  archived_at?: string | null
  created_at: string
  updated_at: string
}

export type CustomerFormData = {
  name: string
  street: string
  house_number: string
  postal_code: string
  city: string
  email: string
  phone: string
  contact_name: string
  contact_email: string
  contact_phone: string
  maintenance_report_email: boolean
  maintenance_report_email_address: string
  monteur_report_internal_only: boolean
  monteur_report_portal: boolean
}
