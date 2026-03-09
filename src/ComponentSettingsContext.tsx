import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react'
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
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [refresh])

  const isEnabled = useCallback(
    (key: string) => settings[key] !== false,
    [settings]
  )

  const displayList: ComponentSetting[] =
    settingsList.length > 0
      ? settingsList
      : DEFAULT_SETTINGS_META.map((m) => ({
          id: `default-${m.component_key}`,
          component_key: m.component_key,
          label: m.label,
          enabled: settings[m.component_key] !== false,
          sort_order: m.sort_order,
          created_at: '',
          updated_at: '',
        }))

  const updateSetting = useCallback(
    async (key: string, enabled: boolean): Promise<{ ok: boolean; error?: string }> => {
      setSettings((prev) => ({ ...prev, [key]: enabled }))
      setSettingsList((prev) => {
        const base = prev.length > 0 ? prev : DEFAULT_SETTINGS_META.map((m) => ({
          id: `default-${m.component_key}`,
          component_key: m.component_key,
          label: m.label,
          enabled: m.component_key === key ? enabled : (settings[m.component_key] !== false),
          sort_order: m.sort_order,
          created_at: '',
          updated_at: '',
        }))
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
    [refresh]
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
