export const LANGUAGE_CODES = ['en', 'fr', 'es'] as const;
export type LanguageCode = (typeof LANGUAGE_CODES)[number];

export interface LanguageOption {
	code: LanguageCode;
	label: string;
}

/**
 * Languages the demo's language picker offers, mirrored across all three
 * demos (see demos/demo-react/languages.ts and
 * demos/demo-angular/src/languages.ts).
 */
export const languages: LanguageOption[] = [
	{ code: 'en', label: 'English' },
	{ code: 'fr', label: 'Français' },
	{ code: 'es', label: 'Español' },
];

export const languageKeys = languages.map((language) => language.code);
