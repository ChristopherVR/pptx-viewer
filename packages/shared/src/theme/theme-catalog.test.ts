import { describe, it, expect } from 'vitest';

import { vermilionDarkTheme, vermilionLightTheme } from './presets';
import { resolveThemeCatalogEntry, THEME_CATALOG } from './theme-catalog';

describe('theme catalog', () => {
	it('has unique keys', () => {
		const keys = THEME_CATALOG.map((entry) => entry.key);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it('includes the built-in default (undefined theme) as the first entry', () => {
		expect(THEME_CATALOG[0]).toMatchObject({ key: 'default', theme: undefined });
	});

	it('includes both vermilion presets', () => {
		expect(THEME_CATALOG.find((e) => e.key === 'vermilionLight')?.theme).toBe(vermilionLightTheme);
		expect(THEME_CATALOG.find((e) => e.key === 'vermilionDark')?.theme).toBe(vermilionDarkTheme);
	});
});

describe('resolveThemeCatalogEntry', () => {
	it('resolves a known key to its theme', () => {
		expect(resolveThemeCatalogEntry('vermilionDark')).toBe(vermilionDarkTheme);
	});

	it('falls back to undefined for an unknown key', () => {
		expect(resolveThemeCatalogEntry('does-not-exist')).toBeUndefined();
	});

	it('falls back to undefined when no key is given', () => {
		expect(resolveThemeCatalogEntry(undefined)).toBeUndefined();
	});
});
