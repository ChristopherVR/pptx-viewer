/**
 * Global test setup: install a vue-i18n instance for every mounted component.
 *
 * The viewer components call `useI18n()` from vue-i18n, which requires an i18n
 * instance to be installed on the app. In production the host app installs one;
 * in unit tests we register it here via `@vue/test-utils`' global config so
 * individual `mount(...)` calls do not each have to wire it up. Messages are the
 * canonical English catalog from `pptx-viewer-shared`.
 */
import { config } from '@vue/test-utils';
import { keyToLabel, translationsEn } from 'pptx-viewer-shared/i18n';
import { createI18n } from 'vue-i18n';

// The shared catalog uses i18next-style `{{var}}` interpolation; vue-i18n's
// compiler expects single-brace `{var}` and rejects the doubled form. Convert
// it so interpolated messages (e.g. participant counts) compile in tests.
const messagesEn: Record<string, string> = {};
for (const [key, value] of Object.entries(translationsEn)) {
	messagesEn[key] = value.replace(/\{\{\s*(?<name>[\w.]+)\s*\}\}/gu, '{$<name>}');
}

const i18n = createI18n({
	legacy: false,
	globalInjection: true,
	locale: 'en',
	fallbackLocale: 'en',
	messages: { en: messagesEn },
	// Humanize any key absent from the catalog (e.g. `pptx.a.saveFailed` ->
	// `Save failed`) so components render readable copy in tests.
	missing: (_locale, key) => keyToLabel(key),
});

config.global.plugins = [...(config.global.plugins ?? []), i18n];
