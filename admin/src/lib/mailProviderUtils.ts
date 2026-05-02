/** Mandanten-Mailprovider im Lizenzportal (DB kann noch `custom` enthalten). */
export const normalizeTenantMailProvider = (raw: string | null | undefined): 'resend' | 'smtp' => {
  const s = String(raw ?? 'resend').trim().toLowerCase()
  if (s === 'smtp' || s === 'custom') return 'smtp'
  return 'resend'
}

export const tenantMailProviderLabelDe = (p: 'resend' | 'smtp'): string =>
  p === 'smtp' ? 'SMTP' : 'Resend'
