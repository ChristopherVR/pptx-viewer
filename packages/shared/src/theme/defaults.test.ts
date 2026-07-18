import { describe, it, expect } from 'vitest';

import { themeToCssVars } from './css-vars';
import { defaultThemeColors, lightThemeColors, lightTheme } from './defaults';

describe('lightThemeColors', () => {
	it('defines every ViewerThemeColors key', () => {
		expect(Object.keys(lightThemeColors).sort()).toStrictEqual(
			Object.keys(defaultThemeColors).sort(),
		);
	});

	it('holds only valid CSS color strings', () => {
		for (const value of Object.values(lightThemeColors)) {
			expect(value).toMatch(/^(#[0-9a-f]{6}|rgba?\([\d\s.,]+\))$/i);
		}
	});

	it('converts to a full set of CSS vars', () => {
		const vars = themeToCssVars(lightTheme);
		// Every color plus the 2 derived inspector tokens (active/border).
		expect(Object.keys(vars).filter((k) => k.startsWith('--pptx-'))).toHaveLength(
			Object.keys(lightThemeColors).length + 2,
		);
	});
});
