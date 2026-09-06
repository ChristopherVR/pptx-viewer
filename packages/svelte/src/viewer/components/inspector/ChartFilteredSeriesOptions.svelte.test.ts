import type { PptxChartData } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ChartFilteredSeriesOptions from './ChartFilteredSeriesOptions.svelte';

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function chartData(overrides: Partial<PptxChartData> = {}): PptxChartData {
	return {
		chartType: 'bar',
		categories: ['Q1', 'Q2'],
		series: [{ name: 'Revenue', values: [10, 20] }],
		...overrides,
	};
}

function mountOptions(
	data: PptxChartData,
	canEdit = true,
): {
	target: HTMLElement;
	onhideseries: ReturnType<typeof vi.fn>;
	onrestoreseries: ReturnType<typeof vi.fn>;
	onsetdatalabelsrangecache: ReturnType<typeof vi.fn>;
} {
	const onhideseries = vi.fn();
	const onrestoreseries = vi.fn();
	const onsetdatalabelsrangecache = vi.fn();
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ChartFilteredSeriesOptions, {
		target,
		props: { chartData: data, canEdit, onhideseries, onrestoreseries, onsetdatalabelsrangecache },
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return { target, onhideseries, onrestoreseries, onsetdatalabelsrangecache };
}

describe('chartFilteredSeriesOptions', () => {
	it('renders nothing when there is a single visible series, nothing filtered, and no cached labels', () => {
		const { target } = mountOptions(chartData());

		expect(target.querySelector('.pptx-svelte-chart-filters')).toBeNull();
	});

	it('lists every visible series with a hide button once there is more than one', () => {
		const { target } = mountOptions(
			chartData({
				series: [
					{ name: 'Revenue', values: [10, 20] },
					{ name: 'Cost', values: [5, 8] },
				],
			}),
		);

		expect(target.querySelector('[data-testid="chart-series-hide-0"]')).not.toBeNull();
		expect(target.querySelector('[data-testid="chart-series-hide-1"]')).not.toBeNull();
	});

	it('calls back with the visible series index when hidden', () => {
		const { target, onhideseries } = mountOptions(
			chartData({
				series: [
					{ name: 'Revenue', values: [10, 20] },
					{ name: 'Cost', values: [5, 8] },
				],
			}),
		);

		target
			.querySelector<HTMLButtonElement>('[data-testid="chart-series-hide-1"]')!
			.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		flushSync();

		expect(onhideseries).toHaveBeenCalledWith(1);
	});

	it('shows a filtered series row with its cached name and a show control', () => {
		const { target } = mountOptions(
			chartData({
				filteredSeries: [
					{ idx: 1, order: 1, name: 'Cost', categories: ['Q1', 'Q2'], values: [5, 8] },
				],
			}),
		);

		const row = target.querySelector('[data-testid="chart-series-show-0"]');
		expect(row).not.toBeNull();
		expect(target.textContent).toContain('Cost');
	});

	it('calls back with the filtered index when a filtered series is restored', () => {
		const { target, onrestoreseries } = mountOptions(
			chartData({
				filteredSeries: [
					{ idx: 1, order: 1, name: 'Cost', categories: ['Q1', 'Q2'], values: [5, 8] },
				],
			}),
		);

		target
			.querySelector<HTMLButtonElement>('[data-testid="chart-series-show-0"]')!
			.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		flushSync();

		expect(onrestoreseries).toHaveBeenCalledWith(0);
	});

	it('falls back to filteredSeriesTitle when the filtered entry has no cached name', () => {
		const { target } = mountOptions(
			chartData({
				filteredSeriesTitle: 'Auto Series',
				filteredSeries: [{ idx: 1, order: 1, categories: ['Q1', 'Q2'], values: [5, 8] }],
			}),
		);

		expect(target.textContent).toContain('Auto Series');
	});

	it('renders one input per cached "Value From Cells" label, keyed by category', () => {
		const { target } = mountOptions(
			chartData({
				series: [
					{
						name: 'Revenue',
						values: [10, 20],
						dataLabelOptions: {
							dataLabelsRange: { formula: 'Sheet1!$A$1:$A$2', cache: ['Low', 'High'] },
						},
					},
				],
			}),
		);

		const first = target.querySelector<HTMLInputElement>('[data-testid="chart-dlbl-range-0-0"]')!;
		const second = target.querySelector<HTMLInputElement>('[data-testid="chart-dlbl-range-0-1"]')!;
		expect(first.value).toBe('Low');
		expect(second.value).toBe('High');
		expect(target.textContent).toContain('Q1');
		expect(target.textContent).toContain('Q2');
	});

	it('calls back with series/point index and the new text when a cached label is edited', () => {
		const { target, onsetdatalabelsrangecache } = mountOptions(
			chartData({
				series: [
					{
						name: 'Revenue',
						values: [10, 20],
						dataLabelOptions: {
							dataLabelsRange: { formula: 'Sheet1!$A$1:$A$2', cache: ['Low', 'High'] },
						},
					},
				],
			}),
		);

		const input = target.querySelector<HTMLInputElement>('[data-testid="chart-dlbl-range-0-1"]')!;
		input.value = 'Peak';
		input.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();

		expect(onsetdatalabelsrangecache).toHaveBeenCalledWith(0, 1, 'Peak');
	});

	it('disables every control in read-only mode', () => {
		const { target } = mountOptions(
			chartData({
				series: [
					{
						name: 'Revenue',
						values: [10, 20],
						dataLabelOptions: {
							dataLabelsRange: { formula: 'Sheet1!$A$1:$A$2', cache: ['Low', 'High'] },
						},
					},
					{ name: 'Cost', values: [5, 8] },
				],
				filteredSeries: [
					{ idx: 2, order: 2, name: 'Margin', categories: ['Q1', 'Q2'], values: [1, 2] },
				],
			}),
			false,
		);
		const controls = target.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input');

		expect(controls.length).toBeGreaterThan(0);
		expect(Array.from(controls).every((control) => control.disabled)).toBeTruthy();
	});
});
