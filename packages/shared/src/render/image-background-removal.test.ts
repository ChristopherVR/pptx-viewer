import type { PptxElement, PptxImageEffects } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getImageBackgroundRemoval } from './image-background-removal';
import {
	getArtisticImageFilter,
	getImageFilterCss,
	isArtisticEffectRendered,
} from './image-effects';

/** Build an image element with the given effects. */
function image(effects?: PptxImageEffects, id = 'img1'): PptxElement {
	return {
		type: 'image',
		id,
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		imageEffects: effects,
	} as PptxElement;
}

describe('getImageBackgroundRemoval', () => {
	it('returns undefined for a picture with no removal recorded', () => {
		expect(getImageBackgroundRemoval(image({ grayscale: true }))).toBeUndefined();
	});

	it('returns undefined for a non-image element', () => {
		expect(
			getImageBackgroundRemoval({
				type: 'shape',
				id: 's1',
				x: 0,
				y: 0,
				width: 1,
				height: 1,
			} as PptxElement),
		).toBeUndefined();
	});

	it('describes the retained rectangle as CSS insets, clockwise from the top', () => {
		const descriptor = getImageBackgroundRemoval(
			image({ backgroundRemoval: { top: 0.12, bottom: 0.88, left: 0.07, right: 0.93 } }),
		);
		expect(descriptor?.clipPath).toBe('inset(12% 7% 12% 7%)');
		expect(descriptor?.retained).toStrictEqual({
			top: 0.12,
			bottom: 0.88,
			left: 0.07,
			right: 0.93,
		});
	});

	it('counts the foreground and background strokes', () => {
		const descriptor = getImageBackgroundRemoval(
			image({
				backgroundRemoval: {
					top: 0,
					bottom: 1,
					left: 0,
					right: 1,
					foregroundMarks: [
						{ x1: 0.1, y1: 0.1, x2: 0.2, y2: 0.2 },
						{ x1: 0.3, y1: 0.3, x2: 0.4, y2: 0.4 },
					],
					backgroundMarks: [{ x1: 0, y1: 0, x2: 0.05, y2: 0.05 }],
				},
			}),
		);
		expect(descriptor?.foregroundMarkCount).toBe(2);
		expect(descriptor?.backgroundMarkCount).toBe(1);
	});

	it('reports the removal as already baked into the stored bitmap', () => {
		const descriptor = getImageBackgroundRemoval(
			image({ backgroundRemoval: { top: 0.25, bottom: 0.75, left: 0.25, right: 0.75 } }),
		);
		expect(descriptor?.prerendered).toBeTruthy();
	});

	it('never leaks into the CSS filter a binding applies', () => {
		// PowerPoint renders the stored bitmap, which already has the background
		// removed; clipping here would crop an image twice.
		expect(
			getImageFilterCss(
				image({ backgroundRemoval: { top: 0.25, bottom: 0.75, left: 0.25, right: 0.75 } }),
			),
		).toBeUndefined();
	});
});

describe('isArtisticEffectRendered', () => {
	it('renders an effect chosen in the inspector', () => {
		expect(isArtisticEffectRendered({ artisticEffect: 'cutout' })).toBeTruthy();
		expect(getImageFilterCss(image({ artisticEffect: 'cutout' }))).toBe('url(#artistic-fx-img1)');
	});

	it('skips an effect PowerPoint already baked into the bitmap', () => {
		const effects: PptxImageEffects = {
			artisticEffect: 'artisticCutout',
			artisticRadius: 60,
			artisticPrerenderedEffect: 'artisticCutout',
		};
		expect(isArtisticEffectRendered(effects)).toBeFalsy();
		expect(getImageFilterCss(image(effects))).toBeUndefined();
		expect(getArtisticImageFilter(image(effects))).toBeUndefined();
	});

	it('leaves the other effects on a pre-rendered picture alone', () => {
		const css = getImageFilterCss(
			image({
				brightness: 50,
				artisticEffect: 'artisticBlur',
				artisticPrerenderedEffect: 'artisticBlur',
			}),
		);
		expect(css).toBe('brightness(1.5)');
	});

	it('returns false when there is no artistic effect at all', () => {
		expect(isArtisticEffectRendered(undefined)).toBeFalsy();
		expect(isArtisticEffectRendered({ grayscale: true })).toBeFalsy();
	});

	it('renders a gallery choice made over a picture with a baked effect', () => {
		// Every binding's gallery patches `artisticEffect` alone, so the baked name
		// has to stay distinguishable or the user's pick would never show up.
		const css = getImageFilterCss(
			image({ artisticEffect: 'sepia', artisticPrerenderedEffect: 'artisticPencilSketch' }),
		);
		expect(css).toBe('sepia(100%)');
	});
});

describe('artistic effect coverage', () => {
	it('honours the schema spelling of artisticMosiaicBubbles', () => {
		// The DrawingML element is misspelled "Mosiaic"; only that spelling ever
		// arrives from a file, and it used to fall through to the generic no-op.
		const filter = getArtisticImageFilter(image({ artisticEffect: 'artisticMosiaicBubbles' }));
		expect(filter?.filterMarkup).toContain('feDisplacementMap');
	});

	it('applies the inspector gallery sepia and grayscale entries', () => {
		expect(getImageFilterCss(image({ artisticEffect: 'sepia' }))).toBe('sepia(100%)');
		expect(getImageFilterCss(image({ artisticEffect: 'grayscale' }))).toBe('grayscale(100%)');
	});
});
