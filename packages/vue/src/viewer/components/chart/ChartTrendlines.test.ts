import { mount } from '@vue/test-utils';
import type { PptxChartData, PptxChartTrendline } from 'pptx-viewer-core';
import type { PlotLayout, ValueRange } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import ChartTrendlines from './ChartTrendlines.vue';

const LAYOUT: PlotLayout = {
	plotLeft: 0,
	plotTop: 0,
	plotRight: 100,
	plotBottom: 100,
	plotWidth: 100,
	plotHeight: 100,
	svgWidth: 100,
	svgHeight: 100,
};

const RANGE: ValueRange = { min: 0, max: 10, span: 10 };

function data(trendlines: PptxChartTrendline[]): PptxChartData {
	return {
		chartType: 'line',
		categories: ['A', 'B', 'C', 'D'],
		series: [{ name: 'S1', values: [1, 2, 3, 4], trendlines }],
	} as PptxChartData;
}

describe('chartTrendlines', () => {
	it('renders nothing when no series declares a trendline', () => {
		const wrapper = mount(ChartTrendlines, {
			props: { chartData: data([]), layout: LAYOUT, range: RANGE, mode: 'line' },
		});
		expect(wrapper.find('.pptx-vue-chart-trendlines').exists()).toBeFalsy();
		expect(wrapper.find('path').exists()).toBeFalsy();
	});

	it('renders a dashed path for a linear trendline', () => {
		const wrapper = mount(ChartTrendlines, {
			props: {
				chartData: data([{ trendlineType: 'linear' }]),
				layout: LAYOUT,
				range: RANGE,
				mode: 'line',
			},
		});
		const path = wrapper.get('path');
		expect(path.attributes('stroke-dasharray')).toBe('6 3');
		expect(path.attributes('d')?.startsWith('M ')).toBeTruthy();
	});

	it('renders an equation/R² label when requested', () => {
		const wrapper = mount(ChartTrendlines, {
			props: {
				chartData: data([{ trendlineType: 'linear', displayEq: true, displayRSq: true }]),
				layout: LAYOUT,
				range: RANGE,
				mode: 'line',
			},
		});
		const text = wrapper.get('text');
		expect(text.text()).toContain('R²');
	});

	it('uses the trendline colour override on the stroke', () => {
		const wrapper = mount(ChartTrendlines, {
			props: {
				chartData: data([{ trendlineType: 'linear', color: '#abcdef' }]),
				layout: LAYOUT,
				range: RANGE,
				mode: 'line',
			},
		});
		expect(wrapper.get('path').attributes('stroke')).toBe('#abcdef');
	});
});
