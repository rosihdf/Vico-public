import type { ErrorInfo, ReactNode } from 'react'
import ErrorBoundaryBase from '../../../shared/ErrorBoundary'
import { reportError } from '../lib/errorReportService'

const ErrorBoundary = ({ children }: { children: ReactNode }) => (
  <ErrorBoundaryBase
    onError={(error: Error, errorInfo: ErrorInfo) => {
      const path =
        typeof window !== 'undefined'
          ? window.location.pathname + window.location.search
          : null
      reportError({
        message: error.message,
        stack: error.stack ?? errorInfo.componentStack ?? null,
        path,
        source: 'portal',
      })
    }}
    buttonClassName="px-4 py-2 bg-vico-primary text-white rounded-lg hover:bg-vico-primary-hover"
    containerClassName="min-h-screen bg-slate-100 dark:bg-slate-900 p-8 flex items-center justify-center"
  >
    {children}
  </ErrorBoundaryBase>
)

export default ErrorBoundary
