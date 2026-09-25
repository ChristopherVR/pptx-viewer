import { describe, expect, it } from 'vitest';

import { activeGalleryThemePreset, GALLERY_THEME_PRESETS } from './theme-gallery-presets';

describe('theme-gallery-presets', () => {
	it('exposes the gallery set in the canonical order', () => {
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

	it('adds the gallery-only themes and omits slate/metropolitan', () => {
		const ids = GALLERY_THEME_PRESETS.map((p) => p.id);
		expect(ids).toContain('wisp');
		expect(ids).toContain('berlin');
		expect(ids).toContain('slice');
		expect(ids).toContain('dividend');
		expect(ids).not.toContain('slate');
		expect(ids).not.toContain('metropolitan');
	});

	it('gives every preset a colour scheme and a nested font scheme', () => {
		for (const preset of GALLERY_THEME_PRESETS) {
			expect(preset.colorScheme.accent1).toMatch(/^#[0-9A-Fa-f]{6}$/);
			expect(preset.fontScheme.majorFont.latin).toBeTypeOf('string');
			expect(preset.fontScheme.minorFont.latin).toBeTypeOf('string');
		}
	});

	it('finds the active preset by colour scheme, then by name', () => {
		const berlin = GALLERY_THEME_PRESETS.find((p) => p.id === 'berlin');
		expect(
			activeGalleryThemePreset({ name: 'Renamed', colorScheme: berlin?.colorScheme })?.id,
		).toBe('berlin');
		expect(activeGalleryThemePreset({ name: 'Ion' })?.id).toBe('ion');
		expect(activeGalleryThemePreset({ name: 'Custom Theme' })).toBeUndefined();
		expect(activeGalleryThemePreset(undefined)).toBeUndefined();
	});
});
