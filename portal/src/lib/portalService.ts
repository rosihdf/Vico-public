import { supabase } from './supabase'

export type PortalReport = {
  report_id: string
  object_id: string
  maintenance_date: string
  maintenance_time: string | null
  reason: string | null
  reason_other: string | null
  manufacturer_maintenance_done: boolean
  hold_open_checked: boolean | null
  deficiencies_found: boolean
  deficiency_description: string | null
  urgency: string | null
  fixed_immediately: boolean
  pdf_path: string | null
  created_at: string
  object_name: string | null
  object_internal_id: string | null
  object_floor: string | null
  object_room: string | null
  bv_name: string | null
  customer_name: string | null
}

export const fetchPortalReports = async (userId: string): Promise<PortalReport[]> => {
  const { data, error } = await supabase.rpc('get_portal_maintenance_reports', {
    p_user_id: userId,
  })
  if (error || !Array.isArray(data)) return []
  return data as PortalReport[]
}

export const getPortalPdfPath = async (reportId: string): Promise<string | null> => {
  const { data, error } = await supabase.rpc('get_portal_pdf_path', {
    p_report_id: reportId,
  })
  if (error || !data) return null
  return data as string
}

export const getPortalPdfUrl = (pdfPath: string): string => {
  const { data } = supabase.storage
    .from('maintenance-photos')
    .getPublicUrl(pdfPath)
  return data.publicUrl
}

export const requestMagicLink = async (
  email: string
): Promise<{ success: boolean; error?: string }> => {
  const { data, error } = await supabase.functions.invoke('request-portal-magic-link', {
    body: { email },
  })
  if (error) return { success: false, error: error.message }
  const bodyError = (data as { error?: string })?.error
  if (bodyError) return { success: false, error: bodyError }
  return { success: true }
}
