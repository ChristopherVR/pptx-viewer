import { mount } from '@vue/test-utils';
import type { ChartPptxElement, PptxChartData } from 'pptx-viewer-core';
import { buildChartViewModel } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import ChartViewModelSvg from './ChartViewModelSvg.vue';

/** A pie label with category + percent and no c:separator draws on two lines. */
const pieData = {
	chartType: 'pie',
	categories: ['Direct', 'Partner'],
	series: [
		{
			name: 'Share',
			values: [60, 40],
			dataLabelOptions: { showValue: false, showCategory: true, showPercent: true },
		},
	],
	style: { hasDataLabels: true },
} as PptxChartData;

const element = {
	id: 'el-pie',
	type: 'chart',
	x: 0,
	y: 0,
	width: 400,
	height: 300,
	chartData: pieData,
} as ChartPptxElement;

describe('chartViewModelSvg: multi-line pie labels', () => {
	it('paints the category and the percentage as separate <text> nodes', () => {
		const wrapper = mount(ChartViewModelSvg, {
			props: { elementId: 'c1', vm: buildChartViewModel(element) },
		});
		const texts = wrapper.findAll('text').map((t) => t.text());
		expect(texts).toContain('Direct');
		expect(texts).toContain('60%');
		expect(texts).not.toContain('Direct, 60%');
	});
});
