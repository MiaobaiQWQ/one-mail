import * as React from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import { Languages, Link, Key } from 'lucide-react'

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
import { Input } from '@renderer/components/ui/input'
import { useI18n } from '@renderer/lib/i18n'
import type { SettingsFormValues } from './settings-dialog'

export function TranslateSettings(): React.JSX.Element {
  const { t } = useI18n()
  const { control, register } = useFormContext<SettingsFormValues>()

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[540px] flex-col gap-3 p-3 sm:p-4">
      <FieldGroup className="gap-2.5">
        <Controller
          control={control}
          name="translateProvider"
          render={({ field }) => (
            <SettingRow
              icon={Languages}
              title={t('settings.translate.provider')}
              description={t('settings.translate.provider')}
              control={
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger size="sm" className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="deeplx">{t('settings.translate.deeplx')}</SelectItem>
                      <SelectItem value="llm">{t('settings.translate.llm')}</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              }
            />
          )}
        />

        <SettingRow
          icon={Link}
          title={t('settings.translate.endpoint')}
          description={t('settings.translate.endpoint')}
          control={
            <Input
              id="translate-endpoint"
              className="w-48"
              type="text"
              {...register('translateEndpoint')}
            />
          }
        />

        <SettingRow
          icon={Key}
          title={t('settings.translate.apiKey')}
          description={t('settings.translate.apiKey')}
          control={
            <Input
              id="translate-api-key"
              className="w-48"
              type="password"
              {...register('translateApiKey')}
            />
          }
        />
      </FieldGroup>
    </div>
  )
}
