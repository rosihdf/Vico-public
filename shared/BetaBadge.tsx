import type { HTMLAttributes } from 'react'

/**
 * Kennzeichnet Funktionen in Erprobung (z. B. GPS/Ortung bei Zeiterfassung).
 */
export const BetaBadge = ({
  className = '',
  ...rest
}: HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={`inline-flex shrink-0 items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-100 ${className}`.trim()}
    title="Funktion in Erprobung – Verhalten kann sich noch ändern."
    {...rest}
  >
    Beta
  </span>
)
