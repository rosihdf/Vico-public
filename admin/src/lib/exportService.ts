import { supabase } from './supabase'

export type TenantExport = {
  exported_at: string
  tenant: Record<string, unknown> | null
  licenses: Record<string, unknown>[]
  limit_exceeded_log: Record<string, unknown>[]
}

export const exportTenantData = async (tenantId: string): Promise<TenantExport> => {
  const [tenantRes, licensesRes, logRes] = await Promise.all([
    supabase.from('tenants').select('*').eq('id', tenantId).single(),
    supabase.from('licenses').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
    supabase.from('limit_exceeded_log').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
  ])
  const payload: TenantExport = {
    exported_at: new Date().toISOString(),
    tenant: tenantRes.data as Record<string, unknown> | null,
    licenses: (licensesRes.data ?? []) as Record<string, unknown>[],
    limit_exceeded_log: (logRes.data ?? []) as Record<string, unknown>[],
  }
  return payload
}

export const downloadTenantExport = (tenantName: string, data: TenantExport) => {
  const sanitized = tenantName.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 50)
  const date = new Date().toISOString().slice(0, 10)
  const filename = `vico-export-${sanitized}-${date}.json`
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
