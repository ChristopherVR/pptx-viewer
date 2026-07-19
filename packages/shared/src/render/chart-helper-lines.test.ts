/**
 * Regression tests for shared drop-line / hi-low-line / up-down-bar primitives
 * (#88). These previously rendered only in the React chrome (drop/hi-low) or
 * nowhere at all (up-down bars); the shared builders make every binding draw
 * them.
 */
import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	computeDropLinePrimitives,
	computeHiLowLinePrimitives,
	computeUpDownBarPrimitives,
} from './chart-helper-lines';
import { buildChartViewModel } from './chart-view-model';
import type { PlotLayout, ValueRange } from './chart-view-model';

const layout: PlotLayout = {
	svgWidth: 400,
	svgHeight: 300,
	plotLeft: 40,
	plotTop: 10,
	plotRight: 390,
	plotBottom: 260,
	plotWidth: 350,
	plotHeight: 250,
};
const range: ValueRange = { min: 0, max: 100, span: 100 };

const twoSeries: PptxChartData = {
	chartType: 'line',
	categories: ['A', 'B', 'C'],
	series: [
		{ name: 'Low', values: [10, 20, 30] },
		{ name: 'High', values: [60, 50, 80] },
	],
};

describe('computeDropLinePrimitives (#88)', () => {
	it('returns nothing when c:dropLines is absent', () => {
		expect(computeDropLinePrimitives(twoSeries, layout, range, 3, { mode: 'line' })).toHaveLength(
			0,
		);
	});

	it('draws a vertical line per data point down to the baseline', () => {
		const data: PptxChartData = { ...twoSeries, dropLines: { color: '#abc' } };
		const lines = computeDropLinePrimitives(data, layout, range, 3, { mode: 'line' });
		expect(lines).toHaveLength(6); // 2 series x 3 points
		expect(lines[0].x1).toBe(lines[0].x2); // vertical
		expect(lines[0].y2).toBeCloseTo(layout.plotBottom); // baseline at range.min
		expect(lines[0].stroke).toBe('#abc');
	});
});

describe('computeHiLowLinePrimitives (#88)', () => {
	it('requires at least two series', () => {
		const single: PptxChartData = {
			...twoSeries,
			series: [twoSeries.series[0]],
			hiLowLines: {},
		};
		expect(computeHiLowLinePrimitives(single, layout, range, 3, { mode: 'line' })).toHaveLength(0);
	});

	it('spans the high and low value per category', () => {
		const data: PptxChartData = { ...twoSeries, hiLowLines: { color: '#111' } };
		const lines = computeHiLowLinePrimitives(data, layout, range, 3, { mode: 'line' });
		expect(lines).toHaveLength(3);
		// Category A: high 60, low 10 -> y1 above y2.
		expect(lines[0].y1).toBeLessThan(lines[0].y2);
	});
});

describe('computeUpDownBarPrimitives (#88)', () => {
	it('colours rising vs falling categories differently', () => {
		const data: PptxChartData = {
			...twoSeries,
			upDownBars: { upBars: { fillColor: '#00ff00' }, downBars: { fillColor: '#ff0000' } },
		};
		const bars = computeUpDownBarPrimitives(data, layout, range, 3, { mode: 'line' });
		expect(bars).toHaveLength(3);
		// last(High) >= first(Low) in every category -> all "up".
		expect(bars.every((b) => b.fill === '#00ff00')).toBeTruthy();
	});

	it('is drawn through the line-chart view-model', () => {
		const data: PptxChartData = {
			...twoSeries,
			hiLowLines: { color: '#111' },
		};
		const el = {
			id: 'c',
			type: 'chart',
			x: 0,
			y: 0,
			width: 400,
			height: 300,
			chartData: data,
		} as PptxElement;
		const vm = buildChartViewModel(el);
		// hi-low lines are vertical helper lines added to primitives.
		const verticalLines = vm.primitives.filter((p) => p.kind === 'line' && p.x1 === p.x2);
		expect(verticalLines.length).toBeGreaterThanOrEqual(3);
	});
});
