import React from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native'
import type { Order, OrderStatus } from '../lib/types'

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

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
        parts.push(n === 1 ? `1 Auftrag ${label}` : `${n} Aufträge ${label}`)
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
  const abbrev: Record<OrderStatus, string> = {
    offen: 'offen',
    in_bearbeitung: 'i.B.',
    erledigt: 'erl.',
    storniert: 'storn.',
  }
  const result: { status: OrderStatus; text: string }[] = []
  ;(['offen', 'in_bearbeitung', 'erledigt', 'storniert'] as OrderStatus[]).forEach(
    (s) => {
      const n = counts[s]
      if (n > 0) result.push({ status: s, text: `${n} ${abbrev[s]}` })
    }
  )
  return result
}

const MONTHS = [
  'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez',
]

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

type OrderCalendarProps = {
  orders: Order[]
  selectedDate: string | null
  onSelectDate: (date: string | null) => void
  currentMonth: Date
  onMonthChange: (date: Date) => void
  getCustomerName: (id: string) => string
  getBvName: (id: string) => string
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={prevMonth} style={styles.navBtn} accessibilityLabel="Vorheriger Monat">
          <Text style={styles.navText}>←</Text>
        </Pressable>
        <Text style={styles.monthTitle}>
          {MONTHS[month]} {year}
        </Text>
        <Pressable onPress={nextMonth} style={styles.navBtn} accessibilityLabel="Nächster Monat">
          <Text style={styles.navText}>→</Text>
        </Pressable>
      </View>
      <View style={styles.weekdays}>
        {WEEKDAYS.map((wd) => (
          <Text key={wd} style={styles.weekday}>
            {wd}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {days.map((d, i) => {
          if (d === null) return <View key={`e-${i}`} style={styles.cell} />
          const dateStr = formatDate(new Date(year, month, d))
          const dayOrders = ordersByDate[dateStr] ?? []
          const isSelected = selectedDate === dateStr
          const isToday = dateStr === formatDate(new Date())
          return (
            <Pressable
              key={dateStr}
              onPress={() => onSelectDate(isSelected ? null : dateStr)}
              style={[
                styles.cell,
                isSelected && styles.cellSelected,
                isToday && !isSelected && styles.cellToday,
              ]}
            >
              <Text
                style={[
                  styles.cellDay,
                  isSelected && styles.cellSelectedText,
                ]}
              >
                {d}
              </Text>
              {dayOrders.length > 0 && (
                <View style={styles.cellStatusList}>
                  {formatStatusSummaryCompact(dayOrders).map(({ status, text }) => (
                    <Text
                      key={status}
                      style={[
                        styles.cellCount,
                        isSelected && styles.cellSelectedText,
                        !isSelected && { color: STATUS_COLORS[status] },
                      ]}
                    >
                      {text}
                    </Text>
                  ))}
                </View>
              )}
            </Pressable>
          )
        })}
      </View>
      {selectedDate && (
        <View style={styles.detail}>
          <Text style={styles.detailTitle}>Aufträge am {selectedDate}</Text>
          {selectedOrders.length === 0 ? (
            <Text style={styles.detailEmpty}>Keine Aufträge an diesem Tag.</Text>
          ) : (
            <ScrollView style={styles.detailList}>
              <Text style={styles.detailSummary}>
                {formatStatusSummary(selectedOrders)}
              </Text>
                {(['offen', 'in_bearbeitung', 'erledigt', 'storniert'] as OrderStatus[]).map(
                  (status) => {
                    const filtered = selectedOrders.filter((o) => o.status === status)
                    if (filtered.length === 0) return null
                    return (
                      <View key={status} style={styles.detailGroup}>
                        <Text
                          style={[
                            styles.detailGroupTitle,
                            { color: STATUS_COLORS[status] },
                          ]}
                        >
                          {STATUS_LABELS[status]}
                        </Text>
                      {filtered.map((o) => (
                        <View
                          key={o.id}
                          style={[
                            styles.detailItem,
                            !o.assigned_to && styles.detailItemUnassigned,
                          ]}
                        >
                          <Text style={styles.detailItemTitle}>
                            {getCustomerName(o.customer_id)} → {getBvName(o.bv_id)}
                            {!o.assigned_to && (
                              <Text style={styles.detailItemUnassignedBadge}> (nicht zugewiesen)</Text>
                            )}
                          </Text>
                          <Text style={styles.detailItemSub}>{o.order_type}</Text>
                        </View>
                      ))}
                    </View>
                  )
                }
              )}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navBtn: {
    padding: 8,
  },
  navText: {
    fontSize: 18,
    color: '#475569',
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  weekdays: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginBottom: 2,
  },
  cellSelected: {
    backgroundColor: '#5b7895',
  },
  cellToday: {
    backgroundColor: '#fef3c7',
  },
  cellDay: {
    fontSize: 14,
    color: '#0f172a',
  },
  cellStatusList: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 0,
    marginTop: 2,
  },
  cellCount: {
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },
  cellSelectedText: {
    color: '#fff',
  },
  detail: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    maxHeight: 150,
  },
  detailTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
  },
  detailEmpty: {
    fontSize: 14,
    color: '#64748b',
  },
  detailList: {},
  detailSummary: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 12,
  },
  detailGroup: {
    marginBottom: 8,
  },
  detailGroupTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  detailItem: {
    paddingVertical: 4,
    paddingLeft: 8,
    marginLeft: -8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
  },
  detailItemUnassigned: {
    backgroundColor: '#fff',
    borderLeftColor: '#f59e0b',
  },
  detailItemUnassignedBadge: {
    fontSize: 12,
    color: '#b45309',
    fontWeight: '400',
  },
  detailItemTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0f172a',
  },
  detailItemSub: {
    fontSize: 12,
    color: '#64748b',
  },
})
