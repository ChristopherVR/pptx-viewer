/**
 * Unit tests for chart-interaction-stacked.ts: stacked / percentStacked
 * segment drag geometry and value inversion. Hand-computed baselines, no DOM.
 */
import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildStackedDragGeometry, resolveStackedDragValue } from './chart-interaction-stacked';
import { valueToY } from './chart-view-model';

const stackedData: PptxChartData = {
	chartType: 'bar',
	grouping: 'stacked',
	categories: ['Q1', 'Q2'],
	series: [
		{ name: 'A', values: [10, 20] },
		{ name: 'B', values: [30, 5] },
	],
};

describe('buildStackedDragGeometry', () => {
	it('resolves the base value for a series above another in the stack', () => {
		// Series B (index 1) sits on top of series A (10) at category 0.
		const geometry = buildStackedDragGeometry({ width: 400, height: 300 }, stackedData, 1, 0);
		expect(geometry).not.toBeNull();
		expect(geometry?.baseValue).toBe(10);
		expect(geometry?.percent).toBeFalsy();
	});

	it('resolves a zero base for the bottom-most series', () => {
		const geometry = buildStackedDragGeometry({ width: 400, height: 300 }, stackedData, 0, 0);
		expect(geometry?.baseValue).toBe(0);
	});

	it('returns null for a clustered (non-stacked) chart', () => {
		expect(
			buildStackedDragGeometry(
				{ width: 400, height: 300 },
				{ ...stackedData, grouping: 'clustered' },
				0,
				0,
			),
		).toBeNull();
	});

	it('resolves percent geometry with a fixed 0..100 range', () => {
		const geometry = buildStackedDragGeometry(
			{ width: 400, height: 300 },
			{ ...stackedData, grouping: 'percentStacked' },
			1,
			0,
		);
		expect(geometry?.percent).toBeTruthy();
		expect(geometry?.range).toStrictEqual({ min: 0, max: 100, span: 100 });
		// Category 0: A=10, B=30, total=40 -> A's percent share is 25%, the base for B.
		expect(geometry?.baseValue).toBeCloseTo(25, 5);
		expect(geometry?.otherAbsSum).toBe(10);
	});
});

describe('resolveStackedDragValue', () => {
	it('plain stacked: pointer value minus base gives the new own value', () => {
		const geometry = buildStackedDragGeometry({ width: 400, height: 300 }, stackedData, 1, 0)!,
			// Pointer at the value 55 (base 10 + 45 of new own contribution).
			pointerY = valueToY(55, geometry.range, geometry.plotTop, geometry.plotBottom),
			value = resolveStackedDragValue(geometry, pointerY);
		expect(value).toBeCloseTo(45, 0);
	});

	it('plain stacked: dragging to the base value gives zero', () => {
		const geometry = buildStackedDragGeometry({ width: 400, height: 300 }, stackedData, 1, 0)!,
			pointerY = valueToY(
				geometry.baseValue,
				geometry.range,
				geometry.plotTop,
				geometry.plotBottom,
			),
			value = resolveStackedDragValue(geometry, pointerY);
		expect(value).toBeCloseTo(0, 0);
	});

	it('percentStacked: converts the pointer share back to an absolute value', () => {
		const geometry = buildStackedDragGeometry(
				{ width: 400, height: 300 },
				{ ...stackedData, grouping: 'percentStacked' },
				1,
				0,
			)!,
			// Drag the top edge to 75% (base 25% + 50 percentage points of new share).
			pointerY = valueToY(75, geometry.range, geometry.plotTop, geometry.plotBottom),
			value = resolveStackedDragValue(geometry, pointerY);
		// share = 0.5, otherAbsSum = 10 -> value = 0.5/0.5 * 10 = 10.
		expect(value).toBeCloseTo(10, 0);
	});

	it('percentStacked: dragging back to the base percent gives zero', () => {
		const geometry = buildStackedDragGeometry(
				{ width: 400, height: 300 },
				{ ...stackedData, grouping: 'percentStacked' },
				1,
				0,
			)!,
			pointerY = valueToY(
				geometry.baseValue,
				geometry.range,
				geometry.plotTop,
				geometry.plotBottom,
			),
			value = resolveStackedDragValue(geometry, pointerY);
		expect(value).toBeCloseTo(0, 0);
	});
});
