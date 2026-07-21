import * as React from 'react'
import { useSettingsStore } from '../stores/use-settings-store'

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

export function useShortcuts(handlers: Record<string, () => void>) {
  const { settings } = useSettingsStore()

  React.useEffect(() => {
    if (!settings?.shortcuts) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      const keyString = eventToKeyString(e)

      const binding = settings.shortcuts.find((s) => s.keys === keyString)
      if (!binding) return

      // Allow single key shortcuts only if not in input
      if (isInput && !keyString.includes('+')) {
        return
      }

      const handler = handlers[binding.actionId]
      if (handler) {
        e.preventDefault()
        handler()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [settings?.shortcuts, handlers])
}
