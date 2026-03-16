import ErrorBoundaryBase from '../../shared/ErrorBoundary'
import { reportError } from './lib/errorReportService'

const ErrorBoundary = ({ children }: { children: React.ReactNode }) => (
  <ErrorBoundaryBase
    onError={(error, errorInfo) => {
      const path =
        typeof window !== 'undefined'
          ? window.location.pathname + window.location.search
          : null
      reportError({
        message: error.message,
        stack: error.stack ?? errorInfo.componentStack ?? null,
        path,
        source: 'arbeitszeit_portal',
      })
    }}
    buttonClassName="px-4 py-2 bg-vico-primary text-slate-800 rounded-lg hover:opacity-90 border border-slate-300"
  >
    {children}
  </ErrorBoundaryBase>
)

export default ErrorBoundary
