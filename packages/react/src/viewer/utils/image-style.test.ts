import type { PptxElement } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import {
	getCropShapeClipPath,
	isImageTiled,
	getImageTilingStyle,
	getImageRenderStyle,
	buildMirrorTiledBackground,
} from './image-style';

// Helper to create a minimal image element
function makeImageElement(overrides?: Partial<PptxElement>): PptxElement {
	return {
		id: 'img-1',
		type: 'image',
		x: 0,
		y: 0,
		width: 200,
		height: 150,
		...overrides,
	} as PptxElement;
}

function makeShapeElement(): PptxElement {
	return {
		id: 'shape-1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
	} as PptxElement;
}

// ---------------------------------------------------------------------------
// getCropShapeClipPath
// ---------------------------------------------------------------------------

describe('getCropShapeClipPath', () => {
	it('returns undefined for non-image elements', () => {
		expect(getCropShapeClipPath(makeShapeElement())).toBeUndefined();
	});

	it('returns undefined when no cropShape is set', () => {
		expect(getCropShapeClipPath(makeImageElement())).toBeUndefined();
	});

	it("returns undefined for cropShape 'none'", () => {
		expect(
			getCropShapeClipPath(makeImageElement({ cropShape: 'none' } as Partial<PptxElement>)),
		).toBeUndefined();
	});

	it('returns ellipse clip path', () => {
		const result = getCropShapeClipPath(
			makeImageElement({ cropShape: 'ellipse' } as Partial<PptxElement>),
		);
		expect(result).toBeDefined();
		expect(result).toContain('ellipse(');
	});

	it('returns roundedRect clip path', () => {
		const result = getCropShapeClipPath(
			makeImageElement({ cropShape: 'roundedRect' } as Partial<PptxElement>),
		);
		expect(result).toBeDefined();
		expect(result).toContain('inset(0 round 12%)');
	});

	it('returns triangle clip path', () => {
		const result = getCropShapeClipPath(
			makeImageElement({ cropShape: 'triangle' } as Partial<PptxElement>),
		);
		expect(result).toBeDefined();
		expect(result).toContain('polygon(');
	});

	it('returns diamond clip path', () => {
		const result = getCropShapeClipPath(
			makeImageElement({ cropShape: 'diamond' } as Partial<PptxElement>),
		);
		expect(result).toBeDefined();
		expect(result).toContain('polygon(');
	});

	it('returns star clip path', () => {
		const result = getCropShapeClipPath(
			makeImageElement({ cropShape: 'star' } as Partial<PptxElement>),
		);
		expect(result).toBeDefined();
		expect(result).toContain('polygon(');
	});

	it('returns undefined for unknown crop shape', () => {
		expect(
			getCropShapeClipPath(makeImageElement({ cropShape: 'unknownShape' } as Partial<PptxElement>)),
		).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// isImageTiled
// ---------------------------------------------------------------------------

describe('isImageTiled', () => {
	it('returns false for non-image elements', () => {
		expect(isImageTiled(makeShapeElement())).toBeFalsy();
	});

	it('returns false when no tile scale properties exist', () => {
		expect(isImageTiled(makeImageElement())).toBeFalsy();
	});

	it('returns true when tileScaleX is set', () => {
		const el = makeImageElement({ tileScaleX: 1 } as Partial<PptxElement>);
		expect(isImageTiled(el)).toBeTruthy();
	});

	it('returns true when tileScaleY is set', () => {
		const el = makeImageElement({ tileScaleY: 0.5 } as Partial<PptxElement>);
		expect(isImageTiled(el)).toBeTruthy();
	});

	it('returns true when both tile scales are set', () => {
		const el = makeImageElement({
			tileScaleX: 1,
			tileScaleY: 1,
		} as Partial<PptxElement>);
		expect(isImageTiled(el)).toBeTruthy();
	});

	it('returns false when tile scale is undefined', () => {
		const el = makeImageElement({
			tileScaleX: undefined,
			tileScaleY: undefined,
		} as Partial<PptxElement>);
		expect(isImageTiled(el)).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// getImageTilingStyle
// ---------------------------------------------------------------------------

describe('getImageTilingStyle', () => {
	it('returns undefined for non-image elements', () => {
		expect(getImageTilingStyle(makeShapeElement())).toBeUndefined();
	});

	it('returns undefined for non-tiled images', () => {
		expect(getImageTilingStyle(makeImageElement())).toBeUndefined();
	});

	it('returns tiling style with correct backgroundRepeat', () => {
		const el = makeImageElement({
			tileScaleX: 0.5,
			tileScaleY: 0.5,
		} as Partial<PptxElement>);
		const style = getImageTilingStyle(el);
		expect(style).toBeDefined();
		expect(style!.backgroundRepeat).toBe('repeat');
	});

	it('calculates background size from tile scales', () => {
		const el = makeImageElement({
			tileScaleX: 0.5,
			tileScaleY: 0.25,
		} as Partial<PptxElement>);
		const style = getImageTilingStyle(el);
		expect(style).toBeDefined();
		expect(style!.backgroundSize).toBe('50% 25%');
	});

	it('defaults scale to 100% when not specified', () => {
		const el = makeImageElement({
			tileScaleX: undefined,
			tileScaleY: 0.5,
		} as Partial<PptxElement>);
		const style = getImageTilingStyle(el);
		expect(style).toBeDefined();
		expect(style!.backgroundSize).toBe('100% 50%');
	});

	it('uses tile offset for backgroundPosition', () => {
		const el = makeImageElement({
			tileScaleX: 1,
			tileOffsetX: 10,
			tileOffsetY: 20,
		} as Partial<PptxElement>);
		const style = getImageTilingStyle(el);
		expect(style).toBeDefined();
		expect(style!.backgroundPosition).toBe('10px 20px');
	});

	it('sets width and height to 100%', () => {
		const el = makeImageElement({
			tileScaleX: 1,
		} as Partial<PptxElement>);
		const style = getImageTilingStyle(el);
		expect(style).toBeDefined();
		expect(style!.width).toBe('100%');
		expect(style!.height).toBe('100%');
	});

	it('uses backgroundImage from svgData or imageData', () => {
		const el = makeImageElement({
			tileScaleX: 1,
			imageData: 'data:image/png;base64,abc',
		} as Partial<PptxElement>);
		const style = getImageTilingStyle(el);
		expect(style).toBeDefined();
		expect(style!.backgroundImage).toContain('url(');
	});
});

// ---------------------------------------------------------------------------
// Mirror tile-flip (a:tile/@flip)
// ---------------------------------------------------------------------------

const FLIP_DATA_URI = 'data:image/png;base64,iVBORw0KGgo=';

/** Decode the inner SVG markup from a composite url("data:image/svg+xml,..."). */
function decodeFlipSvg(backgroundImage: string): string {
	const match = /data:image\/svg\+xml,([^"]+)/u.exec(backgroundImage);
	return match ? decodeURIComponent(match[1]) : '';
}

describe('buildMirrorTiledBackground', () => {
	it('doubles the horizontal size and mirrors on the x axis', () => {
		const result = buildMirrorTiledBackground(FLIP_DATA_URI, 'x', 100, 100);
		expect(result).toBeDefined();
		expect(result!.backgroundSize).toBe('200% 100%');
		const svg = decodeFlipSvg(result!.backgroundImage);
		expect(svg).toContain('viewBox="0 0 2 1"');
		expect(svg).toContain('scale(-1,1)');
		expect(svg).not.toContain('scale(1,-1)');
	});

	it('doubles the vertical size and mirrors on the y axis', () => {
		const result = buildMirrorTiledBackground(FLIP_DATA_URI, 'y', 80, 120);
		expect(result!.backgroundSize).toBe('80% 240%');
		const svg = decodeFlipSvg(result!.backgroundImage);
		expect(svg).toContain('viewBox="0 0 1 2"');
		expect(svg).toContain('scale(1,-1)');
	});

	it('mirrors both axes across four cells for xy', () => {
		const result = buildMirrorTiledBackground(FLIP_DATA_URI, 'xy', 100, 100);
		expect(result!.backgroundSize).toBe('200% 200%');
		const svg = decodeFlipSvg(result!.backgroundImage);
		expect(svg).toContain('viewBox="0 0 2 2"');
		expect(svg.match(/<image/gu)?.length).toBe(4);
		expect(svg).toContain('scale(-1,-1)');
	});

	it('refuses non-embeddable (blob/http) sources', () => {
		expect(buildMirrorTiledBackground('blob:abc-123', 'x', 100, 100)).toBeUndefined();
		expect(buildMirrorTiledBackground('https://x/y.png', 'xy', 100, 100)).toBeUndefined();
	});
});

describe('getImageTilingStyle flip integration', () => {
	it('applies the mirrored composite when tileFlip is set', () => {
		const el = makeImageElement({
			tileScaleX: 1,
			tileScaleY: 1,
			imageData: FLIP_DATA_URI,
			tileFlip: 'xy',
		} as Partial<PptxElement>);
		const style = getImageTilingStyle(el);
		expect(style!.backgroundSize).toBe('200% 200%');
		expect(String(style!.backgroundImage)).toContain('data:image/svg+xml');
		expect(style!.backgroundRepeat).toBe('repeat');
	});

	it('keeps plain repetition when tileFlip is "none"', () => {
		const el = makeImageElement({
			tileScaleX: 1,
			tileScaleY: 1,
			imageData: FLIP_DATA_URI,
			tileFlip: 'none',
		} as Partial<PptxElement>);
		const style = getImageTilingStyle(el);
		expect(style!.backgroundSize).toBe('100% 100%');
		expect(style!.backgroundImage).toBe(`url(${FLIP_DATA_URI})`);
	});
});

// ---------------------------------------------------------------------------
// getImageRenderStyle
// ---------------------------------------------------------------------------

describe('getImageRenderStyle', () => {
	it('returns basic cover style for non-image elements', () => {
		const style = getImageRenderStyle(makeShapeElement());
		expect(style.width).toBe('100%');
		expect(style.height).toBe('100%');
		expect(style.objectFit).toBe('cover');
	});

	it('returns basic cover style for image without crop', () => {
		const style = getImageRenderStyle(makeImageElement());
		expect(style.width).toBe('100%');
		expect(style.height).toBe('100%');
		expect(style.objectFit).toBe('cover');
	});

	it('applies crop transform when crop values are set', () => {
		const el = makeImageElement({
			cropLeft: 0.1,
			cropTop: 0.1,
			cropRight: 0.1,
			cropBottom: 0.1,
		} as Partial<PptxElement>);
		const style = getImageRenderStyle(el);
		expect(style.transform).toBeDefined();
		expect(style.objectFit).toBe('fill');
		expect(style.position).toBe('absolute');
	});

	it('does not apply crop for negligible values', () => {
		const el = makeImageElement({
			cropLeft: 0.00001,
			cropTop: 0,
			cropRight: 0,
			cropBottom: 0,
		} as Partial<PptxElement>);
		const style = getImageRenderStyle(el);
		expect(style.objectFit).toBe('cover');
	});

	it('handles extreme crop values safely', () => {
		const el = makeImageElement({
			cropLeft: 0.5,
			cropTop: 0.5,
			cropRight: 0.49,
			cropBottom: 0.49,
		} as Partial<PptxElement>);
		const style = getImageRenderStyle(el);
		// Should not produce NaN or Infinity
		expect(style.transform).toBeDefined();
		expect(style.transform).not.toContain('NaN');
		expect(style.transform).not.toContain('Infinity');
	});

	it('sets transformOrigin to top left when cropped', () => {
		const el = makeImageElement({
			cropLeft: 0.2,
			cropTop: 0,
			cropRight: 0,
			cropBottom: 0,
		} as Partial<PptxElement>);
		const style = getImageRenderStyle(el);
		expect(style.transformOrigin).toBe('top left');
	});
});
