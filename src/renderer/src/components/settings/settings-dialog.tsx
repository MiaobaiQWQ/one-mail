import { zodResolver } from '@hookform/resolvers/zod'
import {
  BadgeInfo,
  CalendarRange,
  Clock3,
  DatabaseBackup,
  Download,
  ExternalLink,
  FileUp,
  FolderOpen,
  KeyRound,
  Languages,
  LoaderCircle,
  Power,
  RefreshCcw,
  Save,
  ShieldCheck,
  Upload,
  Palette,
  Keyboard,
  Languages as TranslateIcon,
  ShieldAlert,
  Bell,
  X
} from 'lucide-react'
import * as React from 'react'
import { Controller, useForm, useWatch, FormProvider } from 'react-hook-form'
import { z } from 'zod'

import {
  exportSqlBackup,
  loadBackupSyncSettings,
  openExternalUrl,
  revealPathInFileManager,
  saveBackupSyncSettings,
  testBackupSyncSettings,
  uploadBackupSync
} from '@renderer/lib/api'
import {
  BackupImportDialog,
  type BackupImportDialogSource
} from '@renderer/components/backup/backup-import-dialog'
import { getBackupSyncSettingsKey } from '@renderer/components/backup/backup-sync-draft'
import { BackupSyncFields } from '@renderer/components/backup/backup-sync-fields'
import { ResponsiveDialog } from '@renderer/components/responsive-dialog'
import { AppearanceSettings } from './appearance-settings'
import { ShortcutsSettings } from './shortcuts-settings'
import { TranslateSettings } from './translate-settings'
import { PrivacySettings } from './privacy-settings'
import { NotificationSettings } from './notification-settings'
import { Button } from '@renderer/components/ui/button'
import {
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel
} from '@renderer/components/ui/field'
import { Input } from '@renderer/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { Switch } from '@renderer/components/ui/switch'
import { Alert, AlertDescription, AlertTitle } from '@renderer/components/ui/alert'
import type {
  AppSettings,
  AppTheme,
  MenuDisplayMode,
  ShortcutBinding,
  TranslateProvider,
  PrivacyMode,
  AppUpdateStatus,
  BackupImportResult,
  BackupImportSource,
  BackupSyncDownloadResult,
  BackupSyncSettings,
  SettingsUpdateInput,
  SystemInfo
} from '../../../../shared/types'
import { cn } from '@renderer/lib/utils'
import { useI18n, type TranslationKey } from '@renderer/lib/i18n'
import { ONEMAIL_HOMEPAGE_URL, hasAvailableUpdate } from '@renderer/lib/update-status'

import { SettingRow } from './setting-row'

type SettingsDialogProps = {
  open: boolean
  settings: AppSettings | null
  systemInfo: SystemInfo | null
  updateStatus: AppUpdateStatus | null
  initialSection?: SettingsSection
  onOpenChange: (open: boolean) => void
  onSubmit: (input: SettingsUpdateInput) => Promise<void>
  onImported?: () => Promise<void> | void
}

type SettingsSection =
  | 'general'
  | 'appearance'
  | 'shortcuts'
  | 'translate'
  | 'privacy'
  | 'notification'
  | 'backup'
  | 'about'
type BackupPending =
  | 'export'
  | 'import'
  | 'saveRemote'
  | 'testRemote'
  | 'uploadRemote'
  | 'downloadRemote'
  | null
type BackupMessage = {
  label: string
  path?: string
}

const AUTO_SAVE_DELAY_MS = 350

export type SettingsFormValues = {
  syncIntervalMinutes: number
  syncWindowDays: number
  openAtLogin: boolean
  locale: 'zh-CN' | 'en-US'
  theme: AppTheme
  contextMenuEnabled: boolean
  contextMenuOptions: string[]
  menuDisplayMode: MenuDisplayMode
  shortcuts: ShortcutBinding[]
  translateProvider: TranslateProvider
  translateEndpoint?: string
  translateApiKey?: string
  privacyMode: PrivacyMode
  notificationsEnabled: boolean
  notificationSound?: string
}

const sections: Array<{
  value: SettingsSection
  labelKey: TranslationKey
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}> = [
  {
    value: 'general',
    labelKey: 'settings.general',
    icon: RefreshCcw
  },
  {
    value: 'appearance',
    labelKey: 'settings.appearance',
    icon: Palette
  },
  {
    value: 'shortcuts',
    labelKey: 'settings.shortcuts',
    icon: Keyboard
  },
  {
    value: 'translate',
    labelKey: 'settings.translate',
    icon: TranslateIcon
  },
  {
    value: 'privacy',
    labelKey: 'settings.privacy',
    icon: ShieldAlert
  },
  {
    value: 'notification',
    labelKey: 'settings.notifications',
    icon: Bell
  },
  {
    value: 'backup',
    labelKey: 'settings.backup',
    icon: DatabaseBackup
  },
  {
    value: 'about',
    labelKey: 'settings.about',
    icon: BadgeInfo
  }
]

function useMediaQuery(query: string): boolean {
  return React.useSyncExternalStore(
    (onStoreChange) => {
      const media = window.matchMedia(query)
      media.addEventListener('change', onStoreChange)

      return () => media.removeEventListener('change', onStoreChange)
    },
    () => window.matchMedia(query).matches,
    () => false
  )
}

export function SettingsDialog({
  open,
  settings,
  systemInfo,
  updateStatus,
  initialSection = 'general',
  onOpenChange,
  onSubmit,
  onImported
}: SettingsDialogProps): React.JSX.Element {
  const { t } = useI18n()
  const settingsSchema = React.useMemo(() => createSettingsSchema(t), [t])
  const [section, setSection] = React.useState<SettingsSection>('general')
  const [pending, setPending] = React.useState(false)
  const [backupPending, setBackupPending] = React.useState<BackupPending>(null)
  const [backupImportDialogOpen, setBackupImportDialogOpen] = React.useState(false)
  const [backupImportDefaultSource, setBackupImportDefaultSource] =
    React.useState<BackupImportDialogSource>('sql')
  const [backupImportSyncSettings, setBackupImportSyncSettings] =
    React.useState<BackupSyncSettings | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [backupMessage, setBackupMessage] = React.useState<BackupMessage | null>(null)
  const [backupError, setBackupError] = React.useState<string | null>(null)
  const [backupSyncSettings, setBackupSyncSettings] = React.useState<BackupSyncSettings | null>(
    null
  )
  const lastSavedValuesRef = React.useRef<SettingsFormValues>(toFormValues(settings))
  const autoSaveTimerRef = React.useRef<number | null>(null)
  const queuedValuesRef = React.useRef<SettingsFormValues | null>(null)
  const savingRef = React.useRef(false)
  const wasOpenRef = React.useRef(false)
  const backupImportSourceRef = React.useRef<BackupImportDialogSource>('sql')
  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: toFormValues(settings),
    mode: 'onChange'
  })
  const watchedValues = useWatch({ control: form.control })
  
  // 拖拽状态
  const [position, setPosition] = React.useState<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const dragStartRef = React.useRef<{ x: number; y: number } | null>(null)
  const initialPositionRef = React.useRef<{ x: number; y: number } | null>(null)
  const dialogRef = React.useRef<HTMLDivElement | null>(null)
  const isDesktop = useMediaQuery('(min-width: 768px)')

  // 拖拽事件处理
  const handleMouseDown = React.useCallback((event: React.MouseEvent) => {
    if (event.target instanceof HTMLButtonElement || 
        event.target instanceof SVGElement ||
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLSelectElement) {
      return
    }
    setIsDragging(true)
    dragStartRef.current = { x: event.clientX, y: event.clientY }
    
    // 获取当前弹窗的实际位置作为起点
    if (position) {
      initialPositionRef.current = position
    } else if (dialogRef.current) {
      const rect = dialogRef.current.getBoundingClientRect()
      initialPositionRef.current = { x: rect.left, y: rect.top }
    } else {
      initialPositionRef.current = { x: 0, y: 0 }
    }
  }, [position])

  React.useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (event: MouseEvent) => {
      if (!dragStartRef.current || !initialPositionRef.current) return
      const deltaX = event.clientX - dragStartRef.current.x
      const deltaY = event.clientY - dragStartRef.current.y
      setPosition({
        x: initialPositionRef.current.x + deltaX,
        y: initialPositionRef.current.y + deltaY
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      dragStartRef.current = null
      initialPositionRef.current = null
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  const saveSettingsValues = React.useCallback(
    async (values: SettingsFormValues): Promise<void> => {
      if (areSettingsEqual(values, lastSavedValuesRef.current)) return
      if (savingRef.current) {
        queuedValuesRef.current = values
        return
      }

      savingRef.current = true
      setPending(true)
      setError(null)

      let nextValues: SettingsFormValues | null = values
      while (nextValues) {
        const currentValues = nextValues
        queuedValuesRef.current = null

        try {
          await onSubmit({
            syncIntervalMinutes: currentValues.syncIntervalMinutes,
            syncWindowDays: currentValues.syncWindowDays,
            openAtLogin: currentValues.openAtLogin,
            locale: currentValues.locale,
            theme: currentValues.theme,
            contextMenuEnabled: currentValues.contextMenuEnabled,
            contextMenuOptions: currentValues.contextMenuOptions,
            menuDisplayMode: currentValues.menuDisplayMode,
            shortcuts: currentValues.shortcuts,
            translateProvider: currentValues.translateProvider,
            translateEndpoint: currentValues.translateEndpoint,
            translateApiKey: currentValues.translateApiKey,
            privacyMode: currentValues.privacyMode,
            notificationsEnabled: currentValues.notificationsEnabled,
            notificationSound: currentValues.notificationSound
          })
          lastSavedValuesRef.current = currentValues
        } catch (submitError) {
          setError(submitError instanceof Error ? submitError.message : t('settings.updateError'))
          break
        }

        nextValues = queuedValuesRef.current
        if (nextValues && areSettingsEqual(nextValues, lastSavedValuesRef.current)) {
          nextValues = null
        }
      }

      savingRef.current = false
      queuedValuesRef.current = null
      setPending(false)
    },
    [onSubmit, t]
  )

  const flushPendingSettings = React.useCallback((): void => {
    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }

    const parsedValues = settingsSchema.safeParse(form.getValues())
    if (parsedValues.success) {
      void saveSettingsValues(parsedValues.data)
    }
  }, [form, saveSettingsValues, settingsSchema])

  React.useEffect(() => {
    if (!open) {
      wasOpenRef.current = false
      return
    }
    if (wasOpenRef.current) return

    const nextValues = toFormValues(settings)
    lastSavedValuesRef.current = nextValues
    form.reset(nextValues)
    setSection(initialSection)
    wasOpenRef.current = true
  }, [form, initialSection, open, settings])

  React.useEffect(() => {
    if (!open || section !== 'backup') return

    let cancelled = false
    void loadBackupSyncSettings()
      .then((nextSettings) => {
        if (!cancelled) setBackupSyncSettings(nextSettings)
      })
      .catch((loadError) => {
        if (!cancelled) {
          setBackupError(
            loadError instanceof Error ? loadError.message : t('settings.backup.error')
          )
        }
      })

    return () => {
      cancelled = true
    }
  }, [open, section, t])

  React.useEffect(() => {
    if (!open) return

    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }

    const parsedValues = settingsSchema.safeParse(watchedValues)
    if (!parsedValues.success) return
    if (areSettingsEqual(parsedValues.data, lastSavedValuesRef.current)) return

    autoSaveTimerRef.current = window.setTimeout(() => {
      autoSaveTimerRef.current = null
      void saveSettingsValues(parsedValues.data)
    }, AUTO_SAVE_DELAY_MS)

    return () => {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current)
        autoSaveTimerRef.current = null
      }
    }
  }, [open, saveSettingsValues, settingsSchema, watchedValues])

  React.useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current)
        autoSaveTimerRef.current = null
      }
    }
  }, [])

  function handleOpenChange(nextOpen: boolean): void {
    if ((pending || backupPending) && !nextOpen) return

    if (!nextOpen) {
      flushPendingSettings()
      setError(null)
      setBackupError(null)
      setBackupMessage(null)
      setSection('general')
    }
    onOpenChange(nextOpen)
  }

  async function handleExport(): Promise<void> {
    await runBackupAction('export', async () => {
      const path = await exportSqlBackup()
      setBackupMessage(
        path
          ? { label: t('settings.backup.exported'), path }
          : { label: t('settings.backup.exportCanceled') }
      )
    })
  }

  function handleImport(): void {
    openBackupImportDialog('sql')
  }

  async function handleSaveBackupSync(input: BackupSyncSettings): Promise<void> {
    await runBackupAction('saveRemote', async () => {
      const nextSettings = await saveBackupSyncSettings(input)
      setBackupSyncSettings(nextSettings)
      setBackupMessage({ label: t('settings.backup.remoteSaved') })
    })
  }

  async function handleTestBackupSync(input: BackupSyncSettings): Promise<void> {
    await runBackupAction('testRemote', async () => {
      const result = await testBackupSyncSettings(input)
      setBackupMessage({
        label: t('settings.backup.remoteTested'),
        path: result.remotePath
      })
    })
  }

  async function handleUploadBackupSync(): Promise<void> {
    await runBackupAction('uploadRemote', async () => {
      const result = await uploadBackupSync()
      setBackupMessage({
        label: t('settings.backup.remoteUploaded'),
        path: result.remotePath
      })
    })
  }

  function handleDownloadBackupSync(input: BackupSyncSettings): void {
    if (input.provider === 'none') return
    openBackupImportDialog(input.provider, input)
  }

  function openBackupImportDialog(
    source: BackupImportDialogSource,
    syncInput?: BackupSyncSettings
  ): void {
    if (backupPending) return
    backupImportSourceRef.current = source
    setBackupImportDefaultSource(source)
    setBackupImportSyncSettings(syncInput ?? null)
    setBackupError(null)
    setBackupMessage(null)
    setBackupImportDialogOpen(true)
  }

  function handleBackupImportBusyChange(busy: boolean): void {
    setBackupPending(
      busy ? (backupImportSourceRef.current === 'sql' ? 'import' : 'downloadRemote') : null
    )
  }

  async function handleBackupImported(
    result: BackupImportResult | BackupSyncDownloadResult,
    source: BackupImportSource
  ): Promise<void> {
    const remote = source !== 'local'
    setBackupMessage({
      label: formatImportResultMessage(result, remote, t),
      path: remote && 'remotePath' in result ? result.remotePath : result.filePath
    })
    await onImported?.()
  }

  async function runBackupAction(
    action: Exclude<BackupPending, null>,
    task: () => Promise<void>
  ): Promise<void> {
    setBackupPending(action)
    setBackupError(null)
    setBackupMessage(null)

    try {
      await task()
    } catch (backupActionError) {
      setBackupError(getBackupActionErrorMessage(backupActionError, t))
    } finally {
      setBackupPending(null)
    }
  }

  // 重置位置
  React.useEffect(() => {
    if (!open) {
      setPosition(null)
    }
  }, [open])

  // 桌面端内容（可拖拽、非模态）
  const DesktopContent = (
    <div
      ref={dialogRef}
      className={cn(
        'fixed z-50 grid w-[min(calc(100%-2rem),672px)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-lg border bg-background shadow-lg',
        'h-[min(560px,82vh)]'
      )}
      style={{
        left: position ? position.x : '50%',
        top: position ? position.y : '50%',
        transform: position 
          ? undefined
          : 'translate(-50%, -50%)',
        cursor: isDragging ? 'grabbing' : undefined
      }}
    >
      {/* 拖拽手柄和标题栏 */}
      <div
        className="shrink-0 flex cursor-grab items-center justify-between border-b bg-muted/30 px-4 py-3 pr-3 select-none"
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
      >
        <h2 className="text-sm font-semibold">{t('settings.title')}</h2>
        <button
          type="button"
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
          aria-label="Close"
          onClick={() => handleOpenChange(false)}
        >
          <X className="size-4" />
        </button>
      </div>

      {/* 主体内容 */}
      <div className="grid h-full min-h-0 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden md:grid-cols-[136px_minmax(0,1fr)] md:grid-rows-1">
        <nav className="min-h-0 shrink-0 border-b bg-muted/30 p-1.5 md:border-r md:border-b-0 md:p-2">
          <div className="flex gap-1 md:flex-col">
            {sections.map((item) => {
              const Icon = item.icon
              const active = section === item.value

              return (
                <button
                  key={item.value}
                  type="button"
                  className={cn(
                    'flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 text-left text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring md:w-full md:flex-none [&_svg]:size-3.5',
                    active
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:bg-background/70 hover:text-foreground'
                  )}
                  onClick={() => setSection(item.value)}
                >
                  <Icon className="shrink-0" aria-hidden="true" />
                  <span className="min-w-0 truncate font-medium">{t(item.labelKey)}</span>
                </button>
              )
            })}
          </div>
        </nav>

        <div className="h-full min-h-0 overflow-auto">
          <FormProvider {...form}>
              {section === 'general' ? (
                <GeneralSettingsForm form={form} error={error} />
              ) : section === 'appearance' ? (
                <AppearanceSettings />
              ) : section === 'shortcuts' ? (
                <ShortcutsSettings />
              ) : section === 'translate' ? (
                <TranslateSettings />
              ) : section === 'privacy' ? (
                <PrivacySettings />
              ) : section === 'notification' ? (
                <NotificationSettings />
              ) : section === 'backup' ? (
                <BackupSettings
                  key={getBackupSyncSettingsKey(backupSyncSettings)}
                  pending={backupPending}
                  message={backupMessage}
                  error={backupError}
                  syncSettings={backupSyncSettings}
                  onExport={handleExport}
                  onImport={handleImport}
                  onSaveSync={handleSaveBackupSync}
                  onTestSync={handleTestBackupSync}
                  onUploadSync={handleUploadBackupSync}
                  onDownloadSync={handleDownloadBackupSync}
                />
              ) : (
                <AboutSettings systemInfo={systemInfo} updateStatus={updateStatus} />
              )}
            </FormProvider>
        </div>
      </div>
    </div>
  )

  // 移动端内容（Drawer）
  const MobileContent = (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={t('settings.title')}
      contentClassName="h-[min(560px,82vh)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-2xl"
      headerClassName="shrink-0 border-b px-4 py-3 pr-12 [&_[data-slot=dialog-title]]:text-sm! [&_[data-slot=drawer-title]]:text-sm!"
      bodyClassName="h-full min-h-0 overflow-hidden"
    >
      <div className="grid h-full min-h-0 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden md:grid-cols-[136px_minmax(0,1fr)] md:grid-rows-1">
        <nav className="min-h-0 shrink-0 border-b bg-muted/30 p-1.5 md:border-r md:border-b-0 md:p-2">
          <div className="flex gap-1 md:flex-col">
            {sections.map((item) => {
              const Icon = item.icon
              const active = section === item.value

              return (
                <button
                  key={item.value}
                  type="button"
                  className={cn(
                    'flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 text-left text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring md:w-full md:flex-none [&_svg]:size-3.5',
                    active
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:bg-background/70 hover:text-foreground'
                  )}
                  onClick={() => setSection(item.value)}
                >
                  <Icon className="shrink-0" aria-hidden="true" />
                  <span className="min-w-0 truncate font-medium">{t(item.labelKey)}</span>
                </button>
              )
            })}
          </div>
        </nav>

        <div className="h-full min-h-0 overflow-auto">
          <FormProvider {...form}>
              {section === 'general' ? (
                <GeneralSettingsForm form={form} error={error} />
              ) : section === 'appearance' ? (
                <AppearanceSettings />
              ) : section === 'shortcuts' ? (
                <ShortcutsSettings />
              ) : section === 'translate' ? (
                <TranslateSettings />
              ) : section === 'privacy' ? (
                <PrivacySettings />
              ) : section === 'notification' ? (
                <NotificationSettings />
              ) : section === 'backup' ? (
                <BackupSettings
                  key={getBackupSyncSettingsKey(backupSyncSettings)}
                  pending={backupPending}
                  message={backupMessage}
                  error={backupError}
                  syncSettings={backupSyncSettings}
                  onExport={handleExport}
                  onImport={handleImport}
                  onSaveSync={handleSaveBackupSync}
                  onTestSync={handleTestBackupSync}
                  onUploadSync={handleUploadBackupSync}
                  onDownloadSync={handleDownloadBackupSync}
                />
              ) : (
                <AboutSettings systemInfo={systemInfo} updateStatus={updateStatus} />
              )}
            </FormProvider>
        </div>
      </div>
    </ResponsiveDialog>
  )

  return (
    <>
      {open && (isDesktop ? DesktopContent : MobileContent)}

      <BackupImportDialog
        open={backupImportDialogOpen}
        defaultSource={backupImportDefaultSource}
        syncSettings={backupImportSyncSettings ?? backupSyncSettings ?? undefined}
        onOpenChange={(nextOpen) => {
          setBackupImportDialogOpen(nextOpen)
          if (!nextOpen) setBackupImportSyncSettings(null)
        }}
        onBusyChange={handleBackupImportBusyChange}
        onImported={handleBackupImported}
      />
    </>
  )
}

function GeneralSettingsForm({
  form,
  error
}: {
  form: ReturnType<typeof useForm<SettingsFormValues>>
  error: string | null
}): React.JSX.Element {
  const { t } = useI18n()

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[540px] flex-col gap-3 p-3 sm:p-4">
      <FieldGroup className="gap-2.5">
        <Controller
          control={form.control}
          name="openAtLogin"
          render={({ field }) => (
            <SettingRow
              icon={Power}
              title={t('settings.openAtLogin.title')}
              description={t('settings.openAtLogin.description')}
              control={
                <Switch
                  id="open-at-login"
                  size="sm"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              }
            />
          )}
        />

        <SettingRow
          icon={Clock3}
          title={t('settings.syncInterval.title')}
          description={t('settings.syncInterval.description')}
          control={
            <Input
              id="sync-interval-minutes"
              className="w-28"
              type="number"
              min={0}
              max={1440}
              aria-invalid={Boolean(form.formState.errors.syncIntervalMinutes)}
              {...form.register('syncIntervalMinutes', { valueAsNumber: true })}
            />
          }
          error={form.formState.errors.syncIntervalMinutes?.message}
          invalid={Boolean(form.formState.errors.syncIntervalMinutes)}
        />

        <SettingRow
          icon={CalendarRange}
          title={t('settings.syncWindow.title')}
          description={t('settings.syncWindow.description')}
          control={
            <Input
              id="sync-window-days"
              className="w-28"
              type="number"
              min={1}
              max={3650}
              aria-invalid={Boolean(form.formState.errors.syncWindowDays)}
              {...form.register('syncWindowDays', { valueAsNumber: true })}
            />
          }
          error={form.formState.errors.syncWindowDays?.message}
          invalid={Boolean(form.formState.errors.syncWindowDays)}
        />

        <Controller
          control={form.control}
          name="locale"
          render={({ field }) => (
            <SettingRow
              icon={Languages}
              title={t('settings.locale.title')}
              description={t('settings.locale.description')}
              control={
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="locale"
                    size="sm"
                    className="w-36"
                    aria-invalid={Boolean(form.formState.errors.locale)}
                  >
                    <SelectValue placeholder={t('settings.locale.placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="zh-CN">{t('settings.locale.zhCN')}</SelectItem>
                      <SelectItem value="en-US">{t('settings.locale.enUS')}</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              }
              error={form.formState.errors.locale?.message}
              invalid={Boolean(form.formState.errors.locale)}
            />
          )}
        />

        {error ? <FieldError>{error}</FieldError> : null}
      </FieldGroup>
    </div>
  )
}

function BackupSettings({
  pending,
  message,
  error,
  syncSettings,
  onExport,
  onImport,
  onSaveSync,
  onTestSync,
  onUploadSync,
  onDownloadSync
}: {
  pending: BackupPending
  message: BackupMessage | null
  error: string | null
  syncSettings: BackupSyncSettings | null
  onExport: () => Promise<void>
  onImport: () => void
  onSaveSync: (input: BackupSyncSettings) => Promise<void>
  onTestSync: (input: BackupSyncSettings) => Promise<void>
  onUploadSync: () => Promise<void>
  onDownloadSync: (input: BackupSyncSettings) => void
}): React.JSX.Element {
  const { t } = useI18n()
  const [draft, setDraft] = React.useState<BackupSyncSettings>(
    () => syncSettings ?? { provider: 'none' }
  )
  const disabled = Boolean(pending)
  const remoteConfigured = Boolean(syncSettings && syncSettings.provider !== 'none')

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[540px] flex-col gap-3 p-3 sm:p-4">
      <FieldGroup className="gap-2.5">
        <Alert className="bg-muted/30 py-2 text-xs">
          <KeyRound />
          <AlertTitle>{t('settings.backup.securityTitle')}</AlertTitle>
          <AlertDescription className="text-xs">
            {t('settings.backup.securityDescription')}
          </AlertDescription>
        </Alert>

        <div className="grid gap-2 sm:grid-cols-2">
          <BackupActionButton
            icon={Download}
            title={t('settings.backup.export')}
            loadingTitle={t('settings.backup.exporting')}
            description={t('settings.backup.exportDescription')}
            loading={pending === 'export'}
            disabled={disabled}
            onClick={onExport}
          />
          <BackupActionButton
            icon={FileUp}
            title={t('settings.backup.import')}
            loadingTitle={t('settings.backup.importing')}
            description={t('settings.backup.importDescription')}
            loading={pending === 'import'}
            disabled={disabled}
            onClick={onImport}
          />
        </div>

        <div className="flex flex-col gap-2 rounded-md border bg-card p-3">
          <div className="flex flex-col gap-1">
            <FieldLabel className="text-xs">{t('settings.backup.remoteTitle')}</FieldLabel>
            <FieldDescription className="text-xs leading-snug">
              {t('settings.backup.remoteDescription')}
            </FieldDescription>
          </div>

          <BackupSyncFields
            draft={draft}
            currentSettings={syncSettings}
            disabled={disabled}
            onChange={setDraft}
          />

          <div className="grid gap-2 sm:grid-cols-2">
            <BackupActionButton
              icon={Save}
              title={t('settings.backup.remoteSave')}
              loadingTitle={t('settings.backup.remoteSaving')}
              description={t('settings.backup.remoteSaveDescription')}
              loading={pending === 'saveRemote'}
              disabled={disabled}
              onClick={() => onSaveSync(draft)}
            />
            <BackupActionButton
              icon={RefreshCcw}
              title={t('settings.backup.remoteTest')}
              loadingTitle={t('settings.backup.remoteTesting')}
              description={t('settings.backup.remoteTestDescription')}
              loading={pending === 'testRemote'}
              disabled={disabled || draft.provider === 'none'}
              onClick={() => onTestSync(draft)}
            />
            <BackupActionButton
              icon={Upload}
              title={t('settings.backup.remoteUpload')}
              loadingTitle={t('settings.backup.remoteUploading')}
              description={t('settings.backup.remoteUploadDescription')}
              loading={pending === 'uploadRemote'}
              disabled={disabled || !remoteConfigured}
              onClick={onUploadSync}
            />
            <BackupActionButton
              icon={Download}
              title={t('settings.backup.remoteDownload')}
              loadingTitle={t('settings.backup.remoteDownloading')}
              description={t('settings.backup.remoteDownloadDescription')}
              loading={pending === 'downloadRemote'}
              disabled={disabled || draft.provider === 'none'}
              onClick={() => onDownloadSync(draft)}
            />
          </div>
        </div>

        {message ? <BackupMessageView message={message} /> : null}
        {error ? <FieldError>{error}</FieldError> : null}
      </FieldGroup>
    </div>
  )
}

function formatImportResultMessage(
  result: BackupImportResult,
  remote: boolean,
  t: (key: TranslationKey, values?: Record<string, string | number>) => string
): string {
  const values = {
    accounts: result.accountCount ?? 0,
    messages: result.messageCount ?? 0
  }

  return t(
    remote ? 'settings.backup.remoteDownloadedSummary' : 'settings.backup.importedSummary',
    values
  )
}

function getBackupActionErrorMessage(error: unknown, t: (key: TranslationKey) => string): string {
  const message = error instanceof Error ? error.message : t('settings.backup.error')
  return message.replace(/^Error invoking remote method '[^']+':\s*/i, '')
}

function AboutSettings({
  systemInfo,
  updateStatus
}: {
  systemInfo: SystemInfo | null
  updateStatus: AppUpdateStatus | null
}): React.JSX.Element {
  const { t } = useI18n()
  const version = systemInfo?.appVersion ? `v${systemInfo.appVersion}` : t('common.loading')
  const hasUpdate = hasAvailableUpdate(updateStatus)
  const versionTitle =
    hasUpdate && updateStatus?.latestVersion
      ? t('settings.about.updateVersionTooltip', { version: updateStatus.latestVersion })
      : hasUpdate
        ? t('settings.about.updateAvailable')
        : undefined

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[540px] flex-col gap-3 p-3 sm:p-4">
      <FieldGroup className="gap-2.5">
        <SettingRow
          icon={BadgeInfo}
          title="OneMail"
          description={
            <span>
              {t('settings.about.versionPrefix')}{' '}
              {hasUpdate ? (
                <button
                  type="button"
                  className="rounded-sm font-medium text-warning outline-none transition-colors hover:text-warning focus-visible:ring-2 focus-visible:ring-ring"
                  title={versionTitle}
                  onClick={() => void openExternalUrl(ONEMAIL_HOMEPAGE_URL)}
                >
                  {version}
                </button>
              ) : (
                <span>{version}</span>
              )}
              {t('settings.about.versionSuffix')}
            </span>
          }
          control={
            <Button
              variant="outline"
              size="sm"
              onClick={() => void openExternalUrl('https://github.com/MiaobaiQWQ/one-mail')}
            >
              <ExternalLink data-icon="inline-start" />
              GitHub
            </Button>
          }
        />
      </FieldGroup>
    </div>
  )
}

function BackupMessageView({ message }: { message: BackupMessage }): React.JSX.Element {
  const isRemotePath =
    message.path?.startsWith('http://') === true || message.path?.startsWith('https://') === true

  if (!message.path) {
    return (
      <Alert className="py-2 text-xs">
        <ShieldCheck />
        <AlertTitle>{message.label}</AlertTitle>
      </Alert>
    )
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-md border bg-card p-2.5 text-xs">
      <div className="flex items-center gap-1.5 font-medium">
        <ShieldCheck aria-hidden="true" />
        <span>{message.label}</span>
      </div>
      <Button
        className="h-auto justify-start break-all px-0 py-0 text-left whitespace-normal"
        variant="link"
        size="sm"
        onClick={() =>
          void (isRemotePath
            ? openExternalUrl(message.path!)
            : revealPathInFileManager(message.path!))
        }
      >
        <FolderOpen data-icon="inline-start" />
        {message.path}
      </Button>
    </div>
  )
}

function BackupActionButton({
  icon: Icon,
  title,
  loadingTitle,
  description,
  loading,
  disabled,
  onClick
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  title: string
  loadingTitle: string
  description: string
  loading: boolean
  disabled: boolean
  onClick: () => void | Promise<void>
}): React.JSX.Element {
  return (
    <Button
      className="h-auto justify-start px-3 py-2 text-left"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled}
    >
      {loading ? (
        <LoaderCircle data-icon="inline-start" className="animate-spin" />
      ) : (
        <Icon data-icon="inline-start" />
      )}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate">{loading ? loadingTitle : title}</span>
        <span className="text-xs font-normal text-muted-foreground">{description}</span>
      </span>
    </Button>
  )
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function createSettingsSchema(t: (key: TranslationKey) => string) {
  return z.object({
    syncIntervalMinutes: z.coerce
      .number<number>(t('settings.syncInterval.errorRequired'))
      .int(t('settings.syncInterval.errorInteger'))
      .min(0, t('settings.syncInterval.errorMin'))
      .max(1440, t('settings.syncInterval.errorMax')),
    syncWindowDays: z.coerce
      .number<number>(t('settings.syncWindow.errorRequired'))
      .int(t('settings.syncWindow.errorInteger'))
      .min(1, t('settings.syncWindow.errorMin'))
      .max(3650, t('settings.syncWindow.errorMax')),
    openAtLogin: z.boolean(),
    locale: z.enum(['zh-CN', 'en-US']),
    theme: z.enum(['light', 'dark', 'system']),
    contextMenuEnabled: z.boolean(),
    contextMenuOptions: z.array(z.string()),
    menuDisplayMode: z.enum(['hover', 'click', 'always']),

    shortcuts: z.array(
      z.object({
        actionId: z.string(),
        keys: z.string()
      })
    ),

    translateProvider: z.enum(['deeplx', 'llm']),
    translateEndpoint: z.string().optional(),
    translateApiKey: z.string().optional(),

    privacyMode: z.enum(['strict', 'medium', 'loose', 'off']),

    notificationsEnabled: z.boolean(),
    notificationSound: z.string().optional()
  })
}

function toFormValues(settings: AppSettings | null): SettingsFormValues {
  return {
    syncIntervalMinutes: settings?.syncIntervalMinutes ?? 15,
    syncWindowDays: settings?.syncWindowDays ?? 90,
    openAtLogin: settings?.openAtLogin === true,
    locale: settings?.locale === 'en-US' ? 'en-US' : 'zh-CN',

    theme: settings?.theme ?? 'light',
    contextMenuEnabled: settings?.contextMenuEnabled ?? true,
    contextMenuOptions: settings?.contextMenuOptions ?? [],
    menuDisplayMode: settings?.menuDisplayMode ?? 'hover',

    shortcuts: settings?.shortcuts ?? [],

    translateProvider: settings?.translateProvider ?? 'deeplx',
    translateEndpoint: settings?.translateEndpoint,
    translateApiKey: settings?.translateApiKey,

    privacyMode: settings?.privacyMode ?? 'strict',

    notificationsEnabled: settings?.notificationsEnabled ?? true,
    notificationSound: settings?.notificationSound
  }
}

function areSettingsEqual(first: SettingsFormValues, second: SettingsFormValues): boolean {
  return (
    first.syncIntervalMinutes === second.syncIntervalMinutes &&
    first.syncWindowDays === second.syncWindowDays &&
    first.openAtLogin === second.openAtLogin &&
    first.locale === second.locale &&
    first.theme === second.theme &&
    first.contextMenuEnabled === second.contextMenuEnabled &&
    first.menuDisplayMode === second.menuDisplayMode &&
    first.translateProvider === second.translateProvider &&
    first.translateEndpoint === second.translateEndpoint &&
    first.translateApiKey === second.translateApiKey &&
    first.privacyMode === second.privacyMode &&
    first.notificationsEnabled === second.notificationsEnabled &&
    first.notificationSound === second.notificationSound &&
    JSON.stringify(first.contextMenuOptions) === JSON.stringify(second.contextMenuOptions) &&
    JSON.stringify(first.shortcuts) === JSON.stringify(second.shortcuts)
  )
}
