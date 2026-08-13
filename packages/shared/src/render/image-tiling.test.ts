import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildMirrorTiledBackground, getImageTilingStyle, isImageTiled } from './image-tiling';

/** `a:blipFill/a:tile`: scale, offset, alignment anchor and mirror flip. */
const DATA_URI = 'data:image/png;base64,iVBORw0KGgo=';

function picture(overrides: Record<string, unknown> = {}): PptxElement {
	return {
		id: 'pic1',
		type: 'picture',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		imageData: DATA_URI,
		...overrides,
	} as unknown as PptxElement;
}

/** Decode the inner SVG markup from a composite url("data:image/svg+xml,..."). */
function decodeFlipSvg(backgroundImage: string): string {
	const match = /data:image\/svg\+xml,([^"]+)/u.exec(backgroundImage);
	return match ? decodeURIComponent(match[1]) : '';
}

describe('isImageTiled', () => {
	it('is false for a shape and for an untiled picture', () => {
		expect(isImageTiled({ id: 's', type: 'shape' } as unknown as PptxElement)).toBeFalsy();
		expect(isImageTiled(picture())).toBeFalsy();
	});

	it('is true for any surviving `a:tile` attribute, not just a scale', () => {
		expect(isImageTiled(picture({ tileScaleX: 0.5 }))).toBeTruthy();
		expect(isImageTiled(picture({ tileScaleY: 0.5 }))).toBeTruthy();
		// React gated on `@sx`/`@sy` alone, so `<a:tile flip="xy"/>` and
		// `<a:tile algn="tl"/>` - both legal, both scale-less - stretched instead.
		expect(isImageTiled(picture({ tileFlip: 'xy' }))).toBeTruthy();
		expect(isImageTiled(picture({ tileAlignment: 'ctr' }))).toBeTruthy();
		expect(isImageTiled(picture({ tileOffsetX: 12 }))).toBeTruthy();
		expect(isImageTiled(picture({ tileFlip: 'none' }))).toBeFalsy();
	});
});

describe('getImageTilingStyle', () => {
	it('returns nothing for an untiled element', () => {
		expect(getImageTilingStyle(picture())).toBeUndefined();
		expect(
			getImageTilingStyle({ id: 's', type: 'shape' } as unknown as PptxElement),
		).toBeUndefined();
	});

	it('scales each tile by `@sx`/`@sy`, defaulting either to 100%', () => {
		expect(
			getImageTilingStyle(picture({ tileScaleX: 0.5, tileScaleY: 0.25 }))?.backgroundSize,
		).toBe('50% 25%');
		expect(getImageTilingStyle(picture({ tileScaleY: 0.5 }))?.backgroundSize).toBe('100% 50%');
	});

	it('repeats from the top-left by default', () => {
		const style = getImageTilingStyle(picture({ tileScaleX: 1 }));
		expect(style?.backgroundRepeat).toBe('repeat');
		expect(style?.backgroundPosition).toBe('0% 0%');
		expect(style?.backgroundImage).toBe(`url(${DATA_URI})`);
	});

	it('anchors the tile grid at `@algn`', () => {
		expect(getImageTilingStyle(picture({ tileAlignment: 'ctr' }))?.backgroundPosition).toBe(
			'50% 50%',
		);
		expect(getImageTilingStyle(picture({ tileAlignment: 'br' }))?.backgroundPosition).toBe(
			'100% 100%',
		);
	});

	// `@algn` anchors and `@tx`/`@ty` shift FROM that anchor: they compose.
	// React let a non-zero offset replace the anchor outright.
	it('composes the `@tx`/`@ty` offset with the alignment anchor', () => {
		expect(
			getImageTilingStyle(picture({ tileOffsetX: 10, tileOffsetY: 20 }))?.backgroundPosition,
		).toBe('10px 20px');
		expect(
			getImageTilingStyle(picture({ tileAlignment: 'ctr', tileOffsetX: 10, tileOffsetY: -4 }))
				?.backgroundPosition,
		).toBe('calc(50% + 10px) calc(50% + -4px)');
	});

	it('bakes `@flip` into a mirrored composite tile', () => {
		const style = getImageTilingStyle(picture({ tileScaleX: 1, tileScaleY: 1, tileFlip: 'xy' }));
		expect(style?.backgroundSize).toBe('200% 200%');
		expect(String(style?.backgroundImage)).toContain('data:image/svg+xml');
	});
});

describe('buildMirrorTiledBackground', () => {
	it('doubles the axis it mirrors', () => {
		const x = buildMirrorTiledBackground(DATA_URI, 'x', 100, 100);
		expect(x?.backgroundSize).toBe('200% 100%');
		expect(decodeFlipSvg(x!.backgroundImage)).toContain('viewBox="0 0 2 1"');

		const y = buildMirrorTiledBackground(DATA_URI, 'y', 80, 120);
		expect(y?.backgroundSize).toBe('80% 240%');
		expect(decodeFlipSvg(y!.backgroundImage)).toContain('scale(1,-1)');

		const xy = buildMirrorTiledBackground(DATA_URI, 'xy', 100, 100);
		expect(decodeFlipSvg(xy!.backgroundImage).match(/<image/gu)?.length).toBe(4);
	});

	it('refuses a non-embeddable source (an SVG data: URI cannot fetch it)', () => {
		expect(buildMirrorTiledBackground('blob:abc-123', 'x', 100, 100)).toBeUndefined();
		expect(buildMirrorTiledBackground('https://x/y.png', 'xy', 100, 100)).toBeUndefined();
	});
});
