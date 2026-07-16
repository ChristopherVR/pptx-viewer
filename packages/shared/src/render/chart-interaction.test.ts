/**
 * Unit tests for chart-interaction.ts: the data-attribute hit-testing bridge,
 * drag-to-value inversion, and immutable chart-data edit helpers behind direct
 * on-canvas chart editing, plus the `part` tagging emitted by the view-model
 * builders. Pure TypeScript, no DOM.
 */
import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	CHART_PART_ATTR,
	CHART_PART_POINT_ATTR,
	CHART_PART_SERIES_ATTR,
	chartPartFromElement,
	chartPartToAttrs,
	dragAnchorViewY,
	dragValueForPart,
	findChartPartTarget,
	isSameChartPart,
	roundDragValue,
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
		const el = fakeElement(chartPartToAttrs(part));
		expect(chartPartFromElement(el)).toStrictEqual(part);
	});

	it('round-trips a series part without a point index', () => {
		const part = { role: 'series' as const, seriesIndex: 1 };
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
		const rects = vm.primitives.filter((p) => p.kind === 'rect');
		expect(rects).toHaveLength(6);
		expect(rects[0].part).toStrictEqual({ role: 'dataPoint', seriesIndex: 0, pointIndex: 0 });
		expect(rects[5].part).toStrictEqual({ role: 'dataPoint', seriesIndex: 1, pointIndex: 2 });
		expect(vm.valueDrag).toBeDefined();
		expect(vm.valueDrag?.range.max).toBeGreaterThanOrEqual(150);
	});

	it('tags stacked bar rects but omits valueDrag', () => {
		const vm = buildChartViewModel(chartElement({ ...baseData, grouping: 'stacked' }));
		const rects = vm.primitives.filter((p) => p.kind === 'rect');
		expect(rects.length).toBeGreaterThan(0);
		expect(rects.every((r) => r.part?.role === 'dataPoint')).toBeTruthy();
		expect(vm.valueDrag).toBeUndefined();
	});

	it('tags line series polylines and point dots', () => {
		const vm = buildChartViewModel(chartElement({ ...baseData, chartType: 'line' }));
		const lines = vm.primitives.filter((p) => p.kind === 'polyline');
		const dots = vm.primitives.filter((p) => p.kind === 'circle');
		expect(lines[0].part).toStrictEqual({ role: 'series', seriesIndex: 0 });
		expect(dots).toHaveLength(6);
		expect(dots[3].part).toStrictEqual({ role: 'dataPoint', seriesIndex: 1, pointIndex: 0 });
		expect(vm.valueDrag).toBeDefined();
	});

	it('keeps reversed category marks wired to their original editable values', () => {
		const reversed: PptxChartData = {
			chartType: 'bar',
			categories: ['A', 'B', 'C'],
			series: [{ name: 'S', values: [10, 20, 30] }],
			axes: [{ axisType: 'catAx', orientation: 'maxMin' }],
		};
		const vm = buildChartViewModel(chartElement(reversed));
		const first = vm.primitives.find((primitive) => primitive.kind === 'rect');
		expect(first?.part).toStrictEqual({ role: 'dataPoint', seriesIndex: 0, pointIndex: 2 });
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
		const vm = buildChartViewModel(chartElement(pieData, 300, 300));
		const slices = vm.primitives.filter((p) => p.kind === 'path');
		expect(slices).toHaveLength(3);
		expect(slices[2].part).toStrictEqual({ role: 'dataPoint', seriesIndex: 0, pointIndex: 2 });
		expect(vm.valueDrag).toBeUndefined();
	});
});
