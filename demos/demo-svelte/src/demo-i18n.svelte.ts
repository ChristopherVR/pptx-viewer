import { registerTranslations, translate } from 'pptx-svelte-viewer/i18n';
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
 * Demo i18n wiring (runes module, no external i18n library).
 *
 * The viewer's own strings are translated by the binding: registering the
 * French / Spanish / German / Simplified Chinese dictionaries here and passing `locale` to
 * `<PowerPointViewer>` is all it takes. The demo chrome (dropzone, pickers)
 * shares the same registry: its `demo.*` keys are registered per language and
 * read through {@link t}, which tracks the reactive current language.
 *
 * Selection persists to `localStorage` under `pptx-demo-lang`, mirroring
 * demos/demo-vue. An explicit `?locale=` query param wins over the stored
 * preference, so the docs landing page's live demo embed
 * (docs/.vitepress/theme/landing/useLiveDemo.ts) can drive this pane to the
 * site's active locale; with no param, the picker keeps working as before.
 */

registerTranslations('en', demoStringsEn);
registerTranslations('fr', { ...translationsFr, ...demoStringsFr });
registerTranslations('es', { ...translationsEs, ...demoStringsEs });
registerTranslations('de', { ...translationsDe, ...demoStringsDe });
registerTranslations('zh-CN', { ...translationsZhCN, ...demoStringsZhCN });

function readStoredLanguage(): LanguageCode {
	let stored: LanguageCode = 'en';
	try {
		const value = localStorage.getItem('pptx-demo-lang');
		stored = value && languageKeys.includes(value as LanguageCode) ? (value as LanguageCode) : 'en';
	} catch {
		stored = 'en';
	}
	return resolveLocaleParam(window.location.search, stored) as LanguageCode;
}

/** Reactive current language (exported as an object so mutation is tracked). */
export const language = $state<{ current: LanguageCode }>({ current: readStoredLanguage() });

/** Switch the demo + viewer language and persist the choice. */
export function setLanguage(code: LanguageCode): void {
	language.current = code;
	try {
		localStorage.setItem('pptx-demo-lang', code);
	} catch {
		/* ignore */
	}
}

/** Translate a demo or viewer key in the demo's current language. */
export function t(key: string, params?: Record<string, string | number>): string {
	return translate(language.current, key, params);
}
