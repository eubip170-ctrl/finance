<template>
  <div class="app-root">
    <div class="locale-host">
      <LocaleSwitcher />
    </div>
    <router-view />
  </div>
</template>

<script setup>
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import LocaleSwitcher from './components/LocaleSwitcher.vue'

const { locale } = useI18n()
watch(
  locale,
  (l) => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = l
    }
  },
  { immediate: true }
)
</script>

<style>
.app-root {
  position: relative;
  min-height: 100vh;
}

.locale-host {
  position: fixed;
  top: 10px;
  right: 16px;
  z-index: 10050;
  background: rgba(255, 255, 255, 0.92);
  padding: 4px 10px;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

/* 全局样式重置 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

#app {
  font-family: 'JetBrains Mono', 'Space Grotesk', 'Noto Sans SC', monospace;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #000000;
  background-color: #ffffff;
}

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background: #000000;
}

::-webkit-scrollbar-thumb:hover {
  background: #333333;
}

/* 全局按钮样式 */
button {
  font-family: inherit;
}
</style>
