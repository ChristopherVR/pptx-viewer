import { describe, expect, it } from 'vitest';

import { roundCoordinate, scaleVectorToIntegers } from './scene3d-coordinate';

describe('roundCoordinate', () => {
	it('rounds a fractional position to the nearest integer', () => {
		expect(roundCoordinate(1.6)).toBe(2);
		expect(roundCoordinate(-1.6)).toBe(-2);
	});

	it('passes an already-integer value through unchanged', () => {
		expect(roundCoordinate(100)).toBe(100);
	});
});

describe('scaleVectorToIntegers', () => {
	it('passes an already-integer vector through unchanged', () => {
		expect(scaleVectorToIntegers(0, 0, 1)).toStrictEqual({ x: 0, y: 0, z: 1 });
		expect(scaleVectorToIntegers(700000, 700000, 0)).toStrictEqual({ x: 700000, y: 700000, z: 0 });
	});

	it('scales a fractional (normalised) vector so every component becomes an integer', () => {
		const result = scaleVectorToIntegers(0.7071, 0.7071, 0);
		expect(Number.isInteger(result.x)).toBeTruthy();
		expect(Number.isInteger(result.y)).toBeTruthy();
		expect(Number.isInteger(result.z)).toBeTruthy();
	});

	it('preserves the ratio between fractional components instead of collapsing a small one to 0', () => {
		// Independent per-component rounding of (0.1, 0.9, 0.4) would give
		// (0, 1, 0), destroying the x/z components entirely.
		const result = scaleVectorToIntegers(0.1, 0.9, 0.4);
		expect(result.x).not.toBe(0);
		expect(result.z).not.toBe(0);
		expect(result.y / result.x).toBeCloseTo(0.9 / 0.1, 1);
		expect(result.z / result.x).toBeCloseTo(0.4 / 0.1, 1);
	});

	it('preserves an equal-component ratio exactly', () => {
		const result = scaleVectorToIntegers(0.5, 0.5, 0);
		expect(result.x).toBe(result.y);
		expect(result.z).toBe(0);
	});

	it('treats a mixed integer/fractional vector as fractional (scales all three)', () => {
		const result = scaleVectorToIntegers(0, 0.5, 1);
		expect(Number.isInteger(result.x)).toBeTruthy();
		expect(Number.isInteger(result.y)).toBeTruthy();
		expect(Number.isInteger(result.z)).toBeTruthy();
		expect(result.z / result.y).toBeCloseTo(2, 5);
	});
});
