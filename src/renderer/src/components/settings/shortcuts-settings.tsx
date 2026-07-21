import * as React from 'react'
import { useFormContext } from 'react-hook-form'
import { Keyboard, RotateCcw } from 'lucide-react'

import { SettingRow } from './setting-row'
import { Button } from '@renderer/components/ui/button'
import { FieldGroup } from '@renderer/components/ui/field'
import { useI18n } from '@renderer/lib/i18n'
import type { SettingsFormValues } from './settings-dialog'

const SHORTCUT_CATEGORIES = [
  {
    id: 'general',
    label: 'settings.shortcuts.category.general',
    actions: [
      { id: 'sync', label: '同步' },
      { id: 'search', label: '搜索' }
    ]
  },
  {
    id: 'navigation',
    label: 'settings.shortcuts.category.navigation',
    actions: [
      { id: 'next-message', label: '下一封邮件' },
      { id: 'prev-message', label: '上一封邮件' }
    ]
  },
  {
    id: 'mail',
    label: 'settings.shortcuts.category.mail',
    actions: [
      { id: 'compose', label: '写信' },
      { id: 'reply', label: '回复' },
      { id: 'reply-all', label: '全部回复' },
      { id: 'forward', label: '转发' },
      { id: 'archive', label: '归档' },
      { id: 'delete', label: '删除' }
    ]
  },
  {
    id: 'translate',
    label: 'settings.shortcuts.category.translate',
    actions: [
      { id: 'translate-selection', label: '翻译选中内容' }
    ]
  }
]

const DEFAULT_SHORTCUTS = [
  { actionId: 'sync', keys: 'Ctrl+R' },
  { actionId: 'search', keys: 'Ctrl+F' },
  { actionId: 'next-message', keys: 'J' },
  { actionId: 'prev-message', keys: 'K' },
  { actionId: 'compose', keys: 'C' },
  { actionId: 'reply', keys: 'R' },
  { actionId: 'reply-all', keys: 'A' },
  { actionId: 'forward', keys: 'F' },
  { actionId: 'archive', keys: 'E' },
  { actionId: 'delete', keys: 'Backspace' },
  { actionId: 'translate-selection', keys: 'Ctrl+T' }
]

export function eventToKeyString(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
  if (e.shiftKey) parts.push('Shift')
  if (e.altKey) parts.push('Alt')
  const key = e.key.length === 1 ? e.key.toUpperCase() : e.key
  if (!['Control', 'Meta', 'Shift', 'Alt'].includes(e.key)) {
    parts.push(key)
  }
  return parts.join('+')
}

export function ShortcutsSettings(): React.JSX.Element {
  const { t } = useI18n()
  const { setValue, watch } = useFormContext<SettingsFormValues>()
  const shortcuts = watch('shortcuts') || []

  const [recordingId, setRecordingId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!recordingId) return

    const handleKeyDown = async (e: KeyboardEvent): Promise<void> => {
      e.preventDefault()
      e.stopPropagation()

      if (e.key === 'Escape') {
        setRecordingId(null)
        return
      }

      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
        return // Only modifiers pressed so far
      }

      const keyString = eventToKeyString(e)

      const conflict = await window.api.settings.detectShortcutConflict(keyString, recordingId)
      if (conflict) {
        alert(t('settings.shortcuts.conflict', { action: conflict }))
        setRecordingId(null)
        return
      }

      const newShortcuts = [...shortcuts]
      const index = newShortcuts.findIndex((s) => s.actionId === recordingId)
      if (index >= 0) {
        newShortcuts[index].keys = keyString
      } else {
        newShortcuts.push({ actionId: recordingId, keys: keyString })
      }

      setValue('shortcuts', newShortcuts, { shouldValidate: true, shouldDirty: true })
      setRecordingId(null)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [recordingId, shortcuts, setValue, t])

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[540px] flex-col gap-6 p-3 sm:p-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setValue('shortcuts', DEFAULT_SHORTCUTS, { shouldValidate: true, shouldDirty: true })}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          {t('settings.shortcuts.reset')}
        </Button>
      </div>

      {SHORTCUT_CATEGORIES.map((category) => (
        <div key={category.id} className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-muted-foreground">{t(category.label as any)}</h3>
          <FieldGroup className="gap-2.5">
            {category.actions.map((action) => {
              const binding = shortcuts.find((s) => s.actionId === action.id)
              const isRecording = recordingId === action.id

              return (
                <SettingRow
                  key={action.id}
                  icon={Keyboard}
                  title={action.label}
                  description=""
                  control={
                    <Button
                      variant={isRecording ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setRecordingId(isRecording ? null : action.id)}
                    >
                      {isRecording ? t('settings.shortcuts.recording') : binding?.keys || t('settings.shortcuts.record')}
                    </Button>
                  }
                />
              )
            })}
          </FieldGroup>
        </div>
      ))}
    </div>
  )
}
