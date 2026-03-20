import { useI18n } from 'vue-i18n'

export function useLocaleToggle() {
  const { locale } = useI18n()

  const toggleLocale = () => {
    const newLocale = locale.value === 'zh-CN' ? 'en' : 'zh-CN'
    locale.value = newLocale
    localStorage.setItem('mirofish-locale', newLocale)
  }

  return { locale, toggleLocale }
}
