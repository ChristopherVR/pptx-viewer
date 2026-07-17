import type { ThemeCatalogEntry, ViewerTheme } from 'pptx-viewer-shared';
import type { LocaleCatalogEntry } from 'pptx-viewer-shared/i18n';
import { LOCALE_CATALOG } from 'pptx-viewer-shared/i18n';

import type { PptxViewerOptions } from './types';

/**
 * Resolution helpers behind File > Options' Appearance/Language tabs and the
 * viewer's persisted theme/locale state (`PptxViewer.currentTheme` /
 * `currentThemeKey` / `currentLocale`).
 *
 * Precedence, mirroring the other bindings' "host callback vs internal
 * persistence" convention: an explicit constructor option always wins, then a
 * previously persisted `localStorage` choice (see `viewer-prefs-storage.ts`
 * in `pptx-viewer-shared`), then the shared catalog's built-in default.
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

/** Resolve the theme to mount with: `options.theme` > stored prefs > catalog default. */
export function resolveInitialThemeState(
	options: PptxViewerOptions,
	storedThemeKey: string | undefined,
	catalog: readonly ThemeCatalogEntry[],
): InitialThemeState {
	if (options.theme !== undefined) {
		return { key: findThemeCatalogKey(options.theme, catalog) ?? 'default', theme: options.theme };
	}
	const key =
		storedThemeKey && catalog.some((entry) => entry.key === storedThemeKey)
			? storedThemeKey
			: 'default';
	return { key, theme: catalog.find((entry) => entry.key === key)?.theme };
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

/** Resolve the locale to start with: `options.locale` > stored prefs (if still offered) > `'en'`. */
export function resolveInitialLocale(
	options: PptxViewerOptions,
	storedLocaleCode: string | undefined,
	availableLocales: readonly LocaleCatalogEntry[],
): string {
	if (options.locale !== undefined) {
		return options.locale;
	}
	if (storedLocaleCode && availableLocales.some((entry) => entry.code === storedLocaleCode)) {
		return storedLocaleCode;
	}
	return 'en';
}
