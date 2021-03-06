import { createApp } from 'vue'
import App from './App'
import bus from './components/bus'

const app = createApp(App);

app.config.globalProperties.$bus = bus;

app.mount('#app');
