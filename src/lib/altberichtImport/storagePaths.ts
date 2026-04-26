/**
 * Altbericht-Import Paket A – Storage-Konvention (Original-PDF).
 * Bucket und Pfad müssen mit docs/sql/mandanten-db-altbericht-import-paket-a.sql übereinstimmen.
 */

export const ALTBERICHT_IMPORT_PDF_BUCKET = 'altbericht-import-pdfs' as const

/**
 * Objektschlüssel im Bucket: `{jobId}/{fileId}.pdf`
 * fileId = Zeile altbericht_import_file (stabiler UUID vor Upload-Ende anlegen).
 */
export const altberichtImportOriginalPdfPath = (jobId: string, fileId: string): string =>
  `${jobId.trim()}/${fileId.trim()}.pdf`
