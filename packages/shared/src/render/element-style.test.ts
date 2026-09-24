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
	elementContainerHeightStyle,
	elementHitTargetStyle,
	elementInLocalFrame,
	getContainerStyle,
	getImageFitStyle,
	getImageOverflow,
	getImageSrc,
	paintedElementSize,
	shouldRenderHitTarget,
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
	// tiny (sub-MIN_ELEMENT_SIZE, sometimes zero) pixel box. The painted box must
	// keep the AUTHORED size in read-only rendering: padding it to
	// MIN_ELEMENT_SIZE turned a 1-2px horizontal rule into a 12-15px solid bar
	// once a solid fill paints as the wrapper's own `background-color` (issue
	// #285). Any grabbability padding now lives only in `elementHitTargetStyle`,
	// rendered separately and only while the element is interactive/editable.
	it('never pads a zero-height element: the painted box stays at the authored size', () => {
		const style = getContainerStyle(picture({ width: 400, height: 0 }), 3);
		expect(style['width']).toBe('400px');
		expect(style['height']).toBe('0px');
	});

	it('keeps a sub-pixel authored height exactly: a 1.25px rule is not padded to a bar', () => {
		const style = getContainerStyle(picture({ width: 400, height: 1.25 }), 3);
		expect(style['height']).toBe('1.25px');
	});

	it('leaves a normally sized element alone', () => {
		const style = getContainerStyle(picture({ width: 400, height: 300 }), 3);
		expect(style['width']).toBe('400px');
		expect(style['height']).toBe('300px');
	});

	it('exposes the painted box as the authored size, unpadded', () => {
		expect(paintedElementSize(picture({ width: 0, height: 0 }))).toStrictEqual({
			width: 0,
			height: 0,
		});
		expect(paintedElementSize(picture({ width: 400, height: 1.25 }))).toStrictEqual({
			width: 400,
			height: 1.25,
		});
	});

	it('publishes a group box as --pptx-parent-w/-h for origin="parent" motion paths', () => {
		const group: PptxElement = {
			id: 'g1',
			type: 'group',
			x: 10,
			y: 20,
			width: 300,
			height: 150,
			children: [],
		};
		const style = getContainerStyle(group, 1);
		expect(style['--pptx-parent-w']).toBe('300px');
		expect(style['--pptx-parent-h']).toBe('150px');
		expect(
			getContainerStyle(picture({ width: 400, height: 300 }), 3)['--pptx-parent-w'],
		).toBeUndefined();
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

	it('pads the image instead of cropping it for a negative a:srcRect inset (issue G2)', () => {
		// A negative left crop is an outward crop dragged past the source
		// bitmap's edge (e.g. a photo smaller than its placeholder): the image
		// must shrink (scale < 1) and shift right, leaving visible padding on
		// the left, not clip further in.
		const style = getImageFitStyle(picture({ cropLeft: -0.2 } as Partial<PptxElement>));
		expect(style['transform']).toBe('translate(16.67%, 0%) scale(0.833333, 1)');
	});

	it('applies a negative crop on one edge even when the opposite edge cancels the sum', () => {
		// cropLeft + cropRight sums to 0 here; a sum-based "has crop" check
		// would wrongly treat this as uncropped and skip the transform.
		const style = getImageFitStyle(
			picture({ cropLeft: -0.2, cropRight: 0.2 } as Partial<PptxElement>),
		);
		expect(String(style['transform'])).not.toBe('');
		expect(style['transform']).toBeDefined();
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

	it('produces the identical crop transform no matter the frame size (COM-verified, 2026-09-25)', () => {
		// PowerPoint's `<a:stretch><a:fillRect/></a:stretch>` always stretches
		// the kept `<a:srcRect>` window to fill 100% of the destination frame,
		// whether that frame was resized to the crop's aspect ratio (the crop
		// tool's usual result) or left at its pre-crop size (a hand-authored or
		// round-tripped file). Measured directly with PowerPoint COM automation
		// on an SVG picture with a 20%-left crop: exported PNG pixels matched a
		// full non-uniform stretch in BOTH a case where the frame was shrunk to
		// 150.5x200 to match the crop and a case where the frame was left at
		// its pre-crop 200x200 (which renders visibly wider/distorted, not
		// letterboxed, because the same stretched proportion now covers a
		// wider frame). This transform must therefore depend only on the crop
		// fractions, never on the element's own width/height.
		const cropLeft = 0.2;
		const frameResizedToCrop = getImageFitStyle(
			picture({ cropLeft, width: 150.5, height: 200 } as Partial<PptxElement>),
		);
		const frameNotResized = getImageFitStyle(
			picture({ cropLeft, width: 200, height: 200 } as Partial<PptxElement>),
		);
		expect(frameResizedToCrop['transform']).toBe('translate(-25%, 0%) scale(1.25, 1)');
		expect(frameNotResized['transform']).toBe(frameResizedToCrop['transform']);
	});

	it('applies the identical crop transform to an SVG-backed picture as a raster one', () => {
		// getImageFitStyle must not special-case a `svgPath`-backed picture
		// into a different (e.g. letterboxed/no-stretch) transform: OOXML's
		// fill model draws no distinction, and `forceSvgStretchFill` (core)
		// relies on this function's transform being the ONLY place the crop
		// percentages are computed.
		const rasterStyle = getImageFitStyle(picture({ cropLeft: 0.2 } as Partial<PptxElement>));
		const svgStyle = getImageFitStyle(
			picture({ cropLeft: 0.2, svgPath: 'ppt/media/image1.svg' } as Partial<PptxElement>),
		);
		expect(svgStyle['transform']).toBe(rasterStyle['transform']);
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

describe('elementHitTargetStyle', () => {
	// The interaction-only affordance for issue #285: a bigger, invisible,
	// centred click/drag target for a degenerate shape, kept entirely separate
	// from the (now always-authored-size) painted box.
	it('returns undefined for an element already at or above the minimum size', () => {
		expect(elementHitTargetStyle(picture({ width: 400, height: 300 }))).toBeUndefined();
		expect(elementHitTargetStyle(picture({ width: 12, height: 12 }))).toBeUndefined();
	});

	it('centres a padded target over a sub-pixel-tall rule', () => {
		const style = elementHitTargetStyle(picture({ width: 400, height: 1.25 }));
		expect(style).toBeDefined();
		expect(style!['width']).toBe('400px');
		expect(style!['height']).toBe('12px');
		expect(style!['top']).toBe(`${(1.25 - 12) / 2}px`);
		expect(style!['left']).toBe('0px');
		expect(style!['position']).toBe('absolute');
		expect(style!['pointerEvents']).toBe('auto');
	});

	it('pads both axes for a fully degenerate (0x0) element', () => {
		const style = elementHitTargetStyle(picture({ width: 0, height: 0 }));
		expect(style).toStrictEqual({
			position: 'absolute',
			left: '-6px',
			top: '-6px',
			width: '12px',
			height: '12px',
			pointerEvents: 'auto',
		});
	});
});

describe('shouldRenderHitTarget', () => {
	// The single source of truth every binding's per-type renderer (shape,
	// image, chart, table, media, ole, model3d, smartArt, equation, zoom,
	// contentPart, ink, group, connector) must gate the overlay on.
	it('is true only when interactive and not presenting', () => {
		expect(shouldRenderHitTarget(true, false)).toBeTruthy();
	});

	it('is false while read-only', () => {
		expect(shouldRenderHitTarget(false, false)).toBeFalsy();
	});

	it('is false while presenting, even if interactive', () => {
		expect(shouldRenderHitTarget(true, true)).toBeFalsy();
	});

	it('is false when neither interactive nor presenting', () => {
		expect(shouldRenderHitTarget(false, true)).toBeFalsy();
	});
});

describe('elementInLocalFrame', () => {
	const el = {
		id: 'e1',
		type: 'shape',
		x: 10,
		y: 20,
		width: 100,
		height: 50,
		rotation: 45,
		flipHorizontal: true,
		flipVertical: true,
		opacity: 0.5,
	} as unknown as PptxElement;

	it('moves the element to its own origin with no transform or opacity', () => {
		const local = elementInLocalFrame(el);
		const style = getContainerStyle(local, 0);
		expect(style.left).toBe('0px');
		expect(style.top).toBe('0px');
		expect(style.transform).toBeUndefined();
		expect(style.opacity).toBeUndefined();
		expect(style.width).toBe('100px');
	});

	it('keeps the same object for the same element', () => {
		expect(elementInLocalFrame(el)).toBe(elementInLocalFrame(el));
	});
});

describe('elementContainerHeightStyle - table rows auto-grow past the authored frame', () => {
	// `a:tr/@h` is a minimum row height, not a fixed one: PowerPoint grows a row
	// (and so the whole table) taller than that the moment a cell's text needs
	// more room than the row's last-saved height. The authored `a:ext/@cy` is a
	// cache of that computed sum, not a hard clip. Treating it as a fixed CSS
	// height clipped off however many trailing rows no longer fit (tables-sbs/c5:
	// a long-wrapping cell grew row 2, and the frame clipped rows 3 and 4 clean
	// off instead of growing with it).
	function table(overrides: Partial<PptxElement> = {}): PptxElement {
		return {
			type: 'table',
			id: 'tbl1',
			x: 0,
			y: 0,
			width: 400,
			height: 120,
			...overrides,
		} as PptxElement;
	}

	it('sizes a table to its content, with the authored height only as a floor', () => {
		expect(elementContainerHeightStyle(table(), 120)).toStrictEqual({
			height: 'auto',
			minHeight: '120px',
		});
	});

	it('leaves every other element type at a fixed authored height', () => {
		expect(elementContainerHeightStyle(picture(), 100)).toStrictEqual({ height: '100px' });
	});

	it('getContainerStyle applies the same auto-height rule for a table element', () => {
		const style = getContainerStyle(table(), 3);
		expect(style.height).toBe('auto');
		expect(style.minHeight).toBe('120px');
		expect(style.width).toBe('400px');
	});
});
