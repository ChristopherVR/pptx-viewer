/**
 * Unit tests for chart-interaction-radar.ts: radar vertex drag geometry and
 * value inversion. Hand-computed spoke positions, no DOM.
 */
import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildRadarDragGeometry, resolveRadarDragValue } from './chart-interaction-radar';

const radarData: PptxChartData = {
	chartType: 'radar',
	categories: ['A', 'B', 'C', 'D'],
	series: [{ name: 'S', values: [10, 20, 30, 40] }],
};

describe('buildRadarDragGeometry', () => {
	it('resolves centre/radius/maxVal/angle for a radar chart', () => {
		const geometry = buildRadarDragGeometry(
			{ width: 300, height: 300 },
			radarData,
			['A', 'B', 'C', 'D'],
			0,
		);
		expect(geometry).not.toBeNull();
		expect(geometry?.maxVal).toBe(40);
		expect(geometry?.radius).toBeGreaterThan(0);
		// Vertex 0 sits on the "up" spoke, angle -PI/2.
		expect(geometry?.angle).toBeCloseTo(-Math.PI / 2, 10);
	});

	it('returns null for a non-radar chart type', () => {
		expect(
			buildRadarDragGeometry(
				{ width: 300, height: 300 },
				{ ...radarData, chartType: 'bar' },
				['A', 'B', 'C', 'D'],
				0,
			),
		).toBeNull();
	});

	it('returns null for an out-of-range point index', () => {
		expect(
			buildRadarDragGeometry({ width: 300, height: 300 }, radarData, ['A', 'B', 'C', 'D'], 4),
		).toBeNull();
	});
});

describe('resolveRadarDragValue', () => {
	it('maps a pointer at the outer ring to maxVal', () => {
		const geometry = buildRadarDragGeometry(
				{ width: 300, height: 300 },
				radarData,
				['A', 'B', 'C', 'D'],
				0,
			)!,
			// Straight up from centre, at exactly the ring radius.
			value = resolveRadarDragValue(geometry, geometry.cx, geometry.cy - geometry.radius);
		expect(value).toBeCloseTo(geometry.maxVal, 0);
	});

	it('maps the centre to zero', () => {
		const geometry = buildRadarDragGeometry(
				{ width: 300, height: 300 },
				radarData,
				['A', 'B', 'C', 'D'],
				0,
			)!,
			value = resolveRadarDragValue(geometry, geometry.cx, geometry.cy);
		expect(value).toBe(0);
	});

	it('maps a pointer at half the ring radius to half of maxVal', () => {
		const geometry = buildRadarDragGeometry(
				{ width: 300, height: 300 },
				radarData,
				['A', 'B', 'C', 'D'],
				0,
			)!,
			value = resolveRadarDragValue(geometry, geometry.cx, geometry.cy - geometry.radius / 2);
		expect(value).toBeCloseTo(geometry.maxVal / 2, 0);
	});

	it('clamps a pointer dragged past the centre to zero (never negative)', () => {
		const geometry = buildRadarDragGeometry(
				{ width: 300, height: 300 },
				radarData,
				['A', 'B', 'C', 'D'],
				0,
			)!,
			// Pointer below centre: the opposite direction of vertex 0's "up" spoke.
			value = resolveRadarDragValue(geometry, geometry.cx, geometry.cy + geometry.radius);
		expect(value).toBe(0);
	});

	it('ignores perpendicular drift off the spoke (radial-only drag)', () => {
		const geometry = buildRadarDragGeometry(
				{ width: 300, height: 300 },
				radarData,
				['A', 'B', 'C', 'D'],
				0,
			)!,
			onSpoke = resolveRadarDragValue(geometry, geometry.cx, geometry.cy - geometry.radius),
			// Same radial distance, but offset sideways: the radial COMPONENT along
			// the spoke should still read close to the same value.
			offSpoke = resolveRadarDragValue(
				geometry,
				geometry.cx + geometry.radius * 0.3,
				geometry.cy - geometry.radius,
			);
		expect(offSpoke).toBeCloseTo(onSpoke, 0);
	});
});
