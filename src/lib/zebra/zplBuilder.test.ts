import { describe, expect, it } from 'vitest'
import { buildZplFromPayloadV1 } from './zplBuilder'
import type { ZebraPrintPayloadV1 } from './types'

const samplePayload = (): ZebraPrintPayloadV1 => ({
  qrContent: 'https://example.com/obj/1',
  titleLine: 'AMRtech Türen & Tore',
  objectLabel: 'Haupteingang',
  customerName: 'Muster GmbH',
  siteName: 'BV Nord',
  subtitle: 'Raum A',
  labelSize: { widthMm: 57.5, heightMm: 40 },
  encodingHint: 'utf8',
})

describe('buildZplFromPayloadV1', () => {
  it('erzeugt stabilen ZPL mit erwarteten Kernfeldern', () => {
    const zpl = buildZplFromPayloadV1(samplePayload())
    expect(zpl.startsWith('^XA')).toBe(true)
    expect(zpl.endsWith('^XZ')).toBe(true)
    expect(zpl).toContain('^CI28')
    expect(zpl).toContain('^BQN,2,4')
    expect(zpl).toContain('^FDLA,https://example.com/obj/1^FS')
    expect(zpl).toContain('^PQ1')
    expect(zpl).toContain('Muster GmbH')
    expect(zpl).toContain('Haupteingang')
  })

  it('wirft bei leerem qrContent', () => {
    expect(() =>
      buildZplFromPayloadV1({
        ...samplePayload(),
        qrContent: '  ',
      }),
    ).toThrow(/INVALID_PAYLOAD/)
  })

  it('wirft bei Komma im QR-Inhalt (V1)', () => {
    expect(() =>
      buildZplFromPayloadV1({
        ...samplePayload(),
        qrContent: 'https://a,b',
      }),
    ).toThrow(/Komma/)
  })
})
