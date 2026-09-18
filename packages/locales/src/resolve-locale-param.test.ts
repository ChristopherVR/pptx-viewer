import { describe, expect, it } from 'vitest';

import { resolveLocaleParam, VIEWER_LOCALE_CODES } from './resolve-locale-param';

describe('resolveLocaleParam', () => {
	it('defaults to English when the param is absent', () => {
		expect(resolveLocaleParam('')).toBe('en');
		expect(resolveLocaleParam('?sample=1')).toBe('en');
	});

	it('resolves every canonical locale code', () => {
		for (const code of VIEWER_LOCALE_CODES) {
			expect(resolveLocaleParam(`?locale=${code}`)).toBe(code);
		}
	});

	it('is case-insensitive', () => {
		expect(resolveLocaleParam('?locale=FR')).toBe('fr');
		expect(resolveLocaleParam('?locale=Zh-Cn')).toBe('zh-CN');
	});

	it('accepts the bare "zh" alias for Simplified Chinese', () => {
		expect(resolveLocaleParam('?locale=zh')).toBe('zh-CN');
	});

	it('falls back to English for an unknown locale, with no throw', () => {
		expect(resolveLocaleParam('?locale=xx')).toBe('en');
	});

	it('falls back to a caller-supplied default when the param is missing', () => {
		expect(resolveLocaleParam('?sample=1', 'de')).toBe('de');
	});

	it('an explicit param overrides the caller-supplied default', () => {
		expect(resolveLocaleParam('?locale=fr', 'de')).toBe('fr');
	});

	it('falls back to the default for an unknown locale, not English', () => {
		expect(resolveLocaleParam('?locale=xx', 'de')).toBe('de');
	});

	it('works whether or not the search string has a leading "?"', () => {
		expect(resolveLocaleParam('locale=es')).toBe('es');
	});
});
