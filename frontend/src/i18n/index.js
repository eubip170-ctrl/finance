import { createI18n } from 'vue-i18n'
import en from './en.json'
import zh from './zh.json'

const savedLocale = localStorage.getItem('mirofish-locale') || 'en'

const i18n = createI18n({
  legacy: false,
  locale: savedLocale,
  fallbackLocale: 'en',
  messages: { en, zh }
})

export function setLocale(locale) {
  i18n.global.locale.value = locale
  localStorage.setItem('mirofish-locale', locale)
  document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en'
}

export default i18n
