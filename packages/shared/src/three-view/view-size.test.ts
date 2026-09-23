import { describe, expect, it } from 'vitest';

import { MAX_VIEW_PIXELS } from './renderer-host';
import { computeThreeViewSize, threeViewSizeChanged } from './view-size';

describe('computeThreeViewSize', () => {
	it('draws a thumbnail at its on-screen size, not its layout size', () => {
		// A 600x300 chart shown in a thumbnail scaled to 20%.
		const size = computeThreeViewSize(600, 300, 120, 60, 1);
		expect(size).toStrictEqual({ width: 600, height: 300, pixelWidth: 120, pixelHeight: 60 });
	});

	it('scales the backing store by the device pixel ratio, capped at 2', () => {
		expect(computeThreeViewSize(400, 200, 400, 200, 1.5).pixelWidth).toBe(600);
		expect(computeThreeViewSize(400, 200, 400, 200, 3).pixelWidth).toBe(800);
	});

	it('falls back to the layout size when the element has no on-screen box', () => {
		const size = computeThreeViewSize(300, 150, 0, 0, 1);
		expect(size.pixelWidth).toBe(300);
		expect(size.pixelHeight).toBe(150);
	});

	it('never produces a zero or oversized backing store', () => {
		expect(computeThreeViewSize(0, 0, 0, 0, 1)).toMatchObject({ pixelWidth: 1, pixelHeight: 1 });
		expect(computeThreeViewSize(1000, 1000, 20000, 20000, 2).pixelWidth).toBe(MAX_VIEW_PIXELS);
	});
});

describe('threeViewSizeChanged', () => {
	it('detects a zoom change even when the layout size is unchanged', () => {
		const a = computeThreeViewSize(600, 300, 600, 300, 1);
		const b = computeThreeViewSize(600, 300, 1200, 600, 1);
		expect(threeViewSizeChanged(a, b)).toBeTruthy();
		expect(threeViewSizeChanged(a, { ...a })).toBeFalsy();
	});
});
