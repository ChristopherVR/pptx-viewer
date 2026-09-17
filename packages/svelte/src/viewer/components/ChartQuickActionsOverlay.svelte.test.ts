import type { ChartPptxElement, PptxChartData, PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ChartQuickActionsOverlay from './ChartQuickActionsOverlay.svelte';

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
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

function mountOverlay(
	element: ChartPptxElement,
	canEdit = true,
): {
	target: HTMLElement;
	onupdateelement: ReturnType<typeof vi.fn<(id: string, updates: Partial<PptxElement>) => void>>;
} {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const onupdateelement = vi.fn<(id: string, updates: Partial<PptxElement>) => void>();
	const instance = mount(ChartQuickActionsOverlay, {
		target,
		props: { element, canEdit, scale: 1, onupdateelement },
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return { target, onupdateelement };
}

describe('chartQuickActionsOverlay', () => {
	it('renders all three quick-action buttons', () => {
		const { target } = mountOverlay(makeChartElement());
		expect(target.querySelector('[data-testid="chart-quick-action-elements"]')).not.toBeNull();
		expect(target.querySelector('[data-testid="chart-quick-action-styles"]')).not.toBeNull();
		expect(target.querySelector('[data-testid="chart-quick-action-filters"]')).not.toBeNull();
	});

	it('opens the Chart Elements popover and toggles the title checkbox', () => {
		const { target, onupdateelement } = mountOverlay(makeChartElement());
		target.querySelector<HTMLButtonElement>('[data-testid="chart-quick-action-elements"]')!.click();
		flushSync();
		expect(target.querySelector('[data-testid="chart-quick-elements-popover"]')).not.toBeNull();

		const titleCheckbox = target.querySelector<HTMLInputElement>(
			'[data-testid="chart-quick-element-title"]',
		)!;
		expect(titleCheckbox.checked).toBeTruthy();

		titleCheckbox.checked = false;
		titleCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();

		expect(onupdateelement).toHaveBeenCalledWith('ch_1', expect.anything());
		const [, updates] = onupdateelement.mock.calls.at(-1)!;
		expect((updates.chartData as PptxChartData).style?.hasTitle).toBeFalsy();
	});

	it('opens the Chart Filters popover and hides a series', () => {
		const { target, onupdateelement } = mountOverlay(makeChartElement());
		target.querySelector<HTMLButtonElement>('[data-testid="chart-quick-action-filters"]')!.click();
		flushSync();
		expect(target.querySelector('[data-testid="chart-quick-filters-popover"]')).not.toBeNull();

		const revenueRow = target.querySelector<HTMLInputElement>(
			'[data-testid="chart-quick-filter-visible-0"]',
		)!;
		revenueRow.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();

		expect(onupdateelement).toHaveBeenCalledWith('ch_1', expect.anything());
		const [, updates] = onupdateelement.mock.calls.at(-1)!;
		const nextData = updates.chartData as PptxChartData;
		expect(nextData.series.map((s) => s.name)).not.toContain('Revenue');
		expect(nextData.filteredSeries?.[0]?.name).toBe('Revenue');
	});

	it('opens the Chart Styles gallery and applies a preset', () => {
		const { target, onupdateelement } = mountOverlay(makeChartElement());
		target.querySelector<HTMLButtonElement>('[data-testid="chart-quick-action-styles"]')!.click();
		flushSync();
		const presetButton = target.querySelector<HTMLButtonElement>(
			'[data-testid="chart-quick-style-monochrome"]',
		)!;
		presetButton.click();
		flushSync();

		expect(onupdateelement).toHaveBeenCalledWith('ch_1', expect.anything());
		const [, updates] = onupdateelement.mock.calls.at(-1)!;
		expect((updates.chartData as PptxChartData).colorPalette?.length).toBeGreaterThan(0);
	});

	it('does not show the filters button when there is only one series', () => {
		const single = makeChartElement(makeChartData({ series: [{ name: 'Only', values: [1, 2] }] }));
		const { target } = mountOverlay(single);
		expect(target.querySelector('[data-testid="chart-quick-action-filters"]')).toBeNull();
		expect(target.querySelector('[data-testid="chart-quick-action-elements"]')).not.toBeNull();
	});

	it('disables every button when canEdit is false', () => {
		const { target } = mountOverlay(makeChartElement(), false);
		const btn = target.querySelector<HTMLButtonElement>(
			'[data-testid="chart-quick-action-elements"]',
		)!;
		expect(btn.disabled).toBeTruthy();
	});
});
