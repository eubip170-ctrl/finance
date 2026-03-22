import { createI18n } from 'vue-i18n'
import api from '../api/index.js'

// Detect browser language, normalize to short tag (e.g. 'hu-HU' -> 'hu')
export function detectLanguage() {
  const raw = navigator.language || navigator.languages?.[0] || 'en'
  return raw.split('-')[0].toLowerCase()
}

export async function setupI18n() {
  const lang = detectLanguage()

  // Note: api.get() returns response.data directly (the Axios interceptor unwraps it).
  // So res is already { success: true, data: {...locale...} }, and res.data is the locale object.
  let messages = {}
  try {
    const res = await api.get(`/api/locale/${lang}`)
    messages = res.data
  } catch (e) {
    console.warn(`Could not load locale '${lang}', falling back to English`)
    try {
      const res = await api.get('/api/locale/en')
      messages = res.data
    } catch {
      messages = {}
    }
  }

  return createI18n({
    legacy: false,
    locale: lang,
    fallbackLocale: 'en',
    messages: { [lang]: messages }
  })
}
