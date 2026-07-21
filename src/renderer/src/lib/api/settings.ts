import type {
  AppSettings,
  AppUpdateCheckResult,
  AppUpdateStatus,
  BackupImportProgress,
  BackupSyncDownloadResult,
  BackupSyncSettings,
  BackupSyncTestResult,
  BackupSyncTransferResult,
  BackupImportResult,
  SettingsUpdateInput,
  SystemInfo
} from '../../../../shared/types'
import { getStaticTranslation } from './common'

const platformLabel: Partial<Record<NodeJS.Platform, string>> = {
  darwin: 'macOS',
  win32: 'Windows',
  linux: 'Linux'
}

export async function loadSettings(): Promise<AppSettings> {
  return window.api.settings.get()
}

export async function getSystemInfo(): Promise<SystemInfo> {
  return window.api.system.info()
}

export async function saveSettings(input: SettingsUpdateInput): Promise<AppSettings> {
  return window.api.settings.update(input)
}

export async function importBackgroundImage(filePath: string): Promise<{ path: string; filename: string }> {
  return window.api.settings.importBackgroundImage(filePath)
}

export async function detectShortcutConflict(keyString: string, actionId: string): Promise<string | null> {
  return window.api.settings.detectShortcutConflict(keyString, actionId)
}

export async function exportSqlBackup(): Promise<string | null> {
  return window.api.settings.exportSql()
}

export async function importSqlBackup(operationId?: string): Promise<BackupImportResult> {
  return window.api.settings.importSql(operationId)
}

export async function loadBackupSyncSettings(): Promise<BackupSyncSettings> {
  return window.api.settings.getBackupSync()
}

export async function saveBackupSyncSettings(
  input: BackupSyncSettings
): Promise<BackupSyncSettings> {
  return window.api.settings.updateBackupSync(input)
}

export async function testBackupSyncSettings(
  input: BackupSyncSettings
): Promise<BackupSyncTestResult> {
  return window.api.settings.testBackupSync(input)
}

export async function uploadBackupSync(): Promise<BackupSyncTransferResult> {
  return window.api.settings.uploadBackupSync()
}

export async function downloadBackupSync(operationId?: string): Promise<BackupSyncDownloadResult> {
  return window.api.settings.downloadBackupSync(operationId)
}

export async function importBackupFromRemote(
  input: BackupSyncSettings,
  operationId?: string
): Promise<BackupSyncDownloadResult> {
  return window.api.settings.importBackupFromRemote(input, operationId)
}

export function onBackupImportProgress(
  callback: (progress: BackupImportProgress) => void
): () => void {
  return window.api.settings.onBackupImportProgress(callback)
}

export async function revealDatabaseInFileManager(): Promise<boolean> {
  return window.api.system.revealDatabase()
}

export async function revealPathInFileManager(path: string): Promise<boolean> {
  return window.api.system.revealPath(path)
}

export async function openExternalUrl(url: string): Promise<boolean> {
  return window.api.system.openExternal(url)
}

export async function testDesktopNotification(): Promise<void> {
  return window.api.notifications.test()
}

export async function checkForAppUpdates(): Promise<AppUpdateCheckResult> {
  const checkUpdates = window.api?.updates?.check
  if (typeof checkUpdates !== 'function') {
    return {
      status: 'unsupported',
      currentVersion: '',
      message: getStaticTranslation('settings.about.updateServiceUnavailable')
    }
  }

  return checkUpdates()
}

export async function getAppUpdateStatus(): Promise<AppUpdateStatus> {
  const status = window.api?.updates?.status
  if (typeof status !== 'function') {
    return {
      state: 'unsupported',
      currentVersion: '',
      message: getStaticTranslation('settings.about.updateServiceUnavailable'),
      updatedAt: new Date().toISOString()
    }
  }

  return status()
}

export function onAppUpdateStatus(callback: (status: AppUpdateStatus) => void): () => void {
  const onStatus = window.api?.updates?.onStatus
  if (typeof onStatus !== 'function') return () => {}

  return onStatus(callback)
}

export async function installAppUpdate(): Promise<boolean> {
  const install = window.api?.updates?.install
  if (typeof install !== 'function') {
    return false
  }

  return install()
}

export function getPlatformName(info?: SystemInfo): string {
  if (!info) return 'Desktop'
  return platformLabel[info.platform] ?? info.platform
}
