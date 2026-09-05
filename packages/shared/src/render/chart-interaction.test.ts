/**
 * Unit tests for chart-interaction.ts: the data-attribute hit-testing bridge,
 * drag-to-value inversion, and immutable chart-data edit helpers behind direct
 * on-canvas chart editing, plus the `part` tagging emitted by the view-model
 * builders. Pure TypeScript, no DOM.
 */
import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildChartMarkDragGeometry,
	CHART_PART_ATTR,
	CHART_PART_POINT_ATTR,
	CHART_PART_SERIES_ATTR,
	chartPartFromElement,
	chartPartToAttrs,
	dragAnchorViewY,
	dragValueForPart,
	findChartPartTarget,
	isSameChartPart,
	resolveChartDragValue,
	roundDragValue,
	shareToValue,
	valueFromY,
	withChartPointValue,
	withChartTitle,
} from './chart-interaction';
import type { ChartPartElement } from './chart-interaction';
import type { ChartValueDrag, ValueRange } from './chart-view-model';
import { buildChartViewModel, valueToY } from './chart-view-model';

function fakeElement(attrs: Record<string, string>): ChartPartElement {
	const el: ChartPartElement = {
		getAttribute: (name) => attrs[name] ?? null,
		closest: (selectors) => (selectors === `[${CHART_PART_ATTR}]` ? el : null),
	};
	return el;
}

// ─────────────────────────────────────────────────────────────────────────────
// Attribute bridge
// ─────────────────────────────────────────────────────────────────────────────

describe('chartPartToAttrs / chartPartFromElement', () => {
	it('round-trips a data-point part', () => {
		const part = { role: 'dataPoint' as const, seriesIndex: 2, pointIndex: 5 };
		// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
		const el = fakeElement(chartPartToAttrs(part));
		expect(chartPartFromElement(el)).toStrictEqual(part);
	});

	it('round-trips a series part without a point index', () => {
		const part = { role: 'series' as const, seriesIndex: 1 };
		// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
		const attrs = chartPartToAttrs(part);
		expect(attrs[CHART_PART_POINT_ATTR]).toBeUndefined();
		expect(chartPartFromElement(fakeElement(attrs))).toStrictEqual(part);
	});

	it('rejects unknown roles and malformed indexes', () => {
		expect(chartPartFromElement(fakeElement({ [CHART_PART_ATTR]: 'legend' }))).toBeNull();
		expect(
			chartPartFromElement(
				fakeElement({ [CHART_PART_ATTR]: 'series', [CHART_PART_SERIES_ATTR]: 'x' }),
			),
		).toBeNull();
		expect(chartPartFromElement(null)).toBeNull();
	});
});

describe('findChartPartTarget', () => {
	it('resolves the part from an event target inside a tagged mark', () => {
		const el = fakeElement(chartPartToAttrs({ role: 'dataPoint', seriesIndex: 0, pointIndex: 1 }));
		expect(findChartPartTarget(el)).toStrictEqual({
			role: 'dataPoint',
			seriesIndex: 0,
			pointIndex: 1,
		});
	});

	it('returns null for non-element targets', () => {
		expect(findChartPartTarget(null)).toBeNull();
		expect(findChartPartTarget('text')).toBeNull();
		expect(findChartPartTarget({})).toBeNull();
	});
});

describe('isSameChartPart', () => {
	it('compares role and indexes structurally', () => {
		const a = { role: 'dataPoint' as const, seriesIndex: 1, pointIndex: 2 };
		expect(isSameChartPart(a, { ...a })).toBeTruthy();
		expect(isSameChartPart(a, { ...a, pointIndex: 3 })).toBeFalsy();
		expect(isSameChartPart(a, { role: 'series', seriesIndex: 1 })).toBeFalsy();
		expect(isSameChartPart(null, null)).toBeTruthy();
		expect(isSameChartPart(a, null)).toBeFalsy();
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Drag-to-value math
// ─────────────────────────────────────────────────────────────────────────────

describe('valueFromY', () => {
	const top = 8;
	// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
	const bottom = 150;

	it('inverts valueToY on a linear range', () => {
		const range: ValueRange = { min: -10, max: 50, span: 60 };
		for (const v of [-10, 0, 12.5, 33, 50]) {
			const y = valueToY(v, range, top, bottom);
			expect(valueFromY(y, range, top, bottom)).toBeCloseTo(v, 8);
		}
	});

	it('inverts valueToY on a log range', () => {
		const range: ValueRange = { min: 1, max: 1000, span: 3, logScale: true, logBase: 10 };
		for (const v of [1, 10, 250, 1000]) {
			const y = valueToY(v, range, top, bottom);
			expect(valueFromY(y, range, top, bottom)).toBeCloseTo(v, 6);
		}
	});

	it('inverts valueToY on a reversed linear range', () => {
		const range: ValueRange = { min: 0, max: 100, span: 100, reverseOrder: true };
		for (const value of [0, 25, 100]) {
			const y = valueToY(value, range, top, bottom);
			expect(valueFromY(y, range, top, bottom)).toBeCloseTo(value, 8);
		}
	});

	it('returns the range minimum for a degenerate zero-height plot', () => {
		const range: ValueRange = { min: 0, max: 10, span: 10 };
		expect(valueFromY(42, range, 50, 50)).toBe(0);
	});
});

describe('roundDragValue', () => {
	it('rounds to a step two orders below the span', () => {
		expect(roundDragValue(12.3456, { min: 0, max: 60, span: 60 })).toBeCloseTo(12.3, 10);
		expect(roundDragValue(123.456, { min: 0, max: 500, span: 500 })).toBe(123);
		expect(roundDragValue(1.2345, { min: 0, max: 5, span: 5 })).toBeCloseTo(1.23, 10);
	});

	it('passes through non-finite values and degenerate spans', () => {
		expect(roundDragValue(Number.NaN, { min: 0, max: 1, span: 1 })).toBeNaN();
		expect(roundDragValue(3.14, { min: 0, max: 0, span: 0 })).toBe(3.14);
	});
});

describe('dragValueForPart', () => {
	const drag: ChartValueDrag = {
		range: { min: 0, max: 100, span: 100 },
		secondaryRange: { min: 0, max: 10, span: 10 },
		secondarySeriesIndexes: [1],
		plotTop: 0,
		plotBottom: 100,
	};

	it('maps against the primary range by default', () => {
		// Halfway up the plot on a 0..100 range is 50.
		expect(dragValueForPart(50, drag, 0)).toBe(50);
	});

	it('maps secondary-axis series against the secondary range', () => {
		expect(dragValueForPart(50, drag, 1)).toBe(5);
	});

	it('dragAnchorViewY projects a value with the series range, inverse of dragValueForPart', () => {
		expect(dragAnchorViewY(50, drag, 0)).toBe(50);
		expect(dragValueForPart(dragAnchorViewY(37, drag, 0), drag, 0)).toBe(37);
		// Secondary-axis series project against the secondary range.
		expect(dragAnchorViewY(5, drag, 1)).toBe(50);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Immutable chart-data edits
// ─────────────────────────────────────────────────────────────────────────────

const baseData: PptxChartData = {
	chartType: 'bar',
	categories: ['Q1', 'Q2', 'Q3'],
	series: [
		{ name: 'Revenue', values: [100, 150, 120] },
		{ name: 'Cost', values: [80, 90, 100], color: '#ff0000' },
	],
	style: { hasLegend: true, legendPosition: 'b' },
};

describe('withChartPointValue', () => {
	it('replaces one value without mutating the input', () => {
		const next = withChartPointValue(baseData, 1, 2, 42);
		expect(next.series[1].values).toStrictEqual([80, 90, 42]);
		expect(next.series[1].color).toBe('#ff0000');
		expect(next.series[0]).toBe(baseData.series[0]);
		expect(baseData.series[1].values).toStrictEqual([80, 90, 100]);
	});

	it('returns the input unchanged for out-of-range indexes', () => {
		expect(withChartPointValue(baseData, 5, 0, 1)).toBe(baseData);
		expect(withChartPointValue(baseData, 0, 99, 1)).toBe(baseData);
		expect(withChartPointValue(baseData, 0, -1, 1)).toBe(baseData);
	});
});

describe('withChartTitle', () => {
	it('sets the title and turns hasTitle on, preserving other style fields', () => {
		const next = withChartTitle(baseData, ' Sales 2026 ');
		expect(next.title).toBe('Sales 2026');
		expect(next.style?.hasTitle).toBeTruthy();
		expect(next.style?.hasLegend).toBeTruthy();
		expect(next.style?.legendPosition).toBe('b');
	});

	it('turns hasTitle off when cleared', () => {
		const next = withChartTitle({ ...baseData, title: 'Old' }, '   ');
		expect(next.title).toBe('');
		expect(next.style?.hasTitle).toBeFalsy();
	});

	// W4-D: the on-canvas title editor shares the same dominant-style collapse
	// rule as every binding's inspector title field (`collapseChartTitleRunsForEdit`).
	it('collapses a multi-run title to one run in the dominant style', () => {
		const next = withChartTitle(
			{
				...baseData,
				titleRuns: [
					{ text: 'Sales ', bold: true },
					{ text: 'Q1 2026', italic: true, color: '#FF0000' },
				],
			},
			'New Title',
		);
		expect(next.title).toBe('New Title');
		expect(next.titleRuns).toStrictEqual([{ text: 'New Title', italic: true, color: '#FF0000' }]);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// View-model part tagging
// ─────────────────────────────────────────────────────────────────────────────

function chartElement(chartData: PptxChartData, width = 400, height = 300) {
	return { id: 'el-1', type: 'chart' as const, x: 0, y: 0, width, height, chartData };
}

describe('view-model part tagging', () => {
	it('tags clustered bar rects with (series, point) and exposes valueDrag', () => {
		const vm = buildChartViewModel(chartElement(baseData));
		// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
		const rects = vm.primitives.filter((p) => p.kind === 'rect');
		expect(rects).toHaveLength(6);
		expect(rects[0].part).toStrictEqual({ role: 'dataPoint', seriesIndex: 0, pointIndex: 0 });
		expect(rects[5].part).toStrictEqual({ role: 'dataPoint', seriesIndex: 1, pointIndex: 2 });
		expect(vm.valueDrag).toBeDefined();
		expect(vm.valueDrag?.range.max).toBeGreaterThanOrEqual(150);
	});

	it('tags stacked bar rects but omits valueDrag', () => {
		const vm = buildChartViewModel(chartElement({ ...baseData, grouping: 'stacked' }));
		// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
		const rects = vm.primitives.filter((p) => p.kind === 'rect');
		expect(rects.length).toBeGreaterThan(0);
		expect(rects.every((r) => r.part?.role === 'dataPoint')).toBeTruthy();
		expect(vm.valueDrag).toBeUndefined();
	});

	it('tags line series polylines and point dots', () => {
		const vm = buildChartViewModel(chartElement({ ...baseData, chartType: 'line' }));
		// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
		const lines = vm.primitives.filter((p) => p.kind === 'polyline');
		// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
		const dots = vm.primitives.filter((p) => p.kind === 'circle');
		expect(lines[0].part).toStrictEqual({ role: 'series', seriesIndex: 0 });
		expect(dots).toHaveLength(6);
		expect(dots[3].part).toStrictEqual({ role: 'dataPoint', seriesIndex: 1, pointIndex: 0 });
		expect(vm.valueDrag).toBeDefined();
	});

	it('tags stacked line dots but omits valueDrag, unlike a clustered line', () => {
		const vm = buildChartViewModel(
			chartElement({ ...baseData, chartType: 'line', grouping: 'stacked' }),
		);
		// eslint-disable-next-line one-var -- kept separate from `vm` for readability
		const dots = vm.primitives.filter((p) => p.kind === 'circle');
		expect(dots.length).toBeGreaterThan(0);
		expect(dots.every((d) => d.part?.role === 'dataPoint')).toBeTruthy();
		expect(vm.valueDrag).toBeUndefined();
	});

	it('tags percentStacked area bands but omits valueDrag', () => {
		const vm = buildChartViewModel(
			chartElement({ ...baseData, chartType: 'area', grouping: 'percentStacked' }),
		);
		expect(vm.valueDrag).toBeUndefined();
		// eslint-disable-next-line one-var -- an assertion sits between this const and the previous one
		const dots = vm.primitives.filter((p) => p.kind === 'circle');
		expect(dots.every((d) => d.part?.role === 'dataPoint')).toBeTruthy();
	});

	it('keeps reversed category marks wired to their original editable values', () => {
		const reversed: PptxChartData = {
			chartType: 'bar',
			categories: ['A', 'B', 'C'],
			series: [{ name: 'S', values: [10, 20, 30] }],
			axes: [{ axisType: 'catAx', orientation: 'maxMin' }],
		};
		// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
		const vm = buildChartViewModel(chartElement(reversed));
		// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
		const first = vm.primitives.find((primitive) => primitive.kind === 'rect');
		expect(first?.part).toStrictEqual({ role: 'dataPoint', seriesIndex: 0, pointIndex: 2 });
		// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
		const edited = withChartPointValue(
			reversed,
			first?.part?.seriesIndex ?? -1,
			first?.part?.pointIndex ?? -1,
			99,
		);
		expect(edited.series[0].values).toStrictEqual([10, 20, 99]);
	});

	it('tags pie slices per category on series 0 without valueDrag', () => {
		const pieData: PptxChartData = {
			chartType: 'pie',
			categories: ['A', 'B', 'C'],
			series: [{ name: 'S', values: [10, 20, 30] }],
		};
		// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
		const vm = buildChartViewModel(chartElement(pieData, 300, 300));
		// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
		const slices = vm.primitives.filter((p) => p.kind === 'path');
		expect(slices).toHaveLength(3);
		expect(slices[2].part).toStrictEqual({ role: 'dataPoint', seriesIndex: 0, pointIndex: 2 });
		expect(vm.valueDrag).toBeUndefined();
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Non-cartesian mark drag: pie/doughnut, radar, stacked segment dispatch
// ─────────────────────────────────────────────────────────────────────────────

describe('shareToValue', () => {
	it('solves share = value / (value + otherAbsSum) for value', () => {
		// A 50% share against 10 other units means the part itself is also 10.
		expect(shareToValue(0.5, 10)).toBeCloseTo(10, 8);
		// A 25% share against 30 other units: value = 0.25/0.75 * 30 = 10.
		expect(shareToValue(0.25, 30)).toBeCloseTo(10, 8);
	});

	it('returns 0 for a zero (or negative) share', () => {
		expect(shareToValue(0, 10)).toBe(0);
		expect(shareToValue(-1, 10)).toBe(0);
	});

	it('falls back to a finite ratio when there is nothing else to renormalise against', () => {
		expect(Number.isFinite(shareToValue(0.9, 0))).toBeTruthy();
		expect(shareToValue(0.9, 0)).toBeGreaterThan(0);
	});
});

describe('buildChartMarkDragGeometry / resolveChartDragValue', () => {
	it('dispatches a pie kind to the pie geometry/value functions', () => {
		const pieData: PptxChartData = {
				chartType: 'pie',
				categories: ['A', 'B'],
				series: [{ name: 'S', values: [10, 10] }],
			},
			geometry = buildChartMarkDragGeometry({
				kind: 'pie',
				element: { width: 300, height: 300 },
				chartData: pieData,
				categoryLabels: ['A', 'B'],
				seriesIndex: 0,
				pointIndex: 0,
			});
		expect(geometry?.kind).toBe('pie');
		expect(
			resolveChartDragValue(geometry!, { x: geometry!.cx, y: geometry!.cy - 10 }),
		).toBeGreaterThanOrEqual(0);
	});

	it('dispatches a radar kind to the radar geometry/value functions', () => {
		const radarData: PptxChartData = {
				chartType: 'radar',
				categories: ['A', 'B', 'C'],
				series: [{ name: 'S', values: [5, 5, 5] }],
			},
			geometry = buildChartMarkDragGeometry({
				kind: 'radar',
				element: { width: 300, height: 300 },
				chartData: radarData,
				categoryLabels: ['A', 'B', 'C'],
				seriesIndex: 0,
				pointIndex: 0,
			});
		expect(geometry?.kind).toBe('radar');
		expect(resolveChartDragValue(geometry!, { x: geometry!.cx, y: geometry!.cy })).toBe(0);
	});

	it('dispatches a bar kind with stacked grouping to the stacked geometry/value functions', () => {
		const stackedData: PptxChartData = {
				chartType: 'bar',
				grouping: 'stacked',
				categories: ['Q1'],
				series: [
					{ name: 'A', values: [10] },
					{ name: 'B', values: [20] },
				],
			},
			geometry = buildChartMarkDragGeometry({
				kind: 'bar',
				element: { width: 300, height: 300 },
				chartData: stackedData,
				categoryLabels: ['Q1'],
				seriesIndex: 1,
				pointIndex: 0,
			});
		expect(geometry?.kind).toBe('stackedSegment');
	});

	it('returns null for a kind/part combination with no drag meaning', () => {
		const clustered: PptxChartData = {
			chartType: 'bar',
			categories: ['Q1'],
			series: [{ name: 'A', values: [10] }],
		};
		expect(
			buildChartMarkDragGeometry({
				kind: 'bar',
				element: { width: 300, height: 300 },
				chartData: clustered,
				categoryLabels: ['Q1'],
				seriesIndex: 0,
				pointIndex: 0,
			}),
		).toBeNull();
		expect(
			buildChartMarkDragGeometry({
				kind: 'scatter',
				element: { width: 300, height: 300 },
				chartData: clustered,
				categoryLabels: ['Q1'],
				seriesIndex: 0,
				pointIndex: 0,
			}),
		).toBeNull();
	});
});
