import { describe, expect, it } from 'vitest';

import { bounceEndProgress, bounceSettleOffset, bounceSettleStart } from './animation-bounce-end';

/**
 * Samples read off PowerPoint's own CreateVideo frames of a COM-authored Fly
 * In with `Timing.BounceEnd` on (see `animation-bounce-end`'s module doc):
 * `[s, displacement]`, `s` the settle-phase progress, displacement in units
 * of the travel distance (positive = past the end value).
 */
const MEASURED: Record<string, ReadonlyArray<readonly [number, number]>> = {
	'0.5': [
		[0.088, 0.0426],
		[0.2, 0.0157],
		[0.344, -0.0118],
		[0.6, 0.0029],
	],
	'0.75': [
		[0.078, 0.1039],
		[0.189, 0.0068],
		[0.275, -0.0323],
		[0.475, 0.0098],
	],
	'0.2': [
		[0.159, 0.0147],
		[0.559, -0.0029],
	],
};

describe('animation-bounce-end (fitted to PowerPoint frames)', () => {
	it('spends the bounceEnd share at the END: travel is a linear ramp over the rest', () => {
		expect(bounceSettleStart(0.25)).toBeCloseTo(0.75);
		expect(bounceEndProgress(0.25, 0.375)).toBeCloseTo(0.5);
		expect(bounceEndProgress(0.5, 0.5)).toBeCloseTo(1);
	});

	it('matches the measured settle oscillation within 0.005 of the travel', () => {
		for (const [k, samples] of Object.entries(MEASURED)) {
			for (const [s, measured] of samples) {
				const error = Math.abs(bounceSettleOffset(Number(k), s) - measured);
				expect({ k, s, withinTolerance: error < 0.005 }).toStrictEqual({
					k,
					s,
					withinTolerance: true,
				});
			}
		}
	});

	it('overshoots in the direction of travel first and lands exactly on the end value', () => {
		expect(bounceSettleOffset(0.5, 0.09)).toBeGreaterThan(0.03);
		expect(bounceEndProgress(0.5, 1)).toBe(1);
		expect(bounceSettleOffset(0, 0.5)).toBe(0);
	});
});
