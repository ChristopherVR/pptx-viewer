// @vitest-environment happy-dom
import type { ChartPptxElement, PptxChartData, PptxElement } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChartQuickActionsOverlay } from './ChartQuickActionsOverlay';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
});

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

function mount(props: {
	element: ChartPptxElement;
	canEdit?: boolean;
	onUpdateElement: (elementId: string, updates: Partial<PptxElement>) => void;
}) {
	act(() => {
		root.render(
			<ChartQuickActionsOverlay
				element={props.element}
				canEdit={props.canEdit ?? true}
				onUpdateElement={props.onUpdateElement}
			/>,
		);
	});
}

describe('chartQuickActionsOverlay', () => {
	it('renders all three quick-action buttons', () => {
		mount({ element: makeChartElement(), onUpdateElement: vi.fn() });
		expect(container.querySelector('[data-testid="chart-quick-action-elements"]')).toBeTruthy();
		expect(container.querySelector('[data-testid="chart-quick-action-styles"]')).toBeTruthy();
		expect(container.querySelector('[data-testid="chart-quick-action-filters"]')).toBeTruthy();
	});

	it('opens the Chart Elements popover and toggles the title checkbox', () => {
		const onUpdateElement = vi.fn<(id: string, updates: Partial<PptxElement>) => void>();
		mount({ element: makeChartElement(), onUpdateElement });

		act(() => {
			container
				.querySelector<HTMLButtonElement>('[data-testid="chart-quick-action-elements"]')!
				.click();
		});
		const popover = container.querySelector('[data-testid="chart-quick-elements-popover"]');
		expect(popover).toBeTruthy();

		const titleCheckbox = container.querySelector<HTMLInputElement>(
			'[data-testid="chart-quick-element-title"]',
		)!;
		expect(titleCheckbox.checked).toBeTruthy();

		act(() => {
			titleCheckbox.click();
		});
		expect(onUpdateElement).toHaveBeenCalledWith('ch_1', expect.anything());
		const [, updates] = onUpdateElement.mock.calls.at(-1)!;
		expect((updates.chartData as PptxChartData).style?.hasTitle).toBeFalsy();
	});

	it('opens the Chart Filters popover and hides a series', () => {
		const onUpdateElement = vi.fn<(id: string, updates: Partial<PptxElement>) => void>();
		mount({ element: makeChartElement(), onUpdateElement });

		act(() => {
			container
				.querySelector<HTMLButtonElement>('[data-testid="chart-quick-action-filters"]')!
				.click();
		});
		expect(container.querySelector('[data-testid="chart-quick-filters-popover"]')).toBeTruthy();

		const revenueRow = container.querySelector<HTMLInputElement>(
			'[data-testid="chart-quick-filter-visible-0"]',
		)!;
		act(() => {
			revenueRow.click();
		});
		expect(onUpdateElement).toHaveBeenCalledWith('ch_1', expect.anything());
		const [, updates] = onUpdateElement.mock.calls.at(-1)!;
		const nextData = updates.chartData as PptxChartData;
		expect(nextData.series.map((s) => s.name)).not.toContain('Revenue');
		expect(nextData.filteredSeries?.[0]?.name).toBe('Revenue');
	});

	it('opens the Chart Styles gallery and applies a preset', () => {
		const onUpdateElement = vi.fn<(id: string, updates: Partial<PptxElement>) => void>();
		mount({ element: makeChartElement(), onUpdateElement });

		act(() => {
			container
				.querySelector<HTMLButtonElement>('[data-testid="chart-quick-action-styles"]')!
				.click();
		});
		const presetButton = container.querySelector<HTMLButtonElement>(
			'[data-testid="chart-quick-style-monochrome"]',
		)!;
		act(() => {
			presetButton.click();
		});
		expect(onUpdateElement).toHaveBeenCalledWith('ch_1', expect.anything());
		const [, updates] = onUpdateElement.mock.calls.at(-1)!;
		expect((updates.chartData as PptxChartData).colorPalette?.length).toBeGreaterThan(0);
	});

	it('does not show the filters button when there is only one series', () => {
		const single = makeChartElement(makeChartData({ series: [{ name: 'Only', values: [1, 2] }] }));
		mount({ element: single, onUpdateElement: vi.fn() });
		expect(container.querySelector('[data-testid="chart-quick-action-filters"]')).toBeFalsy();
		expect(container.querySelector('[data-testid="chart-quick-action-elements"]')).toBeTruthy();
	});

	it('disables every button when canEdit is false', () => {
		mount({ element: makeChartElement(), canEdit: false, onUpdateElement: vi.fn() });
		const btn = container.querySelector<HTMLButtonElement>(
			'[data-testid="chart-quick-action-elements"]',
		)!;
		expect(btn.disabled).toBeTruthy();
	});
});
