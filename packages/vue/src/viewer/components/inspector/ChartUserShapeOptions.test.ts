// oxlint-disable react-hooks/rules-of-hooks
import { mount } from '@vue/test-utils';
import type { PptxChartData, PptxChartUserShape } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import ChartUserShapeOptions from './ChartUserShapeOptions.vue';

function chartData(overrides: Partial<PptxChartData> = {}): PptxChartData {
	return {
		chartType: 'bar',
		series: [],
		categories: [],
		...overrides,
	} as PptxChartData;
}

const textBoxShape: PptxChartUserShape = {
	kind: 'sp',
	anchor: 'rel',
	from: { x: 0.1, y: 0.1 },
	to: { x: 0.3, y: 0.2 },
	paragraphs: [{ text: 'Note' }],
};

function lastPatch(wrapper: ReturnType<typeof mount>): Partial<PptxChartData> {
	const events = wrapper.emitted('update-chart-data');
	expect(events).toBeTruthy();
	const ev = events as unknown[][];
	return ev[ev.length - 1][0] as Partial<PptxChartData>;
}

describe('chartUserShapeOptions', () => {
	it('shows the empty state with no overlay shapes', () => {
		const wrapper = mount(ChartUserShapeOptions, { props: { chartData: chartData() } });
		expect(wrapper.find('[data-testid="chart-user-shape-row"]').exists()).toBeFalsy();
	});

	it('renders one row per overlay shape', () => {
		const wrapper = mount(ChartUserShapeOptions, {
			props: { chartData: chartData({ userShapes: [textBoxShape] }) },
		});
		expect(wrapper.findAll('[data-testid="chart-user-shape-row"]')).toHaveLength(1);
		expect(wrapper.text()).toContain('Note');
	});

	it('emits update-chart-data with an appended shape on Add text box', async () => {
		const wrapper = mount(ChartUserShapeOptions, { props: { chartData: chartData() } });
		await wrapper.find('[data-testid="chart-user-shape-add"]').trigger('click');
		const patch = lastPatch(wrapper);
		expect(patch.userShapes).toHaveLength(1);
		expect(patch.userShapes![0].kind).toBe('sp');
	});

	it('emits update-chart-data with the shape removed on delete', async () => {
		const wrapper = mount(ChartUserShapeOptions, {
			props: { chartData: chartData({ userShapes: [textBoxShape] }) },
		});
		await wrapper.find('[data-testid="chart-user-shape-delete"]').trigger('click');
		expect(lastPatch(wrapper)).toStrictEqual({ userShapes: [] });
	});
});
