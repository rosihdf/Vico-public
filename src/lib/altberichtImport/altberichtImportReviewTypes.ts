/**
 * Paket B: Review-Status und Patch-Typen (ohne Produktiv-Commit).
 */

export type AltberichtImportReviewStatus =
  | 'draft'
  | 'needs_input'
  | 'ready'
  | 'blocked'
  | 'skipped'
  | 'committed'

export const ALTBERICHT_STAGING_VALIDATION_CODES = {
  MISSING_BV: 'missing_bv',
  MISSING_OBJECT_NAME: 'missing_object_name',
  MISSING_OBJECT_TYPE: 'missing_object_type',
  MISSING_LOCATION: 'missing_location',
} as const

export type AltberichtStagingValidationCode =
  (typeof ALTBERICHT_STAGING_VALIDATION_CODES)[keyof typeof ALTBERICHT_STAGING_VALIDATION_CODES]

export type AltberichtStagingValidationError = {
  code: AltberichtStagingValidationCode | string
  message: string
}

/** Minimale Zeilenform für reine Validierung (DB- oder Merge-Zustand). */
export type AltberichtStagingRowInput = {
  bv_id: string | null
  object_name: string
  object_type_text: string
  floor_text: string | null
  room_text: string | null
  review_bv_id: string | null
  review_object_name: string | null
  review_object_type_text: string | null
  review_floor_text: string | null
  review_room_text: string | null
  /** Gesetzte Produktiv-Objekt-ID im Review (Commit auf bestehendes Objekt). */
  review_object_id?: string | null
  review_status: string
}

export type AltberichtStagingReviewPatch = {
  review_customer_id?: string | null
  review_bv_id?: string | null
  /** Explizite Zuordnung zu bestehendem Produktiv-Objekt (Paket C1 / Review). */
  review_object_id?: string | null
  review_object_name?: string | null
  review_object_type_text?: string | null
  review_floor_text?: string | null
  review_room_text?: string | null
  review_location_rule?: 'floor' | 'room' | 'unknown' | null
  /** Explizite Review-Transitions (z. B. blockieren, überspringen, entblocken). */
  review_status?: AltberichtImportReviewStatus
  review_blocked_reason?: string | null
  /**
   * Parser-Mängel (findings_json). Nach C1-Commit nur als findings-only-Patch erlaubt.
   * Änderungen setzen C2-Import-Markierungen zurück, wenn sich der Inhalt gegenüber der Zeile ändert.
   */
  findings_json?: unknown
}
