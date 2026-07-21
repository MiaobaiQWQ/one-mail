import { ipcMain } from 'electron'
import { getNotificationStatus, testNotification } from '../services/notification-center'

export function registerNotificationIpc(): void {
  ipcMain.handle('notifications/status', () => getNotificationStatus())
  ipcMain.handle('notifications/test', () => testNotification())
}

