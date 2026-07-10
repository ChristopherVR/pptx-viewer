export const LANGUAGE_CODES = ['en', 'fr', 'es', 'de'] as const;
export type LanguageCode = (typeof LANGUAGE_CODES)[number];

export interface LanguageOption {
	code: LanguageCode;
	label: string;
}

/**
 * Languages the demo's language picker offers, mirrored across all demos
 * (see demos/demo-vue/src/languages.ts and demos/demo-react/languages.ts).
 */
export const languages: LanguageOption[] = [
	{ code: 'en', label: 'English' },
	{ code: 'fr', label: 'Français' },
	{ code: 'es', label: 'Español' },
	{ code: 'de', label: 'Deutsch' },
];

export const languageKeys: readonly LanguageCode[] = languages.map((language) => language.code);
