// oxlint-disable react-hooks/rules-of-hooks
import { mount } from '@vue/test-utils';
import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import ChartSubtypeOptions from './ChartSubtypeOptions.vue';

function chartData(overrides: Partial<PptxChartData> = {}): PptxChartData {
	return {
		chartType: 'bar',
		series: [],
		categories: [],
		...overrides,
	} as PptxChartData;
}

function lastPatch(wrapper: ReturnType<typeof mount>): Partial<PptxChartData> {
	const events = wrapper.emitted('update-chart-data');
	expect(events).toBeTruthy();
	const ev = events as unknown[][];
	return ev[ev.length - 1][0] as Partial<PptxChartData>;
}

describe('chartSubtypeOptions', () => {
	it('renders nothing for a plain bar chart', () => {
		const wrapper = mount(ChartSubtypeOptions, { props: { chartData: chartData() } });
		expect(wrapper.find('[data-testid="pptx-chart-bar3d-shape"]').exists()).toBeFalsy();
		expect(wrapper.find('[data-testid="pptx-chart-radar-style"]').exists()).toBeFalsy();
		expect(wrapper.find('[data-testid="pptx-chart-surface-wireframe"]').exists()).toBeFalsy();
	});

	it('shows only the bar3D shape picker for a bar3D chart and patches barShape', async () => {
		const wrapper = mount(ChartSubtypeOptions, {
			props: { chartData: chartData({ chartType: 'bar3D' }) },
		});
		expect(wrapper.find('[data-testid="pptx-chart-radar-style"]').exists()).toBeFalsy();
		expect(wrapper.find('[data-testid="pptx-chart-surface-wireframe"]').exists()).toBeFalsy();
		await wrapper.find('[data-testid="pptx-chart-bar3d-shape"]').setValue('cylinder');
		expect(lastPatch(wrapper)).toStrictEqual({ barShape: 'cylinder' });
	});

	it('shows only the radar style picker for a radar chart and patches radarStyle', async () => {
		const wrapper = mount(ChartSubtypeOptions, {
			props: { chartData: chartData({ chartType: 'radar' }) },
		});
		expect(wrapper.find('[data-testid="pptx-chart-bar3d-shape"]').exists()).toBeFalsy();
		await wrapper.find('[data-testid="pptx-chart-radar-style"]').setValue('filled');
		expect(lastPatch(wrapper)).toStrictEqual({ radarStyle: 'filled' });
	});

	it('shows only the surface wireframe picker for a surface chart and patches wireframe as a boolean', async () => {
		const wrapper = mount(ChartSubtypeOptions, {
			props: { chartData: chartData({ chartType: 'surface' }) },
		});
		expect(wrapper.find('[data-testid="pptx-chart-bar3d-shape"]').exists()).toBeFalsy();
		await wrapper.find('[data-testid="pptx-chart-surface-wireframe"]').setValue('true');
		expect(lastPatch(wrapper)).toStrictEqual({ wireframe: true });
	});
});
