export const CUSTOMER_COLUMNS =
  [
    'id',
    'name',
    'street',
    'house_number',
    'postal_code',
    'city',
    'email',
    'phone',
    'contact_name',
    'contact_email',
    'contact_phone',
    'maintenance_report_email',
    'maintenance_report_email_address',
    'maintenance_report_portal',
    'monteur_report_internal_only',
    'monteur_report_portal',
    'demo_user_id',
    'archived_at',
    'created_at',
    'updated_at',
  ].join(', ')

export const BV_COLUMNS =
  [
    'id',
    'customer_id',
    'name',
    'street',
    'house_number',
    'postal_code',
    'city',
    'email',
    'phone',
    'contact_name',
    'contact_email',
    'contact_phone',
    'maintenance_report_email',
    'maintenance_report_email_address',
    'uses_customer_report_delivery',
    'maintenance_report_portal',
    'monteur_report_portal',
    'monteur_report_internal_only',
    'created_at',
    'updated_at',
  ].join(', ')

export const MAINTENANCE_CONTRACT_COLUMNS =
  'id, customer_id, bv_id, contract_number, start_date, end_date, created_at, updated_at'

export const OBJECT_COLUMNS =
  [
    'id',
    'bv_id',
    'customer_id',
    'name',
    'internal_id',
    'door_position',
    'internal_door_number',
    'floor',
    'room',
    'type_tuer',
    'type_sektionaltor',
    'type_schiebetor',
    'type_freitext',
    'wing_count',
    'anforderung',
    'manufacturer',
    'build_year',
    'lock_manufacturer',
    'lock_type',
    'has_hold_open',
    'hold_open_manufacturer',
    'hold_open_type',
    'hold_open_approval_no',
    'hold_open_approval_date',
    'smoke_detector_count',
    'smoke_detector_build_years',
    'panic_function',
    'accessories_items',
    'accessories',
    'maintenance_by_manufacturer',
    'hold_open_maintenance',
    'defects',
    'defects_structured',
    'remarks',
    'maintenance_interval_months',
    'last_door_maintenance_date',
    'door_maintenance_date_manual',
    'hold_open_last_maintenance_date',
    'hold_open_maintenance_interval_months',
    'hold_open_last_maintenance_manual',
    'profile_photo_path',
    'archived_at',
    'created_at',
    'updated_at',
  ].join(', ')

export const OBJECT_DEFECT_PHOTO_COLUMNS =
  'id, object_id, defect_entry_id, storage_path, created_at'

export const ORDER_COLUMNS =
  [
    'id',
    'customer_id',
    'bv_id',
    'related_order_id',
    'object_id',
    'object_ids',
    'order_date',
    'order_time',
    'order_type',
    'status',
    'description',
    'assigned_to',
    'created_by',
    'created_at',
    'updated_at',
  ].join(', ')

export const ORDER_COMPLETION_COLUMNS = [
  'id',
  'order_id',
  'ausgeführte_arbeiten',
  'material',
  'arbeitszeit_minuten',
  'completion_extra',
  'monteur_pdf_path',
  'unterschrift_mitarbeiter_path',
  'unterschrift_mitarbeiter_name',
  'unterschrift_mitarbeiter_date',
  'unterschrift_kunde_path',
  'unterschrift_kunde_name',
  'unterschrift_kunde_date',
  'created_at',
  'updated_at',
].join(', ')

/** Nur für Offline-Cache / Protokoll-Mängel-Aggregation (klein). */
export const ORDER_COMPLETION_CACHE_COLUMNS = 'order_id, completion_extra, created_at'

export const OBJECT_PHOTO_COLUMNS = [
  'id',
  'object_id',
  'storage_path',
  'caption',
  'created_at',
].join(', ')

export const OBJECT_DOCUMENT_COLUMNS = [
  'id',
  'object_id',
  'storage_path',
  'document_type',
  'title',
  'file_name',
  'created_at',
].join(', ')

export const MAINTENANCE_REPORT_COLUMNS = [
  'id',
  'object_id',
  'maintenance_date',
  'maintenance_time',
  'technician_id',
  'reason',
  'reason_other',
  'manufacturer_maintenance_done',
  'hold_open_checked',
  'deficiencies_found',
  'deficiency_description',
  'urgency',
  'fixed_immediately',
  'customer_signature_path',
  'technician_signature_path',
  'technician_name_printed',
  'customer_name_printed',
  'pdf_path',
  'pruefprotokoll_pdf_path',
  'pruefprotokoll_laufnummer',
  'synced',
  'source_order_id',
  'checklist_protocol',
  'created_at',
  'updated_at',
].join(', ')

export const MAINTENANCE_REPORT_PHOTO_COLUMNS = [
  'id',
  'report_id',
  'storage_path',
  'caption',
  'created_at',
].join(', ')

export const CHECKLIST_DEFECT_PHOTO_COLUMNS = [
  'id',
  'maintenance_report_id',
  'object_id',
  'checklist_scope',
  'checklist_item_id',
  'storage_path',
  'caption',
  'created_at',
  'updated_at',
].join(', ')

export const CHECKLIST_DEFECT_PHOTO_DRAFT_COLUMNS = [
  'id',
  'source_order_id',
  'object_id',
  'checklist_scope',
  'checklist_item_id',
  'storage_path',
  'caption',
  'created_at',
  'updated_at',
].join(', ')

export const MAINTENANCE_REPORT_SMOKE_DETECTOR_COLUMNS = [
  'id',
  'report_id',
  'smoke_detector_label',
  'status',
  'created_at',
].join(', ')

export const PORTAL_USER_COLUMNS = [
  'id',
  'customer_id',
  'email',
  'user_id',
  'invited_by',
  'invited_at',
  'created_at',
].join(', ')

/** Für Suche/Sync: nur benötigte Spalten für time_entries (Auftragszuordnung entfernt, order_id bleibt für Kompatibilität; Ortung optional). */
export const TIME_ENTRY_COLUMNS = [
  'id',
  'user_id',
  'date',
  'start',
  'end',
  'notes',
  'order_id',
  'created_at',
  'updated_at',
  'location_start_lat',
  'location_start_lon',
  'location_end_lat',
  'location_end_lon',
  'approval_status',
  'approved_by',
  'approved_at',
].join(', ')

export const TIME_BREAK_COLUMNS = [
  'id',
  'time_entry_id',
  'start',
  'end',
  'created_at',
].join(', ')
