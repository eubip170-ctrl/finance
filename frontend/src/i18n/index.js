import { createI18n } from 'vue-i18n'
import zhCN from '../locales/zh-CN/index.js'
import enUS from '../locales/en-US/index.js'

const STORAGE_KEY = 'mirofish-locale'

function getInitialLocale() {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'zh-CN'
  } catch {
    return 'zh-CN'
  }
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: getInitialLocale(),
  fallbackLocale: 'en-US',
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS
  }
})

export function setAppLocale(locale) {
  i18n.global.locale.value = locale
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    /* ignore */
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale
  }
}
