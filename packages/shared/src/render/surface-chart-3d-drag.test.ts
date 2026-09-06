import { describe, expect, it } from 'vitest';

import { calibrateSurfaceChart3DDrag } from './surface-chart-3d-drag';
import { MAX_HEIGHT } from './surface-chart-3d-geom';

describe('calibrateSurfaceChart3DDrag', () => {
	const values = new Float32Array([10, 20, 30, 40]);

	it('returns null when every cell shares the same value (no vertical axis)', () => {
		const flat = new Float32Array([5, 5, 5, 5]);
		expect(calibrateSurfaceChart3DDrag([0, 0, 0], 5, flat)).toBeNull();
	});

	it('calibrates against the grid minimum (world Y 0) for a mid-range vertex', () => {
		// value 30 is neither the grid min (10) nor max (40): the minimum is
		// used as the reference, at world Y 0 by construction.
		const position: readonly [number, number, number] = [1, 1.0, 2];
		const result = calibrateSurfaceChart3DDrag(position, 30, values);
		expect(result).toStrictEqual({
			worldAtValue0: [1, 0, 2],
			value0: 10,
			worldAtValue1: [1, 1.0, 2],
			value1: 30,
		});
	});

	it('calibrates against the grid MAXIMUM instead when the vertex IS the minimum', () => {
		// Reusing the minimum as its own reference would collapse both
		// calibration points onto world Y 0 - the whole reason this differs
		// from `calibrateCartesianChart3DDrag`'s zero-relative assumption.
		const position: readonly [number, number, number] = [1, 0, 2];
		const result = calibrateSurfaceChart3DDrag(position, 10, values);
		expect(result).toStrictEqual({
			worldAtValue0: [1, MAX_HEIGHT, 2],
			value0: 40,
			worldAtValue1: [1, 0, 2],
			value1: 10,
		});
	});

	it('keeps x/z fixed between the two calibration points (same vertical column)', () => {
		const position: readonly [number, number, number] = [3.5, 0.6, -2.25];
		const result = calibrateSurfaceChart3DDrag(position, 20, values)!;
		expect(result.worldAtValue0[0]).toBe(position[0]);
		expect(result.worldAtValue0[2]).toBe(position[2]);
	});
});
