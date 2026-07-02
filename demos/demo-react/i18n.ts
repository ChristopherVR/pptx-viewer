/**
 * i18next configuration for the pptx-viewer demo.
 *
 * The viewer components use react-i18next for UI labels. This
 * initialises a minimal i18n instance with English translations
 * and a fallback that derives display text from dotted keys
 * (e.g. "pptx.sections.addSlide" → "Add Slide").
 */
import { createInstance } from 'i18next';
import { keyToLabel, translationsEn } from 'pptx-react-viewer/i18n';
import { initReactI18next } from 'react-i18next';

const i18nInstance = createInstance();

i18nInstance.use(initReactI18next).init({
	resources: { en: { translation: translationsEn } },
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
