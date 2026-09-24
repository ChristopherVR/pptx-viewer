/**
 * Tests for chart-cartesian-bars.ts's `buildBars` clustered-bar sizing, in
 * particular the `c:gapWidth`/`c:overlap` geometry.
 *
 * COM-verified ground truth (PowerPoint Object 16, a single-category,
 * six-series `barChart` with `c:gapWidth val="5"` and `c:overlap val="23"`,
 * the real-world "hill silhouette" construct this suite's sibling fixture
 * `bar-picture-fill-hill.pptx` reproduces): the rendered cluster's width
 * (leftmost bar's left edge to rightmost bar's right edge) divided by one
 * bar's own width is `1 + (seriesCount - 1) * (1 - overlap / 100)` -
 * `1 + 5 * 0.77 = 4.85` for six series at 23% overlap - confirming `step`
 * and `clusterWidth` below were always correct. What was wrong was
 * `singleBarWidth` itself: dividing the gap-reduced group width by the raw
 * `seriesCount` sizes the cluster as if it were laid out side by side, then
 * shrinks each bar AGAIN by overlap when computing `step`, so a high-overlap
 * cluster rendered far too narrow. In the limit (`overlap: 100`), every bar
 * in a cluster should be exactly as wide as a single-series bar - the whole
 * point of 100% overlap is that they all coincide - independent of how many
 * series there are; the old formula kept shrinking by `1 / seriesCount`
 * regardless.
 */
import type { PptxChartData, PptxChartSeries } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildBars } from './chart-cartesian-bars';
import type { PlotLayout } from './chart-view-model-types';

function series(values: number[]): PptxChartSeries[] {
	return values.map((v, i) => ({ name: `Series ${i + 1}`, values: [v] }));
}

function layout(plotWidth: number): PlotLayout {
	return {
		svgWidth: plotWidth,
		svgHeight: 400,
		plotLeft: 0,
		plotTop: 0,
		plotRight: plotWidth,
		plotBottom: 300,
		plotWidth,
		plotHeight: 300,
	};
}

function barRects(chartData: PptxChartData, plotWidth: number) {
	const result = buildBars(
		chartData,
		1,
		layout(plotWidth),
		{ min: 0, max: 10, span: 10 },
		undefined,
		new Set(),
		'clustered',
		[0],
	);
	return result.primitives.filter((p) => p.kind === 'rect');
}

function baseChartData(values: number[], gapWidth: number, overlap: number): PptxChartData {
	return {
		chartType: 'bar',
		categories: ['Category 1'],
		series: series(values),
		barGapWidth: gapWidth,
		barOverlap: overlap,
	} as PptxChartData;
}

describe('buildBars clustered gapWidth/overlap sizing', () => {
	it('matches the COM-verified cluster-width-to-bar-width ratio for 6 series at 23% overlap', () => {
		const chartData = baseChartData([1, 2, 3, 4, 3, 2], 5, 23);
		const rects = barRects(chartData, 1000);
		expect(rects).toHaveLength(6);
		const width = rects[0].w;
		// Every bar is the same width.
		for (const r of rects) {
			expect(r.w).toBeCloseTo(width, 6);
		}
		const clusterWidth = rects[5].x + rects[5].w - rects[0].x;
		expect(clusterWidth / width).toBeCloseTo(1 + 5 * (1 - 23 / 100), 6);
	});

	it('sizes a bar independent of seriesCount at 100% overlap (the dimensional-correctness check)', () => {
		const twoSeries = barRects(baseChartData([5, 5], 10, 100), 1000);
		const eightSeries = barRects(baseChartData(new Array(8).fill(5), 10, 100), 1000);
		expect(eightSeries[0].w).toBeCloseTo(twoSeries[0].w, 6);
	});

	it('keeps the legacy 0.7-of-group heuristic when c:gapWidth is not parsed', () => {
		const chartData: PptxChartData = {
			chartType: 'bar',
			categories: ['Category 1'],
			series: series([1, 2]),
		} as PptxChartData;
		const rects = barRects(chartData, 1000);
		expect(rects[0].w).toBeCloseTo((1000 * 0.7) / 2, 6);
	});

	it('reduces to the single-series case identically to before (no overlap ambiguity)', () => {
		const rects = barRects(baseChartData([7], 150, 0), 1000);
		expect(rects).toHaveLength(1);
		expect(rects[0].w).toBeCloseTo(1000 / (1 + 150 / 100), 6);
	});

	it("matches the COM-verified bar-to-pitch ratio for Office's default 3-series clustered column chart", () => {
		// COM-verified ground truth (PowerPoint's own Office-default 3-series
		// clustered column chart, gapWidth=219, overlap=-27, four categories):
		// the rendered bar is 17.6% of the category pitch. `gapWidth` is a
		// percentage of the bar width (ECMA-376), so `pitch = barWidth *
		// (overlapSpan + gapWidth / 100)`, not `barWidth * (1 + gapWidth / 100)
		// * overlapSpan` (which halved the bar).
		const chartData = baseChartData([4.3, 2.4, 2], 219, -27);
		const rects = barRects(chartData, 1000);
		expect(rects).toHaveLength(3);
		const width = rects[0].w;
		expect(width / 1000).toBeCloseTo(0.176, 2);
	});
});
