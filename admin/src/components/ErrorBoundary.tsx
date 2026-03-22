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
        source: 'admin',
      })
    }}
    buttonClassName="px-4 py-2 bg-vico-primary text-white rounded-lg hover:bg-vico-primary-hover"
  >
    {children}
  </ErrorBoundaryBase>
)

export default ErrorBoundary
