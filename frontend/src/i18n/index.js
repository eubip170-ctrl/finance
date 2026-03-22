import { createI18n } from 'vue-i18n'
import en from './en.json'
import zhCN from './zh-CN.json'

function detectLocale() {
  return localStorage.getItem('locale')
    || (navigator.language.startsWith('zh') ? 'zh-CN' : 'en')
}

const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: 'en',
  messages: { en, 'zh-CN': zhCN }
})

export default i18n
