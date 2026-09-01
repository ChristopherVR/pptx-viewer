import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	isSeriesUsingSecondaryAxis,
	resolveSecondaryAxisId,
	seriesSecondaryAxisPatch,
} from './chart-secondary-axis';

function chart(overrides: Partial<PptxChartData> = {}): PptxChartData {
	return {
		chartType: 'bar',
		categories: ['A', 'B'],
		series: [
			{ name: 'S1', values: [1, 2], axisId: 100 },
			{ name: 'S2', values: [3, 4], axisId: 200 },
		],
		axes: [
			{ axisType: 'valAx', axPos: 'l', axisId: 100 },
			{ axisType: 'valAx', axPos: 'r', axisId: 200 },
		],
		...overrides,
	} as PptxChartData;
}

describe('isSeriesUsingSecondaryAxis', () => {
	it('is false for a series on the left (primary) axis', () => {
		expect(isSeriesUsingSecondaryAxis(chart(), 0)).toBeFalsy();
	});

	it('is true for a series on the right (secondary) axis', () => {
		expect(isSeriesUsingSecondaryAxis(chart(), 1)).toBeTruthy();
	});

	it('is false when the series has no axisId', () => {
		const data = chart({ series: [{ name: 'S1', values: [1] }] });
		expect(isSeriesUsingSecondaryAxis(data, 0)).toBeFalsy();
	});

	it('is false when the axisId does not resolve to a known axis', () => {
		const data = chart({ series: [{ name: 'S1', values: [1], axisId: 999 }] });
		expect(isSeriesUsingSecondaryAxis(data, 0)).toBeFalsy();
	});

	it('is false for an out-of-range series index', () => {
		expect(isSeriesUsingSecondaryAxis(chart(), 5)).toBeFalsy();
	});
});

describe('resolveSecondaryAxisId', () => {
	it('resolves the right-positioned axis id when useSecondary is true', () => {
		expect(resolveSecondaryAxisId(chart(), true)).toBe(200);
	});

	it('resolves the left-positioned axis id when useSecondary is false', () => {
		expect(resolveSecondaryAxisId(chart(), false)).toBe(100);
	});

	it('is undefined when the chart has no axis at that position', () => {
		expect(resolveSecondaryAxisId(chart({ axes: [] }), true)).toBeUndefined();
	});
});

describe('seriesSecondaryAxisPatch', () => {
	it('moves the target series onto the secondary axis, leaving others untouched', () => {
		const data = chart();
		const patch = seriesSecondaryAxisPatch(data, 0, true);
		expect(patch.series).toStrictEqual([
			{ name: 'S1', values: [1, 2], axisId: 200 },
			{ name: 'S2', values: [3, 4], axisId: 200 },
		]);
	});

	it('moves the target series back onto the primary axis', () => {
		const data = chart();
		const patch = seriesSecondaryAxisPatch(data, 1, false);
		expect(patch.series?.[1]).toStrictEqual({ name: 'S2', values: [3, 4], axisId: 100 });
	});

	it('is a no-op for an out-of-range series index', () => {
		expect(seriesSecondaryAxisPatch(chart(), 5, true)).toStrictEqual({});
	});
});
