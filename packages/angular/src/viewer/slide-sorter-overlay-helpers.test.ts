import { describe, expect, it } from 'vitest';

import { gridColumns, thumbnailHeight, thumbnailZoom } from './slide-sorter-overlay-helpers';

// ---------------------------------------------------------------------------
// thumbnailZoom
// ---------------------------------------------------------------------------

describe('thumbnailZoom', () => {
	it('returns thumbW / canvasW for normal positive inputs', () => {
		expect(thumbnailZoom(960, 240)).toBeCloseTo(0.25);
		expect(thumbnailZoom(1280, 160)).toBeCloseTo(0.125);
	});

	it('returns 1 when thumbW equals canvasW', () => {
		expect(thumbnailZoom(800, 800)).toBe(1);
	});

	it('returns 0 when canvasW is zero', () => {
		expect(thumbnailZoom(0, 240)).toBe(0);
	});

	it('returns 0 when thumbW is zero', () => {
		expect(thumbnailZoom(960, 0)).toBe(0);
	});

	it('returns 0 when canvasW is negative', () => {
		expect(thumbnailZoom(-100, 240)).toBe(0);
	});

	it('returns 0 when thumbW is negative', () => {
		expect(thumbnailZoom(960, -10)).toBe(0);
	});

	it('returns 0 when canvasW is NaN', () => {
		expect(thumbnailZoom(NaN, 240)).toBe(0);
	});

	it('returns 0 when thumbW is Infinity', () => {
		// Infinity is not a finite number
		expect(thumbnailZoom(960, Infinity)).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// thumbnailHeight
// ---------------------------------------------------------------------------

describe('thumbnailHeight', () => {
	it('preserves aspect ratio of the canvas', () => {
		// canvasW=1280, canvasH=720, thumbW=320 → zoom=0.25, height=180
		expect(thumbnailHeight(1280, 720, 320)).toBeCloseTo(180);
	});

	it('returns 0 when canvasW is zero', () => {
		expect(thumbnailHeight(0, 720, 320)).toBe(0);
	});

	it('returns 0 when canvasH is zero', () => {
		expect(thumbnailHeight(1280, 0, 320)).toBe(0);
	});

	it('returns 0 when thumbW is zero', () => {
		expect(thumbnailHeight(1280, 720, 0)).toBe(0);
	});

	it('returns 0 when canvasW is negative', () => {
		expect(thumbnailHeight(-1, 720, 320)).toBe(0);
	});

	it('returns 0 when canvasH is negative', () => {
		expect(thumbnailHeight(1280, -1, 320)).toBe(0);
	});

	it('returns 0 when any dimension is NaN', () => {
		expect(thumbnailHeight(NaN, 720, 320)).toBe(0);
		expect(thumbnailHeight(1280, NaN, 320)).toBe(0);
		expect(thumbnailHeight(1280, 720, NaN)).toBe(0);
	});

	it('returns canvasH when thumbW equals canvasW (zoom = 1)', () => {
		expect(thumbnailHeight(800, 450, 800)).toBeCloseTo(450);
	});
});

// ---------------------------------------------------------------------------
// gridColumns
// ---------------------------------------------------------------------------

describe('gridColumns', () => {
	it('fills available width with columns', () => {
		// containerW=1000, thumbW=200, gap=16, maxCols=10
		// cols = floor((1000+16)/(200+16)) = floor(4.7...) = 4
		expect(gridColumns(1000, 200, 16, 10)).toBe(4);
	});

	it('clamps to 1 when containerW is zero', () => {
		expect(gridColumns(0, 200, 16, 10)).toBe(1);
	});

	it('clamps to 1 when thumbW is zero', () => {
		expect(gridColumns(1000, 0, 16, 10)).toBe(1);
	});

	it('clamps to maxCols when the container is very wide', () => {
		expect(gridColumns(10000, 200, 16, 5)).toBe(5);
	});

	it('returns 1 when container fits exactly one thumbnail', () => {
		expect(gridColumns(220, 220, 16, 10)).toBe(1);
	});
});
