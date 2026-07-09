import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';

import LandingHome from './landing/LandingHome.vue';

import './custom.css';
import './landing/landing.css';

export default {
	extends: DefaultTheme,
	enhanceApp({ app }) {
		app.component('LandingHome', LandingHome);
	},
} satisfies Theme;
