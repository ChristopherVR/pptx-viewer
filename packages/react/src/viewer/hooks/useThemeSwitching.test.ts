import { THEME_PRESETS } from 'pptx-viewer-core';
import type { PptxThemePreset, PptxThemeColorScheme } from 'pptx-viewer-core';
import { describe, it, expect, expectTypeOf } from 'vitest';

/**
 * Unit tests for the theme switching hook.
 * These test the pure logic without rendering React components.
 * The hook itself is a thin wrapper around THEME_PRESETS and applyThemeToData.
 */

describe('tHEME_PRESETS (used by useThemeSwitching)', () => {
	it('exports a non-empty readonly array', () => {
		expect(Array.isArray(THEME_PRESETS)).toBeTruthy();
		expect(THEME_PRESETS.length).toBeGreaterThan(0);
	});

	it('each preset has an id, name, colorScheme, and fontScheme', () => {
		for (const preset of THEME_PRESETS) {
			expectTypeOf(preset.id).toBeString();
			expect(preset.id.length).toBeGreaterThan(0);
			expectTypeOf(preset.name).toBeString();
			expect(preset.name.length).toBeGreaterThan(0);
			expect(preset.colorScheme).toBeDefined();
			expect(preset.fontScheme).toBeDefined();
		}
	});

	it('all preset colour schemes have valid hex colours', () => {
		const hexRegex = /^#[0-9A-Fa-f]{6}$/;
		const keys: Array<keyof PptxThemeColorScheme> = [
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
		];
		for (const preset of THEME_PRESETS) {
			for (const key of keys) {
				expect(preset.colorScheme[key]).toMatch(hexRegex);
			}
		}
	});

	it('all preset font schemes have latin major and minor fonts', () => {
		for (const preset of THEME_PRESETS) {
			expectTypeOf(preset.fontScheme.majorFont?.latin).toBeString();
			expectTypeOf(preset.fontScheme.minorFont?.latin).toBeString();
		}
	});

	it('can find a preset by id', () => {
		const ion = THEME_PRESETS.find((p: PptxThemePreset) => p.id === 'ion');
		expect(ion).toBeDefined();
		expect(ion!.name).toBe('Ion');
	});
});
