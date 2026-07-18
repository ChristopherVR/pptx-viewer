import { describe, it, expect } from 'vitest';

import { themeToCssVars } from './css-vars';
import { defaultThemeColors } from './defaults';
import {
	vermilionLightColors,
	vermilionDarkColors,
	vermilionLightTheme,
	vermilionDarkTheme,
	vermilionRadius,
} from './presets';

const presets = [
	['light', vermilionLightColors, vermilionLightTheme],
	['dark', vermilionDarkColors, vermilionDarkTheme],
] as const;

describe('vermilion theme presets', () => {
	it.each(presets)('%s palette defines every ViewerThemeColors key', (_name, colors) => {
		const expectedKeys = Object.keys(defaultThemeColors).sort();
		expect(Object.keys(colors).sort()).toStrictEqual(expectedKeys);
	});

	it.each(presets)('%s palette holds only valid CSS color strings', (_name, colors) => {
		for (const value of Object.values(colors)) {
			expect(value).toMatch(/^(#[0-9a-f]{6}|rgba?\([\d\s.,]+\))$/i);
		}
	});

	it.each(presets)('%s theme converts to a full set of CSS vars', (_name, colors, theme) => {
		const vars = themeToCssVars(theme);
		expect(vars['--pptx-radius']).toBe(vermilionRadius);
		// Every color, the radius, and the 2 derived inspector tokens (active/border).
		expect(Object.keys(vars).filter((k) => k.startsWith('--pptx-'))).toHaveLength(
			Object.keys(colors).length + 3,
		);
	});

	it('light and dark share the same radius', () => {
		expect(vermilionLightTheme.radius).toBe(vermilionDarkTheme.radius);
	});
});
