import { describe, expect, it } from 'vitest';

import { clampFlyoutPosition } from './flyout-position';

const VIEWPORT = { viewportWidth: 1000, viewportHeight: 800 };

describe('clampFlyoutPosition', () => {
	it('leaves a flyout with room to spare exactly where it was anchored', () => {
		expect(
			clampFlyoutPosition({ x: 200, y: 300, width: 180, height: 240, ...VIEWPORT }),
		).toStrictEqual({ left: 200, top: 300 });
	});

	it('flips back inwards at the right and bottom edges', () => {
		// The bug this guards: clamping only the low edge let a menu opened near
		// the bottom render below the fold, where its commands were visible to a
		// locator and unreachable by a user.
		expect(
			clampFlyoutPosition({ x: 960, y: 780, width: 180, height: 240, ...VIEWPORT }),
		).toStrictEqual({ left: 812, top: 552 });
	});

	it('still keeps the low edges clamped', () => {
		expect(
			clampFlyoutPosition({ x: -50, y: 2, width: 180, height: 240, ...VIEWPORT }),
		).toStrictEqual({
			left: 8,
			top: 8,
		});
	});

	it('prefers the top-left when the flyout is taller than the viewport', () => {
		const { top } = clampFlyoutPosition({ x: 10, y: 400, width: 100, height: 2000, ...VIEWPORT });
		expect(top).toBe(8);
	});

	it('clamps on the anchor alone before the flyout has been measured', () => {
		expect(clampFlyoutPosition({ x: 990, y: 790, width: 0, height: 0, ...VIEWPORT })).toStrictEqual(
			{
				left: 990,
				top: 790,
			},
		);
	});

	it('honours a custom margin', () => {
		expect(
			clampFlyoutPosition({ x: 999, y: 1, width: 100, height: 100, margin: 20, ...VIEWPORT }),
		).toStrictEqual({ left: 880, top: 20 });
	});
});
