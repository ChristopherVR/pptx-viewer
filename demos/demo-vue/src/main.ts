import { createApp } from 'vue';

import { externalSessionRequested } from '../../shared/host-owned-collaboration';
import App from './App.vue';
import HostOwnedDemo from './HostOwnedDemo.vue';
import i18n from './i18n';

createApp(externalSessionRequested() ? HostOwnedDemo : App)
	.use(i18n)
	.mount('#app');
