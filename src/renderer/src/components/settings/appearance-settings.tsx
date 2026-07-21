import * as React from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import { Palette, Image as ImageIcon, MousePointerClick, MousePointer2 } from 'lucide-react'

import { SettingRow } from './setting-row'
import { Button } from '@renderer/components/ui/button'
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
import { Input } from '@renderer/components/ui/input'
import { useI18n } from '@renderer/lib/i18n'
import type { SettingsFormValues } from './settings-dialog'

export function AppearanceSettings(): React.JSX.Element {
  const { t } = useI18n()
  const { watch, setValue, control } = useFormContext<SettingsFormValues>()
  const theme = watch('theme')
  const bgImage = watch('backgroundImage')

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

  async function handleImportBackgroundImage(): Promise<void> {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/png, image/jpeg, image/webp'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        try {
          const result = await window.api.settings.importBackgroundImage((file as any).path)
          setValue('backgroundImage', {
            path: result.path,
            filename: result.filename,
            fit: bgImage?.fit ?? 'cover',
            opacity: bgImage?.opacity ?? 0.5
          })
        } catch (error) {
          console.error('Failed to import background image:', error)
        }
      }
    }
    input.click()
  }

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

        <SettingRow
          icon={ImageIcon}
          title={t('settings.backgroundImage.title')}
          description={bgImage?.filename ?? t('settings.backgroundImage.title')}
          control={
            <div className="flex items-center gap-2">
              {bgImage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setValue('backgroundImage', undefined)}
                >
                  {t('common.delete')}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleImportBackgroundImage}>
                {t('settings.backgroundImage.import')}
              </Button>
            </div>
          }
        />

        {bgImage && (
          <div className="ml-10 grid gap-2 rounded-md border bg-card p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-xs">{t('settings.backgroundImage.fit')}</span>
              <Controller
                control={control}
                name="backgroundImage.fit"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger size="sm" className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="cover">{t('settings.backgroundImage.cover')}</SelectItem>
                        <SelectItem value="contain">{t('settings.backgroundImage.contain')}</SelectItem>
                        <SelectItem value="tile">{t('settings.backgroundImage.tile')}</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-xs">{t('settings.backgroundImage.opacity')}</span>
              <Controller
                control={control}
                name="backgroundImage.opacity"
                render={({ field }) => (
                  <Input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={field.value}
                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                    className="w-36"
                  />
                )}
              />
            </div>
          </div>
        )}

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
