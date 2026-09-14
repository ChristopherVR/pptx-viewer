export const LANGUAGE_CODES = ['en', 'fr', 'es', 'de', 'zh-CN'] as const;
export type LanguageCode = (typeof LANGUAGE_CODES)[number];

export interface LanguageOption {
	code: LanguageCode;
	label: string;
}

/** Languages offered by the demo, with matching registered dictionaries. */
export const languages: LanguageOption[] = [
	{ code: 'en', label: 'English' },
	{ code: 'fr', label: 'Français' },
	{ code: 'es', label: 'Español' },
	{ code: 'de', label: 'Deutsch' },
	{ code: 'zh-CN', label: '简体中文' },
];

export const languageKeys: readonly LanguageCode[] = languages.map((language) => language.code);
