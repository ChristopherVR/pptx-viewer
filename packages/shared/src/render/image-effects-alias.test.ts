import type { PptxElement } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import { getImageEffectsFilter, getImageFilterCss, getImageEffectsOpacity } from './image-effects';

// Ported from the React `shape-visual-effects.test.ts` (now a thin shim over
// shared's `image-effects`). Confirms the legacy `getImageEffectsFilter` alias
// is identical to `getImageFilterCss` and that a few representative paths work
// through the alias name.

function makeImageElement(imageEffects?: Record<string, unknown>): PptxElement {
	return {
		id: 'test-img-1',
		type: 'image',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		imageEffects: imageEffects as PptxElement['imageEffects'],
	} as PptxElement;
}

describe('getImageEffectsFilter (alias)', () => {
	it('is the same reference as getImageFilterCss', () => {
		expect(getImageEffectsFilter).toBe(getImageFilterCss);
	});

	it('applies brightness adjustment via the alias', () => {
		expect(getImageEffectsFilter(makeImageElement({ brightness: 50 }))).toContain(
			'brightness(1.5)',
		);
	});

	it('references the artistic SVG filter for complex effects', () => {
		expect(getImageEffectsFilter(makeImageElement({ artisticEffect: 'cutout' }))).toContain(
			'url(#artistic-fx-test-img-1)',
		);
	});

	it('excludes duotone when the excludeDuotone option is set', () => {
		const el = makeImageElement({ duotone: { color1: '#000000', color2: '#FFFFFF' } });
		expect(getImageEffectsFilter(el, { excludeDuotone: true })).toBeUndefined();
	});

	it('returns normalised opacity from alphaModFix', () => {
		expect(getImageEffectsOpacity(makeImageElement({ alphaModFix: 50 }))).toBe(0.5);
	});
});
