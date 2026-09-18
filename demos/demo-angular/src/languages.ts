import type { ViewerLocaleCode } from 'pptx-viewer-locales';
import { resolveLocaleParam } from 'pptx-viewer-locales';

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
	{ code: 'de', label: 'Deutsch' },
	{ code: 'zh-CN', label: '简体中文' },
];

export const LANGUAGE_KEYS = LANGUAGES.map((language) => language.code);

/** Persisted-language localStorage key (shared with the React/Vue demos). */
export const LANGUAGE_STORAGE_KEY = 'pptx-demo-lang';

/**
 * Read the persisted language code, defaulting to `en`.
 *
 * An explicit `?locale=` query param wins over the stored preference, so the
 * docs landing page's live demo embed
 * (docs/.vitepress/theme/landing/useLiveDemo.ts) can drive this pane to the
 * site's active locale; with no param, the picker keeps working as before.
 */
export function restoreLanguageKey(): string {
	let stored = 'en';
	try {
		const value = localStorage.getItem(LANGUAGE_STORAGE_KEY);
		stored = value && LANGUAGE_KEYS.includes(value) ? value : 'en';
	} catch {
		stored = 'en';
	}
	if (typeof window === 'undefined') {
		return stored;
	}
	return resolveLocaleParam(window.location.search, stored as ViewerLocaleCode);
}

/** Persist the selected language code (best-effort; ignores storage failures). */
export function persistLanguageKey(code: string): void {
	try {
		localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
	} catch {
		/* ignore */
	}
}
