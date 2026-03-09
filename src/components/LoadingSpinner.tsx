type LoadingSpinnerProps = {
  message?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'light'
  className?: string
}

const SIZE_CLASSES = {
  sm: 'w-5 h-5',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
}

const TEXT_CLASSES = {
  default: 'text-slate-600 dark:text-slate-400',
  light: 'text-white/95',
}

export const LoadingSpinner = ({
  message = 'Lade…',
  size = 'md',
  variant = 'default',
  className = '',
}: LoadingSpinnerProps) => (
  <div
    className={`flex flex-col items-center justify-center gap-3 ${className}`}
    role="status"
    aria-live="polite"
    aria-label={message}
  >
    <div
      className={`${SIZE_CLASSES[size]} border-2 rounded-full animate-spin border-t-transparent ${
        variant === 'light' ? 'border-white/80' : 'border-vico-primary'
      }`}
      aria-hidden
    />
    {message && (
      <span className={`text-sm ${TEXT_CLASSES[variant]}`}>{message}</span>
    )}
  </div>
)
