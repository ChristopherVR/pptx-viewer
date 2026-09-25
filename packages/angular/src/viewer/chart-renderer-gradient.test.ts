/**
 * Chart gradient fills (COM: charts-com.pptx slide 23) reach the view model
 * `ChartRendererComponent` projects: its template renders every
 * `linearGradient` / `radialGradient` def ahead of the marks that reference
 * it. Asserted through the same vendored builder the component calls (see
 * `chart-renderer.component.test.ts` for why no TestBed mount).
 */
import type { ChartPptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildChartViewModel } from './chart-renderer-helpers';

const stops = [
	{ color: '#595959', position: 0 },
	{ color: '#262626', position: 100 },
];

describe('chartRenderer gradient fills', () => {
	it('emits gradient defs for the chart area and the series bars', () => {
		const element = {
			id: 'c',
			type: 'chart',
			x: 0,
			y: 0,
			width: 400,
			height: 300,
			chartData: {
				chartType: 'bar',
				categories: ['A'],
				series: [{ name: 'S', values: [1], gradientFill: { type: 'linear', angle: 90, stops } }],
				style: { chartAreaGradient: { type: 'radial', stops } },
			},
		} as ChartPptxElement;
		const vm = buildChartViewModel(element);
		expect(vm.defs?.map((d) => d.kind)).toStrictEqual(['radialGradient', 'linearGradient']);
		expect(vm.areaFill).toBe('url(#c-grad-area)');
	});
});
