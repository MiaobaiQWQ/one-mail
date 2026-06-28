import { ipcMain } from 'electron'
import {
  getBackupSyncSettings,
  getSettings,
  updateBackupSyncSettings,
  updateSettings
} from '../db/repositories/settings.repository'
import { downloadBackupSync, uploadBackupSync } from '../services/backup-sync'
import { exportDatabaseSqlBackup, importDatabaseSqlBackup } from '../services/database-backup'
import { refreshMailboxWatchers } from '../services/mailbox-watch'
import type { BackupSyncSettings, SettingsUpdateInput } from './types'

export function registerSettingsIpc(): void {
  ipcMain.handle('settings/get', () => getSettings())
  ipcMain.handle('settings/update', (_event, input: SettingsUpdateInput) => {
    const settings = updateSettings(input)
    refreshMailboxWatchers()
    return settings
  })
  ipcMain.handle('settings/getBackupSync', () => getBackupSyncSettings())
  ipcMain.handle('settings/updateBackupSync', (_event, input: BackupSyncSettings) =>
    updateBackupSyncSettings(input)
  )
  ipcMain.handle('settings/uploadBackupSync', () => uploadBackupSync())
  ipcMain.handle('settings/downloadBackupSync', async () => {
    const result = await downloadBackupSync()
    if (result.imported) refreshMailboxWatchers()
    return result
  })
  ipcMain.handle('settings/exportSql', () => exportDatabaseSqlBackup())
  ipcMain.handle('settings/importSql', async () => {
    const result = await importDatabaseSqlBackup()
    if (result.imported) refreshMailboxWatchers()
    return result
  })
}
