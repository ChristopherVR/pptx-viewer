import { describe, it, expect, expectTypeOf } from 'vitest';

import { ThemePresets, getThemePreset } from './theme-presets';
import type { ThemePreset } from './theme-presets';
import type { PresentationOptions } from './types';

const REQUIRED_COLOR_KEYS = [
	'dk1',
	'lt1',
	'dk2',
	'lt2',
	'accent1',
	'accent2',
	'accent3',
	'accent4',
	'accent5',
	'accent6',
	'hlink',
	'folHlink',
] as const;

const PRESET_NAMES = [
	'OFFICE',
	'MODERN_BLUE',
	'EARTH',
	'MONOCHROME',
	'VIBRANT',
	'CORPORATE',
	'MINIMAL',
	'DARK',
] as const;

describe('theme-presets', () => {
	describe('themePresets', () => {
		it('contains all 8 presets', () => {
			expect(Object.keys(ThemePresets)).toHaveLength(8);
			for (const name of PRESET_NAMES) {
				expect(ThemePresets).toHaveProperty(name);
			}
		});

		describe.each(PRESET_NAMES)('%s preset', (presetName) => {
			const preset: ThemePreset = ThemePresets[presetName];

			it('has a non-empty name', () => {
				expectTypeOf(preset.name).toBeString();
				expect(preset.name.length).toBeGreaterThan(0);
			});

			it('has all 12 required color keys', () => {
				for (const key of REQUIRED_COLOR_KEYS) {
					expect(preset.colors).toHaveProperty(key);
				}
			});

			it('has valid hex color strings for all colors', () => {
				for (const key of REQUIRED_COLOR_KEYS) {
					const color = preset.colors[key];
					expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
				}
			});

			it('has fonts with majorFont and minorFont as non-empty strings', () => {
				expectTypeOf(preset.fonts.majorFont).toBeString();
				expect(preset.fonts.majorFont.length).toBeGreaterThan(0);
				expectTypeOf(preset.fonts.minorFont).toBeString();
				expect(preset.fonts.minorFont.length).toBeGreaterThan(0);
			});
		});
	});

	describe('getThemePreset', () => {
		it('returns the OFFICE theme by name', () => {
			const theme = getThemePreset('OFFICE');
			expect(theme).toBe(ThemePresets.OFFICE);
			expect(theme.name).toBe('Office Theme');
		});

		it('returns the MODERN_BLUE theme by name', () => {
			const theme = getThemePreset('MODERN_BLUE');
			expect(theme).toBe(ThemePresets.MODERN_BLUE);
			expect(theme.name).toBe('Modern Blue');
		});
	});

	describe('type compatibility', () => {
		it('presets can be used as PresentationOptions.theme', () => {
			// This is a compile-time check that also runs at runtime.
			// If ThemePreset were not assignable to PresentationThemeInput,
			// TypeScript would produce an error before the test even runs.
			const options: PresentationOptions = {
				theme: ThemePresets.OFFICE,
			};
			expect(options.theme).toBeDefined();
			expect(options.theme!.name).toBe('Office Theme');

			const options2: PresentationOptions = {
				theme: ThemePresets.MODERN_BLUE,
			};
			expect(options2.theme).toBeDefined();
			expect(options2.theme!.name).toBe('Modern Blue');
		});
	});
});
