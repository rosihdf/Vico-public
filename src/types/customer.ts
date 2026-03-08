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
  demo_user_id?: string | null
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
}
