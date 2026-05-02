/**
 * Stabile Event-Codes für altbericht_import_event (Paket A).
 */

/** Max. Wartezeit für den PDF-Operator-Bildscan (pdf.js); danach Degradation, C1/Text unverändert. */
export const ALTBERICHT_EMBEDDED_IMAGE_SCAN_TIMEOUT_MS = 180_000

/**
 * Pro-Seite-Wartezeit innerhalb des Bildscans; einzelne Seite wird übersprungen, andere laufen weiter.
 * 45 s lässt langsamen Seiten genug Luft, ohne den ganzen Scan zu blockieren.
 */
export const ALTBERICHT_EMBEDDED_IMAGE_PAGE_SCAN_TIMEOUT_MS = 45_000

/**
 * Stabiler String-Key fürs Skip-Event. Dient gleichzeitig als Wert in `ALTBERICHT_IMPORT_EVENT.EMBEDDED_IMAGE_PAGE_SKIPPED`,
 * damit Helper außerhalb dieses Maps (z. B. der Skipped-Pages-Loader) ihn typstabil importieren können.
 */
export const ALTBERICHT_IMPORT_EVENT_PAGE_SKIPPED = 'import.parser.embedded_image_page_skipped'

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
  PARSER_STAGING_PROPOSED_IDS_DEDUPED: 'import.parser.staging_proposed_ids_deduped',
  PARSER_STAGING_MATCH_REUSED: 'import.parser.staging_match_reused',
  PARSER_STATUS_FINDINGS_DEBUG: 'parser.status_findings_debug',
  /** Paket E: Ergebnis PDF-Operator-Scan (eingebettete Bilder, Metadaten). */
  EMBEDDED_IMAGE_SCAN_DONE: 'import.parser.embedded_image_scan_done',
  /** Reparse: aktueller Scan-Stand mit unveränderter scan_version → Bestand wiederverwendet, Zuordnungen erhalten. */
  EMBEDDED_IMAGE_SCAN_REUSED: 'import.parser.embedded_image_scan_reused',
  /** Pro-Seite-Timeout im Bildscan: einzelne Seite übersprungen, Restscan läuft weiter. */
  EMBEDDED_IMAGE_PAGE_SKIPPED: ALTBERICHT_IMPORT_EVENT_PAGE_SKIPPED,
  /** Paket F: produktive Übernahme (Galerie / Stammdaten-Mängelfoto). */
  EMBEDDED_IMAGE_IMPORT_OK: 'import.parser.embedded_image_import_ok',
  /** Hybrid-Workflow: ganze PDF-Seite als Objektfoto in die Galerie übernommen. */
  PAGE_PHOTO_IMPORTED: 'import.page_photo.imported',
  /** Hybrid-Workflow: Seitenfoto-Übernahme fehlgeschlagen. */
  PAGE_PHOTO_FAILED: 'import.page_photo.failed',
  REVIEW_PATCH: 'import.review.patch',
  REVIEW_STATUS_CHANGED: 'import.review.status_changed',
  REVIEW_VALIDATION_RECOMPUTED: 'import.review.validation_recomputed',
  REVIEW_JOB_BV_DEFAULTS: 'import.review.job_bv_defaults',
  MATCH_COMPUTED: 'import.match.computed',
  COMMIT_C1_JOB_STARTED: 'import.commit.c1.job_started',
  COMMIT_C1_JOB_COMPLETED: 'import.commit.c1.job_completed',
  COMMIT_C1_ROW_STARTED: 'import.commit.c1.row_started',
  COMMIT_C1_ROW_SKIPPED_IDEMPOTENT: 'import.commit.c1.row_skipped_idempotent',
  COMMIT_C1_ROW_SKIPPED_INELIGIBLE: 'import.commit.c1.row_skipped_ineligible',
  COMMIT_C1_ROW_SUCCESS: 'import.commit.c1.row_success',
  COMMIT_C1_ROW_FAILED: 'import.commit.c1.row_failed',
  COMMIT_C1_CUSTOMER_CREATED: 'import.commit.c1.customer_created',
  COMMIT_C1_BV_CREATED: 'import.commit.c1.bv_created',
  COMMIT_C1_OBJECT_CREATE_STARTED: 'import.commit.c1.object_create_started',
  COMMIT_C1_OBJECT_CREATE_FAILED: 'import.commit.c1.object_create_failed',
  COMMIT_C1_OBJECT_CREATED: 'import.commit.c1.object_created',
  COMMIT_C1_OBJECT_DUPLICATE_LINKED: 'import.commit.c1.object_duplicate_linked',
  COMMIT_C1_OBJECT_VERIFY_STARTED: 'import.commit.c1.object_verify_started',
  COMMIT_C1_OBJECT_VERIFIED: 'import.commit.c1.object_verified',
  COMMIT_C1_OBJECT_VERIFY_FAILED: 'import.commit.c1.object_verify_failed',
  COMMIT_C2_DEFECTS_STARTED: 'import.commit.c2.defects_started',
  COMMIT_C2_DEFECTS_SUCCESS: 'import.commit.c2.defects_success',
  COMMIT_C2_DEFECTS_REJECTED: 'import.commit.c2.defects_rejected',
  COMMIT_C2_DEFECTS_FAILED: 'import.commit.c2.defects_failed',
  /** Raster-Workflow: Block-Status-Findings + Block-Crops fertig persistiert. */
  RASTER_ANALYSIS_DONE: 'import.parser.raster_analysis_done',
  /** Raster-Workflow: pdf.js-Scan oder Mapping fehlgeschlagen (Text/C1 bleiben nutzbar). */
  RASTER_ANALYSIS_FAILED: 'import.parser.raster_analysis_failed',
  /** Raster-Workflow: Update auf altbericht_import_staging_object.findings_json fehlgeschlagen. */
  RASTER_FINDINGS_UPDATE_FAILED: 'import.parser.raster_findings_update_failed',
  /** Raster-Workflow: Upsert in altbericht_import_embedded_image (Block-Crop-Stub) fehlgeschlagen. */
  RASTER_BLOCK_CROP_PERSIST_FAILED: 'import.parser.raster_block_crop_persist_failed',
} as const
