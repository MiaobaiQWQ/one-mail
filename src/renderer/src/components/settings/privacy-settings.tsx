import * as React from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import { ShieldAlert } from 'lucide-react'

import { SettingRow } from './setting-row'
import { FieldGroup } from '@renderer/components/ui/field'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { useI18n } from '@renderer/lib/i18n'
import type { SettingsFormValues } from './settings-dialog'

export function PrivacySettings(): React.JSX.Element {
  const { t } = useI18n()
  const { control } = useFormContext<SettingsFormValues>()

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[540px] flex-col gap-3 p-3 sm:p-4">
      <FieldGroup className="gap-2.5">
        <Controller
          control={control}
          name="privacyMode"
          render={({ field }) => (
            <SettingRow
              icon={ShieldAlert}
              title={t('settings.privacy.mode')}
              description={t(`settings.privacy.${field.value}`)}
              control={
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger size="sm" className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="strict">{t('settings.privacy.strict')}</SelectItem>
                      <SelectItem value="medium">{t('settings.privacy.medium')}</SelectItem>
                      <SelectItem value="loose">{t('settings.privacy.loose')}</SelectItem>
                      <SelectItem value="off">{t('settings.privacy.off')}</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              }
            />
          )}
        />
      </FieldGroup>
    </div>
  )
}
