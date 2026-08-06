import type { ThemeCatalogEntry, ViewerTheme } from 'pptx-viewer-shared';
import type { LocaleCatalogEntry } from 'pptx-viewer-shared/i18n';
import { LOCALE_CATALOG } from 'pptx-viewer-shared/i18n';

import type { PptxViewerOptions } from './types';

/**
 * Resolution helpers behind File > Options' Appearance/Language tabs and the
 * viewer's persisted theme/locale state (`PptxViewer.currentTheme` /
 * `currentThemeKey` / `currentLocale`).
 *
 * Precedence, mirroring the other four bindings: a previously persisted user
 * choice (see `viewer-prefs-storage.ts` in `pptx-viewer-shared`) beats the
 * host's constructor defaults, then the shared catalog's built-in default
 * applies. The host `theme` option still wins while the resolved catalog key
 * is `'default'` (that entry maps to `undefined`), exactly like the Svelte
 * binding's `theme` prop; hosts that own persistence themselves wire
 * `onThemeChange`/`onLocaleChange`, in which case nothing is ever stored and
 * their options are always used.
 */

/** Reverse-lookup: the catalog key whose theme reference matches `theme` (`undefined` matches the 'default' entry). */
export function findThemeCatalogKey(
	theme: ViewerTheme | undefined,
	catalog: readonly ThemeCatalogEntry[],
): string | undefined {
	return catalog.find((entry) => entry.theme === theme)?.key;
}

export interface InitialThemeState {
	key: string;
	theme: ViewerTheme | undefined;
}

/** Resolve the theme to mount with: stored prefs > `options.theme` > catalog default. */
export function resolveInitialThemeState(
	options: PptxViewerOptions,
	storedThemeKey: string | undefined,
	catalog: readonly ThemeCatalogEntry[],
): InitialThemeState {
	const key =
		storedThemeKey && catalog.some((entry) => entry.key === storedThemeKey)
			? storedThemeKey
			: (findThemeCatalogKey(options.theme, catalog) ?? 'default');
	// The 'default' entry (and an ad hoc host theme with no catalog match) maps
	// to `undefined`, so the host `theme` option still applies there.
	return { key, theme: catalog.find((entry) => entry.key === key)?.theme ?? options.theme };
}

/**
 * Locale choices for File > Options > Language: a host `availableLocales`,
 * or every locale with a registered `messages` dictionary plus `'en'` (which
 * needs no dictionary, it's the viewer's own baseline). Never claims a
 * locale the host hasn't actually supplied translations for.
 */
export function resolveAvailableLocales(options: PptxViewerOptions): readonly LocaleCatalogEntry[] {
	if (options.availableLocales) {
		return options.availableLocales;
	}
	const codes = Array.from(new Set(['en', ...Object.keys(options.messages ?? {})]));
	return codes.map(
		(code) =>
			LOCALE_CATALOG.find((entry) => entry.code === code) ?? {
				code,
				label: code,
				nativeLabel: code,
			},
	);
}

/** Resolve the locale to start with: stored prefs (if still offered) > `options.locale` > `'en'`. */
export function resolveInitialLocale(
	options: PptxViewerOptions,
	storedLocaleCode: string | undefined,
	availableLocales: readonly LocaleCatalogEntry[],
): string {
	if (storedLocaleCode && availableLocales.some((entry) => entry.code === storedLocaleCode)) {
		return storedLocaleCode;
	}
	return options.locale ?? 'en';
}
