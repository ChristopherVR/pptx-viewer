import type { ChartPptxElement, PptxChartData, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createInitialViewerState } from '../state';
import { createStore } from '../state/store';
import { createChartQuickActionsOverlay } from './chart-quick-actions-overlay';
import type { EditorOps } from './editor-operations';

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

function setup(chart: ChartPptxElement, editable = true) {
	const slide = { id: 's1', elements: [chart] } as PptxSlide;
	const store = createStore({
		...createInitialViewerState(),
		slides: [slide],
		currentSlide: 0,
		editable,
		selectedElementId: chart.id,
		selectedElementIds: [chart.id],
	});
	const ops = {
		pushHistory: vi.fn(),
		commitChange: vi.fn(),
	} as unknown as EditorOps;
	const overlay = createChartQuickActionsOverlay({
		doc: document,
		t: (key: string) => key,
		store,
		ops,
		getScale: () => 1,
	});
	const host = document.createElement('div');
	document.body.appendChild(host);
	overlay.mount(host);
	return { overlay, store, host };
}

describe('chartQuickActionsOverlay', () => {
	it('renders all three quick-action buttons', () => {
		const { host } = setup(makeChartElement());
		expect(host.querySelector('[data-testid="chart-quick-action-elements"]')).not.toBeNull();
		expect(host.querySelector('[data-testid="chart-quick-action-styles"]')).not.toBeNull();
		expect(host.querySelector('[data-testid="chart-quick-action-filters"]')).not.toBeNull();
	});

	it('opens the Chart Elements popover and toggles the title checkbox', () => {
		const { host, store } = setup(makeChartElement());
		host.querySelector<HTMLButtonElement>('[data-testid="chart-quick-action-elements"]')!.click();
		expect(host.querySelector('[data-testid="chart-quick-elements-popover"]')).not.toBeNull();

		const titleCheckbox = host.querySelector<HTMLInputElement>(
			'[data-testid="chart-quick-element-title"]',
		)!;
		expect(titleCheckbox.checked).toBeTruthy();
		titleCheckbox.checked = false;
		titleCheckbox.dispatchEvent(new Event('change', { bubbles: true }));

		const chart = store.get().slides[0]!.elements[0] as ChartPptxElement;
		expect(chart.chartData!.style?.hasTitle).toBeFalsy();
	});

	it('opens the Chart Filters popover and hides a series', () => {
		const { host, store } = setup(makeChartElement());
		host.querySelector<HTMLButtonElement>('[data-testid="chart-quick-action-filters"]')!.click();
		expect(host.querySelector('[data-testid="chart-quick-filters-popover"]')).not.toBeNull();

		const revenueRow = host.querySelector<HTMLInputElement>(
			'[data-testid="chart-quick-filter-visible-0"]',
		)!;
		revenueRow.dispatchEvent(new Event('change', { bubbles: true }));

		const chart = store.get().slides[0]!.elements[0] as ChartPptxElement;
		expect(chart.chartData!.series.map((s) => s.name)).not.toContain('Revenue');
		expect(chart.chartData!.filteredSeries?.[0]?.name).toBe('Revenue');
	});

	it('opens the Chart Styles gallery and applies a preset', () => {
		const { host, store } = setup(makeChartElement());
		host.querySelector<HTMLButtonElement>('[data-testid="chart-quick-action-styles"]')!.click();
		host.querySelector<HTMLButtonElement>('[data-testid="chart-quick-style-monochrome"]')!.click();

		const chart = store.get().slides[0]!.elements[0] as ChartPptxElement;
		expect(chart.chartData!.colorPalette?.length).toBeGreaterThan(0);
	});

	it('does not show the filters button when there is only one series', () => {
		const single = makeChartElement(makeChartData({ series: [{ name: 'Only', values: [1, 2] }] }));
		const { host } = setup(single);
		expect(host.querySelector('[data-testid="chart-quick-action-filters"]')).toBeNull();
		expect(host.querySelector('[data-testid="chart-quick-action-elements"]')).not.toBeNull();
	});

	it('renders nothing when the state is not editable', () => {
		const { host } = setup(makeChartElement(), false);
		expect(host.querySelector('[data-testid="chart-quick-action-elements"]')).toBeNull();
	});
});
