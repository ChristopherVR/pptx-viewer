/**
 * Scatter / bubble regressions: the three places the engine used to guess
 * instead of reading the OOXML data model.
 *
 *  - `c:scatterStyle` was never parsed and `buildScatter` never drew a line, so
 *    a "Scatter with Straight Lines" deck lost its lines - and because
 *    PowerPoint writes those series as `c:symbol val="none"`, the series
 *    vanished entirely.
 *  - `c:xVal` is per series, but only the first series' x values (via the
 *    chart-level category list) reached the plot.
 *  - `c:bubbleSize` is per series, but radii came from "the third series", which
 *    also removed series 3+ from the plot.
 */
import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildBubbles } from './chart-cartesian-bubbles';
import { buildScatter } from './chart-cartesian-plots';
import { buildChartViewModel } from './chart-view-model';
import type { PlotLayout, ValueRange } from './chart-view-model';

const layout: PlotLayout = {
	svgWidth: 400,
	svgHeight: 300,
	plotLeft: 40,
	plotTop: 20,
	plotRight: 380,
	plotBottom: 260,
	plotWidth: 340,
	plotHeight: 240,
};
const range: ValueRange = { min: 0, max: 20, span: 20 };

function scatterChart(overrides: Partial<PptxChartData> = {}): PptxChartData {
	return {
		chartType: 'scatter',
		categories: [],
		series: [
			{
				name: 'Rise',
				values: [1, 4, 9, 16],
				xValues: [0, 5, 10, 15],
				marker: { symbol: 'none' },
			},
		],
		...overrides,
	};
}

describe('buildScatter c:scatterStyle', () => {
	it('draws nothing for a marker-suppressed series when the style is marker-only', () => {
		const result = buildScatter(scatterChart({ scatterStyle: 'marker' }), layout, range);
		expect(result.primitives).toHaveLength(0);
	});

	it('draws a connecting polyline for lineMarker (PowerPoint’s own default)', () => {
		const result = buildScatter(scatterChart({ scatterStyle: 'lineMarker' }), layout, range);
		const lines = result.primitives.filter((p) => p.kind === 'polyline');
		expect(lines).toHaveLength(1);
		expect(lines[0].points.split(' ')).toHaveLength(4);
	});

	it('draws a bezier path for smoothMarker', () => {
		const result = buildScatter(scatterChart({ scatterStyle: 'smoothMarker' }), layout, range);
		expect(result.primitives.filter((p) => p.kind === 'path')).toHaveLength(1);
		expect(result.primitives.filter((p) => p.kind === 'polyline')).toHaveLength(0);
	});

	it('respects an a:ln/a:noFill on the series over the chart style', () => {
		const data = scatterChart({ scatterStyle: 'lineMarker' });
		data.series[0].lineNoFill = true;
		expect(buildScatter(data, layout, range).primitives).toHaveLength(0);
	});
});

describe('buildScatter per-series c:xVal', () => {
	it('plots each series against its OWN x values on a shared domain', () => {
		const data: PptxChartData = {
			chartType: 'scatter',
			categories: [],
			scatterStyle: 'marker',
			series: [
				{ name: 'Left', values: [1, 2], xValues: [0, 10], marker: { symbol: 'circle' } },
				{ name: 'Right', values: [3, 4], xValues: [10, 20], marker: { symbol: 'circle' } },
			],
		};
		const dots = buildScatter(data, layout, range).primitives.filter((p) => p.kind === 'circle');
		expect(dots).toHaveLength(4);
		// Domain 0..20 across both series: Left spans the left half, Right the
		// right half. Sharing series 1's x values would have stacked them.
		expect(dots[0].cx).toBeCloseTo(layout.plotLeft, 5);
		expect(dots[1].cx).toBeCloseTo(layout.plotLeft + layout.plotWidth / 2, 5);
		expect(dots[2].cx).toBeCloseTo(layout.plotLeft + layout.plotWidth / 2, 5);
		expect(dots[3].cx).toBeCloseTo(layout.plotLeft + layout.plotWidth, 5);
	});
});

describe('buildBubbles per-series c:bubbleSize', () => {
	it('plots every series and sizes each from its own c:bubbleSize', () => {
		const data: PptxChartData = {
			chartType: 'bubble',
			categories: [],
			series: [
				{ name: 'A', values: [1, 2], xValues: [1, 2], bubbleSizes: [10, 100] },
				{ name: 'B', values: [3, 4], xValues: [1, 2], bubbleSizes: [100, 10] },
				{ name: 'C', values: [5, 6], xValues: [1, 2], bubbleSizes: [50, 50] },
			],
		};
		const circles = buildBubbles(data, layout, range).primitives.filter((p) => p.kind === 'circle');
		// Three series, not "two plus a size channel".
		expect(circles).toHaveLength(6);
		expect(circles[0].r).toBeLessThan(circles[1].r);
		expect(circles[2].r).toBeGreaterThan(circles[3].r);
		// One chart-wide scale keeps series comparable.
		expect(circles[1].r).toBeCloseTo(circles[2].r, 5);
	});

	it('sizes a SINGLE-series bubble chart from its own sizes', () => {
		const data: PptxChartData = {
			chartType: 'bubble',
			categories: [],
			series: [{ name: 'Only', values: [1, 2, 3], xValues: [1, 2, 3], bubbleSizes: [1, 5, 20] }],
		};
		const circles = buildBubbles(data, layout, range).primitives.filter((p) => p.kind === 'circle');
		expect(circles).toHaveLength(3);
		expect(circles[0].r).toBeLessThan(circles[1].r);
		expect(circles[1].r).toBeLessThan(circles[2].r);
	});
});

describe('blank category alignment', () => {
	// The parse-side half of this (c:strCache sparse by @idx) is pinned against
	// PowerPoint output in core's chart-data-fidelity.test.ts. Here we only need
	// the plot to size itself from the FULL category list, blank slot included.
	it('plots every value when a category label is blank', () => {
		const withBlank = {
			id: 'el-blank',
			type: 'chart',
			x: 0,
			y: 0,
			width: 480,
			height: 320,
			chartData: {
				chartType: 'bar',
				categories: ['North', 'South', '', 'East', 'West'],
				series: [{ name: 'Units', values: [12, 25, 7, 31, 18] }],
			},
		} satisfies PptxElement;
		// What the dense (pre-fix) category extraction produced from the same deck.
		const collapsed = {
			...withBlank,
			id: 'el-collapsed',
			chartData: {
				...withBlank.chartData,
				categories: ['North', 'South', 'East', 'West'],
			},
		} satisfies PptxElement;
		expect(buildChartViewModel(withBlank).primitives.filter((p) => p.kind === 'rect')).toHaveLength(
			5,
		);
		// Documents the damage the collapse did: the fifth point is not drawn.
		expect(buildChartViewModel(collapsed).primitives.filter((p) => p.kind === 'rect')).toHaveLength(
			4,
		);
	});
});
