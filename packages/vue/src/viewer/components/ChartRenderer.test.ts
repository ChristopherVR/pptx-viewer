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
		// Count only rects with rx="1": those are the bars.
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
		// Shared-engine convergence: stacked bars now route through the shared
		// `buildBars` (grouping 'stacked'), which gives stacked rects `rx: 1`
		// (the bespoke Vue stacked renderer drew square corners). 2 series x 3
		// categories = 6 stacked segments, each a non-background rect with rx="1".
		const bars = wrapper
			.findAll('rect')
			.filter((r) => r.attributes('fill') !== '#0f172a11' && r.attributes('rx') === '1');
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

	it('renders a filled area band + outline polyline per series for an area chart', () => {
		const wrapper = mount(ChartRenderer, {
			props: { element: chartElement(data('area')), zIndex: 0 },
		});
		// Shared-engine convergence: the shared `buildAreas` draws the filled band
		// as a `polyline` (baseline + points, with fill + 0.25 opacity) rather than
		// the bespoke Vue renderer's `<polygon>`, plus a separate outline polyline.
		// So an area chart now emits 0 polygons and 2 polylines per series
		// (2 series = 4 polylines), and no <polygon>.
		expect(wrapper.findAll('polygon')).toHaveLength(0);
		expect(wrapper.findAll('polyline')).toHaveLength(4);
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

	it('renders an SVG (not a placeholder) for a surface chart', () => {
		const wrapper = mount(ChartRenderer, {
			props: { element: chartElement(data('surface')), zIndex: 0 },
		});
		expect(wrapper.find('.pptx-vue-chart-placeholder').exists()).toBeFalsy();
		expect(wrapper.find('svg').exists()).toBeTruthy();
	});

	it('renders an SVG (not a placeholder) for a regionMap chart', () => {
		const wrapper = mount(ChartRenderer, {
			props: { element: chartElement(data('regionMap')), zIndex: 0 },
		});
		expect(wrapper.find('.pptx-vue-chart-placeholder').exists()).toBeFalsy();
		expect(wrapper.find('svg').exists()).toBeTruthy();
	});

	// Pie-of-pie used to hit Vue's local dispatch table, which had no branch for
	// it and fell through to the placeholder - while React, Angular, Svelte and
	// Vanilla all drew it, because the shared engine has had a `buildOfPieViewModel`
	// for as long as the token has existed. Vue now asks shared what the kind is.
	it('draws pie-of-pie through the shared engine instead of a placeholder', () => {
		const wrapper = mount(ChartRenderer, {
			props: { element: chartElement(data('ofPie')), zIndex: 0 },
		});
		expect(wrapper.find('.pptx-vue-chart-placeholder').exists()).toBeFalsy();
		expect(wrapper.findAll('path').length).toBeGreaterThanOrEqual(3);
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

	// ── Exotic chart types ──────────────────────────────────────────

	it('renders an SVG (not a placeholder) for a radar chart', () => {
		const wrapper = mount(ChartRenderer, {
			props: { element: chartElement(data('radar')), zIndex: 0 },
		});
		expect(wrapper.find('.pptx-vue-chart-placeholder').exists()).toBeFalsy();
		expect(wrapper.find('svg').exists()).toBeTruthy();
		// Radar draws ring polygons and series polygons
		expect(wrapper.findAll('polygon').length).toBeGreaterThanOrEqual(1);
	});

	it('renders an SVG with circles for a scatter chart', () => {
		const wrapper = mount(ChartRenderer, {
			props: { element: chartElement(data('scatter')), zIndex: 0 },
		});
		expect(wrapper.find('.pptx-vue-chart-placeholder').exists()).toBeFalsy();
		expect(wrapper.find('svg').exists()).toBeTruthy();
		// 2 series × 3 values = 6 dots
		expect(wrapper.findAll('circle').length).toBeGreaterThanOrEqual(6);
	});

	it('renders an SVG with circles for a bubble chart', () => {
		const wrapper = mount(ChartRenderer, {
			props: {
				element: chartElement(
					data('bubble', {
						series: [
							{ name: 'X', values: [1, 2, 3] },
							{ name: 'Y', values: [4, 5, 6] },
							{ name: 'Size', values: [10, 20, 30] },
						],
					}),
				),
				zIndex: 0,
			},
		});
		expect(wrapper.find('.pptx-vue-chart-placeholder').exists()).toBeFalsy();
		expect(wrapper.find('svg').exists()).toBeTruthy();
		expect(wrapper.findAll('circle').length).toBeGreaterThanOrEqual(3);
	});

	it('renders an SVG with coloured rects for a waterfall chart', () => {
		const wrapper = mount(ChartRenderer, {
			props: {
				element: chartElement(
					data('waterfall', {
						series: [{ name: 'Cash Flow', values: [100, -30, 50, -20, 80] }],
					}),
				),
				zIndex: 0,
			},
		});
		expect(wrapper.find('.pptx-vue-chart-placeholder').exists()).toBeFalsy();
		expect(wrapper.find('svg').exists()).toBeTruthy();
		// At least some rects drawn by the shared waterfall builder
		expect(wrapper.findAll('rect').length).toBeGreaterThanOrEqual(1);
	});

	it('renders an SVG with paths for a funnel chart', () => {
		const wrapper = mount(ChartRenderer, {
			props: {
				element: chartElement(
					data('funnel', {
						series: [{ name: 'Stage', values: [100, 80, 60, 40] }],
					}),
				),
				zIndex: 0,
			},
		});
		expect(wrapper.find('.pptx-vue-chart-placeholder').exists()).toBeFalsy();
		expect(wrapper.find('svg').exists()).toBeTruthy();
		expect(wrapper.findAll('path').length).toBeGreaterThanOrEqual(4);
	});

	it('renders an SVG with paths for a sunburst chart', () => {
		const wrapper = mount(ChartRenderer, {
			props: {
				element: chartElement(
					data('sunburst', {
						series: [
							{ name: 'Ring1', values: [30, 40, 30] },
							{ name: 'Ring2', values: [20, 50, 30] },
						],
					}),
				),
				zIndex: 0,
			},
		});
		expect(wrapper.find('.pptx-vue-chart-placeholder').exists()).toBeFalsy();
		expect(wrapper.find('svg').exists()).toBeTruthy();
		expect(wrapper.findAll('path').length).toBeGreaterThanOrEqual(3);
	});

	it('renders an SVG with rects for a treemap chart', () => {
		const wrapper = mount(ChartRenderer, {
			props: { element: chartElement(data('treemap')), zIndex: 0 },
		});
		expect(wrapper.find('.pptx-vue-chart-placeholder').exists()).toBeFalsy();
		expect(wrapper.find('svg').exists()).toBeTruthy();
		// treemap draws one rect per data point (3 values across 2 series = 6 items)
		expect(wrapper.findAll('rect').length).toBeGreaterThanOrEqual(1);
	});

	it('renders an SVG with bars and lines for a combo chart', () => {
		const wrapper = mount(ChartRenderer, {
			props: { element: chartElement(data('combo')), zIndex: 0 },
		});
		expect(wrapper.find('.pptx-vue-chart-placeholder').exists()).toBeFalsy();
		expect(wrapper.find('svg').exists()).toBeTruthy();
		// First series as bars, second as line
		expect(wrapper.findAll('polyline').length).toBeGreaterThanOrEqual(1);
	});

	it('renders an SVG with candles for a stock chart', () => {
		const wrapper = mount(ChartRenderer, {
			props: {
				element: chartElement(
					data('stock', {
						series: [
							{ name: 'High', values: [120, 130, 125] },
							{ name: 'Low', values: [100, 110, 105] },
							{ name: 'Close', values: [115, 125, 118] },
						],
					}),
				),
				zIndex: 0,
			},
		});
		expect(wrapper.find('.pptx-vue-chart-placeholder').exists()).toBeFalsy();
		expect(wrapper.find('svg').exists()).toBeTruthy();
		// One wick line + one body rect per category (3 categories)
		expect(wrapper.findAll('rect').length).toBeGreaterThanOrEqual(3);
		expect(wrapper.findAll('line').length).toBeGreaterThanOrEqual(3);
	});

	it('renders an SVG with contiguous bars for a histogram chart', () => {
		const wrapper = mount(ChartRenderer, {
			props: {
				element: chartElement(
					data('histogram', {
						series: [{ name: 'Frequency', values: [5, 12, 20, 15, 8] }],
					}),
				),
				zIndex: 0,
			},
		});
		expect(wrapper.find('.pptx-vue-chart-placeholder').exists()).toBeFalsy();
		expect(wrapper.find('svg').exists()).toBeTruthy();
		expect(wrapper.findAll('rect').length).toBeGreaterThanOrEqual(5);
	});

	it('renders an SVG with box shapes for a boxWhisker chart', () => {
		const wrapper = mount(ChartRenderer, {
			props: {
				element: chartElement(
					data('boxWhisker', {
						categories: ['Group A', 'Group B'],
						series: [
							{ name: 'Min', values: [5, 8] },
							{ name: 'Q1', values: [15, 18] },
							{ name: 'Median', values: [25, 28] },
							{ name: 'Q3', values: [35, 38] },
							{ name: 'Max', values: [45, 48] },
						],
					}),
				),
				zIndex: 0,
			},
		});
		expect(wrapper.find('.pptx-vue-chart-placeholder').exists()).toBeFalsy();
		expect(wrapper.find('svg').exists()).toBeTruthy();
		// 2 categories → 2 box-whisker groups with multiple lines each
		expect(wrapper.findAll('line').length).toBeGreaterThanOrEqual(4);
	});
});

/**
 * Regression cover for the six kinds Vue used to draw with bespoke components
 * (waterfall / combo / stock / surface / treemap / regionMap). They emitted no
 * `data-chart-part` attributes, so on-canvas mark selection did nothing for
 * exactly these kinds while it worked in Angular, Svelte and Vanilla.
 */
describe('chartRenderer: interactive marks on the formerly bespoke kinds', () => {
	const cases: Array<[string, PptxChartData]> = [
		['waterfall', data('waterfall', { series: [{ name: 'Cash flow', values: [45, 62, 58] }] })],
		['combo', data('combo')],
		[
			'stock',
			data('stock', {
				series: [
					{ name: 'Open', values: [42, 58, 55] },
					{ name: 'High', values: [50, 65, 62] },
					{ name: 'Low', values: [38, 52, 51] },
					{ name: 'Close', values: [47, 61, 53] },
				],
			}),
		],
		['treemap', data('treemap')],
		['regionMap', data('regionMap', { categories: ['United States', 'Germany', 'China'] })],
		['surface', data('surface')],
	];

	for (const [name, chartData] of cases) {
		it(`tags ${name} data marks so the canvas can select them`, () => {
			const wrapper = mount(ChartRenderer, {
				props: { element: chartElement(chartData), zIndex: 0 },
			});
			expect(wrapper.findAll('[data-chart-part="dataPoint"]').length).toBeGreaterThan(0);
		});
	}

	/**
	 * The bespoke waterfall scaled cumulative bars against the RAW value range,
	 * so a rising waterfall ran off the top of the plot.
	 */
	it('keeps every waterfall bar inside the plot box', () => {
		const wrapper = mount(ChartRenderer, {
			props: {
				element: chartElement(
					data('waterfall', { series: [{ name: 'Cash flow', values: [45, 62, 58, 71] }] }),
				),
				zIndex: 0,
			},
		});
		const bars = wrapper.findAll('rect');
		expect(bars.length).toBeGreaterThan(1);
		for (const bar of bars) {
			const y = Number(bar.attributes('y'));
			const h = Number(bar.attributes('height'));
			expect(y).toBeGreaterThanOrEqual(-8);
			expect(y + h).toBeLessThanOrEqual(308);
		}
	});

	it('names each region-map region in a tooltip', () => {
		const wrapper = mount(ChartRenderer, {
			props: {
				element: chartElement(data('regionMap', { categories: ['United States', 'Germany'] })),
				zIndex: 0,
			},
		});
		expect(wrapper.html()).toContain('United States: 10');
	});
});
