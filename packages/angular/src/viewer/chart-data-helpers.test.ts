/**
 * chart-data-helpers.test.ts: Vitest unit tests for chart-data-helpers.ts.
 *
 * All tests are pure (no TestBed, no Angular imports).
 *
 * @module angular-viewer/chart-data-helpers.test
 */

import type { ChartPptxElement, PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	addCategory,
	addSeries,
	patchChartData,
	patchChartStyle,
	removeCategory,
	removeSeries,
	setAxisLogScale,
	setAxisTitleStyle,
	setCategoryLabel,
	setDataPointExplosion,
	setDataPointFill,
	setGridlineStyle,
	setSeriesChartType,
	setSeriesMarker,
	setSeriesName,
	setSeriesValue,
} from './chart-data-helpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChart(
	seriesNames: string[],
	categories: string[],
	valuesFn?: (si: number) => number[],
): ChartPptxElement {
	const chartData: PptxChartData = {
		chartType: 'bar',
		categories: [...categories],
		series: seriesNames.map((name, si) => ({
			name,
			values: valuesFn ? valuesFn(si) : categories.map(() => 0),
		})),
	};
	return {
		type: 'chart',
		id: 'ch-1',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData,
	};
}

// ---------------------------------------------------------------------------
// addSeries
// ---------------------------------------------------------------------------

describe('addSeries', () => {
	it('appends a new series with zeros matching category count', () => {
		const el = makeChart(['Rev'], ['Q1', 'Q2', 'Q3']);
		const result = addSeries(el);
		expect(result.chartData?.series).toHaveLength(2);
		const newSeries = result.chartData?.series[1];
		expect(newSeries?.name).toBe('Series 2');
		expect(newSeries?.values).toStrictEqual([0, 0, 0]);
	});

	it('names new series by incrementing count', () => {
		const el = makeChart(['A', 'B'], ['x']);
		const result = addSeries(el);
		expect(result.chartData?.series[2].name).toBe('Series 3');
	});

	it('does not mutate the original', () => {
		const el = makeChart(['Rev'], ['Q1']);
		addSeries(el);
		expect(el.chartData?.series).toHaveLength(1);
	});

	it('returns element unchanged when chartData is missing', () => {
		const el: ChartPptxElement = { type: 'chart', id: 'c', x: 0, y: 0, width: 100, height: 100 };
		expect(addSeries(el)).toBe(el);
	});
});

// ---------------------------------------------------------------------------
// removeSeries
// ---------------------------------------------------------------------------

describe('removeSeries', () => {
	it('removes the series at the given index', () => {
		const el = makeChart(['A', 'B', 'C'], ['x']);
		const result = removeSeries(el, 1);
		expect(result.chartData?.series).toHaveLength(2);
		expect(result.chartData?.series.map((s) => s.name)).toStrictEqual(['A', 'C']);
	});

	it('returns element unchanged when only one series remains', () => {
		const el = makeChart(['A'], ['x']);
		expect(removeSeries(el, 0)).toBe(el);
	});

	it('does not mutate the original', () => {
		const el = makeChart(['A', 'B'], ['x']);
		removeSeries(el, 0);
		expect(el.chartData?.series).toHaveLength(2);
	});
});

// ---------------------------------------------------------------------------
// addCategory
// ---------------------------------------------------------------------------

describe('addCategory', () => {
	it('appends a new category with default label', () => {
		const el = makeChart(['Rev'], ['Q1', 'Q2']);
		const result = addCategory(el);
		expect(result.chartData?.categories).toStrictEqual(['Q1', 'Q2', 'Cat 3']);
	});

	it('appends a zero value for every series', () => {
		const el = makeChart(['A', 'B'], ['x'], () => [1]);
		const result = addCategory(el);
		expect(result.chartData?.series[0].values).toHaveLength(2);
		expect(result.chartData?.series[0].values[1]).toBe(0);
		expect(result.chartData?.series[1].values[1]).toBe(0);
	});

	it('does not mutate the original', () => {
		const el = makeChart(['A'], ['x']);
		addCategory(el);
		expect(el.chartData?.categories).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// removeCategory
// ---------------------------------------------------------------------------

describe('removeCategory', () => {
	it('removes the category and corresponding values', () => {
		const el = makeChart(['A'], ['Q1', 'Q2', 'Q3'], () => [10, 20, 30]);
		const result = removeCategory(el, 1);
		expect(result.chartData?.categories).toStrictEqual(['Q1', 'Q3']);
		expect(result.chartData?.series[0].values).toStrictEqual([10, 30]);
	});

	it('returns element unchanged when only one category exists', () => {
		const el = makeChart(['A'], ['Q1'], () => [5]);
		expect(removeCategory(el, 0)).toBe(el);
	});

	it('does not mutate the original', () => {
		const el = makeChart(['A'], ['Q1', 'Q2']);
		removeCategory(el, 0);
		expect(el.chartData?.categories).toHaveLength(2);
	});
});

// ---------------------------------------------------------------------------
// setSeriesValue
// ---------------------------------------------------------------------------

describe('setSeriesValue', () => {
	it('updates the numeric value at the specified position', () => {
		const el = makeChart(['Rev'], ['Q1', 'Q2'], () => [10, 20]);
		const result = setSeriesValue(el, 0, 1, '99');
		expect(result.chartData?.series[0].values[1]).toBe(99);
	});

	it('returns element unchanged for non-finite raw values', () => {
		const el = makeChart(['Rev'], ['Q1'], () => [10]);
		expect(setSeriesValue(el, 0, 0, 'abc')).toBe(el);
		expect(setSeriesValue(el, 0, 0, '')).toBe(el);
	});

	it('accepts decimal strings', () => {
		const el = makeChart(['Rev'], ['Q1'], () => [0]);
		const result = setSeriesValue(el, 0, 0, '3.14');
		expect(result.chartData?.series[0].values[0]).toBeCloseTo(3.14);
	});

	it('does not mutate the original', () => {
		const el = makeChart(['Rev'], ['Q1'], () => [10]);
		setSeriesValue(el, 0, 0, '99');
		expect(el.chartData?.series[0].values[0]).toBe(10);
	});
});

// ---------------------------------------------------------------------------
// setSeriesName
// ---------------------------------------------------------------------------

describe('setSeriesName', () => {
	it('renames the series at the given index', () => {
		const el = makeChart(['Old', 'B'], ['x']);
		const result = setSeriesName(el, 0, 'New');
		expect(result.chartData?.series[0].name).toBe('New');
		expect(result.chartData?.series[1].name).toBe('B');
	});

	it('does not mutate the original', () => {
		const el = makeChart(['Old'], ['x']);
		setSeriesName(el, 0, 'New');
		expect(el.chartData?.series[0].name).toBe('Old');
	});
});

// ---------------------------------------------------------------------------
// setCategoryLabel
// ---------------------------------------------------------------------------

describe('setCategoryLabel', () => {
	it('renames the category at the given index', () => {
		const el = makeChart(['A'], ['Jan', 'Feb', 'Mar']);
		const result = setCategoryLabel(el, 1, 'February');
		expect(result.chartData?.categories).toStrictEqual(['Jan', 'February', 'Mar']);
	});

	it('does not mutate the original', () => {
		const el = makeChart(['A'], ['Jan', 'Feb']);
		setCategoryLabel(el, 0, 'January');
		expect(el.chartData?.categories[0]).toBe('Jan');
	});
});

// ---------------------------------------------------------------------------
// patchChartStyle
// ---------------------------------------------------------------------------

describe('patchChartStyle', () => {
	it('merges style fields', () => {
		const el = makeChart(['A'], ['x']);
		const result = patchChartStyle(el, { hasLegend: true, legendPosition: 'b' });
		expect(result.chartData?.style?.hasLegend).toBeTruthy();
		expect(result.chartData?.style?.legendPosition).toBe('b');
	});

	it('preserves existing style fields not in patch', () => {
		const el: ChartPptxElement = {
			...makeChart(['A'], ['x']),
			chartData: {
				...makeChart(['A'], ['x']).chartData!,
				style: { hasLegend: true, hasTitle: true },
			},
		};
		const result = patchChartStyle(el, { hasLegend: false });
		expect(result.chartData?.style?.hasTitle).toBeTruthy();
	});
});

// ---------------------------------------------------------------------------
// patchChartData
// ---------------------------------------------------------------------------

describe('patchChartData', () => {
	it('merges arbitrary chartData fields', () => {
		const el = makeChart(['A'], ['x']);
		const result = patchChartData(el, { title: 'My Chart' });
		expect(result.chartData?.title).toBe('My Chart');
	});

	it('uses chartDataChangeType when chartType changes', () => {
		const el = makeChart(['A'], ['x']);
		// Bar -> pie: grouping should be cleared
		const result = patchChartData(el, { chartType: 'pie' });
		expect(result.chartData?.chartType).toBe('pie');
		// pie does not support grouping, so grouping should be undefined/null
		expect(result.chartData?.grouping).toBeUndefined();
	});

	it('does not mutate the original', () => {
		const el = makeChart(['A'], ['x']);
		patchChartData(el, { title: 'Changed' });
		expect(el.chartData?.title).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Advanced formatting wrappers
// ---------------------------------------------------------------------------

describe('advanced chart formatting wrappers', () => {
	function pieChart(): ChartPptxElement {
		const el = makeChart(['Rev', 'Cost'], ['Q1', 'Q2', 'Q3']);
		el.chartData!.chartType = 'pie';
		return el;
	}

	it('setAxisLogScale enables log scaling immutably', () => {
		const el = makeChart(['Rev'], ['Q1']);
		const result = setAxisLogScale(el, 'valAx', { enabled: true, base: 10 });
		expect(result).not.toBe(el);
		const axis = result.chartData?.axes?.find((a) => a.axisType === 'valAx');
		expect(axis?.logScale).toBeTruthy();
		expect(axis?.logBase).toBe(10);
		expect(el.chartData?.axes).toBeUndefined();
	});

	it('setAxisTitleStyle sets font props', () => {
		const el = makeChart(['Rev'], ['Q1']);
		const result = setAxisTitleStyle(el, 'valAx', {
			fontFamily: 'Arial',
			fontSize: 11,
			fontBold: true,
		});
		const axis = result.chartData?.axes?.find((a) => a.axisType === 'valAx');
		expect(axis?.fontFamily).toBe('Arial');
		expect(axis?.fontSize).toBe(11);
		expect(axis?.fontBold).toBeTruthy();
	});

	it('setGridlineStyle sets gridline line styling', () => {
		const el = makeChart(['Rev'], ['Q1']);
		const result = setGridlineStyle(el, 'valAx', 'major', { color: '#CCCCCC', width: 0.75 });
		const axis = result.chartData?.axes?.find((a) => a.axisType === 'valAx');
		expect(axis?.majorGridlinesSpPr?.strokeColor).toBe('#CCCCCC');
		expect(axis?.majorGridlinesSpPr?.strokeWidth).toBe(0.75);
	});

	it('setSeriesMarker sets and clears a marker', () => {
		const el = makeChart(['Rev'], ['Q1']);
		const set = setSeriesMarker(el, 0, { symbol: 'circle', size: 6, fillColor: '#FF0000' });
		expect(set.chartData?.series[0].marker?.symbol).toBe('circle');
		expect(set.chartData?.series[0].marker?.spPr?.fillColor).toBe('#FF0000');
		const cleared = setSeriesMarker(set, 0, null);
		expect(cleared.chartData?.series[0].marker).toBeUndefined();
	});

	it('setSeriesChartType promotes to combo', () => {
		const el = makeChart(['Rev', 'Cost'], ['Q1']);
		const result = setSeriesChartType(el, 1, 'line');
		expect(result.chartData?.series[1].seriesChartType).toBe('line');
		expect(result.chartData?.chartType).toBe('combo');
	});

	it('setDataPointFill sets and clears a per-point fill', () => {
		const el = pieChart();
		const set = setDataPointFill(el, 0, 1, '#123456');
		expect(set.chartData?.series[0].dataPoints?.find((p) => p.idx === 1)?.spPr?.fillColor).toBe(
			'#123456',
		);
		const cleared = setDataPointFill(set, 0, 1, null);
		expect(cleared.chartData?.series[0].dataPoints).toBeUndefined();
	});

	it('setDataPointExplosion sets a pie slice explosion', () => {
		const el = pieChart();
		const result = setDataPointExplosion(el, 0, 2, 25);
		expect(result.chartData?.series[0].dataPoints?.find((p) => p.idx === 2)?.explosion).toBe(25);
	});

	it('returns the element unchanged when chartData is missing', () => {
		const el: ChartPptxElement = {
			type: 'chart',
			id: 'x',
			x: 0,
			y: 0,
			width: 1,
			height: 1,
			chartData: undefined,
		};
		expect(setAxisLogScale(el, 'valAx', { enabled: true })).toBe(el);
	});
});
