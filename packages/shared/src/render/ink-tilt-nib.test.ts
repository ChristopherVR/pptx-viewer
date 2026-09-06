import { describe, it, expect } from 'vitest';

import { generateNibMarks, tiltChannelsFromVectors } from './ink-tilt-nib';

describe('generateNibMarks', () => {
	it('should return an empty array when there are no points', () => {
		expect(generateNibMarks([], [3], [0], [0.5], { baseWidth: 4 })).toStrictEqual([]);
	});

	it('should return an empty array when there are no tilt angles', () => {
		const points = [{ x: 0, y: 0 }];
		expect(generateNibMarks(points, [3], [], [], { baseWidth: 4 })).toStrictEqual([]);
	});

	it('should degrade to a circle (rPerp === rTilt) at zero tilt magnitude', () => {
		const points = [{ x: 5, y: 5 }];
		const [mark] = generateNibMarks(points, [4], [0], [0], { baseWidth: 4 });
		expect(mark.cx).toBe(5);
		expect(mark.cy).toBe(5);
		expect(mark.rPerp).toBeCloseTo(mark.rTilt, 10);
	});

	it('should widen the perpendicular axis as tilt magnitude increases', () => {
		const points = [
			{ x: 0, y: 0 },
			{ x: 10, y: 0 },
		];
		const marks = generateNibMarks(points, [4, 4], [0, 0], [0, 1], { baseWidth: 4 });
		expect(marks[0].rPerp).toBeCloseTo(marks[0].rTilt, 10);
		expect(marks[1].rPerp).toBeGreaterThan(marks[1].rTilt);
	});

	it('should orient the wide axis perpendicular to the lean direction', () => {
		const points = [{ x: 0, y: 0 }];
		// Lean straight along +X (angle 0) => the wide axis should point +Y (90 deg).
		const [mark] = generateNibMarks(points, [4], [0], [1], { baseWidth: 4 });
		expect(mark.rotationDeg).toBeCloseTo(90, 5);
	});

	it('should respect a custom elongation factor', () => {
		const points = [{ x: 0, y: 0 }];
		const subtle = generateNibMarks(points, [4], [0], [1], { baseWidth: 4, elongation: 0.1 });
		const strong = generateNibMarks(points, [4], [0], [1], { baseWidth: 4, elongation: 1 });
		expect(strong[0].rPerp).toBeGreaterThan(subtle[0].rPerp);
	});

	it('should respect minRadius and maxRadius on the tilt (narrow) axis', () => {
		const points = [{ x: 0, y: 0 }];
		const clampedLow = generateNibMarks(points, [0.001], [0], [0], {
			baseWidth: 10,
			minRadius: 2,
		});
		expect(clampedLow[0].rTilt).toBeGreaterThanOrEqual(2);
		const clampedHigh = generateNibMarks(points, [100], [0], [0], {
			baseWidth: 4,
			maxRadius: 5,
		});
		expect(clampedHigh[0].rTilt).toBeLessThanOrEqual(5);
	});

	it('should interpolate angle across the shortest arc near a +-pi wraparound', () => {
		// Three points but only two angle samples, so the middle point is a
		// genuine 50% interpolation between them (matching-length arrays
		// resolve to an exact index with no interpolation to exercise).
		const points = [
			{ x: 0, y: 0 },
			{ x: 5, y: 0 },
			{ x: 10, y: 0 },
		];
		const nearPi = Math.PI - 0.1;
		const nearNegPi = -Math.PI + 0.1;
		const marks = generateNibMarks(points, [4], [nearPi, nearNegPi], [1, 1], {
			baseWidth: 4,
		});
		// The short way from (pi - 0.1) to (-pi + 0.1) crosses the +-pi seam and
		// is only 0.2 rad wide, landing the midpoint at +-pi (not near 0, which
		// is what a naive un-wrapped lerp would produce).
		expect(Math.abs(marks[1].rotationDeg - 90)).toBeGreaterThan(150);
	});
});

describe('tiltChannelsFromVectors', () => {
	it('returns undefined for empty input (no tilt captured)', () => {
		expect(tiltChannelsFromVectors([], [])).toBeUndefined();
	});

	it('derives angle from the vector direction and magnitude normalised to this series own peak', () => {
		// Mirrors the InkML OTx/OTy fixture in
		// packages/core/src/core/utils/inkml-content-part.test.ts.
		const result = tiltChannelsFromVectors([10, 0, 0], [0, 20, 0]);
		expect(result).toBeDefined();
		expect(result?.angles[0]).toBeCloseTo(0, 5);
		expect(result?.angles[1]).toBeCloseTo(Math.PI / 2, 5);
		expect(result?.magnitudes[0]).toBeCloseTo(0.5, 5);
		expect(result?.magnitudes[1]).toBeCloseTo(1, 5);
		expect(result?.magnitudes[2]).toBeCloseTo(0, 5);
	});

	it('returns all-zero magnitudes (not undefined) for a constant (0, 0) reading', () => {
		const result = tiltChannelsFromVectors([0, 0], [0, 0]);
		expect(result).toBeDefined();
		expect(result?.magnitudes).toStrictEqual([0, 0]);
	});

	it('drops non-finite pairs rather than zero-filling them', () => {
		const result = tiltChannelsFromVectors([10, Number.NaN], [0, 5]);
		expect(result?.angles).toHaveLength(1);
	});
});
