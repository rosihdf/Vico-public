import { supabase } from './supabase'

export type RoadmapStatus = 'idea' | 'planned' | 'in_progress' | 'blocked' | 'done'
export type RoadmapPriority = 'p0' | 'p1' | 'p2' | 'p3' | null
export type RoadmapScope = 'global' | 'pilot' | 'tenant'
export type RoadmapChannel = 'all' | 'main' | 'kundenportal' | 'arbeitszeit_portal'

export type RoadmapItem = {
  id: string
  tenant_id: string | null
  title: string
  wp_id: string | null
  status: RoadmapStatus
  priority: RoadmapPriority
  target_channel: RoadmapChannel
  scope: RoadmapScope
  beta_feedback_id: string | null
  public_note: string | null
  internal_note: string | null
  created_at: string
  updated_at: string
  tenants: { name: string } | null
}

export type RoadmapItemInsert = {
  tenant_id: string | null
  title: string
  wp_id: string | null
  status: RoadmapStatus
  priority: RoadmapPriority
  target_channel: RoadmapChannel
  scope: RoadmapScope
  beta_feedback_id: string | null
  public_note: string | null
  internal_note: string | null
}

export const fetchRoadmapItems = async (tenantId: string | 'all', status: RoadmapStatus | 'all') => {
  let q = supabase
    .from('roadmap_items')
    .select('*, tenants(name)')
    .order('created_at', { ascending: false })
    .limit(500)
  if (tenantId !== 'all') q = q.eq('tenant_id', tenantId)
  if (status !== 'all') q = q.eq('status', status)
  const { data, error } = await q
  if (error) return { rows: [] as RoadmapItem[], error: error.message }
  return { rows: (data ?? []) as RoadmapItem[] }
}

export const createRoadmapItem = async (payload: RoadmapItemInsert) => {
  const { error } = await supabase.from('roadmap_items').insert({
    ...payload,
    updated_at: new Date().toISOString(),
  })
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}

export const updateRoadmapItem = async (id: string, payload: Partial<RoadmapItemInsert>) => {
  const { error } = await supabase
    .from('roadmap_items')
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}

