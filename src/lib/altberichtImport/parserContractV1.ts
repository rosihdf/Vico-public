/**
 * Parser-Contract V1 → Ausgabe für Staging (Paket A).
 * Keine Produktiv-Mapping-Logik; nur strukturierte Roh-/Kandidatendaten.
 */

/** Job-Datei-States (DB altbericht_import_file.status) */
export type AltberichtImportFileStatusV1 =
  | 'pending'
  | 'parsing'
  | 'parsed'
  | 'staged'
  | 'parse_failed'

/** Staging-Objekt-States (DB altbericht_import_staging_object.status) */
export type AltberichtImportStagingObjectStatusV1 = 'draft' | 'incomplete' | 'ready_for_review' | 'blocked'

/** Entspricht DB location_rule */
export type AltberichtLocationRuleV1 = 'floor' | 'room' | 'unknown'

export type AltberichtParserSourceRefV1 = {
  page?: number
  charOffset?: number
  snippet?: string
}

export type AltberichtParserCatalogCandidateV1 = {
  field: string
  raw: string
  normalized?: string
  confidence?: number
}

export type AltberichtParserFindingCandidateV1 = {
  text: string
  source?: string
  sequence?: number
  confidence?: number
  sourceRefs?: AltberichtParserSourceRefV1[]
}

export type AltberichtParserMediaHintV1 = {
  kind: 'image'
  page?: number
  note?: string
}

/** Ein extrahiertes Objekt (wird zu altbericht_import_staging_object gemappt). */
export type AltberichtParserStagingObjectV1 = {
  sequence: number
  status: AltberichtImportStagingObjectStatusV1
  customerText?: string
  siteText?: string
  bvId?: string | null
  objectName: string
  objectTypeText: string
  floorText?: string | null
  roomText?: string | null
  locationRule: AltberichtLocationRuleV1
  findings: AltberichtParserFindingCandidateV1[]
  catalogCandidates: AltberichtParserCatalogCandidateV1[]
  mediaHints: AltberichtParserMediaHintV1[]
  parserConfidence?: Record<string, number>
  sourceRefs?: AltberichtParserSourceRefV1[]
  analysisTrace?: unknown
}

export type AltberichtParserDocumentMetaV1 = {
  customerText?: string
  siteText?: string
  reportDate?: string
  extra?: Record<string, string>
}

export type AltberichtParserWarningV1 = {
  code: string
  message: string
  details?: string
}

/**
 * Vollständiges Parser-Ergebnis pro PDF (vor DB-Persistenz durch Worker).
 * `parserVersion` sollte mit altbericht_import_file.parser_version korrespondieren.
 */
export type AltberichtParserResultV1 = {
  parserVersion: string
  documentMeta: AltberichtParserDocumentMetaV1
  objects: AltberichtParserStagingObjectV1[]
  warnings: AltberichtParserWarningV1[]
  /** Optional: Rohtext für Debugging; große Texte ggf. nur als Storage-Referenz */
  extractedText?: string
}
