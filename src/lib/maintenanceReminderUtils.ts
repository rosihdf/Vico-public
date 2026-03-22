import type { MaintenanceReminder } from '../types'

/** Filter für die Wartungsliste (Dashboard / später wiederverwendbar). */
export type MaintenanceReminderDashboardFilter = 'all' | 'overdue' | 'due7' | 'due30'

export const MAINTENANCE_REMINDER_FILTER_LABELS: Record<MaintenanceReminderDashboardFilter, string> = {
  all: 'Alle',
  overdue: 'Überfällig',
  due7: '≤ 7 Tage',
  due30: '≤ 30 Tage',
}

/** Liegt die Erinnerung in „Fällig innerhalb maxDays“ (inkl. überfällig)? */
export const isMaintenanceReminderDueWithinDays = (r: MaintenanceReminder, maxDays: number): boolean => {
  if (r.status === 'overdue') return true
  if (r.days_until_due == null) return false
  return r.days_until_due <= maxDays
}

export const filterMaintenanceRemindersForDashboard = (
  list: MaintenanceReminder[],
  filter: MaintenanceReminderDashboardFilter
): MaintenanceReminder[] => {
  if (filter === 'all') return list
  if (filter === 'overdue') return list.filter((r) => r.status === 'overdue')
  if (filter === 'due7') return list.filter((r) => isMaintenanceReminderDueWithinDays(r, 7))
  return list.filter((r) => isMaintenanceReminderDueWithinDays(r, 30))
}

/** Anzahl für Badge: überfällig oder fällig innerhalb `withinDays` (Standard Navigation). */
export const countMaintenanceRemindersNeedingAttention = (
  list: MaintenanceReminder[],
  withinDays = 7
): number => list.filter((r) => isMaintenanceReminderDueWithinDays(r, withinDays)).length

export const countMaintenanceRemindersByFilter = (
  list: MaintenanceReminder[],
  filter: MaintenanceReminderDashboardFilter
): number => filterMaintenanceRemindersForDashboard(list, filter).length
