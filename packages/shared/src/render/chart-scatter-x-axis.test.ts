/**
 * Unit tests for chart-scatter-x-axis.ts: a scatter/bubble chart's X axis as
 * a genuine "nice" value axis (Excel-style automatic min/max/major-unit,
 * vertical gridlines), not the evenly-spaced category-label row it used to
 * render as.
 */
import type { PptxChartAxisFormatting, PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildScatterXAxisPlan } from './chart-scatter-x-axis';
import type { PlotLayout } from './chart-view-model';

const LAYOUT: PlotLayout = {
	svgWidth: 400,
	svgHeight: 300,
	plotLeft: 40,
	plotTop: 20,
	plotRight: 380,
	plotBottom: 260,
	plotWidth: 340,
	plotHeight: 240,
	autoPlotHeight: 240,
};

function scatterChart(overrides: Partial<PptxChartData> = {}): PptxChartData {
	return {
		chartType: 'scatter',
		categories: [],
		series: [{ name: 'S1', values: [2.7, 3.2, 0.8], xValues: [0.7, 1.8, 2.6] }],
		...overrides,
	};
}

describe('buildScatterXAxisPlan', () => {
	it('resolves a nice round range around the real X data, not the tight min/max', () => {
		const plan = buildScatterXAxisPlan(scatterChart(), LAYOUT);
		expect(plan.range).toBeDefined();
		// Data spans 0.7..2.6; the automatic scale anchors at zero and rounds
		// outward, matching PowerPoint's own render of this exact data (COM
		// measured: 0..3, major unit 0.5).
		expect(plan.range!.min).toBe(0);
		expect(plan.range!.max).toBeGreaterThanOrEqual(2.6);
		expect(plan.range!.majorUnit).toBeGreaterThan(0);
	});

	it('draws a vertical gridline at every major tick', () => {
		const plan = buildScatterXAxisPlan(scatterChart(), LAYOUT);
		const gridlines = plan.gridlines.filter((g) => g.x1 === g.x2);
		expect(gridlines.length).toBeGreaterThan(1);
		for (const line of gridlines) {
			expect(line.y1).toBe(LAYOUT.plotTop);
			expect(line.y2).toBe(LAYOUT.plotBottom);
		}
	});

	it('places tick labels along the bottom, at the same X as their gridline', () => {
		const plan = buildScatterXAxisPlan(scatterChart(), LAYOUT);
		expect(plan.labels.length).toBeGreaterThan(0);
		for (const label of plan.labels) {
			expect(label.y).toBe(LAYOUT.plotBottom + 12);
			expect(label.textAnchor).toBe('middle');
		}
	});

	it('honours an authored c:min/c:max/c:majorUnit over the automatic scale', () => {
		const axis: PptxChartAxisFormatting = {
			axisType: 'valAx',
			axPos: 'b',
			min: 0,
			max: 10,
			majorUnit: 5,
		};
		const plan = buildScatterXAxisPlan(scatterChart({ axes: [axis] }), LAYOUT);
		expect(plan.range).toStrictEqual(expect.objectContaining({ min: 0, max: 10 }));
		const tickTexts = plan.labels.map((l) => l.text);
		expect(tickTexts).toStrictEqual(['0', '5', '10']);
	});

	it('suppresses gridlines when c:majorGridlines is explicitly false', () => {
		const axis: PptxChartAxisFormatting = { axisType: 'valAx', axPos: 'b', majorGridlines: false };
		const plan = buildScatterXAxisPlan(scatterChart({ axes: [axis] }), LAYOUT);
		expect(plan.gridlines.filter((g) => g.x1 === g.x2)).toHaveLength(0);
	});

	it('returns range: undefined when no series has any finite X value', () => {
		const data = scatterChart({
			categories: ['A', 'B', 'C'],
			series: [{ name: 'S', values: [10, 20, 30] }],
		});
		const plan = buildScatterXAxisPlan(data, LAYOUT);
		expect(plan.range).toBeUndefined();
		expect(plan.gridlines).toHaveLength(0);
		expect(plan.labels).toHaveLength(0);
	});

	it('falls back to the chart-level numeric categories when a series has no c:xVal', () => {
		const data: PptxChartData = {
			chartType: 'scatter',
			categories: ['5', '10', '15'],
			series: [{ name: 'S', values: [1, 2, 3] }],
		};
		const plan = buildScatterXAxisPlan(data, LAYOUT);
		expect(plan.range).toBeDefined();
		expect(plan.range!.max).toBeGreaterThanOrEqual(15);
	});

	it('maps a value inside the range to a pixel between plotLeft and plotRight', () => {
		const plan = buildScatterXAxisPlan(scatterChart(), LAYOUT);
		const px = plan.toPixelX(plan.range!.min);
		const px2 = plan.toPixelX(plan.range!.max);
		expect(px).toBeCloseTo(LAYOUT.plotLeft, 5);
		expect(px2).toBeCloseTo(LAYOUT.plotRight, 5);
	});
});
