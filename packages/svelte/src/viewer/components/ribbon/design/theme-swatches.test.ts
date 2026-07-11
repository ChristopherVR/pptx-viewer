import { describe, expect, it } from 'vitest';

import { THEME_SWATCHES } from './theme-swatches';

describe('themeSwatches', () => {
	it('lists Default (reset) then Light then Dark', () => {
		expect(THEME_SWATCHES.map((s) => s.labelKey)).toStrictEqual([
			'pptx.ribbon.theme.default',
			'pptx.ribbon.theme.light',
			'pptx.ribbon.theme.dark',
		]);
	});

	it('default resets to undefined; light/dark carry a resolved ViewerTheme', () => {
		expect(THEME_SWATCHES[0].theme).toBeUndefined();
		expect(THEME_SWATCHES[1].theme?.colors?.primary).toBeTruthy();
		expect(THEME_SWATCHES[2].theme?.colors?.primary).toBeTruthy();
		expect(THEME_SWATCHES[1].theme).not.toBe(THEME_SWATCHES[2].theme);
	});
});
