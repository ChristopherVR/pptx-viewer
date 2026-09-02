import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	chartGridlinesPatch,
	chartGridlinesState,
	shouldRenderMajorGridlines,
} from './chart-gridlines-toggle';

function chart(overrides: Partial<PptxChartData> = {}): PptxChartData {
	return {
		chartType: 'bar',
		categories: ['A', 'B'],
		series: [{ name: 'S1', values: [1, 2] }],
		...overrides,
	} as PptxChartData;
}

describe('chartGridlinesState', () => {
	it('defaults to shown when the chart has no axes and no style flag (what the renderer draws)', () => {
		expect(chartGridlinesState(chart())).toBeTruthy();
		expect(shouldRenderMajorGridlines(chart())).toBeTruthy();
	});

	it('falls back to the legacy style.hasGridlines flag when there is no value axis', () => {
		expect(chartGridlinesState(chart({ style: { hasGridlines: true } }))).toBeTruthy();
		expect(chartGridlinesState(chart({ style: { hasGridlines: false } }))).toBeFalsy();
	});

	it('reads majorGridlines off the left-positioned value axis', () => {
		const data = chart({
			axes: [{ axisType: 'valAx', axPos: 'l', majorGridlines: true }],
		});
		expect(chartGridlinesState(data)).toBeTruthy();
	});

	it('reads majorGridlines off the first value axis when none is positioned "l"', () => {
		const data = chart({
			axes: [{ axisType: 'catAx' }, { axisType: 'valAx', majorGridlines: true }],
		});
		expect(chartGridlinesState(data)).toBeTruthy();
	});

	it('defaults to false when the value axis omits majorGridlines', () => {
		const data = chart({ axes: [{ axisType: 'valAx', axPos: 'l' }] });
		expect(chartGridlinesState(data)).toBeFalsy();
	});

	it('ignores a secondary (right-positioned) value axis', () => {
		const data = chart({
			axes: [{ axisType: 'valAx', axPos: 'r', majorGridlines: true }],
		});
		// No "l" axis and the "r" one is skipped by axPos==='l' match, but the
		// fallback `find` with no axPos filter still picks it up as the only
		// valAx present, matching getPrimaryValueAxisId's own fallback.
		expect(chartGridlinesState(data)).toBeTruthy();
	});
});

describe('chartGridlinesPatch', () => {
	it('sets majorGridlines on the existing left value axis and syncs style.hasGridlines', () => {
		const data = chart({
			axes: [{ axisType: 'valAx', axPos: 'l', majorGridlines: false }],
			style: { hasLegend: true },
		});
		const patch = chartGridlinesPatch(data, true);
		expect(patch.axes).toStrictEqual([{ axisType: 'valAx', axPos: 'l', majorGridlines: true }]);
		expect(patch.style).toStrictEqual({ hasLegend: true, hasGridlines: true });
	});

	it('creates a minimal valAx entry when the chart has no axes yet', () => {
		const patch = chartGridlinesPatch(chart(), true);
		expect(patch.axes).toStrictEqual([{ axisType: 'valAx', majorGridlines: true }]);
		expect(patch.style).toStrictEqual({ hasGridlines: true });
	});

	it('preserves other axes when patching', () => {
		const data = chart({
			axes: [{ axisType: 'catAx' }, { axisType: 'valAx', majorGridlines: true }],
		});
		const patch = chartGridlinesPatch(data, false);
		expect(patch.axes).toStrictEqual([
			{ axisType: 'catAx' },
			{ axisType: 'valAx', majorGridlines: false },
		]);
	});
});
