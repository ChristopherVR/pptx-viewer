/**
 * Regression tests: c:dTable data table (gap 1) and c:legendEntry deletion /
 * text-style (gap 2), reaching Angular through the same vendored shared
 * pipeline `ChartRendererComponent`'s template consumes.
 *
 * Angular components can't be mounted here (`connector-renderer.component.test.ts`
 * notes TestBed needs `@analogjs/vite-plugin-angular`, a follow-up), so this
 * exercises the exact data the template reads: `buildChartViewModel` (via the
 * `chart-renderer-helpers` shim the component itself imports) for
 * `vm.dataTable` / `vm.primitives`, and `computeChartLegendLayout` (via the
 * `../internal/shared` barrel the component imports) for the legend the
 * `@for (item of legendItems(); ...)` block in `chart-renderer.component.ts`
 * renders.
 */
import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { computeChartLegendLayout } from '../internal/shared';
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

describe('chartRendererComponent data source: c:dTable data table', () => {
	it('populates vm.dataTable, whose primitives include the series key text', () => {
		const element = chartElement({
			chartType: 'bar',
			categories: ['Q1', 'Q2'],
			series: [{ name: 'Revenue', values: [100, 150] }],
			dataTable: { showKeys: true, showOutline: true },
		});
		const vm = buildChartViewModel(element);
		expect(vm.dataTable).toBeDefined();
		expect(vm.dataTable!.length).toBeGreaterThan(0);
		const texts = vm.dataTable!.filter((p) => p.kind === 'text').map((p) => p.text);
		expect(texts).toContain('Revenue');
		// The component's `@for (prim of vm().primitives)` renders every
		// data-table primitive too, since they are appended to vm.primitives.
		for (const prim of vm.dataTable!) {
			expect(vm.primitives).toContain(prim);
		}
	});

	it('leaves vm.dataTable undefined when the chart has no c:dTable', () => {
		const element = chartElement({
			chartType: 'bar',
			categories: ['Q1'],
			series: [{ name: 'Revenue', values: [100] }],
		});
		expect(buildChartViewModel(element).dataTable).toBeUndefined();
	});
});

describe('chartRendererComponent data source: c:legendEntry deletion', () => {
	it('omits a deleted series from computeChartLegendLayout (what @for legendItems() renders)', () => {
		const element = chartElement({
			chartType: 'bar',
			categories: ['Q1'],
			series: [
				{ name: 'Revenue', values: [100] },
				{ name: 'Cost', values: [80] },
			],
			style: {
				hasLegend: true,
				legendPosition: 'b',
				legendEntries: [{ index: 1, deleted: true }],
			},
		});
		const vm = buildChartViewModel(element);
		const legendItems = computeChartLegendLayout(vm);
		expect(legendItems.map((i) => i.label)).toStrictEqual(['Revenue']);
	});

	it('applies a per-entry text-style override onto the resolved legend item', () => {
		const element = chartElement({
			chartType: 'bar',
			categories: ['Q1'],
			series: [{ name: 'Revenue', values: [100] }],
			style: {
				hasLegend: true,
				legendEntries: [{ index: 0, textStyle: { bold: true, color: '#ff0000' } }],
			},
		});
		const vm = buildChartViewModel(element);
		const [item] = computeChartLegendLayout(vm);
		expect(item.fontWeight).toBe('bold');
		expect(item.fill).toBe('#ff0000');
	});
});
