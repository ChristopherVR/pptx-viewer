import { mount } from '@vue/test-utils';
import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import ChartFilteredSeriesOptions from './ChartFilteredSeriesOptions.vue';

function chartData(overrides: Partial<PptxChartData> = {}): PptxChartData {
	return {
		chartType: 'bar',
		categories: ['Jan', 'Feb'],
		series: [{ name: 'Revenue', values: [10, 20] }],
		...overrides,
	} as PptxChartData;
}

describe('chartFilteredSeriesOptions', () => {
	it('renders nothing when there is nothing to show', () => {
		const wrapper = mount(ChartFilteredSeriesOptions, {
			props: { chartData: chartData(), canEdit: true },
		});
		expect(wrapper.find('.pptx-vue-chart-card').exists()).toBeFalsy();
	});

	it('renders a hide button per visible series (only when there is more than one)', () => {
		const single = mount(ChartFilteredSeriesOptions, {
			props: { chartData: chartData(), canEdit: true },
		});
		expect(single.find('[data-testid="chart-series-hide-0"]').exists()).toBeFalsy();

		const twoSeries = chartData({
			series: [
				{ name: 'Revenue', values: [10, 20] },
				{ name: 'Cost', values: [5, 8] },
			],
		});
		const wrapper = mount(ChartFilteredSeriesOptions, {
			props: { chartData: twoSeries, canEdit: true },
		});
		expect(wrapper.find('[data-testid="chart-series-hide-0"]').exists()).toBeTruthy();
		expect(wrapper.find('[data-testid="chart-series-hide-1"]').exists()).toBeTruthy();
	});

	it('emits hide-series with the correct index', async () => {
		const twoSeries = chartData({
			series: [
				{ name: 'Revenue', values: [10, 20] },
				{ name: 'Cost', values: [5, 8] },
			],
		});
		const wrapper = mount(ChartFilteredSeriesOptions, {
			props: { chartData: twoSeries, canEdit: true },
		});
		await wrapper.get('[data-testid="chart-series-hide-1"]').trigger('click');
		expect(wrapper.emitted('hide-series')).toStrictEqual([[1]]);
	});

	it('shows a filtered-series row and emits restore-series with the correct index', async () => {
		const data = chartData({
			filteredSeries: [
				{ idx: 1, order: 1, name: 'Old series' },
				{ idx: 2, order: 2, name: 'Another' },
			],
		});
		const wrapper = mount(ChartFilteredSeriesOptions, {
			props: { chartData: data, canEdit: true },
		});
		expect(wrapper.text()).toContain('Old series');
		expect(wrapper.text()).toContain('Another');

		await wrapper.get('[data-testid="chart-series-show-1"]').trigger('click');
		expect(wrapper.emitted('restore-series')).toStrictEqual([[1]]);
	});

	it('falls back to filteredSeriesTitle when a filtered entry has no cached name', () => {
		const data = chartData({
			filteredSeries: [{ idx: 0, order: 0 }],
			filteredSeriesTitle: 'Legacy title',
		});
		const wrapper = mount(ChartFilteredSeriesOptions, {
			props: { chartData: data, canEdit: true },
		});
		expect(wrapper.text()).toContain('Legacy title');
	});

	it('renders one input per cached label and emits set-data-labels-range-cache on edit', async () => {
		const data = chartData({
			series: [
				{
					name: 'Revenue',
					values: [10, 20],
					dataLabelOptions: {
						dataLabelsRange: { formula: 'Sheet1!A1:A2', cache: ['Low', 'Medium'] },
					},
				},
			],
		});
		const wrapper = mount(ChartFilteredSeriesOptions, {
			props: { chartData: data, canEdit: true },
		});
		const inputs = wrapper.findAll('input[type="text"]');
		expect(inputs).toHaveLength(2);
		expect((inputs[0]!.element as HTMLInputElement).value).toBe('Low');
		expect((inputs[1]!.element as HTMLInputElement).value).toBe('Medium');

		await wrapper.get('[data-testid="chart-dlbl-range-0-1"]').setValue('Renamed');
		expect(wrapper.emitted('set-data-labels-range-cache')).toStrictEqual([[0, 1, 'Renamed']]);
	});

	it('disables every control when canEdit is false', () => {
		const data = chartData({
			series: [
				{
					name: 'Revenue',
					values: [10, 20],
					dataLabelOptions: {
						dataLabelsRange: { formula: 'Sheet1!A1:A2', cache: ['Low'] },
					},
				},
			],
			filteredSeries: [{ idx: 0, order: 0, name: 'Old series' }],
		});
		const wrapper = mount(ChartFilteredSeriesOptions, {
			props: { chartData: data, canEdit: false },
		});

		for (const el of wrapper.findAll('button')) {
			expect((el.element as HTMLButtonElement).disabled).toBeTruthy();
		}
		for (const el of wrapper.findAll('input')) {
			expect((el.element as HTMLInputElement).disabled).toBeTruthy();
		}
	});
});
