import { describe, expect, it } from 'vitest';

import { calibrateBarChart3DDrag } from './bar-chart-3d-drag';
import type { BarChart3DBox } from './bar-chart-3d-layout';

function box(overrides: Partial<BarChart3DBox> = {}): BarChart3DBox {
	return {
		seriesIndex: 0,
		categoryIndex: 0,
		value: 10,
		color: '#4472C4',
		center: [0, 0.5, 0],
		size: [0.4, 1, 0.4],
		...overrides,
	};
}

describe('calibrateBarChart3DDrag', () => {
	it('calibrates a vertical positive-value box from its center/size', () => {
		const result = calibrateBarChart3DDrag(
			[box()],
			{ seriesIndex: 0, categoryIndex: 0, value: 10 },
			'clustered',
			false,
		);
		expect(result).toStrictEqual({
			worldAtValue0: [0, 0, 0],
			value0: 0,
			worldAtValue1: [0, 1, 0],
			value1: 10,
		});
	});

	it('calibrates a negative-value box (base sits ABOVE the bar)', () => {
		// value -10: bottom = -1, height 1 -> center.y = -1 + 0.5 = -0.5.
		const result = calibrateBarChart3DDrag(
			[box({ value: -10, center: [0, -0.5, 0], size: [0.4, 1, 0.4] })],
			{ seriesIndex: 0, categoryIndex: 0, value: -10 },
			'clustered',
			false,
		);
		expect(result!.worldAtValue0).toStrictEqual([0, 0, 0]);
		expect(result!.worldAtValue1).toStrictEqual([0, -1, 0]);
		expect(result!.value1).toBe(-10);
	});

	it('uses the X axis for a horizontal (barDir=bar) chart', () => {
		const result = calibrateBarChart3DDrag(
			[box({ center: [0.5, 0, 0], size: [1, 0.4, 0.4] })],
			{ seriesIndex: 0, categoryIndex: 0, value: 10 },
			'clustered',
			true,
		);
		expect(result!.worldAtValue0).toStrictEqual([0, 0, 0]);
		expect(result!.worldAtValue1).toStrictEqual([1, 0, 0]);
	});

	it('returns null for stacked/percentStacked grouping', () => {
		expect(
			calibrateBarChart3DDrag(
				[box()],
				{ seriesIndex: 0, categoryIndex: 0, value: 10 },
				'stacked',
				false,
			),
		).toBeNull();
		expect(
			calibrateBarChart3DDrag(
				[box()],
				{ seriesIndex: 0, categoryIndex: 0, value: 10 },
				'percentStacked',
				false,
			),
		).toBeNull();
	});

	it('returns null when no matching box is found', () => {
		expect(
			calibrateBarChart3DDrag(
				[box()],
				{ seriesIndex: 5, categoryIndex: 5, value: 10 },
				'clustered',
				false,
			),
		).toBeNull();
	});

	it('returns null for a (near) zero-extent box on the value axis', () => {
		expect(
			calibrateBarChart3DDrag(
				[box({ value: 0, center: [0, 0, 0], size: [0.4, 0, 0.4] })],
				{ seriesIndex: 0, categoryIndex: 0, value: 0 },
				'clustered',
				false,
			),
		).toBeNull();
	});
});
