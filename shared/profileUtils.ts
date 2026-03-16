/** Gemeinsame Profile-Utilities (Haupt-App, Arbeitszeitenportal) */

export type ProfileRole =
  | 'admin'
  | 'teamleiter'
  | 'mitarbeiter'
  | 'operator'
  | 'leser'
  | 'demo'
  | 'kunde'

export type ProfileLike = {
  first_name?: string | null
  last_name?: string | null
  email?: string | null
}

const VALID_ROLES: ProfileRole[] = [
  'admin',
  'teamleiter',
  'mitarbeiter',
  'operator',
  'leser',
  'demo',
  'kunde',
]

export const parseRole = (role: string): ProfileRole =>
  (VALID_ROLES.includes(role as ProfileRole) ? role : 'mitarbeiter') as ProfileRole

export const getProfileDisplayName = (p: ProfileLike): string => {
  if (p.first_name || p.last_name) {
    return [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
  }
  return p.email ?? '(kein Name)'
}
