import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react'
import { recordMandantRealtimeSubscribeStatus } from '../shared/mandantRealtimeDegraded'
import { supabase } from './supabase'
import {
  fetchComponentSettings,
  fetchComponentSettingsFull,
  updateComponentSetting,
  DEFAULT_SETTINGS_META,
  type ComponentSetting,
} from './lib/componentSettingsService'

type ComponentSettingsContextType = {
  settings: Record<string, boolean>
  settingsList: ComponentSetting[]
  isEnabled: (key: string) => boolean
  refresh: () => Promise<void>
  updateSetting: (key: string, enabled: boolean) => Promise<{ ok: boolean; error?: string }>
}

const ComponentSettingsContext = createContext<ComponentSettingsContextType | null>(null)

const buildDefaultList = (settings: Record<string, boolean>): ComponentSetting[] =>
  DEFAULT_SETTINGS_META.map((m) => ({
    id: `default-${m.component_key}`,
    component_key: m.component_key,
    label: m.label,
    enabled: settings[m.component_key] !== false,
    sort_order: m.sort_order,
    created_at: '',
    updated_at: '',
  }))

const mergeSettingsListWithDefaults = (
  settings: Record<string, boolean>,
  settingsList: ComponentSetting[]
): ComponentSetting[] => {
  const defaults = buildDefaultList(settings)
  const byKey = new Map(settingsList.map((row) => [row.component_key, row]))
  const merged = defaults.map((fallback) => {
    const existing = byKey.get(fallback.component_key)
    return existing ? { ...fallback, ...existing } : fallback
  })
  const knownKeys = new Set(merged.map((row) => row.component_key))
  const unknownRows = settingsList.filter((row) => !knownKeys.has(row.component_key))
  return [...merged, ...unknownRows]
}

export const ComponentSettingsProvider = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const [settings, setSettings] = useState<Record<string, boolean>>({})
  const [settingsList, setSettingsList] = useState<ComponentSetting[]>([])

  const refresh = useCallback(async () => {
    const [map, list] = await Promise.all([
      fetchComponentSettings(),
      fetchComponentSettingsFull(),
    ])
    setSettings(map)
    setSettingsList(list)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const channel = supabase
      .channel('component_settings_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'component_settings' },
        () => { refresh() }
      )
      .subscribe((status, err) => {
        recordMandantRealtimeSubscribeStatus(status, err ?? undefined)
      })
    return () => {
      supabase.removeChannel(channel)
    }
  }, [refresh])

  const isEnabled = useCallback(
    (key: string) => settings[key] !== false,
    [settings]
  )

  const displayList: ComponentSetting[] = mergeSettingsListWithDefaults(settings, settingsList)

  const updateSetting = useCallback(
    async (key: string, enabled: boolean): Promise<{ ok: boolean; error?: string }> => {
      setSettings((prev) => ({ ...prev, [key]: enabled }))
      setSettingsList((prev) => {
        const base = mergeSettingsListWithDefaults(settings, prev)
        return base.map((s) =>
          s.component_key === key ? { ...s, enabled, updated_at: new Date().toISOString() } : s
        )
      })
      const result = await updateComponentSetting(key, enabled)
      if (result.ok) {
        await refresh()
      } else {
        setSettings((prev) => ({ ...prev, [key]: !enabled }))
        setSettingsList((prev) =>
          prev.map((s) => (s.component_key === key ? { ...s, enabled: !enabled } : s))
        )
      }
      return result
    },
    [refresh, settings]
  )

  return (
    <ComponentSettingsContext.Provider
      value={{ settings, settingsList: displayList, isEnabled, refresh, updateSetting }}
    >
      {children}
    </ComponentSettingsContext.Provider>
  )
}

export const useComponentSettings = () => {
  const ctx = useContext(ComponentSettingsContext)
  if (!ctx) throw new Error('useComponentSettings must be used within ComponentSettingsProvider')
  return ctx
}
