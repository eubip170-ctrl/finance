import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { i18n, setAppLocale } from './i18n'

const app = createApp(App)

app.use(router)
app.use(i18n)
setAppLocale(i18n.global.locale.value)

app.mount('#app')
