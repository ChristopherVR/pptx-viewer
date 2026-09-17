import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	applyChartElementToggle,
	chartAxesVisibilityPatch,
	chartAxesVisibilityState,
	chartAxisTitlesPatch,
	chartAxisTitlesState,
} from './chart-quick-action-toggles';

function chart(overrides: Partial<PptxChartData> = {}): PptxChartData {
	return {
		chartType: 'bar',
		categories: ['A', 'B'],
		series: [{ name: 'S1', values: [1, 2] }],
		...overrides,
	} as PptxChartData;
}

describe('chartAxesVisibilityState / chartAxesVisibilityPatch', () => {
	it('treats a chart with no axes as visible (nothing to hide)', () => {
		expect(chartAxesVisibilityState(chart())).toBeTruthy();
	});

	it('is visible when neither axis is deleted', () => {
		const data = chart({ axes: [{ axisType: 'catAx' }, { axisType: 'valAx' }] });
		expect(chartAxesVisibilityState(data)).toBeTruthy();
	});

	it('is hidden only when every relevant axis is deleted', () => {
		const bothDeleted = chart({
			axes: [
				{ axisType: 'catAx', deleted: true },
				{ axisType: 'valAx', deleted: true },
			],
		});
		expect(chartAxesVisibilityState(bothDeleted)).toBeFalsy();

		const oneDeleted = chart({
			axes: [
				{ axisType: 'catAx', deleted: true },
				{ axisType: 'valAx', deleted: false },
			],
		});
		expect(chartAxesVisibilityState(oneDeleted)).toBeTruthy();
	});

	it('patch sets deleted=true on every axis when hiding', () => {
		const data = chart({ axes: [{ axisType: 'catAx' }, { axisType: 'valAx' }] });
		const patch = chartAxesVisibilityPatch(data, false);
		expect(patch.axes).toStrictEqual([
			{ axisType: 'catAx', deleted: true },
			{ axisType: 'valAx', deleted: true },
		]);
	});

	it('patch clears deleted when showing', () => {
		const data = chart({
			axes: [
				{ axisType: 'catAx', deleted: true },
				{ axisType: 'valAx', deleted: true },
			],
		});
		const patch = chartAxesVisibilityPatch(data, true);
		expect(patch.axes).toStrictEqual([
			{ axisType: 'catAx', deleted: false },
			{ axisType: 'valAx', deleted: false },
		]);
	});
});

describe('chartAxisTitlesState / chartAxisTitlesPatch', () => {
	it('is false with no axes or empty titles', () => {
		expect(chartAxisTitlesState(chart())).toBeFalsy();
		expect(
			chartAxisTitlesState(chart({ axes: [{ axisType: 'catAx' }, { axisType: 'valAx' }] })),
		).toBeFalsy();
	});

	it('is true when any relevant axis has titleText', () => {
		const data = chart({ axes: [{ axisType: 'valAx', titleText: 'Sales' }] });
		expect(chartAxisTitlesState(data)).toBeTruthy();
	});

	it('patch fills in a default title when turning on with none set', () => {
		const data = chart({ axes: [{ axisType: 'catAx' }, { axisType: 'valAx' }] });
		const patch = chartAxisTitlesPatch(data, true);
		expect(patch.axes).toStrictEqual([
			{ axisType: 'catAx', titleText: 'Axis Title' },
			{ axisType: 'valAx', titleText: 'Axis Title' },
		]);
	});

	it('patch preserves an existing title when turning on', () => {
		const data = chart({ axes: [{ axisType: 'valAx', titleText: 'Revenue' }] });
		const patch = chartAxisTitlesPatch(data, true);
		expect(patch.axes).toStrictEqual([{ axisType: 'valAx', titleText: 'Revenue' }]);
	});

	it('patch clears titleText when turning off', () => {
		const data = chart({ axes: [{ axisType: 'valAx', titleText: 'Revenue' }] });
		const patch = chartAxisTitlesPatch(data, false);
		expect(patch.axes).toStrictEqual([{ axisType: 'valAx', titleText: undefined }]);
	});
});

describe('applyChartElementToggle', () => {
	it('dispatches title/legend/dataLabels through style', () => {
		const data = chart();
		expect(applyChartElementToggle(data, 'title', true).style?.hasTitle).toBeTruthy();
		expect(applyChartElementToggle(data, 'legend', true).style?.hasLegend).toBeTruthy();
		expect(applyChartElementToggle(data, 'dataLabels', true).style?.hasDataLabels).toBeTruthy();
	});

	it('dispatches gridlines through the primary value axis', () => {
		const data = chart({ axes: [{ axisType: 'valAx', axPos: 'l', majorGridlines: false }] });
		const next = applyChartElementToggle(data, 'gridlines', true);
		expect(next.axes?.[0]?.majorGridlines).toBeTruthy();
	});

	it('dispatches axes/axisTitles through the axis helpers', () => {
		const data = chart({ axes: [{ axisType: 'valAx' }] });
		expect(applyChartElementToggle(data, 'axes', false).axes?.[0]?.deleted).toBeTruthy();
		expect(applyChartElementToggle(data, 'axisTitles', true).axes?.[0]?.titleText).toBe(
			'Axis Title',
		);
	});
});
