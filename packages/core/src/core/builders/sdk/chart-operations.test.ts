import { describe, it, expect, beforeEach } from 'vitest';

import type { PptxChartType } from '../../types/chart';
import type { ChartPptxElement } from '../../types/elements';
import {
	setChartType,
	addChartSeries,
	removeChartSeries,
	setChartCategories,
	updateChartSeriesValues,
	setChartTitle,
	setChartGrouping,
	setChartLegend,
	setChartAxis,
	setChartDataLabels,
	setChartSeriesTrendline,
	setChartSeriesErrorBars,
	updateChartDataPoint,
	addChartCategory,
	removeChartCategory,
	setChartSeriesColor,
	setChartAxisLogScale,
	setChartAxisTitleStyle,
	setChartAxisGridlineStyle,
	setChartSeriesMarker,
	setChartSeriesChartType,
	setChartDataPointFill,
	setChartDataPointExplosion,
	setChartDataPointLabel,
} from './chart-operations';
import { createChartElement, resetIdCounter } from './ElementFactory';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a standard test chart element with predictable data. */
function makeTestChart(
	overrides?: Partial<{
		chartType: PptxChartType;
		categories: string[];
		series: { name: string; values: number[]; color?: string }[];
		title: string;
		grouping: 'clustered' | 'stacked' | 'percentStacked';
	}>,
): ChartPptxElement {
	return createChartElement(overrides?.chartType ?? 'bar', {
		series: overrides?.series ?? [
			{ name: 'Revenue', values: [100, 200, 300], color: '#4472C4' },
			{ name: 'Cost', values: [80, 160, 240], color: '#ED7D31' },
		],
		categories: overrides?.categories ?? ['Q1', 'Q2', 'Q3'],
		title: overrides?.title ?? 'Test Chart',
		grouping: overrides?.grouping,
	});
}

/** Create a chart element with no chartData (simulates uninitialised state). */
function makeEmptyChart(): ChartPptxElement {
	return {
		type: 'chart',
		id: 'empty_chart',
		x: 0,
		y: 0,
		width: 600,
		height: 400,
		chartData: undefined,
	};
}

beforeEach(() => {
	resetIdCounter();
});

// ===========================================================================
// setChartType
// ===========================================================================

describe('setChartType', () => {
	it('changes chart type from bar to line', () => {
		const el = makeTestChart();
		setChartType(el, 'line');
		expect(el.chartData?.chartType).toBe('line');
	});

	it('changes chart type from bar to pie', () => {
		const el = makeTestChart();
		setChartType(el, 'pie');
		expect(el.chartData?.chartType).toBe('pie');
	});

	it('preserves series data after type switch', () => {
		const el = makeTestChart();
		const seriesBefore = JSON.parse(JSON.stringify(el.chartData?.series));
		setChartType(el, 'area');
		expect(el.chartData?.series).toStrictEqual(seriesBefore);
		expect(Object.keys(el.chartData!.series[0])).toStrictEqual(['name', 'values', 'color']);
	});

	it('preserves categories after type switch', () => {
		const el = makeTestChart();
		const catsBefore = [...el.chartData!.categories];
		setChartType(el, 'scatter');
		expect(el.chartData?.categories).toStrictEqual(catsBefore);
	});

	it('preserves title after type switch', () => {
		const el = makeTestChart({ title: 'My Title' });
		setChartType(el, 'doughnut');
		expect(el.chartData?.title).toBe('My Title');
	});

	it('can switch to 3D chart types', () => {
		const el = makeTestChart();
		setChartType(el, 'bar3D');
		expect(el.chartData?.chartType).toBe('bar3D');
	});

	it('can switch to modern chart types', () => {
		const el = makeTestChart();
		setChartType(el, 'waterfall');
		expect(el.chartData?.chartType).toBe('waterfall');
	});

	it('preserves advanced series options across type and category changes', () => {
		const el = createChartElement('waterfall', {
			categories: ['A', 'B'],
			series: [
				{
					name: 'Advanced',
					values: [10, 20],
					boxWhiskerOptions: { quartileMethod: 'inclusive' },
					histogramOptions: { binCount: 4 },
					waterfallOptions: { subtotalIndices: [1], connectorLines: false },
					regionMapOptions: { entityIds: ['AU', 'NZ'], projectionType: 'mercator' },
				},
			],
		});
		const before = structuredClone(el.chartData!.series);

		setChartType(el, 'line');
		setChartCategories(el, ['First', 'Second']);

		expect(el.chartData!.series).toStrictEqual(before);
	});

	it('can set type to the same value (no-op)', () => {
		const el = makeTestChart({ chartType: 'bar' });
		setChartType(el, 'bar');
		expect(el.chartData?.chartType).toBe('bar');
	});

	it('throws when chartData is missing', () => {
		const el = makeEmptyChart();
		expect(() => setChartType(el, 'line')).toThrow(/no chartData/u);
	});
});

// ===========================================================================
// addChartSeries
// ===========================================================================

describe('addChartSeries', () => {
	it('adds a series to the chart', () => {
		const el = makeTestChart();
		const before = el.chartData!.series.length;
		addChartSeries(el, { name: 'Profit', values: [20, 40, 60] });
		expect(el.chartData!.series).toHaveLength(before + 1);
		expect(el.chartData!.series[before].name).toBe('Profit');
		expect(el.chartData!.series[before].values).toStrictEqual([20, 40, 60]);
	});

	it('adds a series with color', () => {
		const el = makeTestChart();
		addChartSeries(el, { name: 'Extra', values: [1, 2], color: '#00FF00' });
		const added = el.chartData!.series[el.chartData!.series.length - 1];
		expect(added.color).toBe('#00FF00');
	});

	it('adds a series without color', () => {
		const el = makeTestChart();
		addChartSeries(el, { name: 'NoColor', values: [5] });
		const added = el.chartData!.series[el.chartData!.series.length - 1];
		expect(added.color).toBeUndefined();
	});

	it('adds a series with empty values array', () => {
		const el = makeTestChart();
		addChartSeries(el, { name: 'Empty', values: [] });
		const added = el.chartData!.series[el.chartData!.series.length - 1];
		expect(added.values).toStrictEqual([]);
	});

	it('can add multiple series sequentially', () => {
		const el = makeTestChart();
		const before = el.chartData!.series.length;
		addChartSeries(el, { name: 'S1', values: [1] });
		addChartSeries(el, { name: 'S2', values: [2] });
		addChartSeries(el, { name: 'S3', values: [3] });
		expect(el.chartData!.series).toHaveLength(before + 3);
	});

	it('appends to the end of existing series', () => {
		const el = makeTestChart();
		addChartSeries(el, { name: 'Last', values: [999] });
		const last = el.chartData!.series[el.chartData!.series.length - 1];
		expect(last.name).toBe('Last');
	});

	it('throws when chartData is missing', () => {
		const el = makeEmptyChart();
		expect(() => addChartSeries(el, { name: 'X', values: [1] })).toThrow(/no chartData/u);
	});
});

// ===========================================================================
// removeChartSeries
// ===========================================================================

describe('removeChartSeries', () => {
	it('removes the first series', () => {
		const el = makeTestChart();
		const secondName = el.chartData!.series[1].name;
		removeChartSeries(el, 0);
		expect(el.chartData!.series).toHaveLength(1);
		expect(el.chartData!.series[0].name).toBe(secondName);
	});

	it('removes the last series', () => {
		const el = makeTestChart();
		const firstName = el.chartData!.series[0].name;
		removeChartSeries(el, 1);
		expect(el.chartData!.series).toHaveLength(1);
		expect(el.chartData!.series[0].name).toBe(firstName);
	});

	it('removes a middle series from a 3-series chart', () => {
		const el = makeTestChart();
		addChartSeries(el, { name: 'Third', values: [10, 20, 30] });
		expect(el.chartData!.series).toHaveLength(3);
		removeChartSeries(el, 1);
		expect(el.chartData!.series).toHaveLength(2);
		expect(el.chartData!.series[0].name).toBe('Revenue');
		expect(el.chartData!.series[1].name).toBe('Third');
	});

	it('throws RangeError for negative index', () => {
		const el = makeTestChart();
		expect(() => removeChartSeries(el, -1)).toThrow(RangeError);
	});

	it('throws RangeError for index equal to series length', () => {
		const el = makeTestChart();
		expect(() => removeChartSeries(el, 2)).toThrow(RangeError);
	});

	it('throws RangeError for index beyond series length', () => {
		const el = makeTestChart();
		expect(() => removeChartSeries(el, 100)).toThrow(RangeError);
	});

	it('throws when chartData is missing', () => {
		const el = makeEmptyChart();
		expect(() => removeChartSeries(el, 0)).toThrow(/no chartData/u);
	});

	it('can remove all series one by one', () => {
		const el = makeTestChart();
		removeChartSeries(el, 1);
		removeChartSeries(el, 0);
		expect(el.chartData!.series).toHaveLength(0);
	});
});

// ===========================================================================
// setChartCategories
// ===========================================================================

describe('setChartCategories', () => {
	it('replaces categories', () => {
		const el = makeTestChart();
		setChartCategories(el, ['Jan', 'Feb', 'Mar', 'Apr']);
		expect(el.chartData?.categories).toStrictEqual(['Jan', 'Feb', 'Mar', 'Apr']);
	});

	it('sets categories to an empty array', () => {
		const el = makeTestChart();
		setChartCategories(el, []);
		expect(el.chartData?.categories).toStrictEqual([]);
	});

	it('can increase the number of categories', () => {
		const el = makeTestChart({ categories: ['A'] });
		setChartCategories(el, ['A', 'B', 'C', 'D', 'E']);
		expect(el.chartData?.categories.length).toBe(5);
	});

	it('can decrease the number of categories', () => {
		const el = makeTestChart({ categories: ['A', 'B', 'C'] });
		setChartCategories(el, ['X']);
		expect(el.chartData?.categories.length).toBe(1);
	});

	it('does not affect series data', () => {
		const el = makeTestChart();
		const seriesBefore = JSON.parse(JSON.stringify(el.chartData?.series));
		setChartCategories(el, ['New1', 'New2']);
		expect(el.chartData?.series).toStrictEqual(seriesBefore);
		expect(Object.keys(el.chartData!.series[0])).toStrictEqual(['name', 'values', 'color']);
	});

	it('throws when chartData is missing', () => {
		const el = makeEmptyChart();
		expect(() => setChartCategories(el, ['A'])).toThrow(/no chartData/u);
	});
});

// ===========================================================================
// updateChartSeriesValues
// ===========================================================================

describe('updateChartSeriesValues', () => {
	it('updates values for the first series', () => {
		const el = makeTestChart();
		updateChartSeriesValues(el, 0, [999, 888, 777]);
		expect(el.chartData!.series[0].values).toStrictEqual([999, 888, 777]);
	});

	it('updates values for the second series', () => {
		const el = makeTestChart();
		updateChartSeriesValues(el, 1, [10, 20]);
		expect(el.chartData!.series[1].values).toStrictEqual([10, 20]);
	});

	it('can set values to an empty array', () => {
		const el = makeTestChart();
		updateChartSeriesValues(el, 0, []);
		expect(el.chartData!.series[0].values).toStrictEqual([]);
	});

	it('preserves other series when updating one', () => {
		const el = makeTestChart();
		const secondBefore = [...el.chartData!.series[1].values];
		updateChartSeriesValues(el, 0, [1, 2, 3]);
		expect(el.chartData!.series[1].values).toStrictEqual(secondBefore);
	});

	it('preserves series name and color', () => {
		const el = makeTestChart();
		const nameBefore = el.chartData!.series[0].name;
		const colorBefore = el.chartData!.series[0].color;
		updateChartSeriesValues(el, 0, [42]);
		expect(el.chartData!.series[0].name).toBe(nameBefore);
		expect(el.chartData!.series[0].color).toBe(colorBefore);
	});

	it('throws RangeError for negative index', () => {
		const el = makeTestChart();
		expect(() => updateChartSeriesValues(el, -1, [1])).toThrow(RangeError);
	});

	it('throws RangeError for out-of-bounds index', () => {
		const el = makeTestChart();
		expect(() => updateChartSeriesValues(el, 5, [1])).toThrow(RangeError);
	});

	it('throws when chartData is missing', () => {
		const el = makeEmptyChart();
		expect(() => updateChartSeriesValues(el, 0, [1])).toThrow(/no chartData/u);
	});
});

// ===========================================================================
// setChartTitle
// ===========================================================================

describe('setChartTitle', () => {
	it('sets the chart title', () => {
		const el = makeTestChart();
		setChartTitle(el, 'New Title');
		expect(el.chartData?.title).toBe('New Title');
	});

	it('overwrites an existing title', () => {
		const el = makeTestChart({ title: 'Old Title' });
		setChartTitle(el, 'Updated Title');
		expect(el.chartData?.title).toBe('Updated Title');
	});

	it('can set an empty title', () => {
		const el = makeTestChart({ title: 'Has Title' });
		setChartTitle(el, '');
		expect(el.chartData?.title).toBe('');
	});

	it('throws when chartData is missing', () => {
		const el = makeEmptyChart();
		expect(() => setChartTitle(el, 'Title')).toThrow(/no chartData/u);
	});
});

// ===========================================================================
// setChartGrouping
// ===========================================================================

describe('setChartGrouping', () => {
	it('sets grouping to clustered', () => {
		const el = makeTestChart();
		setChartGrouping(el, 'clustered');
		expect(el.chartData?.grouping).toBe('clustered');
	});

	it('sets grouping to stacked', () => {
		const el = makeTestChart();
		setChartGrouping(el, 'stacked');
		expect(el.chartData?.grouping).toBe('stacked');
	});

	it('sets grouping to percentStacked', () => {
		const el = makeTestChart();
		setChartGrouping(el, 'percentStacked');
		expect(el.chartData?.grouping).toBe('percentStacked');
	});

	it('overwrites existing grouping', () => {
		const el = makeTestChart({ grouping: 'stacked' });
		setChartGrouping(el, 'clustered');
		expect(el.chartData?.grouping).toBe('clustered');
	});

	it('throws when chartData is missing', () => {
		const el = makeEmptyChart();
		expect(() => setChartGrouping(el, 'stacked')).toThrow(/no chartData/u);
	});
});

// ===========================================================================
// Combined / integration scenarios
// ===========================================================================

describe('combined chart operations', () => {
	it('switches type and adds a series', () => {
		const el = makeTestChart({ chartType: 'bar' });
		setChartType(el, 'line');
		addChartSeries(el, { name: 'New', values: [1, 2, 3] });
		expect(el.chartData?.chartType).toBe('line');
		expect(el.chartData?.series.length).toBe(3);
	});

	it('adds then removes a series, returning to original state', () => {
		const el = makeTestChart();
		const originalLength = el.chartData!.series.length;
		addChartSeries(el, { name: 'Temp', values: [1] });
		expect(el.chartData!.series).toHaveLength(originalLength + 1);
		removeChartSeries(el, originalLength); // remove the added one
		expect(el.chartData!.series).toHaveLength(originalLength);
	});

	it('updates categories, title, and grouping together', () => {
		const el = makeTestChart();
		setChartCategories(el, ['X', 'Y']);
		setChartTitle(el, 'Combined');
		setChartGrouping(el, 'percentStacked');
		expect(el.chartData?.categories).toStrictEqual(['X', 'Y']);
		expect(el.chartData?.title).toBe('Combined');
		expect(el.chartData?.grouping).toBe('percentStacked');
	});

	it('performs a full chart rebuild: type switch, clear series, add new series, set categories', () => {
		const el = makeTestChart();
		setChartType(el, 'pie');
		// Remove all existing series
		while (el.chartData!.series.length > 0) {
			removeChartSeries(el, 0);
		}
		addChartSeries(el, { name: 'Segments', values: [40, 30, 20, 10], color: '#FF6384' });
		setChartCategories(el, ['A', 'B', 'C', 'D']);
		setChartTitle(el, 'Distribution');

		expect(el.chartData?.chartType).toBe('pie');
		expect(el.chartData?.series.length).toBe(1);
		expect(el.chartData?.series[0].name).toBe('Segments');
		expect(el.chartData?.series[0].values).toStrictEqual([40, 30, 20, 10]);
		expect(el.chartData?.categories).toStrictEqual(['A', 'B', 'C', 'D']);
		expect(el.chartData?.title).toBe('Distribution');
	});

	it('updates values for a newly added series', () => {
		const el = makeTestChart();
		addChartSeries(el, { name: 'Added', values: [0, 0, 0] });
		const newIndex = el.chartData!.series.length - 1;
		updateChartSeriesValues(el, newIndex, [10, 20, 30]);
		expect(el.chartData!.series[newIndex].values).toStrictEqual([10, 20, 30]);
	});

	it('preserves internal chartData properties (chartPartPath, chartRelationshipId) through operations', () => {
		const el = makeTestChart();
		el.chartData!.chartPartPath = 'ppt/charts/chart1.xml';
		el.chartData!.chartRelationshipId = 'rId5';

		setChartType(el, 'line');
		addChartSeries(el, { name: 'Extra', values: [1] });
		setChartTitle(el, 'Changed');
		setChartGrouping(el, 'stacked');
		setChartCategories(el, ['A']);

		expect(el.chartData?.chartPartPath).toBe('ppt/charts/chart1.xml');
		expect(el.chartData?.chartRelationshipId).toBe('rId5');
	});
});

// ===========================================================================
// updateChartDataPoint
// ===========================================================================

describe('updateChartDataPoint', () => {
	it('updates a single data point in the first series', () => {
		const el = makeTestChart();
		updateChartDataPoint(el, 0, 1, 999);
		expect(el.chartData!.series[0].values).toStrictEqual([100, 999, 300]);
	});

	it('updates a data point in the second series', () => {
		const el = makeTestChart();
		updateChartDataPoint(el, 1, 0, 42);
		expect(el.chartData!.series[1].values[0]).toBe(42);
	});

	it('does not affect other series', () => {
		const el = makeTestChart();
		const secondBefore = [...el.chartData!.series[1].values];
		updateChartDataPoint(el, 0, 0, 42);
		expect(el.chartData!.series[1].values).toStrictEqual(secondBefore);
	});

	it('does not affect other data points in the same series', () => {
		const el = makeTestChart();
		updateChartDataPoint(el, 0, 1, 777);
		expect(el.chartData!.series[0].values[0]).toBe(100);
		expect(el.chartData!.series[0].values[2]).toBe(300);
	});

	it('can set a value to zero', () => {
		const el = makeTestChart();
		updateChartDataPoint(el, 0, 0, 0);
		expect(el.chartData!.series[0].values[0]).toBe(0);
	});

	it('can set a negative value', () => {
		const el = makeTestChart();
		updateChartDataPoint(el, 0, 0, -50);
		expect(el.chartData!.series[0].values[0]).toBe(-50);
	});

	it('throws RangeError for invalid series index', () => {
		const el = makeTestChart();
		expect(() => updateChartDataPoint(el, -1, 0, 1)).toThrow(RangeError);
		expect(() => updateChartDataPoint(el, 5, 0, 1)).toThrow(RangeError);
	});

	it('throws RangeError for invalid point index', () => {
		const el = makeTestChart();
		expect(() => updateChartDataPoint(el, 0, -1, 1)).toThrow(RangeError);
		expect(() => updateChartDataPoint(el, 0, 10, 1)).toThrow(RangeError);
	});

	it('throws when chartData is missing', () => {
		const el = makeEmptyChart();
		expect(() => updateChartDataPoint(el, 0, 0, 1)).toThrow(/no chartData/u);
	});
});

// ===========================================================================
// addChartCategory
// ===========================================================================

describe('addChartCategory', () => {
	it('appends a category to the chart', () => {
		const el = makeTestChart();
		addChartCategory(el, 'Q4');
		expect(el.chartData!.categories).toStrictEqual(['Q1', 'Q2', 'Q3', 'Q4']);
	});

	it('adds a zero value to every series', () => {
		const el = makeTestChart();
		addChartCategory(el, 'Q4');
		expect(el.chartData!.series[0].values).toStrictEqual([100, 200, 300, 0]);
		expect(el.chartData!.series[1].values).toStrictEqual([80, 160, 240, 0]);
	});

	it('works with no existing categories', () => {
		const el = makeTestChart({ categories: [] });
		el.chartData!.series[0].values = [];
		el.chartData!.series[1].values = [];
		addChartCategory(el, 'First');
		expect(el.chartData!.categories).toStrictEqual(['First']);
		expect(el.chartData!.series[0].values).toStrictEqual([0]);
		expect(el.chartData!.series[1].values).toStrictEqual([0]);
	});

	it('can add multiple categories sequentially', () => {
		const el = makeTestChart();
		addChartCategory(el, 'Q4');
		addChartCategory(el, 'Q5');
		expect(el.chartData!.categories).toHaveLength(5);
		expect(el.chartData!.series[0].values).toHaveLength(5);
	});

	it('throws when chartData is missing', () => {
		const el = makeEmptyChart();
		expect(() => addChartCategory(el, 'X')).toThrow(/no chartData/u);
	});
});

// ===========================================================================
// removeChartCategory
// ===========================================================================

describe('removeChartCategory', () => {
	it('removes the first category', () => {
		const el = makeTestChart();
		removeChartCategory(el, 0);
		expect(el.chartData!.categories).toStrictEqual(['Q2', 'Q3']);
		expect(el.chartData!.series[0].values).toStrictEqual([200, 300]);
		expect(el.chartData!.series[1].values).toStrictEqual([160, 240]);
	});

	it('removes the last category', () => {
		const el = makeTestChart();
		removeChartCategory(el, 2);
		expect(el.chartData!.categories).toStrictEqual(['Q1', 'Q2']);
		expect(el.chartData!.series[0].values).toStrictEqual([100, 200]);
	});

	it('removes a middle category', () => {
		const el = makeTestChart();
		removeChartCategory(el, 1);
		expect(el.chartData!.categories).toStrictEqual(['Q1', 'Q3']);
		expect(el.chartData!.series[0].values).toStrictEqual([100, 300]);
	});

	it('throws RangeError for negative index', () => {
		const el = makeTestChart();
		expect(() => removeChartCategory(el, -1)).toThrow(RangeError);
	});

	it('throws RangeError for index equal to category count', () => {
		const el = makeTestChart();
		expect(() => removeChartCategory(el, 3)).toThrow(RangeError);
	});

	it('throws RangeError for index beyond category count', () => {
		const el = makeTestChart();
		expect(() => removeChartCategory(el, 100)).toThrow(RangeError);
	});

	it('throws when chartData is missing', () => {
		const el = makeEmptyChart();
		expect(() => removeChartCategory(el, 0)).toThrow(/no chartData/u);
	});

	it('can remove all categories one by one', () => {
		const el = makeTestChart();
		removeChartCategory(el, 2);
		removeChartCategory(el, 1);
		removeChartCategory(el, 0);
		expect(el.chartData!.categories).toHaveLength(0);
		expect(el.chartData!.series[0].values).toHaveLength(0);
	});
});

// ===========================================================================
// Combined: new + existing operations
// ===========================================================================

describe('combined with new operations', () => {
	it('add category then update the new data point', () => {
		const el = makeTestChart();
		addChartCategory(el, 'Q4');
		updateChartDataPoint(el, 0, 3, 400);
		expect(el.chartData!.series[0].values).toStrictEqual([100, 200, 300, 400]);
	});

	it('remove category then verify remaining data integrity', () => {
		const el = makeTestChart();
		removeChartCategory(el, 0); // remove Q1
		expect(el.chartData!.categories).toStrictEqual(['Q2', 'Q3']);
		updateChartDataPoint(el, 0, 0, 999); // Q2 position is now [0]
		expect(el.chartData!.series[0].values[0]).toBe(999);
	});

	it('full workflow: add series, add category, update point, remove', () => {
		const el = makeTestChart();
		addChartSeries(el, { name: 'Extra', values: [10, 20, 30] });
		addChartCategory(el, 'Q4');
		updateChartDataPoint(el, 2, 3, 40); // Extra series, Q4
		expect(el.chartData!.series[2].values).toStrictEqual([10, 20, 30, 40]);

		removeChartCategory(el, 0); // remove Q1
		expect(el.chartData!.categories).toStrictEqual(['Q2', 'Q3', 'Q4']);
		expect(el.chartData!.series[2].values).toStrictEqual([20, 30, 40]);

		removeChartSeries(el, 2);
		expect(el.chartData!.series).toHaveLength(2);
	});
});

// ===========================================================================
// setChartSeriesColor
// ===========================================================================

describe('setChartSeriesColor', () => {
	it('sets a series colour from a #-prefixed hex', () => {
		const el = makeTestChart();
		setChartSeriesColor(el, 0, '#FF0000');
		expect(el.chartData?.series[0].color).toBe('#FF0000');
	});

	it('normalises a bare hex by prefixing #', () => {
		const el = makeTestChart();
		setChartSeriesColor(el, 1, '00FF00');
		expect(el.chartData?.series[1].color).toBe('#00FF00');
	});

	it('trims surrounding whitespace before normalising', () => {
		const el = makeTestChart();
		setChartSeriesColor(el, 0, '  #123456  ');
		expect(el.chartData?.series[0].color).toBe('#123456');
	});

	it('clears the colour when passed null', () => {
		const el = makeTestChart();
		setChartSeriesColor(el, 0, null);
		expect(el.chartData?.series[0].color).toBeUndefined();
	});

	it('clears the colour when passed undefined', () => {
		const el = makeTestChart();
		setChartSeriesColor(el, 0, undefined);
		expect(el.chartData?.series[0].color).toBeUndefined();
	});

	it('only affects the targeted series', () => {
		const el = makeTestChart();
		const otherBefore = el.chartData!.series[1].color;
		setChartSeriesColor(el, 0, '#ABCDEF');
		expect(el.chartData?.series[1].color).toBe(otherBefore);
	});

	it('throws RangeError for an out-of-range series index', () => {
		const el = makeTestChart();
		expect(() => setChartSeriesColor(el, 9, '#FFFFFF')).toThrow(RangeError);
		expect(() => setChartSeriesColor(el, -1, '#FFFFFF')).toThrow(RangeError);
	});

	it('throws when chartData is missing', () => {
		const el = makeEmptyChart();
		expect(() => setChartSeriesColor(el, 0, '#FFFFFF')).toThrow(/no chartData/u);
	});
});

// ===========================================================================
// setChartLegend
// ===========================================================================

describe('setChartLegend', () => {
	it('shows the legend', () => {
		const el = makeTestChart();
		setChartLegend(el, { show: true });
		expect(el.chartData?.style?.hasLegend).toBeTruthy();
	});

	it('hides the legend', () => {
		const el = makeTestChart();
		setChartLegend(el, { show: false });
		expect(el.chartData?.style?.hasLegend).toBeFalsy();
	});

	it('sets the legend position', () => {
		const el = makeTestChart();
		setChartLegend(el, { position: 'r' });
		expect(el.chartData?.style?.legendPosition).toBe('r');
	});

	it('turns the legend on when a position is set without an explicit show', () => {
		const el = makeTestChart();
		setChartLegend(el, { position: 't' });
		expect(el.chartData?.style?.hasLegend).toBeTruthy();
		expect(el.chartData?.style?.legendPosition).toBe('t');
	});

	it('does not override an explicit show=false when a position is given', () => {
		const el = makeTestChart();
		setChartLegend(el, { show: false, position: 'b' });
		expect(el.chartData?.style?.hasLegend).toBeFalsy();
		expect(el.chartData?.style?.legendPosition).toBe('b');
	});

	it('initialises style when absent', () => {
		const el = makeTestChart();
		delete el.chartData!.style;
		setChartLegend(el, { show: true, position: 'l' });
		expect(el.chartData?.style).toStrictEqual({ hasLegend: true, legendPosition: 'l' });
	});

	it('preserves other style fields', () => {
		const el = makeTestChart();
		el.chartData!.style = { hasTitle: true, hasGridlines: true };
		setChartLegend(el, { show: true, position: 'tr' });
		expect(el.chartData?.style).toStrictEqual({
			hasTitle: true,
			hasGridlines: true,
			hasLegend: true,
			legendPosition: 'tr',
		});
	});

	it('throws when chartData is missing', () => {
		const el = makeEmptyChart();
		expect(() => setChartLegend(el, { show: true })).toThrow(/no chartData/u);
	});
});

// ===========================================================================
// setChartAxis
// ===========================================================================

describe('setChartAxis', () => {
	it('creates the axes array and a value axis entry when none exists', () => {
		const el = makeTestChart();
		setChartAxis(el, 'valAx', { min: 0, max: 100 });
		const axis = el.chartData?.axes?.find((a) => a.axisType === 'valAx');
		expect(axis).toBeDefined();
		expect(axis?.min).toBe(0);
		expect(axis?.max).toBe(100);
	});

	it('updates an existing axis in place, preserving its id and other fields', () => {
		const el = makeTestChart();
		el.chartData!.axes = [{ axisType: 'valAx', axisId: 111, majorUnit: 5 }];
		setChartAxis(el, 'valAx', { min: 10 });
		const axis = el.chartData?.axes?.[0];
		expect(axis?.axisId).toBe(111);
		expect(axis?.majorUnit).toBe(5);
		expect(axis?.min).toBe(10);
	});

	it('sets major and minor units', () => {
		const el = makeTestChart();
		setChartAxis(el, 'valAx', { majorUnit: 20, minorUnit: 4 });
		const axis = el.chartData?.axes?.find((a) => a.axisType === 'valAx');
		expect(axis?.majorUnit).toBe(20);
		expect(axis?.minorUnit).toBe(4);
	});

	it('sets and clears the axis orientation', () => {
		const el = makeTestChart();
		setChartAxis(el, 'valAx', { orientation: 'maxMin' });
		expect(el.chartData?.axes?.[0].orientation).toBe('maxMin');
		setChartAxis(el, 'valAx', { orientation: null });
		expect(el.chartData?.axes?.[0].orientation).toBeUndefined();
	});

	it('clears a numeric field when passed null', () => {
		const el = makeTestChart();
		el.chartData!.axes = [{ axisType: 'valAx', min: 5, max: 50 }];
		setChartAxis(el, 'valAx', { min: null });
		const axis = el.chartData?.axes?.[0];
		expect(axis?.min).toBeUndefined();
		expect(axis?.max).toBe(50);
	});

	it('sets the number format from a format code', () => {
		const el = makeTestChart();
		setChartAxis(el, 'valAx', { numberFormat: '0.00%' });
		const axis = el.chartData?.axes?.find((a) => a.axisType === 'valAx');
		expect(axis?.numFmt).toStrictEqual({ formatCode: '0.00%', sourceLinked: false });
	});

	it('clears the number format when passed an empty string', () => {
		const el = makeTestChart();
		el.chartData!.axes = [{ axisType: 'valAx', numFmt: { formatCode: '0.00' } }];
		setChartAxis(el, 'valAx', { numberFormat: '' });
		expect(el.chartData?.axes?.[0].numFmt).toBeUndefined();
	});

	it('sets the tick label position', () => {
		const el = makeTestChart();
		setChartAxis(el, 'catAx', { tickLabelPosition: 'low' });
		const axis = el.chartData?.axes?.find((a) => a.axisType === 'catAx');
		expect(axis?.tickLblPos).toBe('low');
	});

	it('sets the axis title', () => {
		const el = makeTestChart();
		setChartAxis(el, 'valAx', { title: 'Revenue' });
		expect(el.chartData?.axes?.find((a) => a.axisType === 'valAx')?.titleText).toBe('Revenue');
	});

	it('clears the axis title to an empty string when passed null', () => {
		const el = makeTestChart();
		el.chartData!.axes = [{ axisType: 'valAx', titleText: 'Revenue' }];
		setChartAxis(el, 'valAx', { title: null });
		expect(el.chartData?.axes?.[0].titleText).toBe('');
	});

	it('toggles major and minor gridlines', () => {
		const el = makeTestChart();
		setChartAxis(el, 'valAx', { majorGridlines: true, minorGridlines: false });
		const axis = el.chartData?.axes?.find((a) => a.axisType === 'valAx');
		expect(axis?.majorGridlines).toBeTruthy();
		expect(axis?.minorGridlines).toBeFalsy();
	});

	it('sets and clears display units', () => {
		const el = makeTestChart();
		setChartAxis(el, 'valAx', { displayUnits: 'thousands' });
		expect(el.chartData?.axes?.find((a) => a.axisType === 'valAx')?.displayUnits).toBe('thousands');
		setChartAxis(el, 'valAx', { displayUnits: null });
		expect(el.chartData?.axes?.find((a) => a.axisType === 'valAx')?.displayUnits).toBeUndefined();
	});

	it('sets typed display-unit label contents', () => {
		const el = makeTestChart();
		setChartAxis(el, 'valAx', {
			displayUnits: 'millions',
			displayUnitsLabel: { text: 'M', layout: { x: 0.2 }, spPr: { fillColor: '#123456' } },
		});
		expect(
			el.chartData?.axes?.find((a) => a.axisType === 'valAx')?.displayUnitsLabel,
		).toStrictEqual({
			text: 'M',
			layout: { x: 0.2 },
			spPr: { fillColor: '#123456' },
		});
	});

	it('leaves unspecified fields unchanged', () => {
		const el = makeTestChart();
		el.chartData!.axes = [{ axisType: 'valAx', min: 1, max: 9, majorUnit: 2 }];
		setChartAxis(el, 'valAx', { max: 12 });
		const axis = el.chartData?.axes?.[0];
		expect(axis?.min).toBe(1);
		expect(axis?.max).toBe(12);
		expect(axis?.majorUnit).toBe(2);
	});

	it('keeps value and category axes independent', () => {
		const el = makeTestChart();
		setChartAxis(el, 'valAx', { min: 0 });
		setChartAxis(el, 'catAx', { tickLabelPosition: 'none' });
		expect(el.chartData?.axes).toHaveLength(2);
		expect(el.chartData?.axes?.find((a) => a.axisType === 'valAx')?.min).toBe(0);
		expect(el.chartData?.axes?.find((a) => a.axisType === 'catAx')?.tickLblPos).toBe('none');
	});

	it('throws when chartData is missing', () => {
		const el = makeEmptyChart();
		expect(() => setChartAxis(el, 'valAx', { min: 0 })).toThrow(/no chartData/u);
	});
});

// ===========================================================================
// setChartDataLabels
// ===========================================================================

describe('setChartDataLabels', () => {
	it('shows data labels', () => {
		const el = makeTestChart();
		setChartDataLabels(el, { show: true });
		expect(el.chartData?.style?.hasDataLabels).toBeTruthy();
	});

	it('hides data labels', () => {
		const el = makeTestChart();
		setChartDataLabels(el, { show: false });
		expect(el.chartData?.style?.hasDataLabels).toBeFalsy();
	});

	it('sets content flags', () => {
		const el = makeTestChart();
		setChartDataLabels(el, { showValue: true, showPercent: true });
		expect(el.chartData?.style?.dataLabels).toStrictEqual({
			showValue: true,
			showPercent: true,
		});
	});

	it('turns labels on when a content flag is set without an explicit show', () => {
		const el = makeTestChart();
		setChartDataLabels(el, { showCategory: true });
		expect(el.chartData?.style?.hasDataLabels).toBeTruthy();
	});

	it('sets the label position', () => {
		const el = makeTestChart();
		setChartDataLabels(el, { show: true, position: 'outEnd' });
		expect(el.chartData?.style?.dataLabels?.position).toBe('outEnd');
	});

	it('clears the position when passed undefined-like empty', () => {
		const el = makeTestChart();
		setChartDataLabels(el, { position: 'ctr' });
		setChartDataLabels(el, { position: undefined });
		// position untouched (undefined leaves it unchanged)
		expect(el.chartData?.style?.dataLabels?.position).toBe('ctr');
	});

	it('merges content edits without dropping prior flags', () => {
		const el = makeTestChart();
		setChartDataLabels(el, { showValue: true });
		setChartDataLabels(el, { showCategory: true });
		expect(el.chartData?.style?.dataLabels).toStrictEqual({
			showValue: true,
			showCategory: true,
		});
	});

	it('preserves other style fields', () => {
		const el = makeTestChart();
		el.chartData!.style = { hasLegend: true, legendPosition: 'r' };
		setChartDataLabels(el, { show: true, showValue: true });
		expect(el.chartData?.style?.hasLegend).toBeTruthy();
		expect(el.chartData?.style?.legendPosition).toBe('r');
		expect(el.chartData?.style?.hasDataLabels).toBeTruthy();
	});

	it('throws when chartData is missing', () => {
		const el = makeEmptyChart();
		expect(() => setChartDataLabels(el, { show: true })).toThrow(/no chartData/u);
	});
});

// ===========================================================================
// setChartSeriesTrendline
// ===========================================================================

describe('setChartSeriesTrendline', () => {
	it('adds a trendline to a series', () => {
		const el = makeTestChart();
		setChartSeriesTrendline(el, 0, { trendlineType: 'linear' });
		expect(el.chartData?.series[0].trendlines).toStrictEqual([{ trendlineType: 'linear' }]);
	});

	it('replaces an existing trendline', () => {
		const el = makeTestChart();
		setChartSeriesTrendline(el, 0, { trendlineType: 'linear' });
		setChartSeriesTrendline(el, 0, { trendlineType: 'movingAvg', period: 3 });
		expect(el.chartData?.series[0].trendlines).toStrictEqual([
			{ trendlineType: 'movingAvg', period: 3 },
		]);
	});

	it('removes the trendline when passed null', () => {
		const el = makeTestChart();
		setChartSeriesTrendline(el, 0, { trendlineType: 'linear' });
		setChartSeriesTrendline(el, 0, null);
		expect(el.chartData?.series[0].trendlines).toStrictEqual([]);
	});

	it('only affects the targeted series', () => {
		const el = makeTestChart();
		setChartSeriesTrendline(el, 1, { trendlineType: 'power' });
		expect(el.chartData?.series[0].trendlines).toBeUndefined();
		expect(el.chartData?.series[1].trendlines).toStrictEqual([{ trendlineType: 'power' }]);
	});

	it('throws RangeError for an out-of-range series index', () => {
		const el = makeTestChart();
		expect(() => setChartSeriesTrendline(el, 9, { trendlineType: 'linear' })).toThrow(RangeError);
	});

	it('throws when chartData is missing', () => {
		const el = makeEmptyChart();
		expect(() => setChartSeriesTrendline(el, 0, { trendlineType: 'linear' })).toThrow(
			/no chartData/u,
		);
	});
});

// ===========================================================================
// setChartSeriesErrorBars
// ===========================================================================

describe('setChartSeriesErrorBars', () => {
	it('adds error bars to a series', () => {
		const el = makeTestChart();
		setChartSeriesErrorBars(el, 0, {
			direction: 'y',
			barType: 'both',
			valType: 'percentage',
			val: 5,
		});
		expect(el.chartData?.series[0].errBars).toStrictEqual([
			{ direction: 'y', barType: 'both', valType: 'percentage', val: 5 },
		]);
	});

	it('replaces existing error bars', () => {
		const el = makeTestChart();
		setChartSeriesErrorBars(el, 0, {
			direction: 'y',
			barType: 'both',
			valType: 'fixedVal',
			val: 1,
		});
		setChartSeriesErrorBars(el, 0, { direction: 'y', barType: 'plus', valType: 'stdErr' });
		expect(el.chartData?.series[0].errBars).toStrictEqual([
			{ direction: 'y', barType: 'plus', valType: 'stdErr' },
		]);
	});

	it('removes error bars when passed null', () => {
		const el = makeTestChart();
		setChartSeriesErrorBars(el, 0, {
			direction: 'y',
			barType: 'both',
			valType: 'fixedVal',
			val: 1,
		});
		setChartSeriesErrorBars(el, 0, null);
		expect(el.chartData?.series[0].errBars).toStrictEqual([]);
	});

	it('only affects the targeted series', () => {
		const el = makeTestChart();
		setChartSeriesErrorBars(el, 1, { direction: 'y', barType: 'both', valType: 'stdDev', val: 2 });
		expect(el.chartData?.series[0].errBars).toBeUndefined();
		expect(el.chartData?.series[1].errBars).toHaveLength(1);
	});

	it('throws RangeError for an out-of-range series index', () => {
		const el = makeTestChart();
		expect(() =>
			setChartSeriesErrorBars(el, 9, {
				direction: 'y',
				barType: 'both',
				valType: 'fixedVal',
				val: 1,
			}),
		).toThrow(RangeError);
	});

	it('throws when chartData is missing', () => {
		const el = makeEmptyChart();
		expect(() =>
			setChartSeriesErrorBars(el, 0, {
				direction: 'y',
				barType: 'both',
				valType: 'fixedVal',
				val: 1,
			}),
		).toThrow(/no chartData/u);
	});
});

// ===========================================================================
// setChartAxisLogScale
// ===========================================================================

describe('setChartAxisLogScale', () => {
	it('enables log scale with default base 10', () => {
		const el = makeTestChart();
		setChartAxisLogScale(el, 'valAx', { enabled: true });
		const axis = el.chartData?.axes?.find((a) => a.axisType === 'valAx');
		expect(axis?.logScale).toBeTruthy();
		expect(axis?.logBase).toBe(10);
	});

	it('enables log scale with explicit base', () => {
		const el = makeTestChart();
		setChartAxisLogScale(el, 'valAx', { enabled: true, base: 2 });
		const axis = el.chartData?.axes?.find((a) => a.axisType === 'valAx');
		expect(axis?.logBase).toBe(2);
	});

	it('disabling clears the log base', () => {
		const el = makeTestChart();
		setChartAxisLogScale(el, 'valAx', { enabled: true, base: 10 });
		setChartAxisLogScale(el, 'valAx', { enabled: false });
		const axis = el.chartData?.axes?.find((a) => a.axisType === 'valAx');
		expect(axis?.logScale).toBeFalsy();
		expect(axis?.logBase).toBeUndefined();
	});

	it('creates the axis entry when missing', () => {
		const el = makeTestChart();
		el.chartData!.axes = undefined;
		setChartAxisLogScale(el, 'valAx', { enabled: true });
		expect(el.chartData?.axes?.length).toBe(1);
	});
});

// ===========================================================================
// setChartAxisTitleStyle
// ===========================================================================

describe('setChartAxisTitleStyle', () => {
	it('sets font family, size, bold, colour', () => {
		const el = makeTestChart();
		setChartAxisTitleStyle(el, 'valAx', {
			fontFamily: 'Calibri',
			fontSize: 12,
			fontBold: true,
			fontColor: '#FF0000',
		});
		const axis = el.chartData?.axes?.find((a) => a.axisType === 'valAx');
		expect(axis?.fontFamily).toBe('Calibri');
		expect(axis?.fontSize).toBe(12);
		expect(axis?.fontBold).toBeTruthy();
		expect(axis?.fontColor).toBe('#FF0000');
	});

	it('clears fields with null', () => {
		const el = makeTestChart();
		setChartAxisTitleStyle(el, 'valAx', { fontFamily: 'Arial', fontSize: 10 });
		setChartAxisTitleStyle(el, 'valAx', { fontFamily: null, fontSize: null });
		const axis = el.chartData?.axes?.find((a) => a.axisType === 'valAx');
		expect(axis?.fontFamily).toBeUndefined();
		expect(axis?.fontSize).toBeUndefined();
	});
});

// ===========================================================================
// setChartAxisGridlineStyle
// ===========================================================================

describe('setChartAxisGridlineStyle', () => {
	it('sets major gridline colour/width/dash and turns gridlines on', () => {
		const el = makeTestChart();
		setChartAxisGridlineStyle(el, 'valAx', 'major', {
			color: '#CCCCCC',
			width: 0.75,
			dashStyle: 'dash',
		});
		const axis = el.chartData?.axes?.find((a) => a.axisType === 'valAx');
		expect(axis?.majorGridlines).toBeTruthy();
		expect(axis?.majorGridlinesSpPr?.strokeColor).toBe('#CCCCCC');
		expect(axis?.majorGridlinesSpPr?.strokeWidth).toBe(0.75);
		expect(axis?.majorGridlinesSpPr?.strokeDashStyle).toBe('dash');
	});

	it('targets minor gridlines independently', () => {
		const el = makeTestChart();
		setChartAxisGridlineStyle(el, 'valAx', 'minor', { color: '#EEEEEE' });
		const axis = el.chartData?.axes?.find((a) => a.axisType === 'valAx');
		expect(axis?.minorGridlinesSpPr?.strokeColor).toBe('#EEEEEE');
		expect(axis?.majorGridlinesSpPr).toBeUndefined();
	});

	it('clears style when all props nulled', () => {
		const el = makeTestChart();
		setChartAxisGridlineStyle(el, 'valAx', 'major', { color: '#CCCCCC' });
		setChartAxisGridlineStyle(el, 'valAx', 'major', { color: null });
		const axis = el.chartData?.axes?.find((a) => a.axisType === 'valAx');
		expect(axis?.majorGridlinesSpPr).toBeUndefined();
	});
});

// ===========================================================================
// setChartSeriesMarker
// ===========================================================================

describe('setChartSeriesMarker', () => {
	it('sets a marker from a partial patch', () => {
		const el = makeTestChart({ chartType: 'line' });
		setChartSeriesMarker(el, 0, { symbol: 'circle', size: 7, fillColor: '#FF0000' });
		const m = el.chartData?.series[0].marker;
		expect(m?.symbol).toBe('circle');
		expect(m?.size).toBe(7);
		expect(m?.spPr?.fillColor).toBe('#FF0000');
	});

	it('merges into an existing marker', () => {
		const el = makeTestChart({ chartType: 'line' });
		setChartSeriesMarker(el, 0, { symbol: 'square', size: 5 });
		setChartSeriesMarker(el, 0, { fillColor: '#00FF00' });
		const m = el.chartData?.series[0].marker;
		expect(m?.symbol).toBe('square');
		expect(m?.size).toBe(5);
		expect(m?.spPr?.fillColor).toBe('#00FF00');
	});

	it('removes the marker with null', () => {
		const el = makeTestChart({ chartType: 'line' });
		setChartSeriesMarker(el, 0, { symbol: 'diamond' });
		setChartSeriesMarker(el, 0, null);
		expect(el.chartData?.series[0].marker).toBeUndefined();
	});

	it('throws on out-of-range series index', () => {
		const el = makeTestChart();
		expect(() => setChartSeriesMarker(el, 99, { symbol: 'circle' })).toThrow(RangeError);
	});
});

// ===========================================================================
// setChartSeriesChartType
// ===========================================================================

describe('setChartSeriesChartType', () => {
	it('sets a per-series type and promotes chart to combo', () => {
		const el = makeTestChart({ chartType: 'bar' });
		setChartSeriesChartType(el, 1, 'line');
		expect(el.chartData?.series[1].seriesChartType).toBe('line');
		expect(el.chartData?.chartType).toBe('combo');
	});

	it('does not promote to combo when all effective types match', () => {
		const el = makeTestChart({ chartType: 'bar' });
		setChartSeriesChartType(el, 0, 'bar');
		expect(el.chartData?.chartType).toBe('bar');
	});

	it('clears per-series type with null', () => {
		const el = makeTestChart({ chartType: 'bar' });
		setChartSeriesChartType(el, 1, 'line');
		setChartSeriesChartType(el, 1, null);
		expect(el.chartData?.series[1].seriesChartType).toBeUndefined();
	});
});

// ===========================================================================
// setChartDataPointFill / setChartDataPointExplosion
// ===========================================================================

describe('setChartDataPointFill', () => {
	it('sets a per-point fill colour', () => {
		const el = makeTestChart({ chartType: 'pie' });
		setChartDataPointFill(el, 0, 2, '#123456');
		const dp = el.chartData?.series[0].dataPoints?.find((p) => p.idx === 2);
		expect(dp?.spPr?.fillColor).toBe('#123456');
	});

	it('removes the point override when fill is cleared and nothing else set', () => {
		const el = makeTestChart({ chartType: 'pie' });
		setChartDataPointFill(el, 0, 2, '#123456');
		setChartDataPointFill(el, 0, 2, null);
		expect(el.chartData?.series[0].dataPoints).toBeUndefined();
	});

	it('keeps the override when explosion is also set', () => {
		const el = makeTestChart({ chartType: 'pie' });
		setChartDataPointFill(el, 0, 1, '#123456');
		setChartDataPointExplosion(el, 0, 1, 25);
		setChartDataPointFill(el, 0, 1, null);
		const dp = el.chartData?.series[0].dataPoints?.find((p) => p.idx === 1);
		expect(dp?.explosion).toBe(25);
		expect(dp?.spPr).toBeUndefined();
	});
});

describe('setChartDataPointExplosion', () => {
	it('sets and clears pie slice explosion', () => {
		const el = makeTestChart({ chartType: 'pie' });
		setChartDataPointExplosion(el, 0, 0, 30);
		expect(el.chartData?.series[0].dataPoints?.[0].explosion).toBe(30);
		setChartDataPointExplosion(el, 0, 0, null);
		expect(el.chartData?.series[0].dataPoints).toBeUndefined();
	});

	it('keeps points sorted by idx', () => {
		const el = makeTestChart({ chartType: 'pie' });
		setChartDataPointExplosion(el, 0, 2, 10);
		setChartDataPointExplosion(el, 0, 0, 20);
		const idxs = el.chartData?.series[0].dataPoints?.map((p) => p.idx);
		expect(idxs).toStrictEqual([0, 2]);
	});
});

describe('setChartDataPointLabel', () => {
	it('adds a per-point label override for a series', () => {
		const chart = makeTestChart();
		setChartDataPointLabel(chart, 0, 2, { showValue: true, position: 'outEnd' });
		const labels = chart.chartData!.series[0].dataLabels;
		expect(labels).toHaveLength(1);
		expect(labels![0]).toMatchObject({ idx: 2, showVal: true, position: 'outEnd' });
	});

	it('merges into an existing override for the same point', () => {
		const chart = makeTestChart();
		setChartDataPointLabel(chart, 0, 1, { showValue: true });
		setChartDataPointLabel(chart, 0, 1, { showCategory: true, text: 'Hi' });
		const labels = chart.chartData!.series[0].dataLabels!;
		expect(labels).toHaveLength(1);
		expect(labels[0]).toMatchObject({ idx: 1, showVal: true, showCatName: true, text: 'Hi' });
	});

	it('keeps overrides sorted by idx', () => {
		const chart = makeTestChart();
		setChartDataPointLabel(chart, 0, 2, { showValue: true });
		setChartDataPointLabel(chart, 0, 0, { showValue: true });
		expect(chart.chartData!.series[0].dataLabels!.map((l) => l.idx)).toStrictEqual([0, 2]);
	});

	it('clears empty text back to undefined', () => {
		const chart = makeTestChart();
		setChartDataPointLabel(chart, 0, 0, { text: 'X' });
		setChartDataPointLabel(chart, 0, 0, { text: '' });
		expect(chart.chartData!.series[0].dataLabels![0].text).toBeUndefined();
	});

	it('removes the override when passed null', () => {
		const chart = makeTestChart();
		setChartDataPointLabel(chart, 0, 1, { showValue: true });
		setChartDataPointLabel(chart, 0, 1, null);
		expect(chart.chartData!.series[0].dataLabels).toBeUndefined();
	});

	it('removing one of several overrides keeps the rest', () => {
		const chart = makeTestChart();
		setChartDataPointLabel(chart, 0, 0, { showValue: true });
		setChartDataPointLabel(chart, 0, 1, { showValue: true });
		setChartDataPointLabel(chart, 0, 0, null);
		expect(chart.chartData!.series[0].dataLabels!.map((l) => l.idx)).toStrictEqual([1]);
	});

	it('throws RangeError for an out-of-range series index', () => {
		const chart = makeTestChart();
		expect(() => setChartDataPointLabel(chart, 9, 0, { showValue: true })).toThrow(RangeError);
	});
});
