export interface LanguageOption {
	code: string;
	label: string;
}

/**
 * Languages the demo's language picker offers, mirrored across all three demos
 * (Vue/Angular have their own copy of this file plus matching translation
 * dictionaries; see demos/demo-vue/src/languages.ts and
 * demos/demo-angular/src/languages.ts).
 */
export const languages: LanguageOption[] = [
	{ code: 'en', label: 'English' },
	{ code: 'fr', label: 'Français' },
	{ code: 'es', label: 'Español' },
];

export const languageKeys = languages.map((language) => language.code);
