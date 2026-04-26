/**
 * Stabile Event-Codes für altbericht_import_event (Paket A).
 */

export const ALTBERICHT_IMPORT_EVENT = {
  JOB_CREATED: 'import.job.created',
  JOB_UPLOADS_STARTED: 'import.job.uploads_started',
  JOB_UPLOADS_COMPLETED: 'import.job.uploads_completed',
  JOB_UPLOADS_FAILED: 'import.job.uploads_failed',
  UPLOAD_STARTED: 'import.upload.started',
  UPLOAD_SUCCEEDED: 'import.upload.succeeded',
  UPLOAD_FAILED: 'import.upload.failed',
  PARSER_STARTED: 'import.parser.started',
  PARSER_TEXT_EXTRACTED: 'import.parser.text_extracted',
  PARSER_SUCCEEDED: 'import.parser.succeeded',
  PARSER_FAILED: 'import.parser.failed',
  PARSER_STAGING_STARTED: 'import.parser.staging_started',
  PARSER_STAGING_SUCCEEDED: 'import.parser.staging_succeeded',
  PARSER_STAGING_FAILED: 'import.parser.staging_failed',
  /** Paket E: Ergebnis PDF-Operator-Scan (eingebettete Bilder, Metadaten). */
  EMBEDDED_IMAGE_SCAN_DONE: 'import.parser.embedded_image_scan_done',
  /** Paket F: produktive Übernahme (Galerie / Stammdaten-Mängelfoto). */
  EMBEDDED_IMAGE_IMPORT_OK: 'import.parser.embedded_image_import_ok',
  REVIEW_PATCH: 'import.review.patch',
  REVIEW_STATUS_CHANGED: 'import.review.status_changed',
  REVIEW_VALIDATION_RECOMPUTED: 'import.review.validation_recomputed',
  REVIEW_JOB_BV_DEFAULTS: 'import.review.job_bv_defaults',
  MATCH_COMPUTED: 'import.match.computed',
  COMMIT_C1_JOB_STARTED: 'import.commit.c1.job_started',
  COMMIT_C1_JOB_COMPLETED: 'import.commit.c1.job_completed',
  COMMIT_C1_ROW_SKIPPED_IDEMPOTENT: 'import.commit.c1.row_skipped_idempotent',
  COMMIT_C1_ROW_SKIPPED_INELIGIBLE: 'import.commit.c1.row_skipped_ineligible',
  COMMIT_C1_ROW_SUCCESS: 'import.commit.c1.row_success',
  COMMIT_C1_ROW_FAILED: 'import.commit.c1.row_failed',
  COMMIT_C1_CUSTOMER_CREATED: 'import.commit.c1.customer_created',
  COMMIT_C1_BV_CREATED: 'import.commit.c1.bv_created',
  COMMIT_C2_DEFECTS_STARTED: 'import.commit.c2.defects_started',
  COMMIT_C2_DEFECTS_SUCCESS: 'import.commit.c2.defects_success',
  COMMIT_C2_DEFECTS_REJECTED: 'import.commit.c2.defects_rejected',
  COMMIT_C2_DEFECTS_FAILED: 'import.commit.c2.defects_failed',
} as const
