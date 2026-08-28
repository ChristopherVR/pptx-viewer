/**
 * Contract tests for the interactive 3D line3D-chart wiring.
 *
 * `LineChart3DRendererComponent` itself dynamically imports the vendored
 * scene runtime (which pulls the optional `three` peer) and mounts a WebGL
 * scene, which needs a real WebGL context happy-dom does not provide. This
 * file follows the same pattern as `bar-chart-3d-renderer.component.test.ts`:
 * assert the pure data adapter is reachable through the barrel every Angular
 * source imports from, and that the vendored scene module exposes the shape
 * the component relies on.
 */
import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildLineChart3DDataForElement } from '../internal/shared';

function chartElement(chartData: PptxChartData | undefined): PptxElement {
	return {
		id: 'ch-1',
		type: 'chart',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData,
	} as unknown as PptxElement;
}

describe('buildLineChart3DDataForElement (via the ../internal/shared barrel)', () => {
	it('is reachable through the vendored shared barrel Angular imports from', () => {
		expect(buildLineChart3DDataForElement).toBeTypeOf('function');
	});

	it('returns null for a plain (non-3D) line chart', () => {
		const data: PptxChartData = {
			chartType: 'line',
			categories: ['A'],
			series: [{ name: 'S', values: [1] }],
		};
		expect(
			buildLineChart3DDataForElement(chartElement(data), { width: 400, height: 300 }),
		).toBeNull();
	});

	it('returns a mountable per-series path layout for a line3D chart with data', () => {
		const data: PptxChartData = {
			chartType: 'line3D',
			categories: ['A', 'B'],
			series: [
				{ name: 'S1', values: [1, 2] },
				{ name: 'S2', values: [3, 4] },
			],
		};
		const result = buildLineChart3DDataForElement(chartElement(data), { width: 400, height: 300 });
		expect(result).not.toBeNull();
		expect(result!.cols).toBe(2);
		expect(result!.rows).toBe(2);
		expect(result!.series).toHaveLength(2);
	});
});

describe('shared line-chart-3d-scene contract (vendored path)', () => {
	it('exports mountLineChart3D and a no-op LINE_CHART_THREE_UNAVAILABLE sentinel', async () => {
		const mod = await import('../internal/shared-src/render/line-chart-3d-scene');
		expect(mod.mountLineChart3D).toBeTypeOf('function');
		expect(mod.LINE_CHART_THREE_UNAVAILABLE.ok).toBeFalsy();
		expect(() => mod.LINE_CHART_THREE_UNAVAILABLE.dispose()).not.toThrow();
	});
});
