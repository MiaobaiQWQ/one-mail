import { normalizeLocale, translate } from '@renderer/lib/i18n'

export function getStaticTranslation(key: Parameters<typeof translate>[1]): string {
  return translate(normalizeLocale(document.documentElement.lang), key)
}
