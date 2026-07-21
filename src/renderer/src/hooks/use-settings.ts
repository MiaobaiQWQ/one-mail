import { useSettingsStore } from '../stores'

export function useSettings() {
  const settings = useSettingsStore((state) => state.settings)
  const systemInfo = useSettingsStore((state) => state.systemInfo)
  const updateStatus = useSettingsStore((state) => state.updateStatus)
  const actions = useSettingsStore((state) => state.actions)

  return {
    settings,
    systemInfo,
    updateStatus,
    ...actions
  }
}
