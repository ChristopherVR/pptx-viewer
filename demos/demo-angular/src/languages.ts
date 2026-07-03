/**
 * Demo language options.
 *
 * Mirrors the React/Vue demos' `languages` array one for one (see
 * demos/demo-react/languages.ts). Keep this in sync with those.
 */
export interface LanguageOption {
	code: string;
	label: string;
}

export const LANGUAGES: LanguageOption[] = [
	{ code: 'en', label: 'English' },
	{ code: 'fr', label: 'Français' },
	{ code: 'es', label: 'Español' },
];

export const LANGUAGE_KEYS = LANGUAGES.map((language) => language.code);

/** Persisted-language localStorage key (shared with the React/Vue demos). */
export const LANGUAGE_STORAGE_KEY = 'pptx-demo-lang';

/** Read the persisted language code, defaulting to `en`. */
export function restoreLanguageKey(): string {
	try {
		return localStorage.getItem(LANGUAGE_STORAGE_KEY) ?? 'en';
	} catch {
		return 'en';
	}
}

/** Persist the selected language code (best-effort; ignores storage failures). */
export function persistLanguageKey(code: string): void {
	try {
		localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
	} catch {
		/* ignore */
	}
}
