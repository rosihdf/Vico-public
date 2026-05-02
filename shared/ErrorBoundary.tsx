/** Gemeinsame ErrorBoundary für Mandanten-Apps */

import { Component, type ReactNode, type ErrorInfo } from 'react'

export type ErrorBoundaryProps = {
  children: ReactNode
  /** Optional: Fehler an Report-Service senden (z. B. reportError aus createErrorReporter) */
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  /** Button-Klasse (App-spezifisch: vico-button, vico-primary, etc.) */
  buttonClassName?: string
  /** Container-Klasse für Dark-Mode-Unterstützung */
  containerClassName?: string
}

type State = {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.props.onError?.(error, errorInfo)
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const btnClass =
        this.props.buttonClassName ??
        'px-4 py-2 bg-vico-primary text-white rounded-lg hover:bg-vico-primary-hover'
      const containerClass =
        this.props.containerClassName ??
        'min-h-screen bg-slate-100 dark:bg-slate-900 p-8 flex items-center justify-center'
      return (
        <div className={containerClass}>
          <div className="max-w-md bg-white dark:bg-slate-800 rounded-lg shadow p-6 border border-slate-200 dark:border-slate-700">
            <h1 className="text-lg font-bold text-red-600 dark:text-red-400 mb-2">
              Fehler
            </h1>
            <p className="text-slate-700 dark:text-slate-300 mb-4">
              {this.state.error.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className={btnClass}
            >
              Seite neu laden
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
