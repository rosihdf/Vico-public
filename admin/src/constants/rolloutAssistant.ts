import type { ReleaseChannel } from '../lib/mandantenReleaseService'

/** D2: feste Reihenfolge bei Mehrkanal-Läufen */
export const CHANNEL_EXECUTION_ORDER: ReleaseChannel[] = ['main', 'kundenportal', 'arbeitszeit_portal']

/** D6: Zusatzbestätigung bei „Alle Mandanten“ ab dieser Anzahl */
export const MIN_TENANTS_BULK_CONFIRM_ALL = 10

/** D5: Vorschau-Tabelle (Rollback) – Zeilen pro Seite */
export const ROLLOUT_PREVIEW_PAGE_SIZE = 20
