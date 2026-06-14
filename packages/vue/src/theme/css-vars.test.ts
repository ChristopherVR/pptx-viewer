import { describe, expect, it } from 'vitest';

import { defaultCssVars, themeToCssVars } from './css-vars';
import { defaultThemeColors } from './defaults';

describe('themeToCssVars', () => {
	it('returns an empty object for an undefined theme', () => {
		expect(themeToCssVars(undefined)).toStrictEqual({});
	});

	it('maps camelCase color keys to --pptx-kebab custom properties', () => {
		const vars = themeToCssVars({ colors: { primaryForeground: '#fff', primary: '#000' } });
		expect(vars['--pptx-primary']).toBe('#000');
		expect(vars['--pptx-primary-foreground']).toBe('#fff');
	});

	it('emits radius and passes through escape-hatch cssVars', () => {
		const vars = themeToCssVars({ radius: '1rem', cssVars: { '--x': 'y' } });
		expect(vars['--pptx-radius']).toBe('1rem');
		expect(vars['--x']).toBe('y');
	});

	it('omits default-valued colors when omitDefaults is true', () => {
		const vars = themeToCssVars({ colors: { primary: defaultThemeColors.primary } }, true);
		expect(vars['--pptx-primary']).toBeUndefined();
	});
});

describe('defaultCssVars', () => {
	it('includes every color token plus radius', () => {
		const vars = defaultCssVars();
		expect(vars['--pptx-background']).toBe(defaultThemeColors.background);
		expect(vars['--pptx-radius']).toBeDefined();
	});
});
