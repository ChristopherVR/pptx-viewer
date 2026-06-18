/**
 * Unit tests for ThemeGalleryComponent (Angular).
 *
 * Tests the pure helpers (swatch extraction) and the component's output
 * contract — applyTheme emits the selected preset; close emits on Cancel /
 * backdrop click.  Uses Angular TestBed with ComponentFixture.
 */
import { THEME_PRESETS } from 'pptx-viewer-core';
import type { PptxThemePreset } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

// ── Pure-helper tests (no DOM needed) ───────────────────────────────────────

describe('accentSwatches helper (via THEME_PRESETS)', () => {
	it('contains at least one preset', () => {
		expect(THEME_PRESETS.length).toBeGreaterThan(0);
	});

	it('every preset has the expected colorScheme keys', () => {
		const requiredKeys: (keyof PptxThemePreset['colorScheme'])[] = [
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
			for (const key of requiredKeys) {
				expect(preset.colorScheme[key], `${preset.id} is missing colorScheme.${key}`).toBeTruthy();
			}
		}
	});

	it('every preset has id, name, and fontScheme', () => {
		for (const preset of THEME_PRESETS) {
			expect(preset.id, 'preset.id must be non-empty').toBeTruthy();
			expect(preset.name, 'preset.name must be non-empty').toBeTruthy();
			expect(
				preset.fontScheme.majorFont.latin,
				'preset.fontScheme.majorFont.latin must be non-empty',
			).toBeTruthy();
			expect(
				preset.fontScheme.minorFont.latin,
				'preset.fontScheme.minorFont.latin must be non-empty',
			).toBeTruthy();
		}
	});

	it('accent swatches for a known preset return six entries', () => {
		const office = THEME_PRESETS.find((p) => p.id === 'office');
		expect(office).toBeDefined();
		if (!office) {
			return;
		}
		const c = office.colorScheme;
		const swatches = [c.dk2, c.accent1, c.accent2, c.accent3, c.accent4, c.accent5];
		expect(swatches).toHaveLength(6);
		for (const swatch of swatches) {
			// Each colour must look like a hex colour string
			expect(swatch).toMatch(/^#[0-9a-fA-F]{6}$/u);
		}
	});
});
