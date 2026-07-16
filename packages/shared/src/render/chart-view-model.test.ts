import type { PptxChartData } from 'pptx-viewer-core';
/**
 * Unit tests for chart-renderer-helpers.ts
 *
 * All tests exercise pure TypeScript helpers - no Angular, no DOM, no TestBed.
 * The helpers mirror the React chart-helpers / chart-layout / chart-pie math so
 * the same assertions hold as in packages/react/src/viewer/utils/chart-pie.test.ts.
 */
import { describe, expect, it } from 'vitest';

import type { PlotLayout, ValueRange } from './chart-view-model';
import {
	buildChartViewModel,
	buildFallbackViewModel,
	computeBarRects,
	computeBubbleRadius,
	computeLinePoints,
	computeRadarPoints,
	computePieLayout,
	computePieSlicePath,
	computePieSlices,
	computePlotLayout,
	computeScatterDots,
	computeStackedBarRects,
	computeStackedValueRange,
	computeValueRange,
	DEFAULT_PALETTE,
	formatAxisValue,
	linePointsToSvgString,
	paletteColor,
	radarAngle,
	radarRingPoints,
	resolveChartKind,
	seriesColor,
	valueToY,
} from './chart-view-model';

// ─────────────────────────────────────────────────────────────────────────────
// Palette helpers
// ─────────────────────────────────────────────────────────────────────────────

describe('paletteColor', () => {
	it('cycles through the default palette when no custom palette is provided', () => {
		expect(paletteColor(0, undefined)).toBe(DEFAULT_PALETTE[0]);
		expect(paletteColor(DEFAULT_PALETTE.length, undefined)).toBe(DEFAULT_PALETTE[0]);
	});

	it('uses the custom palette when provided', () => {
		const custom = ['#aabbcc', '#ddeeff'];
		expect(paletteColor(0, custom)).toBe('#aabbcc');
		expect(paletteColor(1, custom)).toBe('#ddeeff');
		expect(paletteColor(2, custom)).toBe('#aabbcc');
	});
});

describe('seriesColor', () => {
	it('returns the series color property when present', () => {
		const series = { name: 'A', values: [1], color: '#123456' };
		expect(seriesColor(series, 0, undefined)).toBe('#123456');
	});

	it('falls back to palette when series has no color', () => {
		const series = { name: 'B', values: [1] };
		expect(seriesColor(series, 1, undefined)).toBe(DEFAULT_PALETTE[1]);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Value range
// ─────────────────────────────────────────────────────────────────────────────

describe('computeValueRange', () => {
	it('returns {0,1,1} for empty series', () => {
		expect(computeValueRange([])).toStrictEqual({ min: 0, max: 1, span: 1 });
	});

	it('always includes zero in the range', () => {
		const range = computeValueRange([{ name: 'A', values: [5, 10, 15] }]);
		expect(range.min).toBe(0);
		expect(range.max).toBe(15);
		expect(range.span).toBe(15);
	});

	it('extends below zero when values are negative', () => {
		const range = computeValueRange([{ name: 'A', values: [-5, -10, 3] }]);
		expect(range.min).toBe(-10);
		expect(range.max).toBe(3);
		expect(range.span).toBe(13);
	});

	it('span is at least 1 when all values equal zero', () => {
		const range = computeValueRange([{ name: 'A', values: [0] }]);
		expect(range.span).toBeGreaterThanOrEqual(1);
	});

	it('handles datasets larger than the JavaScript argument limit', () => {
		const values = Array.from({ length: 200_000 }, (_, index) => index - 100_000);
		expect(computeValueRange([{ name: 'Large', values }])).toStrictEqual({
			min: -100_000,
			max: 99_999,
			span: 199_999,
		});
	});
});

describe('computeStackedValueRange', () => {
	it('sums positive values per category', () => {
		const series = [
			{ name: 'A', values: [10, 20] },
			{ name: 'B', values: [5, 15] },
		];
		const range = computeStackedValueRange(series, 2);
		expect(range.max).toBe(35);
		expect(range.min).toBe(0);
	});

	it('tracks negative stacks separately', () => {
		const series = [
			{ name: 'A', values: [-10, 5] },
			{ name: 'B', values: [-5, 10] },
		];
		const range = computeStackedValueRange(series, 2);
		expect(range.min).toBe(-15);
		expect(range.max).toBe(15);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Value-to-Y mapping
// ─────────────────────────────────────────────────────────────────────────────

describe('valueToY', () => {
	const range: ValueRange = { min: 0, max: 100, span: 100 };
	const topY = 10;
	const bottomY = 110;

	it('maps the maximum value to topY', () => {
		expect(valueToY(100, range, topY, bottomY)).toBeCloseTo(topY);
	});

	it('maps the minimum value to bottomY', () => {
		expect(valueToY(0, range, topY, bottomY)).toBeCloseTo(bottomY);
	});

	it('maps the midpoint value to the vertical midpoint', () => {
		expect(valueToY(50, range, topY, bottomY)).toBeCloseTo(60);
	});

	it('maps the minimum to the top for a reversed range', () => {
		expect(valueToY(0, { ...range, reverseOrder: true }, topY, bottomY)).toBeCloseTo(topY);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Axis formatting
// ─────────────────────────────────────────────────────────────────────────────

describe('formatAxisValue', () => {
	it('formats millions with M suffix', () => {
		expect(formatAxisValue(2_500_000)).toBe('2.5M');
	});

	it('formats thousands with K suffix', () => {
		expect(formatAxisValue(1_500)).toBe('1.5K');
	});

	it('returns integer string for whole numbers', () => {
		expect(formatAxisValue(42)).toBe('42');
	});

	it('returns one decimal for non-integers', () => {
		expect(formatAxisValue(3.14159)).toBe('3.1');
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Plot layout
// ─────────────────────────────────────────────────────────────────────────────

describe('computePlotLayout', () => {
	const baseData: PptxChartData = {
		chartType: 'bar',
		categories: [],
		series: [],
	};

	it('produces a minimum SVG size of 320x180', () => {
		const layout = computePlotLayout(100, 50, baseData, true);
		expect(layout.svgWidth).toBeGreaterThanOrEqual(320);
		expect(layout.svgHeight).toBeGreaterThanOrEqual(180);
	});

	it('reserves left margin when hasAxes = true', () => {
		const withAxes = computePlotLayout(400, 300, baseData, true);
		const withoutAxes = computePlotLayout(400, 300, baseData, false);
		expect(withAxes.plotLeft).toBeGreaterThan(withoutAxes.plotLeft);
	});

	it('reduces plotBottom when chart has legend at bottom', () => {
		const withLegend = computePlotLayout(
			400,
			300,
			{
				...baseData,
				style: { hasLegend: true, legendPosition: 'b' },
			},
			true,
		);
		const withoutLegend = computePlotLayout(400, 300, baseData, true);
		expect(withLegend.plotBottom).toBeLessThan(withoutLegend.plotBottom);
	});

	it('plotWidth and plotHeight are positive', () => {
		const layout = computePlotLayout(400, 300, baseData, true);
		expect(layout.plotWidth).toBeGreaterThan(0);
		expect(layout.plotHeight).toBeGreaterThan(0);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Bar chart geometry
// ─────────────────────────────────────────────────────────────────────────────

describe('computeBarRects', () => {
	const layout: PlotLayout = {
		svgWidth: 400,
		svgHeight: 300,
		plotLeft: 48,
		plotTop: 8,
		plotRight: 392,
		plotBottom: 276,
		plotWidth: 344,
		plotHeight: 268,
	};
	const range: ValueRange = { min: 0, max: 100, span: 100 };
	const series = [
		{ name: 'A', values: [50, 80], color: '#ff0000' },
		{ name: 'B', values: [30, 60] },
	];

	it('produces one rect per (category x series) pair', () => {
		const rects = computeBarRects(series, 2, layout, range, undefined);
		expect(rects).toHaveLength(4);
	});

	it('uses the series color property when present', () => {
		const rects = computeBarRects(series, 2, layout, range, undefined);
		expect(rects[0].fill).toBe('#ff0000');
	});

	it('all rects have positive width and height', () => {
		const rects = computeBarRects(series, 2, layout, range, undefined);
		for (const r of rects) {
			expect(r.w).toBeGreaterThan(0);
			expect(r.h).toBeGreaterThan(0);
		}
	});

	it('bars are ordered left-to-right by category then series', () => {
		const rects = computeBarRects(series, 2, layout, range, undefined);
		expect(rects[0].x).toBeLessThan(rects[1].x);
		expect(rects[2].x).toBeGreaterThan(rects[1].x);
	});
});

describe('computeStackedBarRects', () => {
	const layout: PlotLayout = {
		svgWidth: 400,
		svgHeight: 300,
		plotLeft: 48,
		plotTop: 8,
		plotRight: 392,
		plotBottom: 276,
		plotWidth: 344,
		plotHeight: 268,
	};
	const range: ValueRange = { min: 0, max: 60, span: 60 };
	const series = [
		{ name: 'A', values: [20, 30] },
		{ name: 'B', values: [40, 30] },
	];

	it('produces the correct number of rects (one per non-zero value)', () => {
		const rects = computeStackedBarRects(series, 2, layout, range, undefined);
		expect(rects).toHaveLength(4);
	});

	it('all rects have positive height', () => {
		const rects = computeStackedBarRects(series, 2, layout, range, undefined);
		for (const r of rects) {
			expect(r.h).toBeGreaterThan(0);
		}
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Line / area chart geometry
// ─────────────────────────────────────────────────────────────────────────────

describe('computeLinePoints', () => {
	const layout: PlotLayout = {
		svgWidth: 400,
		svgHeight: 300,
		plotLeft: 48,
		plotTop: 8,
		plotRight: 392,
		plotBottom: 276,
		plotWidth: 344,
		plotHeight: 268,
	};
	const range: ValueRange = { min: 0, max: 100, span: 100 };

	it('returns one point per value', () => {
		const pts = computeLinePoints([10, 50, 80], 3, layout, range);
		expect(pts).toHaveLength(3);
	});

	it('first point is at plotLeft', () => {
		const pts = computeLinePoints([0, 100], 2, layout, range);
		expect(pts[0].x).toBeCloseTo(layout.plotLeft);
	});

	it('last point is at plotRight', () => {
		const pts = computeLinePoints([0, 100], 2, layout, range);
		expect(pts[1].x).toBeCloseTo(layout.plotRight);
	});

	it('lower values map to higher Y', () => {
		const pts = computeLinePoints([0, 100], 2, layout, range);
		expect(pts[0].y).toBeGreaterThan(pts[1].y);
	});
});

describe('linePointsToSvgString', () => {
	it('formats points as "x.xx,y.xx" pairs separated by spaces', () => {
		const result = linePointsToSvgString([
			{ x: 10, y: 20 },
			{ x: 30, y: 40 },
		]);
		expect(result).toBe('10.00,20.00 30.00,40.00');
	});

	it('returns empty string for empty points array', () => {
		expect(linePointsToSvgString([])).toBe('');
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Pie / doughnut chart geometry
// ─────────────────────────────────────────────────────────────────────────────

describe('computePieLayout', () => {
	const baseData: PptxChartData = { chartType: 'pie', categories: [], series: [] };

	it('uses the smaller dimension as size', () => {
		const geo = computePieLayout(400, 300, baseData, false);
		expect(geo.size).toBe(300);
	});

	it('computes zero innerR for pie', () => {
		const geo = computePieLayout(300, 300, baseData, false);
		expect(geo.innerR).toBe(0);
	});

	it('computes non-zero innerR for doughnut', () => {
		const geo = computePieLayout(300, 300, baseData, true);
		expect(geo.innerR).toBeCloseTo(geo.outerR * 0.55);
	});

	it('reduces outerR when title and legend are present', () => {
		const plain = computePieLayout(300, 300, baseData, false);
		const decorated = computePieLayout(
			300,
			300,
			{
				...baseData,
				style: { hasTitle: true, hasLegend: true },
			},
			false,
		);
		expect(decorated.outerR).toBeLessThan(plain.outerR);
	});

	it('produces non-negative radii', () => {
		const geo = computePieLayout(
			50,
			50,
			{
				...baseData,
				style: { hasTitle: true, hasLegend: true },
			},
			true,
		);
		expect(geo.outerR).toBeGreaterThanOrEqual(0);
		expect(geo.innerR).toBeGreaterThanOrEqual(0);
	});
});

describe('computePieSlicePath', () => {
	const cx = 150;
	const cy = 150;
	const r = 100;

	it('produces a path string for a solid slice', () => {
		const { d } = computePieSlicePath(cx, cy, r, 0, -Math.PI / 2, 0);
		expect(d).toMatch(/^M/u);
		expect(d).toMatch(/A/u);
		expect(d).toMatch(/Z$/u);
	});

	it('produces a doughnut path (inner arc) when innerR > 0', () => {
		const { d } = computePieSlicePath(cx, cy, r, 40, -Math.PI / 2, 0);
		const arcCount = (d.match(/A/gu) ?? []).length;
		expect(arcCount).toBe(2);
	});

	it('sets largeArc flag for slices > PI', () => {
		const { d } = computePieSlicePath(cx, cy, r, 0, -Math.PI / 2, Math.PI);
		expect(d).toMatch(/A100,100 0 1 1/u);
	});

	it('places the label at 70% of the outer radius along the mid-angle', () => {
		const startAngle = -Math.PI / 2;
		const endAngle = 0;
		const { midAngle, labelX, labelY } = computePieSlicePath(cx, cy, r, 0, startAngle, endAngle);
		const expectedR = r * 0.7;
		expect(labelX).toBeCloseTo(cx + expectedR * Math.cos(midAngle), 4);
		expect(labelY).toBeCloseTo(cy + expectedR * Math.sin(midAngle), 4);
	});
});

describe('computePieSlices', () => {
	it("starts at -PI/2 (12 o'clock)", () => {
		const slices = computePieSlices([50, 50], 100, 100, 80, 0);
		expect(slices[0].d).toMatch(/^M100/u);
	});

	it('produces one slice per value', () => {
		expect(computePieSlices([10, 20, 30, 40], 100, 100, 80, 0)).toHaveLength(4);
	});

	it('places first mid-angle at -PI/4 for 4 equal slices', () => {
		const slices = computePieSlices([25, 25, 25, 25], 100, 100, 80, 0);
		expect(slices[0].midAngle).toBeCloseTo(-Math.PI / 4, 10);
	});

	it('handles negative values via absolute-value proportions', () => {
		expect(() => computePieSlices([-10, -30], 100, 100, 80, 0)).not.toThrow();
		expect(computePieSlices([-10, -30], 100, 100, 80, 0)).toHaveLength(2);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Scatter chart geometry
// ─────────────────────────────────────────────────────────────────────────────

describe('computeScatterDots', () => {
	const layout: PlotLayout = {
		svgWidth: 400,
		svgHeight: 300,
		plotLeft: 48,
		plotTop: 8,
		plotRight: 392,
		plotBottom: 276,
		plotWidth: 344,
		plotHeight: 268,
	};
	const range: ValueRange = { min: 0, max: 100, span: 100 };

	it('returns one dot per value', () => {
		const dots = computeScatterDots([10, 50, 90], 2, layout, range);
		expect(dots).toHaveLength(3);
	});

	it('first dot is at plotLeft when maxXIndex is 0', () => {
		const dots = computeScatterDots([50], 0, layout, range);
		expect(dots[0].cx).toBeCloseTo(layout.plotLeft);
	});

	it('dots are ordered left to right by index', () => {
		const dots = computeScatterDots([10, 50, 90], 2, layout, range);
		expect(dots[0].cx).toBeLessThan(dots[1].cx);
		expect(dots[1].cx).toBeLessThan(dots[2].cx);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// computeBubbleRadius
// ─────────────────────────────────────────────────────────────────────────────

describe('computeBubbleRadius', () => {
	it('returns the median radius when no size value is present', () => {
		expect(computeBubbleRadius(undefined, 100, 10)).toBe(10);
	});

	it('scales from 0.5x (size 0) to 2x (max size) the median radius', () => {
		expect(computeBubbleRadius(0, 100, 10)).toBeCloseTo(5);
		expect(computeBubbleRadius(100, 100, 10)).toBeCloseTo(20);
	});

	it('uses the absolute size value', () => {
		expect(computeBubbleRadius(-100, 100, 10)).toBeCloseTo(20);
	});

	it('guards against a zero max (no division by zero)', () => {
		const r = computeBubbleRadius(5, 0, 10);
		expect(Number.isFinite(r)).toBeTruthy();
		// denom falls back to 1: 10*0.5 + (5/1)*10*1.5
		expect(r).toBeCloseTo(80);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Radar geometry
// ─────────────────────────────────────────────────────────────────────────────

describe('radarAngle', () => {
	it('places the first spoke pointing up (-90 degrees)', () => {
		expect(radarAngle(0, 4)).toBeCloseTo(-Math.PI / 2);
	});

	it('advances clockwise by a full turn divided by the category count', () => {
		expect(radarAngle(1, 4) - radarAngle(0, 4)).toBeCloseTo(Math.PI / 2);
	});
});

describe('computeRadarPoints', () => {
	it('returns one point per value, clamped to the category count', () => {
		const pts = computeRadarPoints([10, 20, 30, 40, 50], 50, 100, 200, 200, 4);
		expect(pts).toHaveLength(4);
	});

	it('places a max value on the ring radius (first spoke straight up)', () => {
		const pts = computeRadarPoints([50], 50, 100, 200, 200, 4);
		expect(pts[0].x).toBeCloseTo(200);
		expect(pts[0].y).toBeCloseTo(100);
	});

	it('places a zero value at the centre', () => {
		const pts = computeRadarPoints([0], 50, 100, 200, 200, 4);
		expect(pts[0].x).toBeCloseTo(200);
		expect(pts[0].y).toBeCloseTo(200);
	});
});

describe('radarRingPoints', () => {
	it('produces one vertex per category', () => {
		const pts = radarRingPoints(200, 200, 100, 4).split(' ');
		expect(pts).toHaveLength(4);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// resolveChartKind
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveChartKind', () => {
	it('maps bar and bar3D to "bar"', () => {
		expect(resolveChartKind('bar')).toBe('bar');
		expect(resolveChartKind('bar3D')).toBe('bar');
	});

	it('maps line and line3D to "line"', () => {
		expect(resolveChartKind('line')).toBe('line');
		expect(resolveChartKind('line3D')).toBe('line');
	});

	it('maps area and area3D to "area"', () => {
		expect(resolveChartKind('area')).toBe('area');
		expect(resolveChartKind('area3D')).toBe('area');
	});

	it('maps pie, pie3D and ofPie to "pie"', () => {
		expect(resolveChartKind('pie')).toBe('pie');
		expect(resolveChartKind('pie3D')).toBe('pie');
		expect(resolveChartKind('ofPie')).toBe('pie');
	});

	it('maps doughnut to "doughnut"', () => {
		expect(resolveChartKind('doughnut')).toBe('doughnut');
	});

	it('maps scatter to "scatter"', () => {
		expect(resolveChartKind('scatter')).toBe('scatter');
	});

	it('maps bubble to "bubble"', () => {
		expect(resolveChartKind('bubble')).toBe('bubble');
	});

	it('maps radar and radar3D to "radar"', () => {
		expect(resolveChartKind('radar')).toBe('radar');
		expect(resolveChartKind('radar3D')).toBe('radar');
	});

	it('maps funnel, sunburst, histogram and boxWhisker to their own kinds', () => {
		expect(resolveChartKind('funnel')).toBe('funnel');
		expect(resolveChartKind('sunburst')).toBe('sunburst');
		expect(resolveChartKind('histogram')).toBe('histogram');
		expect(resolveChartKind('boxWhisker')).toBe('boxWhisker');
	});

	it('maps unknown types to "unsupported"', () => {
		expect(resolveChartKind('unknown')).toBe('unsupported');
		expect(resolveChartKind('bar3D')).toBe('bar');
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// buildFallbackViewModel
// ─────────────────────────────────────────────────────────────────────────────

describe('buildFallbackViewModel', () => {
	it('produces a view-model with a single rect primitive', () => {
		const vm = buildFallbackViewModel(200, 150, 'Radar');
		const rects = vm.primitives.filter((p) => p.kind === 'rect');
		expect(rects).toHaveLength(1);
	});

	it('includes the label in dataLabels', () => {
		const vm = buildFallbackViewModel(200, 150, 'My Chart');
		const texts = vm.dataLabels;
		expect(texts.some((t) => t.text === 'My Chart')).toBeTruthy();
	});

	it('has no gridlines, axisLabels, or legend', () => {
		const vm = buildFallbackViewModel(200, 150, 'X');
		expect(vm.gridlines).toHaveLength(0);
		expect(vm.axisLabels).toHaveLength(0);
		expect(vm.legend).toHaveLength(0);
	});

	it('enforces minimum svg dimensions', () => {
		const vm = buildFallbackViewModel(10, 10, 'X');
		expect(vm.svgWidth).toBeGreaterThanOrEqual(100);
		expect(vm.svgHeight).toBeGreaterThanOrEqual(60);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// buildChartViewModel - integration
// ─────────────────────────────────────────────────────────────────────────────

describe('buildChartViewModel - bar chart integration', () => {
	const element = {
		id: 'el-1',
		type: 'chart' as const,
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData: {
			chartType: 'bar' as const,
			categories: ['Q1', 'Q2', 'Q3'],
			series: [
				{ name: 'Revenue', values: [100, 150, 120] },
				{ name: 'Cost', values: [80, 90, 100], color: '#ff0000' },
			],
			style: { hasLegend: true, legendPosition: 'b' },
		} satisfies PptxChartData,
	};

	it('produces bar rects (one per category x series)', () => {
		const vm = buildChartViewModel(element);
		const rects = vm.primitives.filter((p) => p.kind === 'rect');
		expect(rects).toHaveLength(6);
	});

	it('includes a legend entry per series', () => {
		const vm = buildChartViewModel(element);
		expect(vm.legend).toHaveLength(2);
		expect(vm.legend[0].label).toBe('Revenue');
		expect(vm.legend[1].label).toBe('Cost');
	});

	it('includes gridlines and axis labels', () => {
		const vm = buildChartViewModel(element);
		expect(vm.gridlines.length).toBeGreaterThan(0);
		expect(vm.axisLabels.length).toBeGreaterThan(0);
	});

	it('includes category labels', () => {
		const vm = buildChartViewModel(element);
		expect(vm.categoryLabels).toHaveLength(3);
		expect(vm.categoryLabels[0].text).toBe('Q1');
	});
});

describe('buildChartViewModel - pie chart integration', () => {
	const element = {
		id: 'el-2',
		type: 'chart' as const,
		x: 0,
		y: 0,
		width: 300,
		height: 300,
		chartData: {
			chartType: 'pie' as const,
			categories: ['A', 'B', 'C'],
			series: [{ name: 'S1', values: [30, 50, 20] }],
			style: { hasLegend: true },
		} satisfies PptxChartData,
	};

	it('produces one path primitive per pie slice', () => {
		const vm = buildChartViewModel(element);
		const paths = vm.primitives.filter((p) => p.kind === 'path');
		expect(paths).toHaveLength(3);
	});

	it('has no gridlines (pie charts have no axes)', () => {
		const vm = buildChartViewModel(element);
		expect(vm.gridlines).toHaveLength(0);
	});

	it('includes one legend entry per category', () => {
		const vm = buildChartViewModel(element);
		expect(vm.legend).toHaveLength(3);
	});
});

describe('buildChartViewModel - line chart integration', () => {
	const element = {
		id: 'el-3',
		type: 'chart' as const,
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData: {
			chartType: 'line' as const,
			categories: ['Jan', 'Feb', 'Mar'],
			series: [{ name: 'Trend', values: [10, 30, 20] }],
		} satisfies PptxChartData,
	};

	it('produces one polyline primitive per series', () => {
		const vm = buildChartViewModel(element);
		const polylines = vm.primitives.filter((p) => p.kind === 'polyline');
		expect(polylines).toHaveLength(1);
	});

	it('produces circle primitives for data points', () => {
		const vm = buildChartViewModel(element);
		const circles = vm.primitives.filter((p) => p.kind === 'circle');
		expect(circles).toHaveLength(3);
	});
});

describe('buildChartViewModel - scatter chart integration', () => {
	const element = {
		id: 'el-4',
		type: 'chart' as const,
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData: {
			chartType: 'scatter' as const,
			categories: [],
			series: [
				{ name: 'S1', values: [1, 2, 3] },
				{ name: 'S2', values: [4, 5, 6] },
			],
		} satisfies PptxChartData,
	};

	it('produces circle primitives (one per data point)', () => {
		const vm = buildChartViewModel(element);
		const circles = vm.primitives.filter((p) => p.kind === 'circle');
		expect(circles).toHaveLength(6);
	});
});

describe('buildChartViewModel - bubble chart integration', () => {
	const element = {
		id: 'el-bub',
		type: 'chart' as const,
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData: {
			chartType: 'bubble' as const,
			categories: [],
			series: [
				{ name: 'X', values: [1, 2, 3] },
				{ name: 'Y', values: [4, 5, 6] },
				{ name: 'Size', values: [10, 50, 100] },
			],
		} satisfies PptxChartData,
	};

	it('produces circle primitives only for the first two series (size series excluded)', () => {
		const vm = buildChartViewModel(element);
		const circles = vm.primitives.filter((p) => p.kind === 'circle');
		expect(circles).toHaveLength(6);
	});

	it('scales bubble radius by the third series', () => {
		const vm = buildChartViewModel(element);
		const circles = vm.primitives.filter((p) => p.kind === 'circle');
		// First X-series point (size 10) should be smaller than the third (size 100).
		expect(circles[0].r).toBeLessThan(circles[2].r);
	});
});

describe('buildChartViewModel - radar chart integration', () => {
	const element = {
		id: 'el-radar',
		type: 'chart' as const,
		x: 0,
		y: 0,
		width: 400,
		height: 400,
		chartData: {
			chartType: 'radar' as const,
			categories: ['A', 'B', 'C', 'D'],
			series: [
				{ name: 'S1', values: [10, 20, 30, 40] },
				{ name: 'S2', values: [40, 30, 20, 10] },
			],
			style: { hasLegend: true },
		} satisfies PptxChartData,
	};

	it('has no cartesian gridlines or axis labels', () => {
		const vm = buildChartViewModel(element);
		expect(vm.gridlines).toHaveLength(0);
		expect(vm.axisLabels).toHaveLength(0);
	});

	it('produces ring + data polygons', () => {
		const vm = buildChartViewModel(element);
		const polygons = vm.primitives.filter((p) => p.kind === 'polygon');
		// 4 gridline rings + 1 polygon per series.
		expect(polygons).toHaveLength(6);
	});

	it('produces one spoke line per category', () => {
		const vm = buildChartViewModel(element);
		const lines = vm.primitives.filter((p) => p.kind === 'line');
		expect(lines).toHaveLength(4);
	});

	it('places one perimeter label per category', () => {
		const vm = buildChartViewModel(element);
		expect(vm.categoryLabels).toHaveLength(4);
		expect(vm.categoryLabels[0].text).toBe('A');
	});

	it('includes a legend entry per series', () => {
		const vm = buildChartViewModel(element);
		expect(vm.legend).toHaveLength(2);
	});
});

describe('buildChartViewModel - unsupported chart type', () => {
	const element = {
		id: 'el-5',
		type: 'chart' as const,
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData: {
			chartType: 'unknown',
			categories: [],
			series: [{ name: 'S', values: [1, 2, 3] }],
		} satisfies PptxChartData,
	};

	it('returns fallback view-model for unsupported types', () => {
		const vm = buildChartViewModel(element);
		expect(vm.gridlines).toHaveLength(0);
		const rects = vm.primitives.filter((p) => p.kind === 'rect');
		expect(rects).toHaveLength(1);
	});
});

describe('buildChartViewModel - non-chart element', () => {
	const element = {
		id: 'el-x',
		type: 'shape' as const,
		x: 0,
		y: 0,
		width: 200,
		height: 100,
	};

	it('returns a fallback view-model without crashing', () => {
		const vm = buildChartViewModel(element as Parameters<typeof buildChartViewModel>[0]);
		expect(vm.gridlines).toHaveLength(0);
	});
});
