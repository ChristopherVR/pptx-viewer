/**
 * i18next configuration for the pptx-viewer demo.
 *
 * The viewer components use react-i18next for UI labels. This initialises
 * an i18n instance with English, French, and Spanish resource bundles (the
 * language picker in main.tsx switches between them via `changeLanguage`)
 * and a fallback that derives display text from dotted keys for any key not
 * covered by the active translation (e.g. "pptx.sections.addSlide" →
 * "Add Slide").
 */
import { createInstance } from 'i18next';
import { keyToLabel, translationsEn } from 'pptx-react-viewer/i18n';
import { translationsDe, translationsEs, translationsFr } from 'pptx-viewer-locales';
import { initReactI18next } from 'react-i18next';

import { demoStringsDe, demoStringsEn, demoStringsFr, demoStringsEs } from './demo-locales';

const i18nInstance = createInstance();

i18nInstance.use(initReactI18next).init({
	resources: {
		en: { translation: { ...translationsEn, ...demoStringsEn } },
		fr: { translation: { ...translationsFr, ...demoStringsFr } },
		es: { translation: { ...translationsEs, ...demoStringsEs } },
		de: { translation: { ...translationsDe, ...demoStringsDe } },
	},
	lng: 'en',
	fallbackLng: 'en',
	interpolation: {
		escapeValue: false, // React already escapes
	},
	// For any key not explicitly defined, derive display text from the key
	parseMissingKeyHandler: (key: string) => keyToLabel(key),
	// Suppress "missing key" warnings in console
	missingKeyHandler: false,
});

export default i18nInstance;
