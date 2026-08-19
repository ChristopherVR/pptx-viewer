/**
 * Regression cover for the two picture-rendering rules every binding shares.
 *
 * Both were React-only before: React resolved the SVG blip variant and applied
 * the `<a:srcRect>` crop, while Vue, Angular, Vanilla and Svelte resolved only
 * the raster blip and hard-coded `object-fit: contain`. On a real deck that
 * meant SVG-only icons vanished entirely and cropped insets showed the wrong
 * region of their source image.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	getContainerStyle,
	getImageFitStyle,
	getImageOverflow,
	getImageSrc,
	paintedElementSize,
} from './element-style';

function picture(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'picture',
		id: 'pic1',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		...overrides,
	} as PptxElement;
}

describe('getContainerStyle degenerate boxes', () => {
	// A `<a:prstGeom prst="line"/>` rule authored with `cy="1"` EMU rounds to a
	// zero-pixel box. React has always padded such a box to MIN_ELEMENT_SIZE so it
	// stays hoverable and grabbable; the other four did not, so the same slide
	// measured a different height in each.
	it('pads a zero-height element to the minimum element size', () => {
		const style = getContainerStyle(picture({ width: 400, height: 0 }), 3);
		expect(style['width']).toBe('400px');
		expect(style['height']).toBe('12px');
	});

	it('leaves a normally sized element alone', () => {
		const style = getContainerStyle(picture({ width: 400, height: 300 }), 3);
		expect(style['width']).toBe('400px');
		expect(style['height']).toBe('300px');
	});

	it('exposes the painted box so the stroke overlay can match its viewBox', () => {
		expect(paintedElementSize(picture({ width: 0, height: 0 }))).toStrictEqual({
			width: 12,
			height: 12,
		});
	});
});

describe('getImageSrc', () => {
	it('resolves a picture whose only blip is an SVG extension', () => {
		// `<a:blip>` with no `r:embed`, just `asvg:svgBlip`: there is no raster
		// fallback, so a resolver that reads `imageData` alone renders nothing.
		const el = picture({ svgData: 'data:image/svg+xml;base64,SVG' } as Partial<PptxElement>);
		expect(getImageSrc(el, new Map())).toBe('data:image/svg+xml;base64,SVG');
	});

	it('prefers the SVG variant over the raster fallback', () => {
		const el = picture({
			svgData: 'data:image/svg+xml;base64,SVG',
			imageData: 'data:image/png;base64,PNG',
		} as Partial<PptxElement>);
		expect(getImageSrc(el, new Map())).toBe('data:image/svg+xml;base64,SVG');
	});

	it('resolves a lazily hydrated SVG through its media path', () => {
		const el = picture({ svgPath: 'ppt/media/image20.svg' } as Partial<PptxElement>),
			media = new Map([['ppt/media/image20.svg', 'blob:svg']]);
		expect(getImageSrc(el, media)).toBe('blob:svg');
	});

	it('still resolves raster-only pictures, eagerly and lazily', () => {
		expect(getImageSrc(picture({ imageData: 'data:png' } as Partial<PptxElement>), new Map())).toBe(
			'data:png',
		);
		expect(
			getImageSrc(
				picture({ imagePath: 'ppt/media/image1.png' } as Partial<PptxElement>),
				new Map([['ppt/media/image1.png', 'blob:png']]),
			),
		).toBe('blob:png');
	});

	it('returns undefined for an element with no image at all', () => {
		expect(getImageSrc(picture(), new Map())).toBeUndefined();
	});
});

describe('getImageFitStyle', () => {
	it('stretches to fill the frame when the picture is uncropped', () => {
		expect(getImageFitStyle(picture())).toStrictEqual({
			width: '100%',
			height: '100%',
			objectFit: 'fill',
		});
	});

	it('places the image into a negative a:fillRect region, clipped by the frame', () => {
		// Issue #132 deck, phone photo: l=-129.239%, r=-19.565% paints the image
		// 2.48x the frame width, shifted far left, clipped by overflow hidden.
		const style = getImageFitStyle(
			picture({ fillRectLeft: -1.29239, fillRectRight: -0.19565 } as Partial<PptxElement>),
		);
		expect(style['position']).toBe('absolute');
		expect(style['objectFit']).toBe('fill');
		expect(style['transformOrigin']).toBe('top left');
		expect(style['transform']).toBe('translate(-129.24%, 0%) scale(2.48804, 1)');
	});

	it('composes a source crop with a fillRect placement', () => {
		const style = getImageFitStyle(
			picture({
				cropLeft: 0.25,
				cropRight: 0.25,
				fillRectLeft: 0.1,
				fillRectRight: 0.1,
			} as Partial<PptxElement>),
		);
		// Placement maps the img onto the fill-rect region of the frame, then
		// the crop transform magnifies within that box.
		expect(style['transform']).toBe(
			'translate(10%, 0%) scale(0.8, 1) translate(-50%, 0%) scale(2, 1)',
		);
	});

	it('scales and offsets the source so a crop shows the right region', () => {
		// Keep the middle half horizontally: the surviving 50% must be blown up
		// 2x and pulled left by half of its own (post-scale) width.
		const style = getImageFitStyle(
			picture({ cropLeft: 0.25, cropRight: 0.25 } as Partial<PptxElement>),
		);
		expect(style['objectFit']).toBe('fill');
		expect(style['transformOrigin']).toBe('top left');
		expect(style['transform']).toBe('translate(-50%, 0%) scale(2, 1)');
		expect(style['position']).toBe('absolute');
	});

	it('applies a one-sided crop on both axes independently', () => {
		const style = getImageFitStyle(
			picture({ cropLeft: 0.038, cropTop: 0.171, cropRight: 0.569 } as Partial<PptxElement>),
		);
		// Surviving width 0.393 -> scale 2.544529, offset -0.038/0.393 = -9.67%.
		expect(style['transform']).toBe('translate(-9.67%, -20.63%) scale(2.544529, 1.206273)');
	});

	it('leaves a sliver rather than dividing by zero on a total crop', () => {
		const style = getImageFitStyle(
			picture({ cropLeft: 0.95, cropRight: 0.95 } as Partial<PptxElement>),
		);
		expect(String(style['transform'])).not.toContain('Infinity');
		expect(String(style['transform'])).not.toContain('NaN');
	});

	it('fills the frame for a non-image element', () => {
		const shape = { type: 'shape', id: 's1', x: 0, y: 0, width: 1, height: 1 } as PptxElement;
		expect(getImageFitStyle(shape)['objectFit']).toBe('fill');
	});
});

describe('getImageOverflow', () => {
	it('clips a picture so a crop cannot paint outside its frame', () => {
		expect(getImageOverflow(picture())).toBe('hidden');
	});

	it('lets a blur halo with @grow bleed past the element box', () => {
		const el = picture({
			shapeStyle: { blurGrow: true, blurRadius: 8 },
		} as unknown as Partial<PptxElement>);
		expect(getImageOverflow(el)).toBe('visible');
	});

	it('still clips a blur that does not grow', () => {
		const el = picture({
			shapeStyle: { blurGrow: false, blurRadius: 8 },
		} as unknown as Partial<PptxElement>);
		expect(getImageOverflow(el)).toBe('hidden');
	});
});
