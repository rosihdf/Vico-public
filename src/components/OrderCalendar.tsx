import type { Order, OrderStatus } from '../types'

const STATUS_LABELS: Record<OrderStatus, string> = {
  offen: 'Offen',
  in_bearbeitung: 'In Bearbeitung',
  erledigt: 'Abgeschlossen',
  storniert: 'Storniert',
}

const formatStatusSummary = (orders: Order[]): string => {
  const counts: Record<OrderStatus, number> = {
    offen: 0,
    in_bearbeitung: 0,
    erledigt: 0,
    storniert: 0,
  }
  orders.forEach((o) => {
    const s = o.status ?? 'offen'
    counts[s] = (counts[s] ?? 0) + 1
  })
  const labels: Record<OrderStatus, string> = {
    offen: 'offen',
    in_bearbeitung: 'in Bearbeitung',
    erledigt: 'abgeschlossen',
    storniert: 'storniert',
  }
  const parts: string[] = []
  ;(['offen', 'in_bearbeitung', 'erledigt', 'storniert'] as OrderStatus[]).forEach(
    (s) => {
      const n = counts[s]
      if (n > 0) {
        const label = labels[s]
        parts.push(
          n === 1 ? `1 Auftrag ${label}` : `${n} Aufträge ${label}`
        )
      }
    }
  )
  return parts.join(', ')
}

const STATUS_COLORS: Record<OrderStatus, string> = {
  offen: '#d97706',
  in_bearbeitung: '#2563eb',
  erledigt: '#64748b',
  storniert: '#94a3b8',
}

const formatStatusSummaryCompact = (
  orders: Order[]
): { status: OrderStatus; text: string }[] => {
  const counts: Record<OrderStatus, number> = {
    offen: 0,
    in_bearbeitung: 0,
    erledigt: 0,
    storniert: 0,
  }
  orders.forEach((o) => {
    const s = o.status ?? 'offen'
    counts[s] = (counts[s] ?? 0) + 1
  })
  const labels: Record<OrderStatus, string> = {
    offen: 'offen',
    in_bearbeitung: 'in Bearbeitung',
    erledigt: 'erledigt',
    storniert: 'storniert',
  }
  const result: { status: OrderStatus; text: string }[] = []
  ;(['offen', 'in_bearbeitung', 'erledigt', 'storniert'] as OrderStatus[]).forEach(
    (s) => {
      const n = counts[s]
      if (n > 0) result.push({ status: s, text: `${n} ${labels[s]}` })
    }
  )
  return result
}

type OrderCalendarProps = {
  orders: Order[]
  selectedDate: string | null
  onSelectDate: (date: string | null) => void
  currentMonth: Date
  onMonthChange: (date: Date) => void
  getCustomerName: (id: string) => string
  getBvName: (id: string) => string
  onOrderDateChange?: (order: Order, newDate: string) => void
}

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

const formatDate = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
const getOrdersByDate = (orders: Order[]) => {
  const map: Record<string, Order[]> = {}
  orders.forEach((o) => {
    if (!map[o.order_date]) map[o.order_date] = []
    map[o.order_date].push(o)
  })
  return map
}

export const OrderCalendar = ({
  orders,
  selectedDate,
  onSelectDate,
  currentMonth,
  onMonthChange,
  getCustomerName,
  getBvName,
}: OrderCalendarProps) => {
  const ordersByDate = getOrdersByDate(orders)
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = lastDay.getDate()
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7
  const days: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) days.push(null)
  for (let d = 1; d <= daysInMonth; d++) days.push(d)
  while (days.length < totalCells) days.push(null)

  const prevMonth = () => onMonthChange(new Date(year, month - 1))
  const nextMonth = () => onMonthChange(new Date(year, month + 1))

  const selectedOrders = selectedDate ? (ordersByDate[selectedDate] ?? []) : []

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex-1">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={prevMonth}
            className="p-2 rounded-lg hover:bg-slate-100"
            aria-label="Vorheriger Monat"
          >
            ←
          </button>
          <h3 className="text-lg font-semibold text-slate-800">
            {MONTHS[month]} {year}
          </h3>
          <button
            type="button"
            onClick={nextMonth}
            className="p-2 rounded-lg hover:bg-slate-100"
            aria-label="Nächster Monat"
          >
            →
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-sm">
          {WEEKDAYS.map((wd) => (
            <div key={wd} className="font-medium text-slate-500 py-1">
              {wd}
            </div>
          ))}
          {days.map((d, i) => {
            if (d === null) return <div key={`empty-${i}`} className="aspect-square" />
            const dateStr = formatDate(new Date(year, month, d))
            const dayOrders = ordersByDate[dateStr] ?? []
            const isSelected = selectedDate === dateStr
            const isToday = dateStr === formatDate(new Date())
            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => onSelectDate(isSelected ? null : dateStr)}
                className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-colors ${
                  isSelected
                    ? 'bg-vico-primary text-white ring-2 ring-vico-primary ring-offset-2'
                    : isToday
                      ? 'bg-amber-100 text-slate-800 hover:bg-amber-200'
                      : 'hover:bg-slate-100 text-slate-800'
                }`}
              >
                <span>{d}</span>
                {dayOrders.length > 0 && (
                  <span
                    className={`text-[9px] mt-0.5 leading-tight flex flex-col items-center gap-0.5 ${isSelected ? 'text-white/90' : ''}`}
                    title={formatStatusSummary(dayOrders)}
                  >
                    {formatStatusSummaryCompact(dayOrders).map(({ status, text }) => (
                      <span
                        key={status}
                        className="font-medium"
                        style={!isSelected ? { color: STATUS_COLORS[status] } : undefined}
                      >
                        {text}
                      </span>
                    ))}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
      {selectedDate && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 w-full lg:w-80">
          <h4 className="font-semibold text-slate-800 mb-2">
            Aufträge am {selectedDate}
          </h4>
          {selectedOrders.length === 0 ? (
            <p className="text-slate-500 text-sm">Keine Aufträge an diesem Tag.</p>
          ) : (
            <>
              <p className="text-sm text-slate-600 mb-3">
                {formatStatusSummary(selectedOrders)}
              </p>
              <ul className="space-y-2">
                {(['offen', 'in_bearbeitung', 'erledigt', 'storniert'] as OrderStatus[]).map(
                  (status) => {
                    const filtered = selectedOrders.filter((o) => o.status === status)
                    if (filtered.length === 0) return null
                    return (
                      <li key={status}>
                        <p
                          className="text-xs font-medium mb-1"
                          style={{ color: STATUS_COLORS[status] }}
                        >
                          {STATUS_LABELS[status]}
                        </p>
                        {filtered.map((o) => (
                          <div
                            key={o.id}
                            className={`text-sm border-b border-slate-100 pb-2 mb-2 last:border-0 last:mb-0 ${
                              !o.assigned_to ? 'pl-2 -ml-2 border-l-4 border-l-amber-400 bg-amber-50/50' : ''
                            }`}
                          >
                            <p className="font-medium text-slate-800">
                              {getCustomerName(o.customer_id)} → {getBvName(o.bv_id)}
                              {!o.assigned_to && (
                                <span className="ml-2 text-xs font-normal text-amber-700">(nicht zugewiesen)</span>
                              )}
                            </p>
                            <p className="text-slate-600 text-xs">{o.order_type}</p>
                          </div>
                        ))}
                      </li>
                    )
                  }
                )}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}
