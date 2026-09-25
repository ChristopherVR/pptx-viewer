// @vitest-environment jsdom
import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildGradientDef } from './chart-gradient-defs';
import { buildChartViewModel } from './chart-view-model';
import { renderPatternDef } from './chart-view-model-dom-helpers';

const stops = [
	{ color: '#595959', position: 0 },
	{ color: '#262626', position: 100 },
];

describe('buildGradientDef (COM: charts-com.pptx slide 23)', () => {
	it('maps a:lin ang=90deg to a top-to-bottom vector', () => {
		expect(buildGradientDef('g', { type: 'linear', angle: 90, stops })).toStrictEqual({
			kind: 'linearGradient',
			id: 'g',
			x1: 0.5,
			y1: 0,
			x2: 0.5,
			y2: 1,
			stops: [
				{ offset: 0, color: '#595959' },
				{ offset: 1, color: '#262626' },
			],
		});
	});

	it('centres a circle path gradient on its focal point', () => {
		const def = buildGradientDef('g', { type: 'radial', stops, focalPoint: { x: 0.5, y: 0.5 } });
		expect(def).toMatchObject({ kind: 'radialGradient', cx: 0.5, cy: 0.5 });
	});

	it('renders as an SVG gradient node for the vanilla projector', () => {
		const node = renderPatternDef(
			document,
			buildGradientDef('g', { type: 'linear', angle: 0, stops }),
		);
		expect(node.tagName).toBe('linearGradient');
		expect(node.querySelectorAll('stop')).toHaveLength(2);
	});
});

describe('withGradientFills through buildChartViewModel', () => {
	const chartData: PptxChartData = {
		chartType: 'bar',
		categories: ['A', 'B'],
		series: [
			{
				name: 'S1',
				values: [1, 2],
				gradientFill: { type: 'linear', angle: 90, stops },
			},
		],
		style: { chartAreaGradient: { type: 'radial', stops } },
	};
	const vm = buildChartViewModel({
		id: 'chart 1',
		type: 'chart',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData,
	} as never);

	it('paints the chart area and every bar of the series with a gradient def', () => {
		expect(vm.areaFill).toBe('url(#chart_1-grad-area)');
		const bars = vm.primitives.filter((p) => p.kind === 'rect' && p.part?.seriesIndex === 0);
		expect(bars.length).toBeGreaterThan(0);
		expect(bars.every((b) => b.kind === 'rect' && b.fill === 'url(#chart_1-grad-s0)')).toBeTruthy();
		expect(vm.defs?.map((d) => d.kind)).toStrictEqual(['radialGradient', 'linearGradient']);
	});
});
