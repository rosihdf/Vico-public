import { RELEASE_CHANNEL_LABELS, type ReleaseChannel } from './mandantenReleaseService'

export type RolloutOperation = 'assign' | 'rollback'

export type RolloutLogStatus = 'queued' | 'running' | 'ok' | 'skipped' | 'error' | 'cancelled'

export type RolloutLogLine = {
  key: string
  operation: RolloutOperation
  channel: ReleaseChannel
  tenantId: string
  tenantName: string
  status: RolloutLogStatus
  detail?: string
}

export const ROLLOUT_STATUS_LABEL_DE: Record<RolloutLogStatus, string> = {
  queued: 'Wartet',
  running: 'Läuft',
  ok: 'Erfolg',
  skipped: 'Übersprungen',
  error: 'Fehler',
  cancelled: 'Abgebrochen',
}

export const buildRolloutTsv = (lines: RolloutLogLine[]): string => {
  const header = ['Kanal', 'Mandant', 'Vorgang', 'Status', 'Detail'].join('\t')
  const body = lines
    .map((r) =>
      [
        RELEASE_CHANNEL_LABELS[r.channel],
        r.tenantName,
        r.operation === 'assign' ? 'Zuweisen' : 'Rollback',
        ROLLOUT_STATUS_LABEL_DE[r.status],
        r.detail ?? '',
      ].join('\t')
    )
    .join('\n')
  return `${header}\n${body}`
}

export const buildRolloutCsv = (lines: RolloutLogLine[]): string => {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
  const header = ['Kanal', 'Mandant', 'Vorgang', 'Status', 'Detail']
  const rows = lines.map((r) =>
    [
      esc(RELEASE_CHANNEL_LABELS[r.channel]),
      esc(r.tenantName),
      esc(r.operation === 'assign' ? 'Zuweisen' : 'Rollback'),
      esc(ROLLOUT_STATUS_LABEL_DE[r.status]),
      esc(r.detail ?? ''),
    ].join(',')
  )
  return [header.join(','), ...rows].join('\n')
}

export const countRolloutOutcomes = (lines: RolloutLogLine[]) => {
  let ok = 0
  let skipped = 0
  let error = 0
  let cancelled = 0
  for (const l of lines) {
    if (l.status === 'ok') ok += 1
    else if (l.status === 'skipped') skipped += 1
    else if (l.status === 'error') error += 1
    else if (l.status === 'cancelled') cancelled += 1
  }
  return { ok, skipped, error, cancelled }
}
