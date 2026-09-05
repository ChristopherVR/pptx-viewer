/**
 * Unit tests for chart-interaction-mark-drag.ts: the pointer/state machine
 * that drives a pie/radar/stacked mark drag end-to-end. No DOM; `ChartClientRect`
 * is a plain object.
 */
import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildChartMarkDragGeometry } from './chart-interaction';
import {
	advanceChartMarkDrag,
	beginChartMarkDrag,
	clientPointToViewBox,
} from './chart-interaction-mark-drag';

const pieData: PptxChartData = {
	chartType: 'pie',
	categories: ['A', 'B', 'C', 'D'],
	series: [{ name: 'S', values: [25, 25, 25, 25] }],
};

describe('clientPointToViewBox', () => {
	it('scales a client point into view-box units', () => {
		const rect = { left: 100, top: 50, width: 200, height: 100 },
			point = clientPointToViewBox(200, 100, rect, 400, 200);
		// (200-100)/200 * 400 = 200; (100-50)/100 * 200 = 100.
		expect(point).toStrictEqual({ x: 200, y: 100 });
	});

	it('returns the origin for a zero-size rect instead of dividing by zero', () => {
		expect(
			clientPointToViewBox(10, 10, { left: 0, top: 0, width: 0, height: 0 }, 100, 100),
		).toStrictEqual({
			x: 0,
			y: 0,
		});
	});
});

describe('beginChartMarkDrag / advanceChartMarkDrag', () => {
	it('drives a full pie slice drag from a synthetic pointer path', () => {
		const geometry = buildChartMarkDragGeometry({
				kind: 'pie',
				element: { width: 300, height: 300 },
				chartData: pieData,
				categoryLabels: ['A', 'B', 'C', 'D'],
				seriesIndex: 0,
				pointIndex: 1,
			}),
			state = beginChartMarkDrag({
				part: { role: 'dataPoint', seriesIndex: 0, pointIndex: 1 },
				geometry,
				chartData: pieData,
				svgWidth: 300,
				svgHeight: 300,
				clientX: 300,
				clientY: 300,
			});
		expect(state).not.toBeNull();

		const rect = { left: 150, top: 150, width: 150, height: 150 };
		// Below threshold: 1:1 client-to-view-box scale here, so a tiny move is a click.
		expect(advanceChartMarkDrag(state!, 301, 300, rect)).toBeNull();

		// Move the pointer to the view-box point (cx, cy + 50): slice 1's own
		// current trailing edge (see chart-interaction-pie.test.ts), so the
		// value should round-trip back to ~25.
		const clientX = rect.left + 150 / 2,
			clientY = rect.top + (150 / 2 + 50),
			step = advanceChartMarkDrag(state!, clientX, clientY, rect);
		expect(step).not.toBeNull();
		expect(step?.value).toBeCloseTo(25, 0);
		expect(step?.chartData.series[0].values[1]).toBe(step?.value);
		// The base chart data is never mutated.
		expect(pieData.series[0].values[1]).toBe(25);
	});

	it('returns null when there is no geometry for the part', () => {
		expect(
			beginChartMarkDrag({
				part: { role: 'dataPoint', seriesIndex: 0, pointIndex: 1 },
				geometry: null,
				chartData: pieData,
				svgWidth: 300,
				svgHeight: 300,
				clientX: 0,
				clientY: 0,
			}),
		).toBeNull();
	});

	it('returns null for a series-role part (no single point to edit)', () => {
		const geometry = buildChartMarkDragGeometry({
			kind: 'pie',
			element: { width: 300, height: 300 },
			chartData: pieData,
			categoryLabels: ['A', 'B', 'C', 'D'],
			seriesIndex: 0,
			pointIndex: 1,
		});
		expect(
			beginChartMarkDrag({
				part: { role: 'series', seriesIndex: 0 },
				geometry,
				chartData: pieData,
				svgWidth: 300,
				svgHeight: 300,
				clientX: 0,
				clientY: 0,
			}),
		).toBeNull();
	});
});
