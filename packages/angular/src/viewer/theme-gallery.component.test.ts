/**
 * Unit tests for the Theme Gallery preset set (Angular).
 *
 * Validates that the gallery renders the exact React `BUILT_IN_THEMES` set
 * (10 themes, React's order) with valid colour/font schemes, and that the
 * accent-swatch extraction returns six entries for a known preset.
 */
import type { PptxThemePreset } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { GALLERY_THEME_PRESETS } from './theme-gallery-presets';

// ── Gallery-set parity tests (no DOM needed) ────────────────────────────────

describe('gallery theme presets (React BUILT_IN_THEMES parity)', () => {
	it("contains React's exact 10-theme set in order", () => {
		expect(GALLERY_THEME_PRESETS.map((p) => p.id)).toStrictEqual([
			'office',
			'facet',
			'integral',
			'ion',
			'retrospect',
			'organic',
			'wisp',
			'berlin',
			'slice',
			'dividend',
		]);
	});

	it('exposes the matching display names', () => {
		expect(GALLERY_THEME_PRESETS.map((p) => p.name)).toStrictEqual([
			'Office',
			'Facet',
			'Integral',
			'Ion',
			'Retrospect',
			'Organic',
			'Wisp',
			'Berlin',
			'Slice',
			'Dividend',
		]);
	});

	it('omits the core-only Slate and Metropolitan themes', () => {
		const ids = GALLERY_THEME_PRESETS.map((p) => p.id);
		expect(ids).not.toContain('slate');
		expect(ids).not.toContain('metropolitan');
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
		for (const preset of GALLERY_THEME_PRESETS) {
			for (const key of requiredKeys) {
				expect(preset.colorScheme[key], `${preset.id} is missing colorScheme.${key}`).toBeTruthy();
			}
		}
	});

	it('every preset has id, name, and a nested fontScheme', () => {
		for (const preset of GALLERY_THEME_PRESETS) {
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

	it('accent swatches for a known preset return six hex entries', () => {
		const office = GALLERY_THEME_PRESETS.find((p) => p.id === 'office');
		expect(office).toBeDefined();
		if (!office) {
			return;
		}
		const c = office.colorScheme;
		const swatches = [c.dk2, c.accent1, c.accent2, c.accent3, c.accent4, c.accent5];
		expect(swatches).toHaveLength(6);
		for (const swatch of swatches) {
			expect(swatch).toMatch(/^#[0-9a-fA-F]{6}$/u);
		}
	});
});
