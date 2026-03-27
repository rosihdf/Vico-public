import { Link } from 'react-router-dom'

export const MFA_SETTINGS_LINK = '/einstellungen#sicherheit-2fa'

type MfaSettingsHintProps = {
  variant: 'profil' | 'benutzerverwaltung'
}

/**
 * Einheitlicher Verweis auf 2FA-Einrichtung (eigentliche UI: {@link MfaSettings} in Einstellungen).
 */
const MfaSettingsHint = ({ variant }: MfaSettingsHintProps) => {
  if (variant === 'profil') {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400 m-0">
        <span className="font-medium text-slate-700 dark:text-slate-200">2FA:</span> optional, Einrichtung unter{' '}
        <Link to={MFA_SETTINGS_LINK} className="text-vico-primary hover:underline font-medium">
          Einstellungen → Sicherheit
        </Link>
        .
      </p>
    )
  }

  return (
    <div
      className="mt-3 p-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/80 text-sm text-slate-600 dark:text-slate-300"
      role="note"
    >
      <strong className="font-medium text-slate-800 dark:text-slate-100">
        2FA (Zwei-Faktor-Authentifizierung):
      </strong>{' '}
      optional, standardmäßig aus. Jeder interne Nutzer kann TOTP in den{' '}
      <Link to={MFA_SETTINGS_LINK} className="text-vico-primary hover:underline font-medium">
        eigenen Einstellungen unter „Sicherheit“
      </Link>{' '}
      aktivieren. Hier in der Benutzerverwaltung kann 2FA nicht zentral erzwungen oder für andere konfiguriert werden.
    </div>
  )
}

export default MfaSettingsHint
