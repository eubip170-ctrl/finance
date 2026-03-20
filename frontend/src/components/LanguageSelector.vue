<template>
  <div class="language-selector" :class="{ light: light }">
    <button 
      class="lang-btn"
      :class="{ active: locale === 'zh' }"
      @click="setLocale('zh')"
    >
      {{ $t('nav.zh') }}
    </button>
    <span class="lang-sep">/</span>
    <button 
      class="lang-btn"
      :class="{ active: locale === 'en' }"
      @click="setLocale('en')"
    >
      {{ $t('nav.en') }}
    </button>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { setStoredLocale } from '../i18n'

defineProps({
  light: { type: Boolean, default: false }
})

const { locale } = useI18n()

const setLocale = (lang) => {
  locale.value = lang
  setStoredLocale(lang)
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
}
</script>

<style scoped>
.language-selector {
  display: flex;
  align-items: center;
  gap: 4px;
}

.lang-btn {
  background: none;
  border: none;
  padding: 4px 8px;
  font-size: 0.85rem;
  font-weight: 500;
  color: #000;
  cursor: pointer;
  transition: color 0.2s;
}

.lang-btn:hover {
  color: #333;
}

.lang-btn.active {
  color: #000;
  font-weight: 600;
}

.lang-sep {
  color: #333;
  font-size: 0.75rem;
}

/* For light/white header context (MainView, SimulationView) */
.lang-selector.light .lang-btn {
  color: #000;
}

.lang-selector.light .lang-btn:hover {
  color: #333;
}

.lang-selector.light .lang-btn.active {
  color: #000;
  font-weight: 600;
}

.lang-selector.light .lang-sep {
  color: #333;
}
</style>
