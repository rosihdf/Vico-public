type EmptyStateProps = {
  title: string
  description?: string
  className?: string
}

const EmptyState = ({ title, description, className = '' }: EmptyStateProps) => (
  <div
    className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}
    role="status"
    aria-label={title}
  >
    <svg
      className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
    <p className="text-slate-600 dark:text-slate-400 font-medium">{title}</p>
    {description && (
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-500 max-w-sm">{description}</p>
    )}
  </div>
)

export default EmptyState
