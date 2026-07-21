import * as React from 'react'
import { zhCN } from './locales/zh-CN'
import { enUS } from './locales/en-US'
import type { AppLocale, I18nContextValue, TranslationKey, TranslationMap, TranslationValues } from './types'

export { supportedLocales } from './types'
export type { AppLocale, TranslationKey, TranslationMap, TranslationValues }

const translations: Record<AppLocale, TranslationMap> = {
  'zh-CN': zhCN,
  'en-US': enUS
}

const I18nContext = React.createContext<I18nContextValue | null>(null)

export function I18nProvider({
  initialLocale = 'zh-CN',
  children
}: {
  initialLocale?: string
  children: React.ReactNode
}): React.JSX.Element {
  const [locale, setLocaleState] = React.useState<AppLocale>(() => normalizeLocale(initialLocale))

  const setLocale = React.useCallback((nextLocale: AppLocale): void => {
    setLocaleState(nextLocale)
  }, [])

  React.useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const value = React.useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, values) => formatTranslation(translations[locale][key] ?? zhCN[key], values)
    }),
    [locale, setLocale]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const value = React.useContext(I18nContext)
  if (!value) throw new Error('useI18n must be used within I18nProvider')
  return value
}

export function translate(
  locale: AppLocale,
  key: TranslationKey,
  values?: TranslationValues
): string {
  return formatTranslation(translations[locale][key] ?? zhCN[key], values)
}

export function normalizeLocale(value?: string | null): AppLocale {
  return value === 'en-US' ? 'en-US' : 'zh-CN'
}

function formatTranslation(template: string, values?: TranslationValues): string {
  if (!values) return template

  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key]
    return value === undefined ? match : String(value)
  })
}
