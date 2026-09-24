/**
 * Unit tests for chart-stock-candles.ts: the shared HLC/OHLC candle geometry
 * used by both a standalone stock chart and a volume+stock combo's price
 * series (`chart-combo-stock.ts` / `chart-combo.ts`).
 */
import type { PptxChartData, PptxChartSeries } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	computeComboStockOverlay,
	computeStockCandlePrimitives,
	findComboStockSeries,
} from './chart-stock-candles';
import type { PlotLayout } from './chart-view-model';

const LAYOUT: PlotLayout = {
	svgWidth: 400,
	svgHeight: 300,
	plotLeft: 40,
	plotTop: 20,
	plotWidth: 320,
	plotHeight: 240,
	plotBottom: 260,
	plotRight: 360,
	autoPlotHeight: 240,
};

const RANGE = { min: 0, max: 100, logScale: false as const };

function series(
	name: string,
	values: number[],
	extra: Partial<PptxChartSeries> = {},
): PptxChartSeries {
	return { name, values, ...extra };
}

describe('computeStockCandlePrimitives', () => {
	it('draws a wick plus a close tick for HLC (no open series)', () => {
		const primitives = computeStockCandlePrimitives(
			{
				high: series('High', [80]),
				low: series('Low', [20]),
				close: series('Close', [50]),
				closeIndex: 2,
			},
			{ chartType: 'stock', categories: ['D1'], series: [] } as PptxChartData,
			LAYOUT,
			RANGE,
			1,
			[0],
			undefined,
		);
		expect(primitives).toHaveLength(2);
		expect(primitives.every((p) => p.kind === 'line')).toBeTruthy();
		const tick = primitives.find((p) => p.kind === 'line' && p.x2 !== p.x1);
		expect(tick).toBeDefined();
	});

	it('draws a wick plus a candle body for OHLC (open series present)', () => {
		const primitives = computeStockCandlePrimitives(
			{
				open: series('Open', [40]),
				high: series('High', [80]),
				low: series('Low', [20]),
				close: series('Close', [60]),
				closeIndex: 3,
			},
			{ chartType: 'stock', categories: ['D1'], series: [] } as PptxChartData,
			LAYOUT,
			RANGE,
			1,
			[0],
			undefined,
		);
		expect(primitives).toHaveLength(2);
		expect(primitives.filter((p) => p.kind === 'line')).toHaveLength(1);
		expect(primitives.filter((p) => p.kind === 'rect')).toHaveLength(1);
	});

	it('uses PowerPoint default up/down fills when c:upDownBars is absent', () => {
		const primitives = computeStockCandlePrimitives(
			{
				open: series('Open', [40, 60]),
				high: series('High', [80, 80]),
				low: series('Low', [20, 20]),
				close: series('Close', [70, 30]), // point 0 up, point 1 down
				closeIndex: 3,
			},
			{ chartType: 'stock', categories: ['D1', 'D2'], series: [] } as PptxChartData,
			LAYOUT,
			RANGE,
			2,
			[0, 1],
			undefined,
		);
		const rects = primitives.filter((p) => p.kind === 'rect');
		expect(rects.map((r) => (r.kind === 'rect' ? r.fill : undefined))).toStrictEqual([
			'#FFFFFF',
			'#404040',
		]);
	});

	it('skips a category when high or low is undefined (blank cell)', () => {
		const primitives = computeStockCandlePrimitives(
			{
				high: series('High', [80, undefined as unknown as number]),
				low: series('Low', [20, 20]),
				close: series('Close', [50, 50]),
				closeIndex: 2,
			},
			{ chartType: 'stock', categories: ['D1', 'D2'], series: [] } as PptxChartData,
			LAYOUT,
			RANGE,
			2,
			[0, 1],
			undefined,
		);
		// Only D1 produces geometry (wick + tick); D2's missing High skips it.
		expect(primitives).toHaveLength(2);
	});
});

describe('findComboStockSeries', () => {
	it('returns only the series tagged seriesChartType: stock, in order', () => {
		const list: PptxChartSeries[] = [
			series('Volume', [1], { seriesChartType: 'bar' }),
			series('High', [2], { seriesChartType: 'stock' }),
			series('Low', [3], { seriesChartType: 'stock' }),
			series('Close', [4], { seriesChartType: 'stock' }),
		];
		const found = findComboStockSeries(list);
		expect(found.map((entry) => entry.series.name)).toStrictEqual(['High', 'Low', 'Close']);
		expect(found.map((entry) => entry.index)).toStrictEqual([1, 2, 3]);
	});

	it('returns an empty array when no series is tagged stock', () => {
		const list: PptxChartSeries[] = [series('Revenue', [1]), series('Margin', [2])];
		expect(findComboStockSeries(list)).toHaveLength(0);
	});
});

describe('computeComboStockOverlay', () => {
	it('returns nothing for fewer than 3 stock series', () => {
		const entries = findComboStockSeries([
			series('Volume', [1], { seriesChartType: 'bar' }),
			series('High', [2], { seriesChartType: 'stock' }),
		]);
		const overlay = computeComboStockOverlay(
			entries,
			{ chartType: 'combo', categories: [], series: [] } as PptxChartData,
			LAYOUT,
			RANGE,
			1,
			[0],
			undefined,
		);
		expect(overlay.primitives).toHaveLength(0);
		expect(overlay.dataLabels).toHaveLength(0);
	});

	it('builds candle primitives from the stock-tagged subset only (HLC)', () => {
		const chartData: PptxChartData = {
			chartType: 'combo',
			categories: ['D1'],
			series: [
				series('Volume', [90], { seriesChartType: 'bar' }),
				series('High', [80], { seriesChartType: 'stock' }),
				series('Low', [20], { seriesChartType: 'stock' }),
				series('Close', [50], { seriesChartType: 'stock' }),
			],
		};
		const entries = findComboStockSeries(chartData.series);
		const overlay = computeComboStockOverlay(entries, chartData, LAYOUT, RANGE, 1, [0], undefined);
		expect(overlay.primitives).toHaveLength(2); // wick + close tick, no body
		expect(overlay.primitives.every((p) => p.kind === 'line')).toBeTruthy();
	});
});
