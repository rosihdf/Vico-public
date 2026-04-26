import type { ZebraEncodingHintV1, ZebraPrintPayloadV1 } from './types'

/** 203 dpi (ZQ220-Referenz, V1). */
const DOTS_PER_MM = 203 / 25.4

const mmToDots = (mm: number): number => Math.max(1, Math.round(mm * DOTS_PER_MM))

const MAX_LINE_CHARS = 48
const MARGIN_MM = 2

const escapeZplFieldData = (s: string): string =>
  s
    .replace(/\^/g, '_')
    .replace(/~/g, '_')

/**
 * Baut einen ZPL-Druckjob (ein Etikett) aus dem V1-Payload.
 * Wirft bei ungültigem Payload (Vorbedingung für Aufrufer: Validierung im Plugin möglich).
 */
export function buildZplFromPayloadV1(payload: ZebraPrintPayloadV1): string {
  const qr = payload.qrContent?.trim()
  if (!qr) {
    throw new Error('INVALID_PAYLOAD: qrContent fehlt')
  }
  const { widthMm, heightMm } = payload.labelSize
  if (!(widthMm > 0) || !(heightMm > 0)) {
    throw new Error('INVALID_PAYLOAD: labelSize ungültig')
  }

  const pw = mmToDots(widthMm)
  const ll = mmToDots(heightMm)
  const margin = mmToDots(MARGIN_MM)

  const ci = encodingToCi(payload.encodingHint ?? 'utf8')

  const fontMain = 24
  const lineGap = 8
  let y = margin

  const site = payload.siteName?.trim()
  const sub = payload.subtitle?.trim()

  const textLines = [
    payload.titleLine,
    payload.customerName,
    site || undefined,
    payload.objectLabel,
    sub || undefined,
  ].filter((x): x is string => Boolean(x?.trim()))
    .map((line) => escapeZplFieldData(line.trim().slice(0, MAX_LINE_CHARS)))

  let body = `^XA${ci}^PW${pw}^LL${ll}^LH0,0^PR4`

  for (const line of textLines) {
    body += `^FO${margin},${y}^A0N,${fontMain},${fontMain}^FD${line}^FS`
    y += fontMain + lineGap
  }

  const qrData = escapeZplQrData(qr)
  const qrMag = 4
  const qrBlockApprox = mmToDots(22)
  const qrY = Math.min(y + margin, Math.max(margin, ll - qrBlockApprox))

  body += `^FO${margin},${qrY}^BQN,2,${qrMag}^FDLA,${qrData}^FS^PQ1^XZ`

  return body
}

function encodingToCi(hint: ZebraEncodingHintV1): string {
  return hint === 'latin1' ? '^CI27' : '^CI28'
}

/** QR-Feld: Komma trennt Parameter – Kommas im Inhalt vermeiden (V1-Limitierung). */
function escapeZplQrData(data: string): string {
  if (data.includes(',')) {
    throw new Error('INVALID_PAYLOAD: qrContent darf in V1 kein Komma enthalten')
  }
  return escapeZplFieldData(data).slice(0, 2048)
}
