/**
 * Regression test: c:dPt/c:pictureOptions picture fill (C2-G9 render half),
 * reaching Angular through the same vendored shared pipeline
 * `ChartRendererComponent`'s template consumes.
 *
 * Angular components can't be mounted here (`connector-renderer.component.test.ts`
 * notes TestBed needs `@analogjs/vite-plugin-angular`, a follow-up), so this
 * exercises the exact data the template reads: `buildChartViewModel` (via the
 * `chart-renderer-helpers` shim the component itself imports) for `vm.defs`
 * and the `fill: url(#...)` rewritten onto the matching data-point rect in
 * `vm.primitives`, which is exactly what the `@if ((vm().defs ?? []).length >
 * 0)` / `<pattern>` block in `chart-renderer.component.ts` renders.
 */
import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildChartViewModel } from './chart-renderer-helpers';

function chartElement(chartData: PptxChartData): PptxElement {
	return {
		id: 'el-chart',
		type: 'chart',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData,
	} as PptxElement;
}

describe('chartRendererComponent data source: c:dPt/c:pictureOptions picture fill', () => {
	it('populates vm.defs with a pattern and rewrites the matching rect fill to url(#...)', () => {
		const element = chartElement({
			chartType: 'bar',
			categories: ['Q1', 'Q2'],
			series: [
				{
					name: 'Revenue',
					values: [100, 150],
					dataPoints: [
						{
							idx: 0,
							picture: { imageUrl: 'data:image/png;base64,AAA', pictureFormat: 'stretch' },
						},
					],
				},
			],
		});
		const vm = buildChartViewModel(element);
		expect(vm.defs).toHaveLength(1);
		expect(vm.defs![0].href).toBe('data:image/png;base64,AAA');
		const filledRect = vm.primitives.find(
			(p) => p.kind === 'rect' && p.fill === `url(#${vm.defs![0].id})`,
		);
		expect(filledRect).toBeDefined();
	});

	it('leaves vm.defs undefined when no data point has a picture fill', () => {
		const element = chartElement({
			chartType: 'bar',
			categories: ['Q1'],
			series: [{ name: 'Revenue', values: [100] }],
		});
		expect(buildChartViewModel(element).defs).toBeUndefined();
	});
});
