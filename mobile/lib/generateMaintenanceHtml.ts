import type {
  MaintenanceReport,
  Customer,
  BV,
  Object as Obj,
  MaintenanceReason,
  MaintenanceUrgency,
  SmokeDetectorStatus,
} from './types'

const REASON_LABELS: Record<MaintenanceReason | string, string> = {
  regelwartung: 'Regelwartung',
  reparatur: 'Reparatur',
  nachpruefung: 'Nachprüfung',
  sonstiges: 'Sonstiges',
}

const URGENCY_LABELS: Record<MaintenanceUrgency | string, string> = {
  niedrig: 'Niedrig',
  mittel: 'Mittel',
  hoch: 'Hoch',
}

const STATUS_LABELS: Record<SmokeDetectorStatus | string, string> = {
  ok: 'OK',
  defekt: 'Defekt',
  ersetzt: 'Ersetzt',
}

export type MaintenancePdfData = {
  report: MaintenanceReport
  customer: Customer
  bv: BV
  object: Obj
  smokeDetectors: { label: string; status: SmokeDetectorStatus }[]
}

export const generateMaintenanceHtml = (data: MaintenancePdfData): string => {
  const { report, customer, bv, object: obj, smokeDetectors } = data
  const addr = [bv.street, [bv.postal_code, bv.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')

  const smokeRows = smokeDetectors.length > 0
    ? `<h3>Rauchmelder</h3><table>${smokeDetectors.map((sd) => `<tr><td>${sd.label}</td><td>${STATUS_LABELS[sd.status] ?? sd.status}</td></tr>`).join('')}</table>`
    : ''

  const deficiencySection = report.deficiencies_found
    ? `<h3>Mängel</h3>
       <p>${report.deficiency_description || 'Keine Beschreibung'}</p>
       <p>Dringlichkeit: ${report.urgency ? URGENCY_LABELS[report.urgency] : '–'}</p>
       <p>Sofort behoben: ${report.fixed_immediately ? 'Ja' : 'Nein'}</p>`
    : ''

  const holdOpenLine = obj.has_hold_open
    ? `<p>Feststellanlage geprüft: ${report.hold_open_checked === true ? 'Ja' : report.hold_open_checked === false ? 'Nein' : '–'}</p>`
    : ''

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: Helvetica, Arial, sans-serif; font-size: 12px; color: #1e293b; padding: 24px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  h2 { font-size: 14px; color: #475569; margin-top: 0; }
  h3 { font-size: 13px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-top: 16px; }
  p { margin: 4px 0; }
  table { border-collapse: collapse; width: 100%; margin-top: 4px; }
  td { border: 1px solid #e2e8f0; padding: 4px 8px; }
  .meta { color: #64748b; font-size: 11px; }
  hr { border: none; border-top: 1px solid #cbd5e1; margin: 16px 0; }
</style>
</head>
<body>
  <h1>Wartungsprotokoll</h1>
  <h2>${customer.name}${bv.name !== customer.name ? ` · ${bv.name}` : ''}</h2>
  ${addr ? `<p class="meta">${addr}</p>` : ''}
  <hr />
  <p><strong>Objekt:</strong> ${obj.internal_id ?? '–'}${obj.door_position ? ` · ${obj.door_position}` : ''}${obj.room ? ` · Raum ${obj.room}` : ''}</p>
  <p><strong>Datum:</strong> ${report.maintenance_date}${report.maintenance_time ? ` · ${report.maintenance_time}` : ''}</p>
  <p><strong>Prüfgrund:</strong> ${report.reason ? REASON_LABELS[report.reason] : '–'}${report.reason_other ? ` (${report.reason_other})` : ''}</p>
  <p>Wartung nach Herstellerangaben: ${report.manufacturer_maintenance_done ? 'Ja' : 'Nein'}</p>
  ${holdOpenLine}
  ${smokeRows}
  ${deficiencySection}
  ${report.technician_name_printed || report.customer_name_printed ? `<hr /><h3>Unterschriften</h3>
  ${report.technician_name_printed ? `<p><strong>Techniker:</strong> ${report.technician_name_printed}</p>` : ''}
  ${report.customer_name_printed ? `<p><strong>Kunde:</strong> ${report.customer_name_printed}</p>` : ''}` : ''}
</body>
</html>`
}
