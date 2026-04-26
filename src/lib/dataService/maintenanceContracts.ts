import { supabase } from '../../supabase'
import type { MaintenanceContract } from '../../types'
import { MAINTENANCE_CONTRACT_COLUMNS } from '../dataColumns'
import { isOnline } from '../../../shared/networkUtils'

export const fetchMaintenanceContractsByCustomer = async (customerId: string): Promise<MaintenanceContract[]> => {
  if (!isOnline()) return []
  const { data, error } = await supabase
    .from('maintenance_contracts')
    .select(MAINTENANCE_CONTRACT_COLUMNS)
    .eq('customer_id', customerId)
    .is('bv_id', null)
    .order('start_date', { ascending: false })
  if (error) return []
  return (data ?? []) as MaintenanceContract[]
}

export const fetchMaintenanceContractsByBv = async (bvId: string): Promise<MaintenanceContract[]> => {
  if (!isOnline()) return []
  const { data, error } = await supabase
    .from('maintenance_contracts')
    .select(MAINTENANCE_CONTRACT_COLUMNS)
    .eq('bv_id', bvId)
    .order('start_date', { ascending: false })
  if (error) return []
  return (data ?? []) as MaintenanceContract[]
}

export const createMaintenanceContract = async (
  payload: { customer_id?: string | null; bv_id?: string | null; contract_number: string; start_date: string; end_date?: string | null }
): Promise<{ data: MaintenanceContract | null; error: { message: string } | null }> => {
  const full = {
    ...payload,
    customer_id: payload.customer_id ?? null,
    bv_id: payload.bv_id ?? null,
    end_date: payload.end_date?.trim() || null,
    updated_at: new Date().toISOString(),
  }
  if (isOnline()) {
    const { data, error } = await supabase.from('maintenance_contracts').insert(full).select(MAINTENANCE_CONTRACT_COLUMNS).single()
    return { data: data ? (data as unknown as MaintenanceContract) : null, error: error ? { message: error.message } : null }
  }
  return { data: null, error: { message: 'Offline: Wartungsverträge nur online anlegbar.' } }
}

export const updateMaintenanceContract = async (
  id: string,
  payload: Partial<{ contract_number: string; start_date: string; end_date: string | null }>
): Promise<{ error: { message: string } | null }> => {
  const full = { ...payload, id, updated_at: new Date().toISOString() }
  if (isOnline()) {
    const { error } = await supabase.from('maintenance_contracts').update(full).eq('id', id)
    return { error: error ? { message: error.message } : null }
  }
  return { error: { message: 'Offline: Wartungsverträge nur online bearbeitbar.' } }
}

export const deleteMaintenanceContract = async (id: string): Promise<{ error: { message: string } | null }> => {
  if (isOnline()) {
    const { error } = await supabase.from('maintenance_contracts').delete().eq('id', id)
    return { error: error ? { message: error.message } : null }
  }
  return { error: { message: 'Offline: Wartungsverträge nur online löschbar.' } }
}
