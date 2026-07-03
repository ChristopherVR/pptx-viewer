import { keyToLabel, translationsEn } from 'pptx-vue-viewer/i18n';
/**
 * vue-i18n configuration for the pptx-viewer Vue demo.
 *
 * The viewer components use vue-i18n's Composition API (`useI18n().t()`) for
 * UI labels. This initialises a global i18n instance with English, French,
 * and Spanish resource bundles (the language picker in App.vue switches
 * between them via `i18n.global.locale`) and a fallback that derives display
 * text from dotted keys (e.g. "pptx.sections.addSlide" -> "Add Slide") for
 * any key not covered by the active translation, mirroring the React/Angular
 * demos.
 */
import { createI18n } from 'vue-i18n';

import { translationsEs, translationsFr } from './i18n-locales';

const i18n = createI18n({
	legacy: false,
	locale: 'en',
	fallbackLocale: 'en',
	messages: { en: translationsEn, fr: translationsFr, es: translationsEs },
	missing: (_locale, key) => keyToLabel(key),
	missingWarn: false,
	fallbackWarn: false,
});

export default i18n;
