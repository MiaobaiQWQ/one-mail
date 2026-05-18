import { ipcMain } from 'electron'
import {
  checkForAppUpdates,
  getAppUpdateStatus,
  installDownloadedAppUpdate
} from '../services/auto-update'
import type { AppUpdateCheckResult, AppUpdateStatus } from './types'

export function registerUpdateIpc(): void {
  ipcMain.handle('updates/check', async (): Promise<AppUpdateCheckResult> => {
    return checkForAppUpdates()
  })
  ipcMain.handle('updates/status', (): AppUpdateStatus => {
    return getAppUpdateStatus()
  })
  ipcMain.handle('updates/install', (): boolean => {
    return installDownloadedAppUpdate()
  })
}
