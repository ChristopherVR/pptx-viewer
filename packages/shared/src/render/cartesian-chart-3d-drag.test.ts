import { describe, expect, it } from 'vitest';

import { calibrateCartesianChart3DDrag } from './cartesian-chart-3d-drag';

describe('calibrateCartesianChart3DDrag', () => {
	it('calibrates from the marker world position and its floor projection', () => {
		const result = calibrateCartesianChart3DDrag([1.5, 0.8, -2], 10);
		expect(result).toStrictEqual({
			worldAtValue0: [1.5, 0, -2],
			value0: 0,
			worldAtValue1: [1.5, 0.8, -2],
			value1: 10,
		});
	});

	it('returns null for a (near) zero value', () => {
		expect(calibrateCartesianChart3DDrag([1, 0, 1], 0)).toBeNull();
	});
});
