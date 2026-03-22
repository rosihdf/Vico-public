type LicenseLoadErrorProps = {
  message: string
  onRetry: () => void
}

const LicenseLoadError = ({ message, onRetry }: LicenseLoadErrorProps) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
      <div className="max-w-md w-full rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-6 text-center">
        <h1 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">Lizenz nicht erreichbar</h1>
        <p className="text-sm text-red-800 dark:text-red-200 mb-4">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-2 rounded-lg bg-red-200 dark:bg-red-900 text-red-900 dark:text-red-100 text-sm font-medium hover:bg-red-300 dark:hover:bg-red-800 transition-colors"
        >
          Erneut versuchen
        </button>
      </div>
    </div>
  )
}

export default LicenseLoadError
