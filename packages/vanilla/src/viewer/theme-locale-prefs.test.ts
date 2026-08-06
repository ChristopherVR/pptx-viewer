import { THEME_CATALOG } from 'pptx-viewer-shared';
import { LOCALE_CATALOG } from 'pptx-viewer-shared/i18n';
import { describe, expect, it } from 'vitest';

import {
	findThemeCatalogKey,
	resolveAvailableLocales,
	resolveInitialLocale,
	resolveInitialThemeState,
} from './theme-locale-prefs';
import type { PptxViewerOptions } from './types';

describe('theme-locale-prefs', () => {
	describe('findThemeCatalogKey', () => {
		it('matches a catalog entry by theme reference', () => {
			const vermilionDark = THEME_CATALOG.find((entry) => entry.key === 'vermilionDark')!.theme;
			expect(findThemeCatalogKey(vermilionDark, THEME_CATALOG)).toBe('vermilionDark');
		});

		it('matches undefined to the default entry', () => {
			expect(findThemeCatalogKey(undefined, THEME_CATALOG)).toBe('default');
		});

		it('returns undefined for a theme with no catalog match', () => {
			expect(
				findThemeCatalogKey({ colors: { primary: '#000000' } }, THEME_CATALOG),
			).toBeUndefined();
		});
	});

	describe('resolveInitialThemeState', () => {
		it('prefers a stored catalog choice over the host default theme', () => {
			const custom = { colors: { primary: '#123456' } };
			const state = resolveInitialThemeState(
				{ theme: custom } as PptxViewerOptions,
				'vermilionLight',
				THEME_CATALOG,
			);
			expect(state.key).toBe('vermilionLight');
			expect(state.theme).toBe(
				THEME_CATALOG.find((entry) => entry.key === 'vermilionLight')!.theme,
			);
		});

		it('applies the host theme when nothing is stored', () => {
			const custom = { colors: { primary: '#123456' } };
			const state = resolveInitialThemeState(
				{ theme: custom } as PptxViewerOptions,
				undefined,
				THEME_CATALOG,
			);
			expect(state.theme).toBe(custom);
			// No catalog match for an ad hoc theme, so it falls back to the 'default' key.
			expect(state.key).toBe('default');
		});

		it('applies the host theme when the stored key is the default entry', () => {
			const custom = { colors: { primary: '#123456' } };
			const state = resolveInitialThemeState(
				{ theme: custom } as PptxViewerOptions,
				'default',
				THEME_CATALOG,
			);
			expect(state.key).toBe('default');
			// The 'default' entry maps to `undefined`, so the host theme still wins
			// there (the Svelte binding's theme-prop precedence).
			expect(state.theme).toBe(custom);
		});

		it('falls back to the stored theme key when no explicit theme is given', () => {
			const state = resolveInitialThemeState(
				{} as PptxViewerOptions,
				'vermilionLight',
				THEME_CATALOG,
			);
			expect(state.key).toBe('vermilionLight');
			expect(state.theme).toBe(
				THEME_CATALOG.find((entry) => entry.key === 'vermilionLight')!.theme,
			);
		});

		it('falls back to the catalog default when nothing is stored', () => {
			const state = resolveInitialThemeState({} as PptxViewerOptions, undefined, THEME_CATALOG);
			expect(state.key).toBe('default');
			expect(state.theme).toBeUndefined();
		});

		it('ignores an unknown stored key', () => {
			const state = resolveInitialThemeState(
				{} as PptxViewerOptions,
				'not-a-real-key',
				THEME_CATALOG,
			);
			expect(state.key).toBe('default');
		});
	});

	describe('resolveAvailableLocales', () => {
		it('prefers an explicit options.availableLocales', () => {
			const custom = [{ code: 'xx', label: 'Xx', nativeLabel: 'Xx' }];
			expect(resolveAvailableLocales({ availableLocales: custom } as PptxViewerOptions)).toBe(
				custom,
			);
		});

		it('offers en plus every locale with a registered dictionary', () => {
			const locales = resolveAvailableLocales({
				messages: { fr: {}, de: {} },
			} as unknown as PptxViewerOptions);
			expect(locales.map((entry) => entry.code).sort()).toStrictEqual(['de', 'en', 'fr']);
		});

		it('never offers a locale without a registered dictionary', () => {
			const locales = resolveAvailableLocales({} as PptxViewerOptions);
			expect(locales.map((entry) => entry.code)).toStrictEqual(['en']);
		});

		it('falls back to the code itself for a dictionary with no catalog entry', () => {
			const locales = resolveAvailableLocales({
				messages: { pt: {} },
			} as unknown as PptxViewerOptions);
			expect(locales.find((entry) => entry.code === 'pt')).toStrictEqual({
				code: 'pt',
				label: 'pt',
				nativeLabel: 'pt',
			});
		});
	});

	describe('resolveInitialLocale', () => {
		it('prefers a stored locale over the host default locale', () => {
			expect(
				resolveInitialLocale({ locale: 'de' } as PptxViewerOptions, 'fr', LOCALE_CATALOG),
			).toBe('fr');
		});

		it('applies the host locale when nothing is stored', () => {
			expect(
				resolveInitialLocale({ locale: 'de' } as PptxViewerOptions, undefined, LOCALE_CATALOG),
			).toBe('de');
		});

		it('applies the host locale when the stored locale is no longer offered', () => {
			expect(
				resolveInitialLocale({ locale: 'de' } as PptxViewerOptions, 'fr', [LOCALE_CATALOG[0]]),
			).toBe('de');
		});

		it('falls back to the stored locale when it is still offered', () => {
			expect(resolveInitialLocale({} as PptxViewerOptions, 'fr', LOCALE_CATALOG)).toBe('fr');
		});

		it('falls back to en when the stored locale is no longer offered', () => {
			expect(resolveInitialLocale({} as PptxViewerOptions, 'fr', [LOCALE_CATALOG[0]])).toBe('en');
		});

		it('falls back to en when nothing is stored', () => {
			expect(resolveInitialLocale({} as PptxViewerOptions, undefined, LOCALE_CATALOG)).toBe('en');
		});
	});
});
