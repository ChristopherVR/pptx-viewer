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

describe('layoutBarChart3D - horizontal (barDir=bar) remap', () => {
	const range: ValueRange = { min: 0, max: 100, span: 100 };
	const points: CartesianChart3DPoint[] = [
		point({ categoryIndex: 0, seriesIndex: 0, value: 10, plotValue: 10 }),
		point({ categoryIndex: 1, seriesIndex: 0, value: 40, plotValue: 40 }),
		point({ categoryIndex: 0, seriesIndex: 1, value: 25, plotValue: 25 }),
	];

	it('leaves centers/sizes untouched when horizontal is omitted or false', () => {
		const defaulted = layoutBarChart3D(points, 2, 2, range, 'clustered', undefined);
		const explicit = layoutBarChart3D(points, 2, 2, range, 'clustered', undefined, false);
		expect(explicit).toStrictEqual(defaulted);
	});

	it('transposes centers (x, y, z) -> (y, -x, z) and leaves size unchanged (clustered)', () => {
		const vertical = layoutBarChart3D(points, 2, 2, range, 'clustered', undefined);
		const horizontal = layoutBarChart3D(points, 2, 2, range, 'clustered', undefined, true);
		for (let i = 0; i < vertical.length; i++) {
			const v = vertical[i];
			const h = horizontal[i];
			expect(h.center).toStrictEqual([v.center[1], -v.center[0], v.center[2]]);
			expect(h.size).toStrictEqual(v.size);
		}
	});

	it('transposes centers for stacked layout the same way', () => {
		const vertical = layoutBarChart3D(points, 2, 2, range, 'stacked', undefined);
		const horizontal = layoutBarChart3D(points, 2, 2, range, 'stacked', undefined, true);
		for (let i = 0; i < vertical.length; i++) {
			const v = vertical[i];
			const h = horizontal[i];
			expect(h.center).toStrictEqual([v.center[1], -v.center[0], v.center[2]]);
			expect(h.size).toStrictEqual(v.size);
		}
	});
});
