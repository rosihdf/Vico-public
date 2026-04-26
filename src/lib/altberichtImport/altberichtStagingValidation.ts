import {
  ALTBERICHT_STAGING_VALIDATION_CODES,
  type AltberichtStagingRowInput,
  type AltberichtStagingValidationError,
} from './altberichtImportReviewTypes'

export const getEffectiveBvId = (row: AltberichtStagingRowInput): string | null =>
  row.review_bv_id ?? row.bv_id ?? null

export const getEffectiveObjectName = (row: AltberichtStagingRowInput): string =>
  (row.review_object_name?.trim() || row.object_name?.trim() || '').trim()

export const getEffectiveObjectType = (row: AltberichtStagingRowInput): string =>
  (row.review_object_type_text?.trim() || row.object_type_text?.trim() || '').trim()

export const getEffectiveFloor = (row: AltberichtStagingRowInput): string =>
  (row.review_floor_text?.trim() || row.floor_text?.trim() || '').trim()

export const getEffectiveRoom = (row: AltberichtStagingRowInput): string =>
  (row.review_room_text?.trim() || row.room_text?.trim() || '').trim()

/**
 * Pflicht: BV. Ohne explizites Produktiv-Objekt zusätzlich: Objektname, Typ, Etage **oder** Raum.
 */
export const validateAltberichtStagingRow = (row: AltberichtStagingRowInput): AltberichtStagingValidationError[] => {
  const errors: AltberichtStagingValidationError[] = []
  if (!getEffectiveBvId(row)) {
    errors.push({
      code: ALTBERICHT_STAGING_VALIDATION_CODES.MISSING_BV,
      message: 'Bauvorhaben (BV) fehlt – bitte zuordnen oder im Review-Feld setzen.',
    })
  }
  const linkedObjectId = row.review_object_id?.trim()
  if (linkedObjectId) {
    return errors
  }
  if (!getEffectiveObjectName(row)) {
    errors.push({
      code: ALTBERICHT_STAGING_VALIDATION_CODES.MISSING_OBJECT_NAME,
      message: 'Objektname fehlt.',
    })
  }
  if (!getEffectiveObjectType(row)) {
    errors.push({
      code: ALTBERICHT_STAGING_VALIDATION_CODES.MISSING_OBJECT_TYPE,
      message: 'Objekttyp fehlt.',
    })
  }
  const floor = getEffectiveFloor(row)
  const room = getEffectiveRoom(row)
  if (!floor && !room) {
    errors.push({
      code: ALTBERICHT_STAGING_VALIDATION_CODES.MISSING_LOCATION,
      message: 'Etage oder Raum muss angegeben sein.',
    })
  }
  return errors
}

export const validationErrorsToJson = (errors: AltberichtStagingValidationError[]): unknown[] =>
  errors.map((e) => ({ code: e.code, message: e.message }))
