import { keyToLabel, toVueI18nSyntax, translationsEn } from 'pptx-vue-viewer/i18n';
/**
 * vue-i18n configuration for the pptx-viewer Vue demo.
 *
 * The viewer components use vue-i18n's Composition API (`useI18n().t()`) for
 * UI labels. This initialises a global i18n instance with English, French,
 * Spanish, and German resource bundles (the language picker in App.vue
 * switches between them via `i18n.global.locale`) and a fallback that derives
 * display text from dotted keys for any key not covered by the active
 * translation, mirroring the React/Angular demos.
 */
import { createI18n } from 'vue-i18n';

import { demoStringsDe, demoStringsEn, demoStringsFr, demoStringsEs } from './demo-locales';
import { translationsDe, translationsEs, translationsFr } from './i18n-locales';

const i18n = createI18n({
	legacy: false,
	locale: 'en',
	fallbackLocale: 'en',
	messages: {
		// translationsEn is pre-converted by the package; the demo's own fr/es/de
		// dictionaries follow the shared {{var}} convention and must be converted
		// too, or vue-i18n fatally throws at first render of any such message.
		en: { ...translationsEn, ...demoStringsEn },
		fr: { ...toVueI18nSyntax(translationsFr), ...demoStringsFr },
		es: { ...toVueI18nSyntax(translationsEs), ...demoStringsEs },
		de: { ...toVueI18nSyntax(translationsDe), ...demoStringsDe },
	},
	missing: (_locale, key) => keyToLabel(key),
	missingWarn: false,
	fallbackWarn: false,
});

export default i18n;
