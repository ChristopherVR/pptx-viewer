import { mount } from '@vue/test-utils';
import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import type { ChartViewModel, SvgLine, SvgPrimitive, SvgRect, SvgText } from 'pptx-viewer-shared';
import { buildChartViewModel } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import ChartViewModelSvg from './ChartViewModelSvg.vue';

/**
 * Projector tests for the Vue chart view-model renderer.
 *
 * Mirror of React's `chart-view-model-render.test.tsx`: verify the new
 * ChartViewModel fields the shared cartesian builder emits, namely
 * `secondaryGridlines`, `secondaryAxisLabels`, overlay primitives, and
 * data-table primitives (the latter two flow through `vm.primitives`).
 */

function baseViewModel(overrides: Partial<ChartViewModel>): ChartViewModel {
	return {
		svgWidth: 400,
		svgHeight: 300,
		title: undefined,
		titleX: 200,
		titleY: 12,
		gridlines: [],
		axisLabels: [],
		zeroLine: undefined,
		categoryLabels: [],
		primitives: [],
		dataLabels: [],
		legend: [],
		legendX: 200,
		legendY: 292,
		legendAnchor: 'middle',
		...overrides,
	};
}

function secondaryLine(y: number): SvgLine {
	return {
		kind: 'line',
		x1: 8,
		y1: y,
		x2: 392,
		y2: y,
		stroke: '#e2e8f0',
		strokeWidth: 0.5,
		dashArray: '2 3',
		opacity: 0.5,
	};
}

function secondaryLabel(y: number, text: string): SvgText {
	return {
		kind: 'text',
		x: 396,
		y,
		text,
		fontSize: 8,
		fill: '#64748b',
		textAnchor: 'start',
		dominantBaseline: 'central',
	};
}

function mountVm(vm: ChartViewModel) {
	return mount(ChartViewModelSvg, { props: { elementId: 'c1', vm } });
}

describe('chartViewModelSvg: secondary value axis', () => {
	it('renders a dashed right-side line per secondary gridline', () => {
		const wrapper = mountVm(
			baseViewModel({
				secondaryGridlines: [secondaryLine(50), secondaryLine(150), secondaryLine(250)],
			}),
		);
		const dashed = wrapper
			.findAll('line')
			.filter((l) => l.attributes('stroke-dasharray') === '2 3');
		expect(dashed).toHaveLength(3);
		expect(dashed[0].attributes('opacity')).toBe('0.5');
	});

	it('renders a right-anchored label per secondary axis tick', () => {
		const wrapper = mountVm(
			baseViewModel({
				secondaryAxisLabels: [secondaryLabel(50, '10'), secondaryLabel(250, '90')],
			}),
		);
		const starts = wrapper.findAll('text').filter((t) => t.attributes('text-anchor') === 'start');
		expect(starts).toHaveLength(2);
		const content = starts.map((t) => t.text());
		expect(content).toContain('10');
		expect(content).toContain('90');
	});

	it('honours a rotate transform on a secondary axis title label', () => {
		const titled: SvgText = {
			kind: 'text',
			x: 428,
			y: 150,
			text: 'Growth %',
			fontSize: 9,
			fill: '#64748b',
			textAnchor: 'middle',
			transform: 'rotate(-90, 428, 150)',
		};
		const wrapper = mountVm(baseViewModel({ secondaryAxisLabels: [titled] }));
		const rotated = wrapper
			.findAll('text')
			.filter((t) => t.attributes('transform') === 'rotate(-90, 428, 150)');
		expect(rotated).toHaveLength(1);
		expect(rotated[0].text()).toBe('Growth %');
	});

	it('omits secondary axis output when the fields are absent', () => {
		const wrapper = mountVm(baseViewModel({}));
		const dashed = wrapper.findAll('line').filter((l) => l.attributes('stroke-dasharray'));
		expect(dashed).toHaveLength(0);
	});
});

describe('chartViewModelSvg: overlays and data table (via primitives)', () => {
	it('projects overlay primitives (trendline path + error-bar line)', () => {
		const overlays: SvgPrimitive[] = [
			{ kind: 'path', d: 'M0,0 L100,100', fill: 'none', stroke: '#4472C4', strokeWidth: 1.5 },
			{ kind: 'line', x1: 10, y1: 20, x2: 10, y2: 60, stroke: '#334155', strokeWidth: 1 },
		];
		const wrapper = mountVm(baseViewModel({ primitives: overlays, overlays }));
		const paths = wrapper.findAll('path').filter((p) => p.attributes('d') === 'M0,0 L100,100');
		expect(paths).toHaveLength(1);
		expect(paths[0].attributes('stroke')).toBe('#4472C4');
		const lines = wrapper.findAll('line').filter((l) => l.attributes('x1') === '10');
		expect(lines).toHaveLength(1);
	});

	it('projects data-table primitives (rect + line + text block)', () => {
		const rect: SvgRect = { kind: 'rect', x: 8, y: 260, w: 384, h: 14, fill: '#f1f5f9' };
		const line: SvgLine = {
			kind: 'line',
			x1: 8,
			y1: 274,
			x2: 392,
			y2: 274,
			stroke: '#cbd5e1',
			strokeWidth: 1,
		};
		const text: SvgText = {
			kind: 'text',
			x: 12,
			y: 270,
			text: 'Series 1',
			fontSize: 7,
			fill: '#334155',
			textAnchor: 'start',
		};
		const dataTable: SvgPrimitive[] = [rect, line, text];
		const wrapper = mountVm(baseViewModel({ primitives: dataTable, dataTable }));
		const rects = wrapper.findAll('rect').filter((r) => r.attributes('fill') === '#f1f5f9');
		expect(rects).toHaveLength(1);
		expect(wrapper.text()).toContain('Series 1');
	});

	it('honours per-path opacity on overlay primitives', () => {
		const overlays: SvgPrimitive[] = [
			{
				kind: 'path',
				d: 'M0,0 L50,50',
				fill: '#4472C4',
				stroke: 'none',
				strokeWidth: 0,
				opacity: 0.3,
			},
		];
		const wrapper = mountVm(baseViewModel({ primitives: overlays, overlays }));
		const paths = wrapper.findAll('path').filter((p) => p.attributes('d') === 'M0,0 L50,50');
		expect(paths).toHaveLength(1);
		expect(paths[0].attributes('fill-opacity')).toBe('0.3');
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// End-to-end regression: c:dTable data table + c:legendEntry deletion.
//
// Unlike the tests above (hand-built ChartViewModel fixtures), these run a
// real chart element through the shared `buildChartViewModel` first, so they
// prove the whole shared pipeline (core parse -> chart-view-model ->
// chart-data-table-render / chart-legend-entries) reaches Vue's rendered DOM,
// not just that the component can render an arbitrary primitive.
// ─────────────────────────────────────────────────────────────────────────────

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

describe('chartViewModelSvg: c:dTable data table (real chart pipeline)', () => {
	it('renders the data table grid below the plot, including the series key text', () => {
		const element = chartElement({
			chartType: 'bar',
			categories: ['Q1', 'Q2'],
			series: [{ name: 'Revenue', values: [100, 150] }],
			dataTable: { showKeys: true, showOutline: true },
		});
		const wrapper = mountVm(buildChartViewModel(element));
		expect(wrapper.text()).toContain('Revenue');
		expect(wrapper.text()).toContain('Q1');
	});
});

describe('chartViewModelSvg: c:legendEntry deletion (real chart pipeline)', () => {
	it('omits a deleted series from the rendered legend', () => {
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
		const wrapper = mountVm(buildChartViewModel(element));
		// `wrapper.text()` also picks up per-mark `<title>` tooltips (which still
		// say "Cost" for hover), so assert on `<text>` element content directly.
		const labels = wrapper.findAll('text').map((t) => t.text());
		expect(labels).toContain('Revenue');
		expect(labels).not.toContain('Cost');
	});
});
