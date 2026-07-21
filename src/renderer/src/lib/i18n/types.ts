import { zhCN } from './locales/zh-CN'

export const supportedLocales = ['zh-CN', 'en-US'] as const
export type AppLocale = (typeof supportedLocales)[number]

export type TranslationValues = Record<string, string | number>
export type TranslationMap = Record<TranslationKey, string>
export type TranslationKey = keyof typeof zhCN

export type I18nContextValue = {
  locale: AppLocale
  setLocale: (locale: AppLocale) => void
  t: (key: TranslationKey, values?: TranslationValues) => string
}
