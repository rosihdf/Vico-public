import ErrorBoundaryBase from '../shared/ErrorBoundary'
import { reportError } from './lib/errorReportService'

const getSourceFromPath = (path: string | null): 'main_app' | 'zeiterfassung' => {
  if (path?.includes('/arbeitszeit')) return 'zeiterfassung'
  return 'main_app'
}

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
        source: getSourceFromPath(path),
      })
    }}
    buttonClassName="px-4 py-2 bg-vico-button dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg hover:bg-vico-button-hover dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600"
  >
    {children}
  </ErrorBoundaryBase>
)

export default ErrorBoundary
