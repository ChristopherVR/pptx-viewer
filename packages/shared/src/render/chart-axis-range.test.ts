import type { PptxChartSeries } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	computeValueRangeForAxis,
	computeValueRangeForChart,
	generateAxisTicks,
	generateLogTicks,
	generateMinorAxisTicks,
} from './chart-axis';

const SERIES: PptxChartSeries[] = [{ name: 'Values', values: [20, 40] }];

describe('axis-constrained value ranges', () => {
	it('uses explicit linear minimum and maximum bounds', () => {
		expect(computeValueRangeForAxis(SERIES, { axisType: 'valAx', min: 10, max: 50 })).toStrictEqual(
			{ min: 10, max: 50, span: 40 },
		);
	});

	it('uses explicit bounds with logarithmic span math', () => {
		const range = computeValueRangeForAxis([{ name: 'Log', values: [2, 200] }], {
			axisType: 'valAx',
			min: 1,
			max: 1000,
			logScale: true,
			logBase: 10,
		});
		expect(range).toMatchObject({ min: 1, max: 1000, logScale: true, logBase: 10 });
		expect(range.span).toBeCloseTo(3);
	});

	it('does not apply a secondary log axis to the primary range', () => {
		const range = computeValueRangeForChart(SERIES, [
			{ axisType: 'valAx', axPos: 'l', min: 0, max: 100 },
			{ axisType: 'valAx', axPos: 'r', logScale: true, logBase: 10 },
		]);
		expect(range).toStrictEqual({ min: 0, max: 100, span: 100 });
	});

	it('keeps logarithmic ticks inside explicit non-power bounds', () => {
		expect(
			generateLogTicks({ min: 2, max: 200, span: 2, logScale: true, logBase: 10 }),
		).toStrictEqual([10, 100]);
	});

	it('retains exact power ticks across negative and positive exponents', () => {
		expect(
			generateLogTicks({ min: 0.01, max: 100_000, span: 7, logScale: true, logBase: 10 }),
		).toStrictEqual([0.01, 0.1, 1, 10, 100, 1_000, 10_000, 100_000]);
	});

	it('retains reversed axis direction on the computed range', () => {
		expect(
			computeValueRangeForAxis(SERIES, { axisType: 'valAx', orientation: 'maxMin' }),
		).toMatchObject({ reverseOrder: true });
	});

	it('uses explicit major and minor units without duplicating major ticks', () => {
		const range = { min: 0, max: 100, span: 100 };
		const axis = { axisType: 'valAx' as const, majorUnit: 20, minorUnit: 10 };
		expect(generateAxisTicks(range, axis, 5)).toStrictEqual([0, 20, 40, 60, 80, 100]);
		expect(generateMinorAxisTicks(range, axis)).toStrictEqual([10, 30, 50, 70, 90]);
	});
});
