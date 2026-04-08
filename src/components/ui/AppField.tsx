import type { ReactNode } from 'react'
import { appLabelClassName } from './appInputStyles'

type AppFieldProps = {
  id?: string
  label: string
  htmlFor?: string
  error?: string | null
  hint?: string | null
  className?: string
  children: ReactNode
}

/**
 * Label + Hilfetext/Fehler + Control (Design-System v1).
 */
const AppField = ({ id, label, htmlFor, error, hint, className = '', children }: AppFieldProps) => {
  const fid = htmlFor ?? id
  return (
    <div className={className}>
      {fid ? (
        <label htmlFor={fid} className={appLabelClassName}>
          {label}
        </label>
      ) : (
        <span className={appLabelClassName}>{label}</span>
      )}
      {children}
      {hint && !error ? (
        <p id={fid ? `${fid}-hint` : undefined} className="mt-1 text-xs text-app-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={fid ? `${fid}-err` : undefined} className="mt-1 text-sm text-app-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export default AppField
