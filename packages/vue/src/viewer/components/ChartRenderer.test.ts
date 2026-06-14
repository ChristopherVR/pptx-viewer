import { mount } from '@vue/test-utils';
import type { PptxChartData, PptxChartType, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import ChartRenderer from './ChartRenderer.vue';

function chartElement(
	chartData: PptxChartData | undefined,
	overrides: Partial<PptxElement> = {},
): PptxElement {
	return {
		type: 'chart',
		id: 'chart 1',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData,
		...overrides,
	} as PptxElement;
}

function data(chartType: PptxChartType, extra: Partial<PptxChartData> = {}): PptxChartData {
	return {
		chartType,
		categories: ['A', 'B', 'C'],
		series: [
			{ name: 'Revenue', values: [10, 20, 30] },
			{ name: 'Cost', values: [5, 15, 25] },
		],
		style: { hasLegend: true, legendPosition: 'b' },
		...extra,
	};
}

describe('chartRenderer', () => {
	it('renders one rect per data point for a bar chart', () => {
		const wrapper = mount(ChartRenderer, {
			props: { element: chartElement(data('bar')), zIndex: 1 },
		});
		// 2 series × 3 categories = 6 data bars. (Plus a background rect.)
		// Count only rects with rx="1" — those are the bars.
		const bars = wrapper.findAll('rect').filter((r) => r.attributes('rx') === '1');
		expect(bars).toHaveLength(6);
	});

	it('renders a rect per data point for a column (bar3D maps to bar) chart', () => {
		const wrapper = mount(ChartRenderer, {
			props: { element: chartElement(data('bar3D')), zIndex: 0 },
		});
		const bars = wrapper.findAll('rect').filter((r) => r.attributes('rx') === '1');
		expect(bars).toHaveLength(6);
	});

	it('renders stacked bars for stacked grouping', () => {
		const wrapper = mount(ChartRenderer, {
			props: {
				element: chartElement(data('bar', { grouping: 'stacked' })),
				zIndex: 0,
			},
		});
		// Stacked rects have no rx="1"; background rect has fill #0f172a11.
		const bars = wrapper
			.findAll('rect')
			.filter((r) => r.attributes('fill') !== '#0f172a11' && r.attributes('rx') === undefined);
		expect(bars.length).toBeGreaterThanOrEqual(6);
	});

	it('renders one path per slice for a pie chart', () => {
		const wrapper = mount(ChartRenderer, {
			props: { element: chartElement(data('pie')), zIndex: 0 },
		});
		// First series has 3 values → 3 slices.
		expect(wrapper.findAll('path')).toHaveLength(3);
	});

	it('renders one path per slice for a doughnut chart', () => {
		const wrapper = mount(ChartRenderer, {
			props: { element: chartElement(data('doughnut')), zIndex: 0 },
		});
		expect(wrapper.findAll('path')).toHaveLength(3);
	});

	it('renders a polyline for a line chart', () => {
		const wrapper = mount(ChartRenderer, {
			props: { element: chartElement(data('line')), zIndex: 0 },
		});
		// One polyline per series.
		expect(wrapper.findAll('polyline')).toHaveLength(2);
	});

	it('renders a filled polygon + polyline for an area chart', () => {
		const wrapper = mount(ChartRenderer, {
			props: { element: chartElement(data('area')), zIndex: 0 },
		});
		expect(wrapper.findAll('polygon')).toHaveLength(2);
		expect(wrapper.findAll('polyline')).toHaveLength(2);
	});

	it('shows series names in the legend', () => {
		const wrapper = mount(ChartRenderer, {
			props: { element: chartElement(data('bar')), zIndex: 0 },
		});
		const text = wrapper.text();
		expect(text).toContain('Revenue');
		expect(text).toContain('Cost');
	});

	it('renders data labels when enabled', () => {
		const wrapper = mount(ChartRenderer, {
			props: {
				element: chartElement(data('bar', { style: { hasDataLabels: true, hasLegend: false } })),
				zIndex: 0,
			},
		});
		// 6 bar values formatted as labels.
		const labels = wrapper.findAll('text').filter((t) => /^\d/u.test(t.text()));
		expect(labels.length).toBeGreaterThanOrEqual(6);
	});

	it('renders the labelled placeholder for an unsupported chart type', () => {
		const wrapper = mount(ChartRenderer, {
			props: { element: chartElement(data('radar')), zIndex: 0 },
		});
		expect(wrapper.find('.pptx-vue-chart-placeholder').exists()).toBeTruthy();
		expect(wrapper.text()).toContain('Chart: radar');
		expect(wrapper.find('svg').exists()).toBeFalsy();
	});

	it('renders the placeholder when chart data is missing', () => {
		const wrapper = mount(ChartRenderer, {
			props: { element: chartElement(undefined), zIndex: 0 },
		});
		expect(wrapper.find('.pptx-vue-chart-placeholder').exists()).toBeTruthy();
	});

	it('renders the placeholder when series are empty', () => {
		const wrapper = mount(ChartRenderer, {
			props: {
				element: chartElement(data('bar', { series: [] })),
				zIndex: 0,
			},
		});
		expect(wrapper.find('.pptx-vue-chart-placeholder').exists()).toBeTruthy();
	});
});
