import { describe, expect, it } from 'vitest';

import {
	hasThreeViewOverflow,
	MAX_THREE_VIEW_OVERFLOW,
	NO_THREE_VIEW_OVERFLOW,
	overflowCanvasCss,
	overflowPixelSize,
	overflowViewOffset,
	threeViewOverflowFromNdc,
} from './view-overflow';

const SIZE = { width: 400, height: 200, pixelWidth: 800, pixelHeight: 400 };

describe('threeViewOverflowFromNdc', () => {
	it('is zero for points inside the element box', () => {
		expect(
			threeViewOverflowFromNdc([
				{ x: -1, y: -1 },
				{ x: 0.9, y: 1 },
			]),
		).toStrictEqual(NO_THREE_VIEW_OVERFLOW);
	});

	it('measures each side as a fraction of the box, with a small margin', () => {
		// y = 1.4 reaches 0.2 of the box height past the top; x = -1.2 0.1 past the left.
		const o = threeViewOverflowFromNdc([
			{ x: -1.2, y: 1.4 },
			{ x: 0.5, y: -0.5 },
		]);
		expect(o.top).toBeCloseTo(0.21, 6);
		expect(o.left).toBeCloseTo(0.11, 6);
		expect(o.right).toBe(0);
		expect(o.bottom).toBe(0);
	});

	it('caps a runaway reach and ignores non-finite points', () => {
		const o = threeViewOverflowFromNdc([
			{ x: 0, y: -40 },
			{ x: Number.NaN, y: 99 },
		]);
		expect(o.bottom).toBe(MAX_THREE_VIEW_OVERFLOW);
		expect(o.top).toBe(0);
	});
});

describe('overflow framing', () => {
	const overflow = { top: 0.25, right: 0, bottom: 0.5, left: 0.1 };

	it('grows the drawing buffer by the overflow', () => {
		expect(overflowPixelSize(SIZE, overflow)).toStrictEqual({ width: 880, height: 700 });
		expect(overflowPixelSize(SIZE, NO_THREE_VIEW_OVERFLOW)).toStrictEqual({
			width: 800,
			height: 400,
		});
	});

	it('keeps the element box as the camera full frame', () => {
		const offset = overflowViewOffset(SIZE, overflow);
		const rounded = Object.fromEntries(
			Object.entries(offset).map(([key, value]) => [key, Math.round(value)]),
		);
		expect(rounded).toStrictEqual({
			fullWidth: 800,
			fullHeight: 400,
			x: -80,
			y: -100,
			width: 880,
			height: 700,
		});
	});

	it('places the canvas by percentages of the element box', () => {
		expect(overflowCanvasCss(overflow)).toBe('left:-10%;top:-25%;width:110%;height:175%');
		expect(overflowCanvasCss(NO_THREE_VIEW_OVERFLOW)).toBe('');
		expect(hasThreeViewOverflow(overflow)).toBeTruthy();
		expect(hasThreeViewOverflow(NO_THREE_VIEW_OVERFLOW)).toBeFalsy();
	});
});
