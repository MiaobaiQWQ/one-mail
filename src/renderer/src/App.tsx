import { RouterProvider } from 'react-router/dom'
import * as React from 'react'

import { appRouter } from './app/router'
import { I18nProvider } from './lib/i18n'
import { Toaster } from './components/ui/sonner'
import { useSettingsStore } from './stores/use-settings-store'

function App(): React.JSX.Element {
  const settings = useSettingsStore((state) => state.settings)
  const loadSettings = useSettingsStore((state) => state.actions.loadSettings)

  React.useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  React.useEffect(() => {
    if (!settings) return

    const applyDomTheme = () => {
      const root = document.documentElement
      root.classList.remove('light', 'dark')

      let domTheme = settings.theme
      if (settings.theme === 'system') {
        domTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      }

      root.classList.add(domTheme)
      root.style.colorScheme = domTheme

      if (settings.theme === 'system') {
        window.localStorage.removeItem('theme')
      } else {
        window.localStorage.setItem('theme', settings.theme)
      }

      void window.api?.system?.setTitleBarTheme?.(domTheme)
    }

    applyDomTheme()

    if (settings.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      mediaQuery.addEventListener('change', applyDomTheme)
      return () => mediaQuery.removeEventListener('change', applyDomTheme)
    }
    return undefined
  }, [settings?.theme])

  return (
    <I18nProvider>
      <RouterProvider router={appRouter} />
      <Toaster richColors />
    </I18nProvider>
  )
}

export default App
