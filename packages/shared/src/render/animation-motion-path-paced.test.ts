import { describe, expect, it } from 'vitest';

import { pacedFractions, pacedPointAt } from './animation-motion-path-paced';

describe('pacedFractions / pacedPointAt', () => {
	const points = [
		{ x: 0, y: 0 },
		{ x: 30, y: 0 },
		{ x: 30, y: 10 },
	];

	it('measures the path by length, with x scaled by the slide aspect', () => {
		expect(pacedFractions(points, 1)).toStrictEqual([0, 0.75, 1]);
		// A 2:1 slide doubles the horizontal leg: 60 of 70.
		expect(pacedFractions(points, 2)[1]).toBeCloseTo(60 / 70, 9);
	});

	it('travels an even distance per unit of progress', () => {
		const fractions = pacedFractions(points, 1);
		expect(pacedPointAt(points, fractions, 0.375)).toStrictEqual({ x: 15, y: 0 });
		expect(pacedPointAt(points, fractions, 0.875)).toStrictEqual({ x: 30, y: 5 });
		expect(pacedPointAt(points, fractions, 1)).toStrictEqual({ x: 30, y: 10 });
	});

	it('falls back to even point spacing for a zero-length path', () => {
		expect(
			pacedFractions(
				[
					{ x: 1, y: 1 },
					{ x: 1, y: 1 },
				],
				1,
			),
		).toStrictEqual([0, 1]);
	});
});
