import { describe, expect, it } from 'vitest';

import type { CartesianChart3DPoint } from './bar-chart-3d-layout';
import { layoutBarChart3D } from './bar-chart-3d-layout';
import type { ValueRange } from './chart-view-model';

function point(overrides: Partial<CartesianChart3DPoint> = {}): CartesianChart3DPoint {
	return {
		seriesIndex: 0,
		categoryIndex: 0,
		value: 10,
		plotValue: 10,
		color: '#4472C4',
		...overrides,
	};
}

describe('layoutBarChart3D - shape threading', () => {
	const range: ValueRange = { min: 0, max: 100, span: 100 };

	it('carries an absent shape through as undefined (clustered)', () => {
		const [box] = layoutBarChart3D([point()], 1, 1, range, 'clustered', undefined);
		expect(box.shape).toBeUndefined();
		expect(box.coneToMaxTopRadiusFactor).toBeUndefined();
	});

	it('carries a plain shape through unchanged, with no cone-to-max factor (clustered)', () => {
		const [box] = layoutBarChart3D(
			[point({ shape: 'cylinder' })],
			1,
			1,
			range,
			'clustered',
			undefined,
		);
		expect(box.shape).toBe('cylinder');
		expect(box.coneToMaxTopRadiusFactor).toBeUndefined();
	});

	it('carries shape through for stacked layout too', () => {
		const [box] = layoutBarChart3D(
			[point({ shape: 'pyramid' })],
			1,
			1,
			range,
			'stacked',
			undefined,
		);
		expect(box.shape).toBe('pyramid');
	});

	it('computes a coneToMax top-radius factor of 0 at the axis maximum', () => {
		const [box] = layoutBarChart3D(
			[point({ shape: 'coneToMax', value: 100 })],
			1,
			1,
			range,
			'clustered',
			undefined,
		);
		expect(box.coneToMaxTopRadiusFactor).toBe(0);
	});

	it('computes a coneToMax top-radius factor of 1 at zero value', () => {
		const [box] = layoutBarChart3D(
			[point({ shape: 'coneToMax', value: 0, plotValue: 0 })],
			1,
			1,
			range,
			'clustered',
			undefined,
		);
		expect(box.coneToMaxTopRadiusFactor).toBe(1);
	});

	it('computes a fractional coneToMax factor between zero and the max', () => {
		const [box] = layoutBarChart3D(
			[point({ shape: 'pyramidToMax', value: 25 })],
			1,
			1,
			range,
			'clustered',
			undefined,
		);
		expect(box.coneToMaxTopRadiusFactor).toBeCloseTo(0.75);
	});

	it('clamps the coneToMax factor to 0 when the value exceeds the axis max', () => {
		const [box] = layoutBarChart3D(
			[point({ shape: 'coneToMax', value: 150 })],
			1,
			1,
			range,
			'clustered',
			undefined,
		);
		expect(box.coneToMaxTopRadiusFactor).toBe(0);
	});

	it('defaults the coneToMax factor to 0 when the axis max is not positive', () => {
		const zeroRange: ValueRange = { min: 0, max: 0, span: 0 };
		const [box] = layoutBarChart3D(
			[point({ shape: 'coneToMax', value: 0, plotValue: 0 })],
			1,
			1,
			zeroRange,
			'clustered',
			undefined,
		);
		expect(box.coneToMaxTopRadiusFactor).toBe(0);
	});
});
