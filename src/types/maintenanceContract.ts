export type MaintenanceContract = {
  id: string
  customer_id: string | null
  bv_id: string | null
  contract_number: string
  start_date: string
  end_date: string | null
  created_at: string
  updated_at: string
}

export type MaintenanceContractFormData = {
  contract_number: string
  start_date: string
  end_date: string
}
