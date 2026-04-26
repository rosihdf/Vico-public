import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import {
  DASHBOARD_WIDGET_OPTIONS,
  getResolvedWidgetOrder,
  isDashboardWidgetVisible,
  type DashboardLayoutStored,
  type DashboardWidgetId,
} from '../../lib/dashboardLayoutPreferences'

export type DashboardLayoutSettingsSectionProps = {
  visible: boolean
  dashboardLayout: DashboardLayoutStored
  updateWidgetVisible: (id: DashboardWidgetId, visible: boolean) => void
  moveWidgetOrder: (id: DashboardWidgetId, direction: 'up' | 'down') => void
}

export const DashboardLayoutSettingsSection = ({
  visible,
  dashboardLayout,
  updateWidgetVisible,
  moveWidgetOrder,
}: DashboardLayoutSettingsSectionProps) => {
  if (!visible) return null

  return (
    <section
      className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm"
      aria-labelledby="dashboard-layout-heading"
    >
      <h3 id="dashboard-layout-heading" className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
        Startseite (Dashboard)
      </h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
        Legen Sie fest, welche Bereiche auf der Startseite angezeigt werden und in welcher Reihenfolge sie von oben
        nach unten erscheinen (Pfeile). Die Auswahl wird mit Ihrem Konto synchronisiert (<strong>Multi-Gerät</strong>
        ); offline wird ein lokaler Zwischenspeicher genutzt und beim nächsten Sync übertragen. Einzelne Kacheln
        erscheinen nur, wenn Lizenz und Rolle das Modul erlauben (z. B. Arbeitszeit).
      </p>
      <ul className="space-y-3" role="list">
        {getResolvedWidgetOrder(dashboardLayout).map((widgetId, index) => {
          const opt = DASHBOARD_WIDGET_OPTIONS.find((o) => o.id === widgetId)
          if (!opt) return null
          const order = getResolvedWidgetOrder(dashboardLayout)
          const atTop = index === 0
          const atBottom = index === order.length - 1
          const checked = isDashboardWidgetVisible(dashboardLayout, opt.id)
          const handleMoveUp = () => {
            moveWidgetOrder(opt.id, 'up')
          }
          const handleMoveDown = () => {
            moveWidgetOrder(opt.id, 'down')
          }
          const handleMoveKeyDown = (e: ReactKeyboardEvent, direction: 'up' | 'down') => {
            if (e.key !== 'Enter' && e.key !== ' ') return
            e.preventDefault()
            if (direction === 'up' && !atTop) moveWidgetOrder(opt.id, 'up')
            if (direction === 'down' && !atBottom) moveWidgetOrder(opt.id, 'down')
          }
          return (
            <li key={opt.id} className="flex items-start gap-2">
              <div
                className="flex flex-col gap-0.5 shrink-0 pt-0.5"
                role="group"
                aria-label={`Reihenfolge: ${opt.label}`}
              >
                <button
                  type="button"
                  onClick={handleMoveUp}
                  onKeyDown={(e) => handleMoveKeyDown(e, 'up')}
                  disabled={atTop}
                  className="inline-flex items-center justify-center min-w-[2rem] min-h-[1.75rem] rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-100 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-vico-primary focus:ring-offset-2 dark:focus:ring-offset-slate-800"
                  aria-label={`${opt.label} nach oben verschieben`}
                  title="Nach oben"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={handleMoveDown}
                  onKeyDown={(e) => handleMoveKeyDown(e, 'down')}
                  disabled={atBottom}
                  className="inline-flex items-center justify-center min-w-[2rem] min-h-[1.75rem] rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-100 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-vico-primary focus:ring-offset-2 dark:focus:ring-offset-slate-800"
                  aria-label={`${opt.label} nach unten verschieben`}
                  title="Nach unten"
                >
                  ↓
                </button>
              </div>
              <label className="flex items-start gap-3 cursor-pointer flex-1 min-w-0">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => updateWidgetVisible(opt.id, e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
                  aria-describedby={`dashboard-widget-desc-${opt.id}`}
                />
                <span>
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{opt.label}</span>
                  <span id={`dashboard-widget-desc-${opt.id}`} className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {opt.description}
                  </span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
