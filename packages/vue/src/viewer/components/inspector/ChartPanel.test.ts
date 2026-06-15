import { mount } from '@vue/test-utils';
import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import ChartPanel from './ChartPanel.vue';

function chartData(overrides: Partial<PptxChartData> = {}): PptxChartData {
	return {
		title: 'Sales',
		chartType: 'bar',
		categories: ['Jan', 'Feb', 'Mar'],
		series: [{ name: 'Revenue', values: [10, 20, 30] }],
		grouping: 'clustered',
		...overrides,
	};
}

function chartElement(overrides: Partial<PptxChartData> = {}): PptxElement {
	return {
		type: 'chart',
		id: 'chart-1',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData: chartData(overrides),
	} as PptxElement;
}

function nonChartElement(): PptxElement {
	return {
		type: 'shape',
		id: 'shape-1',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
	} as PptxElement;
}

/** Read the single emitted `update` patch's chartData payload. */
function lastChartData(emitted: unknown): PptxChartData {
	const events = emitted as Array<Array<{ chartData?: PptxChartData }>> | undefined;
	if (!events || events.length === 0) {
		throw new Error('no update emitted');
	}
	const patch = events[events.length - 1][0];
	if (!patch.chartData) {
		throw new Error('patch has no chartData');
	}
	return patch.chartData;
}

describe('chartPanel', () => {
	it('shows a muted note for non-chart elements', () => {
		const wrapper = mount(ChartPanel, { props: { element: nonChartElement() } });
		expect(wrapper.find('.pptx-vue-chart-muted').exists()).toBeTruthy();
		expect(wrapper.find('[data-testid="chart-type"]').exists()).toBeFalsy();
	});

	it('changing the type emits new chartData carrying that type', async () => {
		const wrapper = mount(ChartPanel, { props: { element: chartElement() } });
		const select = wrapper.get('[data-testid="chart-type"]');
		await select.setValue('line');

		const next = lastChartData(wrapper.emitted('update'));
		expect(next.chartType).toBe('line');
		// Original data is preserved (categories/series carried over).
		expect(next.categories).toStrictEqual(['Jan', 'Feb', 'Mar']);
		expect(next.series).toHaveLength(1);
	});

	it('clears grouping when switching to a type that does not support it', async () => {
		const wrapper = mount(ChartPanel, { props: { element: chartElement() } });
		await wrapper.get('[data-testid="chart-type"]').setValue('pie');

		const next = lastChartData(wrapper.emitted('update'));
		expect(next.chartType).toBe('pie');
		expect(next.grouping).toBeUndefined();
	});

	it('editing the title emits updated chartData with the new title', async () => {
		const wrapper = mount(ChartPanel, { props: { element: chartElement() } });
		const input = wrapper.get('[data-testid="chart-title"]');
		await input.setValue('New Title');

		const next = lastChartData(wrapper.emitted('update'));
		expect(next.title).toBe('New Title');
		// Type is untouched by a title edit.
		expect(next.chartType).toBe('bar');
	});

	it('shows the grouping control only for grouping-capable types', () => {
		const grouped = mount(ChartPanel, { props: { element: chartElement({ chartType: 'bar' }) } });
		expect(grouped.find('[data-testid="chart-grouping"]').exists()).toBeTruthy();

		const ungrouped = mount(ChartPanel, {
			props: { element: chartElement({ chartType: 'pie', grouping: undefined }) },
		});
		expect(ungrouped.find('[data-testid="chart-grouping"]').exists()).toBeFalsy();
	});

	it('changing grouping emits updated chartData with the new grouping', async () => {
		const wrapper = mount(ChartPanel, { props: { element: chartElement() } });
		await wrapper.get('[data-testid="chart-grouping"]').setValue('stacked');

		const next = lastChartData(wrapper.emitted('update'));
		expect(next.grouping).toBe('stacked');
		expect(next.chartType).toBe('bar');
	});
});
