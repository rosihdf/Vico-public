/** Gemeinsame EmptyState-Komponente für alle Vico-Apps */

import type { ReactNode } from 'react'

type EmptyStateProps = {
  title: string
  description?: string
  icon?: ReactNode
  className?: string
}

const DefaultIcon = () => (
  <svg
    className="w-12 h-12 text-slate-300 dark:text-slate-600"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    aria-hidden
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
    />
  </svg>
)

const EmptyState = ({
  title,
  description,
  icon,
  className = '',
}: EmptyStateProps) => (
  <div
    className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}
    role="status"
    aria-label={title}
  >
    <div className="mb-3">{icon ?? <DefaultIcon />}</div>
    <p className="text-slate-600 dark:text-slate-400 font-medium">{title}</p>
    {description && (
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-500 max-w-sm">
        {description}
      </p>
    )}
  </div>
)

export default EmptyState
