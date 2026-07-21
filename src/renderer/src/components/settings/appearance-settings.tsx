import * as React from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import { Palette, MousePointerClick, MousePointer2 } from 'lucide-react'

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
import { Switch } from '@renderer/components/ui/switch'
import { useI18n } from '@renderer/lib/i18n'
import type { SettingsFormValues } from './settings-dialog'

export function AppearanceSettings(): React.JSX.Element {
  const { t } = useI18n()
  const { watch, control } = useFormContext<SettingsFormValues>()
  const theme = watch('theme')

  React.useEffect(() => {
    if (!theme) return

    const applyDomTheme = () => {
      const root = document.documentElement
      root.classList.remove('light', 'dark')
      
      let domTheme = theme
      if (theme === 'system') {
        domTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      }
      
      root.classList.add(domTheme)
      root.style.colorScheme = domTheme
      
      if (theme === 'system') {
        window.localStorage.removeItem('theme')
      } else {
        window.localStorage.setItem('theme', theme)
      }
      
      void window.api?.system?.setTitleBarTheme?.(domTheme)
    }

    applyDomTheme()

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      mediaQuery.addEventListener('change', applyDomTheme)
      return () => mediaQuery.removeEventListener('change', applyDomTheme)
    }
    return undefined
  }, [theme])

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[540px] flex-col gap-3 p-3 sm:p-4">
      <FieldGroup className="gap-2.5">
        <Controller
          control={control}
          name="theme"
          render={({ field }) => (
            <SettingRow
              icon={Palette}
              title={t('settings.theme.title')}
              description={t('settings.theme.title')}
              control={
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger size="sm" className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="system">{t('settings.theme.system')}</SelectItem>
                      <SelectItem value="light">{t('settings.theme.light')}</SelectItem>
                      <SelectItem value="dark">{t('settings.theme.dark')}</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              }
            />
          )}
        />

        <Controller
          control={control}
          name="contextMenuEnabled"
          render={({ field }) => (
            <SettingRow
              icon={MousePointerClick}
              title={t('settings.contextMenu.title')}
              description={t('settings.contextMenu.description')}
              control={
                <Switch
                  size="sm"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              }
            />
          )}
        />

        <Controller
          control={control}
          name="menuDisplayMode"
          render={({ field }) => (
            <SettingRow
              icon={MousePointer2}
              title={t('settings.menuDisplayMode.title')}
              description={t('settings.menuDisplayMode.title')}
              control={
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger size="sm" className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="hover">{t('settings.menuDisplayMode.hover')}</SelectItem>
                      <SelectItem value="click">{t('settings.menuDisplayMode.click')}</SelectItem>
                      <SelectItem value="always">{t('settings.menuDisplayMode.always')}</SelectItem>
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
