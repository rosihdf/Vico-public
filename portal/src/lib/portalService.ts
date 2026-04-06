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
  pruefprotokoll_pdf_path: string | null
  created_at: string
  object_name: string | null
  object_internal_id: string | null
  object_floor: string | null
  object_room: string | null
  bv_name: string | null
  customer_name: string | null
}

export type PortalOrderTimelineSettings = {
  portal_timeline_show_planned: boolean
  portal_timeline_show_termin: boolean
  portal_timeline_show_in_progress: boolean
}

export type PortalOrderTimelineOrder = {
  id: string
  status: string
  order_type: string
  order_date: string | null
  order_time: string | null
  created_at: string
  updated_at: string
  object_names: string | null
}

export type PortalOrderTimelinePayload = {
  settings: PortalOrderTimelineSettings
  orders: PortalOrderTimelineOrder[]
}

export const DEFAULT_PORTAL_ORDER_TIMELINE_SETTINGS: PortalOrderTimelineSettings = {
  portal_timeline_show_planned: false,
  portal_timeline_show_termin: true,
  portal_timeline_show_in_progress: true,
}

export const fetchPortalOrderTimeline = async (userId: string): Promise<PortalOrderTimelinePayload> => {
  const { data, error } = await supabase.rpc('get_portal_order_timeline', { p_user_id: userId })
  if (error || data == null || typeof data !== 'object') {
    return { settings: DEFAULT_PORTAL_ORDER_TIMELINE_SETTINGS, orders: [] }
  }
  const raw = data as Record<string, unknown>
  const settingsRaw = raw.settings as Record<string, unknown> | undefined
  const settings: PortalOrderTimelineSettings = {
    portal_timeline_show_planned: Boolean(settingsRaw?.portal_timeline_show_planned),
    portal_timeline_show_termin: settingsRaw?.portal_timeline_show_termin !== false,
    portal_timeline_show_in_progress: settingsRaw?.portal_timeline_show_in_progress !== false,
  }
  const ordersRaw = raw.orders
  const orders: PortalOrderTimelineOrder[] = Array.isArray(ordersRaw)
    ? (ordersRaw as PortalOrderTimelineOrder[]).filter((o) => o && typeof o.id === 'string')
    : []
  return { settings, orders }
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

export const getPortalPruefprotokollPdfPath = async (reportId: string): Promise<string | null> => {
  const { data, error } = await supabase.rpc('get_portal_pruefprotokoll_pdf_path', {
    p_report_id: reportId,
  })
  if (error || !data) return null
  return data as string
}

/** Zeitlich begrenzte, signierte URL für sicheren PDF-Zugriff (5 Min. gültig). */
export const getPortalPdfSignedUrl = async (pdfPath: string): Promise<string | null> => {
  const { data, error } = await supabase.storage
    .from('maintenance-photos')
    .createSignedUrl(pdfPath, 300)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

export type PortalUserData = {
  email: string
  customer_names: string[]
}

export const fetchPortalUserData = async (userId: string): Promise<PortalUserData | null> => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .single()

  const { data: portalEntries } = await supabase
    .from('customer_portal_users')
    .select('customer_id, customers(name)')
    .eq('user_id', userId)

  const customerNames: string[] = (portalEntries ?? []).flatMap(
    (e: { customers?: unknown }): string[] => {
      const c = e.customers as { name: string } | { name: string }[] | null
      if (!c) return []
      const names = Array.isArray(c) ? c : [c]
      return names.map((n) => n?.name).filter((n): n is string => Boolean(n))
    }
  )

  if (!profile) return null
  return {
    email: profile.email ?? '',
    customer_names: [...new Set(customerNames)],
  }
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
