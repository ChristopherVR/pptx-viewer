import { config } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';

import { keyToLabel, translationsEn } from './i18n';

/**
 * Every Vue component test mounts via `@vue/test-utils`' `mount()` without
 * installing vue-i18n, so any component calling `useI18n()` throws
 * "Need to install with `app.use` function" and the whole render aborts.
 * Installing the real i18n plugin globally here - once, for every test in
 * the package - means tests exercise the actual dictionary (catching real
 * missing/mistranslated keys) instead of failing before rendering at all.
 */
const i18n = createI18n({
	legacy: false,
	globalInjection: true,
	locale: 'en',
	fallbackLocale: 'en',
	messages: { en: translationsEn },
	missing: (_locale, key) => keyToLabel(key),
	missingWarn: false,
	fallbackWarn: false,
});

config.global.plugins.push(i18n);
