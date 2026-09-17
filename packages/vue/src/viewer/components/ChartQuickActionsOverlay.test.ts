import { mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';
import type { ChartPptxElement, PptxChartData, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import type {
	ChartCanvasEditContext,
	ChartPartSelection,
} from '../composables/chart-part-selection';
import { ChartCanvasEditKey } from '../composables/chart-part-selection';
import ChartQuickActionsOverlay from './ChartQuickActionsOverlay.vue';

function makeChartData(overrides: Partial<PptxChartData> = {}): PptxChartData {
	return {
		chartType: 'bar',
		categories: ['Q1', 'Q2'],
		series: [
			{ name: 'Revenue', values: [100, 150] },
			{ name: 'Cost', values: [80, 90] },
		],
		style: { hasTitle: true, hasLegend: false },
		...overrides,
	};
}

function makeChartElement(chartData = makeChartData()): ChartPptxElement {
	return {
		id: 'ch_1',
		type: 'chart',
		x: 10,
		y: 20,
		width: 400,
		height: 300,
		chartData,
	} as ChartPptxElement;
}

function mountOverlay(
	element: ChartPptxElement,
	canEdit = true,
): {
	wrapper: VueWrapper;
	updateElement: ReturnType<typeof vi.fn<(id: string, patch: Partial<PptxElement>) => void>>;
} {
	const updateElement = vi.fn<(id: string, patch: Partial<PptxElement>) => void>();
	const selection = ref<ChartPartSelection | null>(null);
	const ctx: ChartCanvasEditContext = {
		selection,
		setSelection: (next) => {
			selection.value = next;
		},
		canSelectCharts: () => true,
		canEditChart: () => true,
		updateElement,
	};
	const wrapper = mount(ChartQuickActionsOverlay, {
		props: { element, canEdit, zoom: 1 },
		global: { provide: { [ChartCanvasEditKey as symbol]: ctx } },
	});
	return { wrapper, updateElement };
}

describe('chartQuickActionsOverlay', () => {
	it('renders all three quick-action buttons', () => {
		const { wrapper } = mountOverlay(makeChartElement());
		expect(wrapper.find('[data-testid="chart-quick-action-elements"]').exists()).toBeTruthy();
		expect(wrapper.find('[data-testid="chart-quick-action-styles"]').exists()).toBeTruthy();
		expect(wrapper.find('[data-testid="chart-quick-action-filters"]').exists()).toBeTruthy();
	});

	it('opens the Chart Elements popover and toggles the title checkbox', async () => {
		const { wrapper, updateElement } = mountOverlay(makeChartElement());
		await wrapper.find('[data-testid="chart-quick-action-elements"]').trigger('click');
		expect(wrapper.find('[data-testid="chart-quick-elements-popover"]').exists()).toBeTruthy();

		const titleCheckbox = wrapper.find<HTMLInputElement>(
			'[data-testid="chart-quick-element-title"]',
		);
		expect(titleCheckbox.element.checked).toBeTruthy();

		titleCheckbox.element.checked = false;
		await titleCheckbox.trigger('change');

		expect(updateElement).toHaveBeenCalledWith('ch_1', expect.anything());
		const [, updates] = updateElement.mock.calls.at(-1)!;
		expect((updates.chartData as PptxChartData).style?.hasTitle).toBeFalsy();
	});

	it('opens the Chart Filters popover and hides a series', async () => {
		const { wrapper, updateElement } = mountOverlay(makeChartElement());
		await wrapper.find('[data-testid="chart-quick-action-filters"]').trigger('click');
		expect(wrapper.find('[data-testid="chart-quick-filters-popover"]').exists()).toBeTruthy();

		const revenueRow = wrapper.find<HTMLInputElement>(
			'[data-testid="chart-quick-filter-visible-0"]',
		);
		await revenueRow.trigger('change');

		expect(updateElement).toHaveBeenCalledWith('ch_1', expect.anything());
		const [, updates] = updateElement.mock.calls.at(-1)!;
		const nextData = updates.chartData as PptxChartData;
		expect(nextData.series.map((s) => s.name)).not.toContain('Revenue');
		expect(nextData.filteredSeries?.[0]?.name).toBe('Revenue');
	});

	it('opens the Chart Styles gallery and applies a preset', async () => {
		const { wrapper, updateElement } = mountOverlay(makeChartElement());
		await wrapper.find('[data-testid="chart-quick-action-styles"]').trigger('click');
		const presetButton = wrapper.find('[data-testid="chart-quick-style-monochrome"]');
		await presetButton.trigger('click');

		expect(updateElement).toHaveBeenCalledWith('ch_1', expect.anything());
		const [, updates] = updateElement.mock.calls.at(-1)!;
		expect((updates.chartData as PptxChartData).colorPalette?.length).toBeGreaterThan(0);
	});

	it('does not show the filters button when there is only one series', () => {
		const single = makeChartElement(makeChartData({ series: [{ name: 'Only', values: [1, 2] }] }));
		const { wrapper } = mountOverlay(single);
		expect(wrapper.find('[data-testid="chart-quick-action-filters"]').exists()).toBeFalsy();
		expect(wrapper.find('[data-testid="chart-quick-action-elements"]').exists()).toBeTruthy();
	});

	it('disables every button when canEdit is false', () => {
		const { wrapper } = mountOverlay(makeChartElement(), false);
		const btn = wrapper.find<HTMLButtonElement>('[data-testid="chart-quick-action-elements"]');
		expect(btn.element.disabled).toBeTruthy();
	});
});
