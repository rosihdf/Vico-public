/**
 * Host-Normalisierung und Domain-Matching für Lizenz-API „nach Host“ (Phase B).
 * Genutzt von Haupt-App-Shared-Clients; Server (Netlify) importiert aus Repo-Root.
 */

/** Host aus vollständiger URL oder Origin (z. B. https://portal.kunde.de/path → portal.kunde.de). */
export const extractHostnameFromOriginOrReferer = (originOrReferer: string): string => {
  const t = originOrReferer.trim()
  if (!t) return ''
  try {
    const u = new URL(t)
    return u.hostname.toLowerCase()
  } catch {
    return ''
  }
}

/**
 * Mandanten-Felder portal_domain / app_domain können als URL oder Host gespeichert sein.
 */
export const normalizeTenantDomainField = (raw: string | null | undefined): string => {
  if (!raw || typeof raw !== 'string') return ''
  const s = raw.trim()
  if (!s) return ''
  try {
    if (s.includes('://')) return new URL(s).hostname.toLowerCase()
    const first = s.split('/')[0] ?? ''
    return first.split(':')[0].toLowerCase()
  } catch {
    return s.split('/')[0].split(':')[0].toLowerCase()
  }
}

/** Gleiche Regel wie in license.ts: exakt oder *.suffix */
export const hostMatchesAllowedRule = (requestHost: string, rule: string): boolean => {
  const domain = String(rule).trim().toLowerCase()
  if (!domain) return false
  const h = requestHost.toLowerCase()
  if (domain.startsWith('*.')) {
    const suffix = domain.slice(1)
    return h === suffix || h.endsWith(suffix)
  }
  return h === domain
}

export type TenantDomainFields = {
  portal_domain?: string | null
  arbeitszeitenportal_domain?: string | null
  app_domain?: string | null
  allowed_domains?: unknown
}

/** True, wenn requestHost zu diesem Mandanten passt (Portal-/App-Domain oder allowed_domains). */
export const tenantMatchesRequestHost = (tenant: TenantDomainFields, requestHost: string): boolean => {
  const h = requestHost.trim().toLowerCase()
  if (!h) return false
  const pf = normalizeTenantDomainField(tenant.portal_domain ?? null)
  if (pf && pf === h) return true
  const az = normalizeTenantDomainField(tenant.arbeitszeitenportal_domain ?? null)
  if (az && az === h) return true
  const ad = normalizeTenantDomainField(tenant.app_domain ?? null)
  if (ad && ad === h) return true
  const allowed = tenant.allowed_domains
  if (Array.isArray(allowed)) {
    return allowed.some((rule) => typeof rule === 'string' && hostMatchesAllowedRule(h, rule))
  }
  return false
}
