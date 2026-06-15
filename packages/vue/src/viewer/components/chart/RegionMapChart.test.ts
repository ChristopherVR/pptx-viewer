import { mount } from '@vue/test-utils';
import type { PptxChartData } from 'pptx-viewer-core';
import type { PlotLayout } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import RegionMapChart from './RegionMapChart.vue';

function makeLayout(width = 400, height = 300): PlotLayout {
	return {
		plotLeft: 8,
		plotTop: 8,
		plotRight: width - 8,
		plotBottom: height - 8,
		plotWidth: width - 16,
		plotHeight: height - 16,
		svgWidth: width,
		svgHeight: height,
	};
}

function makeChartData(
	categories: string[],
	values: number[],
	extra: Partial<PptxChartData> = {},
): PptxChartData {
	return {
		chartType: 'regionMap',
		categories,
		series: [{ name: 'Values', values }],
		...extra,
	};
}

describe('regionMapChart', () => {
	it('renders a <path> element for each world region', () => {
		const chartData = makeChartData([], []);
		const wrapper = mount(RegionMapChart, {
			props: {
				chartData,
				layout: makeLayout(),
				categories: [],
			},
		});
		// 22 regions defined in WORLD_REGIONS
		const paths = wrapper.findAll('path');
		expect(paths).toHaveLength(22);
	});

	it('fills a matched region with a blue choropleth colour (not the default grey)', () => {
		const chartData = makeChartData(['United States', 'Canada'], [100, 50]);
		const wrapper = mount(RegionMapChart, {
			props: {
				chartData,
				layout: makeLayout(),
				categories: ['United States', 'Canada'],
			},
		});
		// The US path should not have the default grey fill '#e2e8f0'
		const usPaths = wrapper.findAll('path').filter((p) => {
			const fill = p.attributes('fill') ?? '';
			return fill !== '#e2e8f0' && fill !== '' && fill !== 'none';
		});
		expect(usPaths.length).toBeGreaterThanOrEqual(2);
	});

	it('renders a data label for matched regions', () => {
		const chartData = makeChartData(['china', 'india'], [500, 200]);
		const wrapper = mount(RegionMapChart, {
			props: {
				chartData,
				layout: makeLayout(600, 400),
				categories: ['china', 'india'],
			},
		});
		// Should have data-label text elements for matched regions
		const texts = wrapper.findAll('text');
		const textContent = texts.map((t) => t.text()).join(' ');
		// formatAxisValue(500) => '500', formatAxisValue(200) => '200'
		expect(textContent).toContain('500');
		expect(textContent).toContain('200');
	});

	it('renders without error for empty data (all regions default grey)', () => {
		const chartData = makeChartData([], []);
		expect(() => {
			mount(RegionMapChart, {
				props: {
					chartData,
					layout: makeLayout(),
					categories: [],
				},
			});
		}).not.toThrow();

		const wrapper = mount(RegionMapChart, {
			props: {
				chartData,
				layout: makeLayout(),
				categories: [],
			},
		});
		// All paths should have default grey fill
		const paths = wrapper.findAll('path');
		expect(paths).toHaveLength(22);
		for (const p of paths) {
			expect(p.attributes('fill')).toBe('#e2e8f0');
		}
	});

	it('renders a gradient legend bar', () => {
		const chartData = makeChartData(['us', 'gb'], [10, 20]);
		const wrapper = mount(RegionMapChart, {
			props: {
				chartData,
				layout: makeLayout(),
				categories: ['us', 'gb'],
			},
		});
		// The legend rect has rx="4"
		const legendRects = wrapper.findAll('rect').filter((r) => r.attributes('rx') === '4');
		expect(legendRects.length).toBeGreaterThanOrEqual(1);
		// Gradient defs should be present
		expect(wrapper.find('defs').exists()).toBeTruthy();
		expect(wrapper.find('linearGradient').exists()).toBeTruthy();
	});

	it('renders a fallback table row for unrecognised region labels', () => {
		const chartData = makeChartData(['United States', 'Narnia', 'Middle Earth'], [100, 42, 88]);
		const wrapper = mount(RegionMapChart, {
			props: {
				chartData,
				layout: makeLayout(400, 400),
				categories: ['United States', 'Narnia', 'Middle Earth'],
			},
		});
		// Fallback table header text should appear
		const allText = wrapper.text();
		expect(allText).toContain('Additional regions');
		// Unmatched labels should appear in fallback table
		expect(allText).toContain('Narnia');
		expect(allText).toContain('Middle Earth');
	});

	it('renders a title when chartData.title is set', () => {
		const chartData = makeChartData(['US'], [99], { title: 'Sales by Region' });
		const wrapper = mount(RegionMapChart, {
			props: {
				chartData,
				layout: makeLayout(),
				categories: ['US'],
			},
		});
		expect(wrapper.text()).toContain('Sales by Region');
	});
});
