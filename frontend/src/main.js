import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { setupI18n } from './i18n/index.js'

async function bootstrap() {
  const i18n = await setupI18n()
  const app = createApp(App)
  app.use(router)
  app.use(i18n)
  app.mount('#app')
}

bootstrap()
