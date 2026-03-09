import { describe, it, expect } from 'vitest';
import { themeToCssVars, defaultCssVars } from './css-vars';
import { defaultThemeColors, defaultRadius } from './defaults';

describe('themeToCssVars', () => {
	it('should return empty object for undefined theme', () => {
		expect(themeToCssVars(undefined)).toEqual({});
	});

	it('should return empty object for empty theme', () => {
		expect(themeToCssVars({})).toEqual({});
	});

	it('should convert color keys to CSS custom properties', () => {
		const vars = themeToCssVars({
			colors: { primary: '#FF0000' },
		});
		expect(vars['--pptx-primary']).toBe('#FF0000');
	});

	it('should convert camelCase keys to kebab-case CSS properties', () => {
		const vars = themeToCssVars({
			colors: {
				cardForeground: '#AABBCC',
				primaryForeground: '#112233',
				mutedForeground: '#445566',
			},
		});
		expect(vars['--pptx-card-foreground']).toBe('#AABBCC');
		expect(vars['--pptx-primary-foreground']).toBe('#112233');
		expect(vars['--pptx-muted-foreground']).toBe('#445566');
	});

	it('should include radius when specified', () => {
		const vars = themeToCssVars({ radius: '0.75rem' });
		expect(vars['--pptx-radius']).toBe('0.75rem');
	});

	it('should include escape-hatch cssVars', () => {
		const vars = themeToCssVars({
			cssVars: {
				'--my-custom-prop': 'blue',
				'--another': '42px',
			},
		});
		expect(vars['--my-custom-prop']).toBe('blue');
		expect(vars['--another']).toBe('42px');
	});

	it('should omit defaults when omitDefaults is true', () => {
		const vars = themeToCssVars(
			{
				colors: {
					primary: defaultThemeColors.primary, // same as default
					background: '#FF0000', // different from default
				},
			},
			true,
		);
		expect(vars['--pptx-primary']).toBeUndefined();
		expect(vars['--pptx-background']).toBe('#FF0000');
	});

	it('should include all colors when omitDefaults is false', () => {
		const vars = themeToCssVars({
			colors: {
				primary: defaultThemeColors.primary,
				background: '#FF0000',
			},
		});
		expect(vars['--pptx-primary']).toBe(defaultThemeColors.primary);
		expect(vars['--pptx-background']).toBe('#FF0000');
	});

	it('should omit default radius when omitDefaults is true', () => {
		const vars = themeToCssVars({ radius: defaultRadius }, true);
		expect(vars['--pptx-radius']).toBeUndefined();
	});

	it('should include non-default radius when omitDefaults is true', () => {
		const vars = themeToCssVars({ radius: '1rem' }, true);
		expect(vars['--pptx-radius']).toBe('1rem');
	});

	it('should skip undefined color values', () => {
		const vars = themeToCssVars({
			colors: {
				primary: '#FF0000',
				// background not set
			},
		});
		expect(vars['--pptx-primary']).toBe('#FF0000');
		expect(vars['--pptx-background']).toBeUndefined();
	});
});

describe('defaultCssVars', () => {
	it('should include all color keys', () => {
		const vars = defaultCssVars();
		expect(vars['--pptx-background']).toBeDefined();
		expect(vars['--pptx-foreground']).toBeDefined();
		expect(vars['--pptx-primary']).toBeDefined();
		expect(vars['--pptx-secondary']).toBeDefined();
		expect(vars['--pptx-destructive']).toBeDefined();
		expect(vars['--pptx-border']).toBeDefined();
		expect(vars['--pptx-ring']).toBeDefined();
	});

	it('should use values from defaultThemeColors', () => {
		const vars = defaultCssVars();
		expect(vars['--pptx-background']).toBe(defaultThemeColors.background);
		expect(vars['--pptx-primary']).toBe(defaultThemeColors.primary);
		expect(vars['--pptx-foreground']).toBe(defaultThemeColors.foreground);
	});

	it('should include the default radius', () => {
		const vars = defaultCssVars();
		expect(vars['--pptx-radius']).toBe(defaultRadius);
	});

	it('should produce 20 keys (19 colors + 1 radius)', () => {
		const vars = defaultCssVars();
		expect(Object.keys(vars).length).toBe(20);
	});

	it('should only produce keys prefixed with --pptx-', () => {
		const vars = defaultCssVars();
		for (const key of Object.keys(vars)) {
			expect(key.startsWith('--pptx-')).toBe(true);
		}
	});

	it('should have string values for all keys', () => {
		const vars = defaultCssVars();
		for (const value of Object.values(vars)) {
			expect(typeof value).toBe('string');
			expect(value.length).toBeGreaterThan(0);
		}
	});
});
