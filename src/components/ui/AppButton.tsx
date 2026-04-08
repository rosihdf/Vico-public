import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type AppButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'dangerSolid'
  | 'success'
  | 'successSolid'
  | 'neutralSolid'

type AppButtonProps = {
  variant?: AppButtonVariant
  size?: 'sm' | 'md'
  className?: string
  children: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>

const VARIANT_CLASSES: Record<AppButtonVariant, string> = {
  primary:
    'bg-vico-primary text-white border border-transparent hover:bg-vico-primary-hover focus:ring-vico-primary',
  secondary:
    'bg-vico-button dark:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-600 hover:bg-vico-button-hover dark:hover:bg-slate-600 focus:ring-slate-400',
  outline:
    'bg-transparent text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 focus:ring-slate-400',
  ghost:
    'bg-transparent text-slate-700 dark:text-slate-200 border border-transparent hover:bg-slate-100 dark:hover:bg-slate-700 focus:ring-slate-400',
  danger:
    'bg-transparent text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/40 focus:ring-red-400',
  dangerSolid:
    'bg-red-600 text-white border border-transparent hover:bg-red-700 dark:hover:bg-red-600 focus:ring-red-500',
  success:
    'bg-transparent text-emerald-700 dark:text-emerald-400 border border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 focus:ring-emerald-500',
  successSolid:
    'bg-emerald-600 text-white border border-transparent hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 focus:ring-emerald-500',
  neutralSolid:
    'bg-slate-700 dark:bg-slate-600 text-white border border-transparent hover:bg-slate-600 dark:hover:bg-slate-500 focus:ring-slate-400',
}

const SIZE_CLASSES = {
  sm: 'px-3 py-1.5 text-sm min-h-[36px]',
  md: 'px-4 py-2 text-sm min-h-[40px]',
}

/**
 * Einheitliche Buttons (Design-System v1). Varianten am bisherigen UI orientiert.
 */
const AppButton = ({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  type = 'button',
  ...rest
}: AppButtonProps) => (
  <button
    type={type}
    className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium shrink-0 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} ${className}`.trim()}
    {...rest}
  >
    {children}
  </button>
)

export default AppButton
