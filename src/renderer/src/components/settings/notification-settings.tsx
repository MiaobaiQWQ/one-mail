import * as React from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import { Bell, Volume2, Play } from 'lucide-react'

import { SettingRow } from './setting-row'
import { FieldGroup } from '@renderer/components/ui/field'
import { Switch } from '@renderer/components/ui/switch'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import { useI18n } from '@renderer/lib/i18n'
import type { SettingsFormValues } from './settings-dialog'
import { testDesktopNotification } from '@renderer/lib/api/settings'

export function NotificationSettings(): React.JSX.Element {
  const { t } = useI18n()
  const { control, register } = useFormContext<SettingsFormValues>()

  const handleTestNotification = async () => {
    try {
      await testDesktopNotification()
    } catch (error) {
      console.error('Failed to test notification:', error)
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[540px] flex-col gap-3 p-3 sm:p-4">
      <FieldGroup className="gap-2.5">
        <Controller
          control={control}
          name="notificationsEnabled"
          render={({ field }) => (
            <SettingRow
              icon={Bell}
              title={t('settings.notifications.enabled')}
              description={t('settings.notifications.enabled')}
              control={<Switch size="sm" checked={field.value} onCheckedChange={field.onChange} />}
            />
          )}
        />

        <SettingRow
          icon={Volume2}
          title={t('settings.notifications.sound')}
          description={t('settings.notifications.sound')}
          control={
            <div className="flex items-center gap-2">
              <Input
                id="notification-sound"
                className="w-48"
                type="text"
                {...register('notificationSound')}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                title={t('settings.notifications.test')}
                onClick={handleTestNotification}
              >
                <Play className="h-4 w-4" />
              </Button>
            </div>
          }
        />
      </FieldGroup>
    </div>
  )
}
