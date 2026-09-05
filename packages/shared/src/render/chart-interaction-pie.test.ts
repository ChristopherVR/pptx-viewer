/**
 * Unit tests for chart-interaction-pie.ts: pie/doughnut slice drag geometry
 * and value inversion. Hand-computed angles, no DOM.
 */
import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildPieDragGeometry, resolvePieDragValue } from './chart-interaction-pie';

const pieData: PptxChartData = {
	chartType: 'pie',
	categories: ['A', 'B', 'C', 'D'],
	series: [{ name: 'S', values: [25, 25, 25, 25] }],
};

describe('buildPieDragGeometry', () => {
	it('resolves centre/startAngle for a pie chart', () => {
		const geometry = buildPieDragGeometry({ width: 300, height: 300 }, pieData, 1);
		expect(geometry).not.toBeNull();
		expect(geometry?.cx).toBeCloseTo(150, 5);
		expect(geometry?.cy).toBeCloseTo(150, 5);
		expect(geometry?.startAngle).toBeCloseTo(-Math.PI / 2, 10);
		expect(geometry?.values).toStrictEqual([25, 25, 25, 25]);
	});

	it('returns null for a non-pie chart type', () => {
		expect(
			buildPieDragGeometry({ width: 300, height: 300 }, { ...pieData, chartType: 'bar' }, 0),
		).toBeNull();
	});

	it('returns null for an out-of-range point index', () => {
		expect(buildPieDragGeometry({ width: 300, height: 300 }, pieData, 4)).toBeNull();
		expect(buildPieDragGeometry({ width: 300, height: 300 }, pieData, -1)).toBeNull();
	});

	it('returns null when the series has no values', () => {
		expect(
			buildPieDragGeometry(
				{ width: 300, height: 300 },
				{ ...pieData, series: [{ name: 'S', values: [] }] },
				0,
			),
		).toBeNull();
	});
});

describe('resolvePieDragValue', () => {
	// Four equal slices starting at 12 o'clock (-PI/2), each 90 degrees wide:
	// slice 0 spans [-90, 0), slice 1 [0, 90), slice 2 [90, 180), slice 3 [180, 270)
	// (angles measured clockwise from 12 o'clock, since SVG y grows downward).
	// Slice 1's LEADING edge (angle 0, held fixed by the drag) sits at 3 o'clock;
	// its current TRAILING edge sits at angle PI/2 (6 o'clock, straight down).
	const geometry = buildPieDragGeometry({ width: 300, height: 300 }, pieData, 1)!;

	it('keeps the value unchanged when dragging to the slices own current trailing edge', () => {
		const value = resolvePieDragValue(geometry, geometry.cx, geometry.cy + 50);
		expect(value).toBeCloseTo(25, 0);
	});

	it('shrinks the slice toward its leading edge (near zero span)', () => {
		// Just past the leading edge (angle 0 + a hair): an almost-zero slice.
		const angle = 0.01,
			x = geometry.cx + 50 * Math.cos(angle),
			y = geometry.cy + 50 * Math.sin(angle),
			value = resolvePieDragValue(geometry, x, y);
		expect(value).toBeLessThan(5);
		expect(value).toBeGreaterThanOrEqual(0);
	});

	it('grows the slice toward a much larger share, renormalising the others', () => {
		// Sweep the trailing edge to 180 degrees past the leading edge: half the circle.
		const angle = Math.PI,
			x = geometry.cx + 50 * Math.cos(angle),
			y = geometry.cy + 50 * Math.sin(angle),
			value = resolvePieDragValue(geometry, x, y);
		// Half the circle means slice1 == others combined (75), so slice1 == 75.
		expect(value).toBeCloseTo(75, 0);
	});

	it('preserves the sign of a negative slice value', () => {
		const negData: PptxChartData = {
				...pieData,
				series: [{ name: 'S', values: [25, -25, 25, 25] }],
			},
			geo = buildPieDragGeometry({ width: 300, height: 300 }, negData, 1)!,
			value = resolvePieDragValue(geo, geo.cx, geo.cy + 50);
		expect(value).toBeLessThan(0);
	});

	it('handles a single-slice pie without dividing by zero', () => {
		const single: PptxChartData = { ...pieData, series: [{ name: 'S', values: [10] }] },
			geo = buildPieDragGeometry({ width: 300, height: 300 }, single, 0)!,
			value = resolvePieDragValue(geo, geo.cx + 50, geo.cy - 1);
		expect(Number.isFinite(value)).toBeTruthy();
	});
});
