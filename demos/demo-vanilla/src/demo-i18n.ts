import type { TranslationMessages } from 'pptx-vanilla-viewer';
import { createTranslator } from 'pptx-vanilla-viewer';
import {
	resolveLocaleParam,
	translationsDe,
	translationsEs,
	translationsFr,
	translationsZhCN,
} from 'pptx-viewer-locales';

import {
	demoStringsZhCN,
	demoStringsDe,
	demoStringsEn,
	demoStringsEs,
	demoStringsFr,
} from './demo-locales';
import type { LanguageCode } from './languages';
import { languageKeys } from './languages';

/**
 * Demo i18n wiring (no external i18n library).
 *
 * The viewer's own strings are translated by the binding: {@link viewerMessages}
 * is passed as the `messages` option of `createPptxViewer` and `setLocale`
 * switches the active dictionary. The demo chrome (dropzone, pickers) merges
 * its `demo.*` keys into the same per-locale dictionaries and reads them
 * through {@link t}. Selection persists to `localStorage` under
 * `pptx-demo-lang`, mirroring demos/demo-vue. An explicit `?locale=` query
 * param wins over the stored preference, so the docs landing page's live
 * demo embed (docs/.vitepress/theme/landing/useLiveDemo.ts) can drive this
 * pane to the site's active locale; with no param, the picker keeps working
 * as before.
 */

/** Per-locale dictionaries handed to the viewer (viewer keys + demo keys). */
export const viewerMessages: TranslationMessages = {
	en: { ...demoStringsEn },
	fr: { ...translationsFr, ...demoStringsFr },
	es: { ...translationsEs, ...demoStringsEs },
	de: { ...translationsDe, ...demoStringsDe },
	'zh-CN': { ...translationsZhCN, ...demoStringsZhCN },
};

export function readStoredLanguage(): LanguageCode {
	let stored: LanguageCode = 'en';
	try {
		const value = localStorage.getItem('pptx-demo-lang');
		stored = value && languageKeys.includes(value as LanguageCode) ? (value as LanguageCode) : 'en';
	} catch {
		stored = 'en';
	}
	return resolveLocaleParam(window.location.search, stored) as LanguageCode;
}

let current: LanguageCode = readStoredLanguage();
const listeners = new Set<(code: LanguageCode) => void>();

/** The demo's active language. */
export function getLanguage(): LanguageCode {
	return current;
}

/** Switch the demo + viewer language, persist it, and notify subscribers. */
export function setLanguage(code: LanguageCode): void {
	current = code;
	try {
		localStorage.setItem('pptx-demo-lang', code);
	} catch {
		/* ignore */
	}
	for (const listener of listeners) {
		listener(code);
	}
}

/** Subscribe to language changes; returns an unsubscribe function. */
export function onLanguageChange(listener: (code: LanguageCode) => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

/** Translate a demo or viewer key in the demo's current language. */
export function t(key: string, params?: Record<string, string | number>): string {
	return createTranslator(current, viewerMessages)(key, params);
}
