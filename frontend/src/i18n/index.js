import { createI18n } from 'vue-i18n'
import zh from './locales/zh'
import en from './locales/en'

const LOCALE_KEY = 'mirofish-locale'

export function getStoredLocale() {
  try {
    const stored = localStorage.getItem(LOCALE_KEY)
    if (stored === 'zh' || stored === 'en') return stored
  } catch (_) {}
  return 'zh'
}

export function setStoredLocale(locale) {
  try {
    localStorage.setItem(LOCALE_KEY, locale)
  } catch (_) {}
}

/** Get locale for API requests (en or zh) */
export function getApiLocale() {
  return getStoredLocale()
}

const i18n = createI18n({
  legacy: false, // Use Composition API mode
  locale: getStoredLocale(),
  fallbackLocale: 'zh',
  messages: {
    zh,
    en,
  },
})

export default i18n
