import { create } from 'zustand'
import type {
  AppSettings,
  SystemInfo,
  AppUpdateStatus,
  SettingsUpdateInput
} from '../../../shared/types'
import * as api from '../lib/api'

export interface SettingsStore {
  settings: AppSettings | null
  systemInfo: SystemInfo | null
  updateStatus: AppUpdateStatus | null
  actions: {
    loadSettings: () => Promise<void>
    saveSettings: (input: SettingsUpdateInput) => Promise<void>
  }
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: null,
  systemInfo: null,
  updateStatus: null,
  actions: {
    loadSettings: async () => {
      try {
        const [settings, systemInfo] = await Promise.all([api.loadSettings(), api.getSystemInfo()])
        set({ settings, systemInfo })
      } catch (err) {
        console.error('Failed to load settings:', err)
      }
    },
    saveSettings: async (input: SettingsUpdateInput) => {
      try {
        const updated = await api.saveSettings(input)
        set({ settings: updated })
      } catch (err) {
        console.error('Failed to save settings:', err)
        throw err
      }
    }
  }
}))
