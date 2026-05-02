/**
 * Altbericht-Import (Paket A/B Review, Paket C1 Commit-Lib) – öffentliche Modulschnittstelle.
 */

export { ALTBERICHT_IMPORT_EVENT } from './altberichtImportConstants'
export {
  ALTBERICHT_STAGING_VALIDATION_CODES,
} from './altberichtImportReviewTypes'
export type {
  AltberichtImportReviewStatus,
  AltberichtStagingReviewPatch,
  AltberichtStagingRowInput,
  AltberichtStagingValidationCode,
  AltberichtStagingValidationError,
} from './altberichtImportReviewTypes'
export {
  applyAltberichtJobReviewCustomerBvDefaults,
  patchAltberichtStagingReview,
  recomputeAltberichtStagingReviewForJob,
  recomputeAltberichtStagingReviewRow,
} from './altberichtImportReviewService'
export {
  commitAltberichtC1Job,
  commitAltberichtC1StagingRow,
  isAltberichtStagingRowCommitEligible,
} from './altberichtImportCommitService'
export {
  altberichtC2FindingKey,
  commitAltberichtC2DefectsForStagingRow,
  isAltberichtStagingRowC2Eligible,
  listAltberichtC2FindingRows,
  parseAltberichtC2ImportedKeys,
} from './altberichtImportC2DefectService'
export { textShouldBeExcludedFromAltberichtC2Import } from './altberichtImportC2FindingFilter'
export type {
  AltberichtC2CommitItem,
  AltberichtC2CommitResult,
  AltberichtC2FindingRow,
} from './altberichtImportC2DefectService'
export type {
  AltberichtC1CommitJobOptions,
  AltberichtC1RowCommitOverrides,
  AltberichtC1RowCommitResult,
} from './altberichtImportCommitService'
export { persistAltberichtMatchCandidatesForStaging } from './altberichtImportMatchService'
export {
  ALTBERICHT_MATCH_PAYLOAD_VERSION,
  buildAltberichtMatchPayload,
  collectAltberichtNameSuggestions,
  isAltberichtMatchPayloadV1,
} from './altberichtStagingMatchCandidates'
export type {
  AltberichtMatchCandidateV1,
  AltberichtMatchPayloadV1,
} from './altberichtStagingMatchCandidates'
export {
  getEffectiveBvId,
  getEffectiveFloor,
  getEffectiveObjectName,
  getEffectiveObjectType,
  getEffectiveRoom,
  validateAltberichtStagingRow,
  validationErrorsToJson,
} from './altberichtStagingValidation'
export {
  buildAltberichtDuplicateCheckKeyForObject,
  buildAltberichtDuplicateCheckKeyFromStaging,
  buildImportMatchKeyFromParserObject,
  listAltberichtSoftDuplicateHints,
} from './altberichtImportMatchKey'
export type { AltberichtSoftDuplicateHint } from './altberichtImportMatchKey'
export { extractPdfPlainText } from './extractPdfText'
export { insertAltberichtImportEvent } from './altberichtImportEvents'
export {
  fetchAltberichtEmbeddedImagesForJob,
  fetchAltberichtImportEventsForJob,
  fetchAltberichtImportFilesForJob,
  fetchAltberichtImportStagingForJob,
  listAltberichtImportJobs,
} from './altberichtImportQueryService'
export type { AltberichtImportStagingObjectRow } from './altberichtImportQueryService'
export { runAltberichtImportParseForFile, runAltberichtImportParseJobSequential } from './altberichtImportParseService'
export {
  patchAltberichtEmbeddedImage,
  runAltberichtEmbeddedImageScanForFileById,
} from './altberichtImportEmbeddedImageService'
export {
  fetchAltberichtSkippedPagesByFileForJob,
  getStagingRowSkippedPages,
} from './altberichtImportSkippedPages'
export type { AltberichtSkippedPagesByFile } from './altberichtImportSkippedPages'
export {
  collectPagesMentionedOnStagingRow,
  resolveStagingRowPageHints,
} from './altberichtEmbeddedImageSuggest'
export {
  altberichtBulkResultToastType,
  altberichtToastTypeForCode,
} from './altberichtImportToastMap'
export type {
  StagingRowPageHintSource,
  StagingRowPageHints,
} from './altberichtEmbeddedImageSuggest'
export {
  importAllEmbeddedImagesPendingForJob,
  importEmbeddedImageProductive,
} from './altberichtImportEmbeddedImageProductiveService'
export type { ImportEmbeddedImageResult } from './altberichtImportEmbeddedImageProductiveService'
export { importAltberichtPageAsObjectPhoto } from './altberichtImportPageAsPhotoService'
export type {
  ImportAltberichtPageAsObjectPhotoParams,
  ImportAltberichtPageAsPhotoCode,
  ImportAltberichtPageAsPhotoResult,
} from './altberichtImportPageAsPhotoService'
export { resolveStammdatenDefectEntryIdForC2Key } from './altberichtImportEmbeddedDefectResolve'
export {
  buildAltberichtPositionBlockBoxLookup,
  buildAltberichtPositionBlockBoxes,
} from './altberichtPositionBlockGeometry'
export type { AltberichtPositionBlockBox } from './altberichtPositionBlockGeometry'
export {
  clearAltberichtPositionBlockGeometryCache,
  computeAltberichtPositionBlockBoxesFromPdfBytes,
  getCachedAltberichtPositionBlockLookup,
  renderAltberichtPositionBlockToBlob,
  setCachedAltberichtPositionBlockLookup,
} from './altberichtPositionBlockRender'
export {
  collectEmbeddedImageDraftsFromFnArray,
  finalizeDraftsPerPage,
  classifyImagePaintOp,
} from './altberichtPdfImageScan'
export {
  ALTBERICHT_RASTER_BLOCKS_PER_PAGE,
  ALTBERICHT_RASTER_OP_KIND_BLOCK_CROP,
  ALTBERICHT_RASTER_SCAN_VERSION,
  assignAltberichtRasterBlockIndex,
  computeAllAltberichtRasterBlockBoundsForPage,
  computeAltberichtGlobalRowIndex,
  computeAltberichtRasterBlockBounds,
  computeAltberichtRasterImageIndex,
  formatAltberichtLogicalPhotoKey,
  isAltberichtRasterImageIndex,
  parseAltberichtLogicalPhotoKey,
  splitAltberichtGlobalRowIndex,
} from './altberichtRasterGrid'
export type { AltberichtRasterBlockBounds } from './altberichtRasterGrid'
export {
  ALTBERICHT_RASTER_FINDING_SOURCE_ACCEPT,
  ALTBERICHT_RASTER_FINDING_SOURCE_SUSPECT,
  filterAltberichtRasterBlockStatusText,
  isAltberichtRasterFindingSource,
} from './altberichtRasterStatusFilter'
export type { AltberichtRasterStatusFilterResult } from './altberichtRasterStatusFilter'
export {
  countAltberichtRasterNonEmptyBlocksPerPage,
  flattenAltberichtRasterBlocks,
  matchAltberichtRasterBlocksToStagingRows,
  runAltberichtRasterScanForPdf,
} from './altberichtRasterScan'
export type {
  AltberichtRasterBlockData,
  AltberichtRasterPageData,
  AltberichtRasterScanOptions,
  AltberichtRasterScanProgress,
} from './altberichtRasterScan'
export {
  mergeAltberichtBlockStatusFindings,
  runAltberichtRasterAnalysisForFile,
  runAltberichtRasterAnalysisForFileById,
} from './altberichtRasterFindingsService'
export type {
  AltberichtRasterAnalysisResult,
  RunAltberichtRasterAnalysisOptions,
} from './altberichtRasterFindingsService'
export type { RunAltberichtImportParseForFileResult } from './altberichtImportParseService'
export type {
  AltberichtImportEmbeddedImageImportStatus,
  AltberichtImportEmbeddedImageRow,
  AltberichtImportEmbeddedImageUserIntent,
  AltberichtImportEventLevel,
  AltberichtImportEventRow,
  AltberichtImportFileRow,
  AltberichtImportJobRow,
  AltberichtImportLogEventInput,
  AltberichtImportUploadInputFile,
} from './altberichtImportTypes'
export { deleteAltberichtImportJob } from './altberichtImportDeleteService'
export {
  createAltberichtImportJob,
  createAltberichtImportJobWithPdfUploads,
  uploadPdfsToAltberichtImportJob,
} from './altberichtImportUploadService'
export type {
  CreateAltberichtImportJobParams,
  CreateAltberichtImportJobResult,
  UploadPdfsToAltberichtImportJobParams,
  UploadPdfsToAltberichtImportJobResult,
} from './altberichtImportUploadService'
export {
  parserResultV1ToStagingInsertPayloads,
  persistParserResultV1StagingOnly,
} from './parserPersistV1'
export type { AltberichtStagingInsertPayloadV1, PersistParserResultV1Options } from './parserPersistV1'
export {
  parseStructuredAltberichtPlainTextV1,
  STRUCTURED_ALTBERICHT_PARSER_VERSION,
} from './structuredAltberichtParserV1'

export {
  ALTBERICHT_IMPORT_PDF_BUCKET,
  altberichtImportOriginalPdfPath,
} from './storagePaths'

export type {
  AltberichtImportFileStatusV1,
  AltberichtImportStagingObjectStatusV1,
  AltberichtLocationRuleV1,
  AltberichtParserCatalogCandidateV1,
  AltberichtParserDocumentMetaV1,
  AltberichtParserFindingCandidateV1,
  AltberichtParserMediaHintV1,
  AltberichtParserResultV1,
  AltberichtParserSourceRefV1,
  AltberichtParserStagingObjectV1,
  AltberichtParserWarningV1,
} from './parserContractV1'
