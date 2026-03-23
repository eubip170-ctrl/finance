<template>
  <div class="locale-switcher">
    <button
      type="button"
      class="locale-btn"
      :class="{ active: locale === 'zh-CN' }"
      @click="set('zh-CN')"
    >
      {{ $t('common.localeZh') }}
    </button>
    <span class="sep">|</span>
    <button
      type="button"
      class="locale-btn"
      :class="{ active: locale === 'en-US' }"
      @click="set('en-US')"
    >
      {{ $t('common.localeEn') }}
    </button>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { setAppLocale } from '../i18n'

const { locale } = useI18n()

function set(code) {
  setAppLocale(code)
}
</script>

<style scoped>
.locale-switcher {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
}

.locale-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px 6px;
  color: inherit;
  opacity: 0.55;
  transition: opacity 0.15s;
}

.locale-btn:hover {
  opacity: 0.9;
}

.locale-btn.active {
  opacity: 1;
  font-weight: 700;
}

.sep {
  opacity: 0.35;
  user-select: none;
}
</style>
