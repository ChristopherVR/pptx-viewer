/**
 * W4-D: chart title rich text (`c:title/c:tx/c:rich`, `titleRuns`), reaching
 * Angular through the same vendored shared pipeline `ChartRendererComponent`'s
 * template consumes.
 *
 * Angular components can't be mounted here (`connector-renderer.component.test.ts`
 * notes TestBed needs `@analogjs/vite-plugin-angular`, a follow-up), so this
 * exercises the exact data the template reads: `buildChartViewModel` (via the
 * `chart-renderer-helpers` shim the component itself imports) for
 * `vm.titleRunSpans`, which is exactly what the `@if (vm().titleRunSpans; as
 * titleRunSpans)` / `<tspan>` block in `chart-renderer.component.ts` renders.
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

describe('chartRendererComponent data source: chart title rich text (titleRunSpans)', () => {
	it('resolves one titleRunSpans entry per typed titleRuns run', () => {
		const element = chartElement({
			chartType: 'bar',
			title: 'Sales Q1',
			categories: ['Q1'],
			series: [{ name: 'Revenue', values: [10] }],
			style: { hasTitle: true },
			titleRuns: [
				{ text: 'Sales ', bold: true },
				{ text: 'Q1', italic: true, color: '#FF0000' },
			],
		});
		const vm = buildChartViewModel(element);
		expect(vm.titleRunSpans).toStrictEqual([
			{ text: 'Sales ', fontSize: 12, fontWeight: 700, fill: '#1e293b' },
			{ text: 'Q1', fontSize: 12, fontWeight: 600, fontStyle: 'italic', fill: '#FF0000' },
		]);
	});

	it('leaves vm.titleRunSpans undefined when the title has no typed runs', () => {
		const element = chartElement({
			chartType: 'bar',
			title: 'Sales',
			categories: ['Q1'],
			series: [{ name: 'Revenue', values: [10] }],
			style: { hasTitle: true },
		});
		expect(buildChartViewModel(element).titleRunSpans).toBeUndefined();
	});
});
