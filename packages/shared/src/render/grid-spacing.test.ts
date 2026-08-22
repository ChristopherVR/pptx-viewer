import { EMU_PER_PX } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { computeGridSpacingPx } from './grid-spacing';

describe('computeGridSpacingPx', () => {
	it('returns the fallback when gridSpacing is undefined', () => {
		expect(computeGridSpacingPx(undefined, 8)).toBe(8);
	});

	it('converts EMU to pixels and rounds', () => {
		// 9525 * 10 = 95250 EMU => 10 px
		expect(computeGridSpacingPx({ cx: EMU_PER_PX * 10 }, 8)).toBe(10);
	});

	it('returns the fallback when conversion yields zero', () => {
		expect(computeGridSpacingPx({ cx: 0 }, 8)).toBe(8);
	});

	it('returns the fallback when conversion yields negative', () => {
		expect(computeGridSpacingPx({ cx: -1000 }, 8)).toBe(8);
	});

	it('rounds to the nearest integer', () => {
		const result = computeGridSpacingPx({ cx: 71438 }, 8);
		expect(result).toBe(Math.round(71438 / EMU_PER_PX));
		expect(result).toBeGreaterThan(0);
	});

	it('honours a caller-specific fallback (bindings disagree on the default)', () => {
		expect(computeGridSpacingPx(undefined, 12)).toBe(12);
		expect(computeGridSpacingPx(undefined, 10)).toBe(10);
	});

	it('reflects the fixture value from anatidae-animation.pptx (72008 EMU)', () => {
		// Verified empirically: viewProperties.gridSpacing = { cx: 72008, cy: 72008 }
		// while presentationProperties.gridSpacing was always undefined (the bug).
		expect(computeGridSpacingPx({ cx: 72008, cy: 72008 }, 8)).toBe(Math.round(72008 / EMU_PER_PX));
	});
});
