// oxlint-disable react-hooks/rules-of-hooks
import { mount } from '@vue/test-utils';
import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import ChartDisplayOptions from './ChartDisplayOptions.vue';

function chartData(overrides: Partial<PptxChartData> = {}): PptxChartData {
	return {
		chartType: 'bar',
		series: [],
		categories: [],
		...overrides,
	} as PptxChartData;
}

function lastEmitted<K extends 'update' | 'update-chart-data'>(
	wrapper: ReturnType<typeof mount>,
	event: K,
): unknown {
	const events = wrapper.emitted(event);
	expect(events).toBeTruthy();
	const ev = events as unknown[][];
	return ev[ev.length - 1][0];
}

describe('chartDisplayOptions - gridlines (shared chart-gridlines-toggle)', () => {
	it('reflects the primary value axis majorGridlines flag, not style.hasGridlines', () => {
		// style says gridlines are on, but the axis (the field the renderer
		// actually reads) says they are off: the checkbox must follow the axis.
		const wrapper = mount(ChartDisplayOptions, {
			props: {
				chartData: chartData({
					style: { hasGridlines: true },
					axes: [{ axisType: 'valAx', axPos: 'l', majorGridlines: false }],
				}),
			},
		});
		const checkbox = wrapper.find('[data-testid="chart-show-gridlines"]');
		expect((checkbox.element as HTMLInputElement).checked).toBeFalsy();
	});

	it('defaults to on when the chart has no parsed value axis (matches the renderer default)', () => {
		const wrapper = mount(ChartDisplayOptions, { props: { chartData: chartData() } });
		const checkbox = wrapper.find('[data-testid="chart-show-gridlines"]');
		expect((checkbox.element as HTMLInputElement).checked).toBeTruthy();
	});

	it('toggling gridlines patches the value axis (not just style.hasGridlines) via update-chart-data', async () => {
		const wrapper = mount(ChartDisplayOptions, {
			props: {
				chartData: chartData({ axes: [{ axisType: 'valAx', axPos: 'l', majorGridlines: true }] }),
			},
		});
		await wrapper.find('[data-testid="chart-show-gridlines"]').setValue(false);
		const patch = lastEmitted(wrapper, 'update-chart-data') as Partial<PptxChartData>;
		expect(patch.axes?.[0]).toMatchObject({ axisType: 'valAx', majorGridlines: false });
		expect(patch.style?.hasGridlines).toBeFalsy();
	});

	it('creates a minimal valAx entry when the chart has no axes yet', async () => {
		const wrapper = mount(ChartDisplayOptions, { props: { chartData: chartData() } });
		await wrapper.find('[data-testid="chart-show-gridlines"]').setValue(false);
		const patch = lastEmitted(wrapper, 'update-chart-data') as Partial<PptxChartData>;
		expect(patch.axes).toHaveLength(1);
		expect(patch.axes?.[0]).toMatchObject({ axisType: 'valAx', majorGridlines: false });
	});
});

describe('chartDisplayOptions - other toggles (unchanged PptxChartStyle round-trip)', () => {
	it('title/legend/data-labels still emit a shallow style patch via update', async () => {
		const wrapper = mount(ChartDisplayOptions, {
			props: { chartData: chartData({ style: { hasTitle: false } }) },
		});
		await wrapper.find('[data-testid="chart-show-title"]').setValue(true);
		expect(lastEmitted(wrapper, 'update')).toStrictEqual({ hasTitle: true });
	});
});
