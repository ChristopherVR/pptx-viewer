import type { PptxChartData } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ChartTrendlineSection from './ChartTrendlineSection.svelte';

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function chartData(overrides: Partial<PptxChartData> = {}): PptxChartData {
	return {
		chartType: 'line',
		categories: ['Q1', 'Q2'],
		series: [{ name: 'Revenue', values: [10, 20] }],
		...overrides,
	};
}

function mountSection(
	data: PptxChartData,
	canEdit = true,
): { target: HTMLElement; onsettrendline: ReturnType<typeof vi.fn> } {
	const onsettrendline = vi.fn();
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ChartTrendlineSection, {
		target,
		props: { data, canEdit, onsettrendline },
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return { target, onsettrendline };
}

function setValue(control: HTMLSelectElement | HTMLInputElement, value: string): void {
	control.value = value;
	control.dispatchEvent(new Event('change', { bubbles: true }));
	flushSync();
}

function check(control: HTMLInputElement, next: boolean): void {
	control.checked = next;
	control.dispatchEvent(new Event('change', { bubbles: true }));
	flushSync();
}

describe('chartTrendlineSection', () => {
	it('hides itself on chart types that cannot carry a trendline', () => {
		const { target } = mountSection(chartData({ chartType: 'doughnut' }));

		expect(target.querySelector('.pptx-svelte-chart-trendlines')).toBeNull();
	});

	it('offers the shared, translated regression list', () => {
		const { target } = mountSection(chartData());
		const options = Array.from(target.querySelectorAll<HTMLOptionElement>('select option')).map(
			(option) => option.textContent,
		);

		expect(options).toStrictEqual([
			'None',
			'Linear',
			'Exponential',
			'Logarithmic',
			'Polynomial',
			'Power',
			'Moving Average',
		]);
	});

	it('adds a trendline when a type is chosen', () => {
		const { target, onsettrendline } = mountSection(chartData());

		setValue(target.querySelector<HTMLSelectElement>('select')!, 'linear');

		expect(onsettrendline).toHaveBeenCalledWith(0, { trendlineType: 'linear' });
	});

	it('keeps the fields a loaded deck already set when the type changes', () => {
		const { target, onsettrendline } = mountSection(
			chartData({
				series: [
					{
						name: 'Revenue',
						values: [10, 20],
						trendlines: [{ trendlineType: 'polynomial', order: 3, forward: 2, displayRSq: true }],
					},
				],
			}),
		);

		setValue(target.querySelector<HTMLSelectElement>('select')!, 'movingAvg');

		expect(onsettrendline).toHaveBeenCalledWith(0, {
			trendlineType: 'movingAvg',
			order: 3,
			forward: 2,
			displayRSq: true,
		});
	});

	it('clears the trendline when None is chosen again', () => {
		const { target, onsettrendline } = mountSection(
			chartData({
				series: [{ name: 'Revenue', values: [10, 20], trendlines: [{ trendlineType: 'linear' }] }],
			}),
		);

		setValue(target.querySelector<HTMLSelectElement>('select')!, '');

		expect(onsettrendline).toHaveBeenCalledWith(0, null);
	});

	it('shows the equation / R-squared toggles only once a trendline exists', () => {
		const { target } = mountSection(chartData());
		expect(target.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
		cleanup?.();

		const { target: withLine } = mountSection(
			chartData({
				series: [{ name: 'Revenue', values: [10, 20], trendlines: [{ trendlineType: 'linear' }] }],
			}),
		);
		expect(withLine.querySelectorAll('input[type="checkbox"]')).toHaveLength(2);
	});

	it('toggles displayEq without disturbing the rest of the trendline', () => {
		const { target, onsettrendline } = mountSection(
			chartData({
				series: [
					{
						name: 'Revenue',
						values: [10, 20],
						trendlines: [{ trendlineType: 'linear', displayRSq: true }],
					},
				],
			}),
		);

		check(target.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[0], true);

		expect(onsettrendline).toHaveBeenCalledWith(0, {
			trendlineType: 'linear',
			displayRSq: true,
			displayEq: true,
		});
	});

	it('toggles displayRSq back off', () => {
		const { target, onsettrendline } = mountSection(
			chartData({
				series: [
					{
						name: 'Revenue',
						values: [10, 20],
						trendlines: [{ trendlineType: 'linear', displayRSq: true }],
					},
				],
			}),
		);

		check(target.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[1], false);

		expect(onsettrendline).toHaveBeenCalledWith(0, {
			trendlineType: 'linear',
			displayRSq: false,
		});
	});

	it('disables every control in read-only mode', () => {
		const { target } = mountSection(
			chartData({
				series: [{ name: 'Revenue', values: [10, 20], trendlines: [{ trendlineType: 'linear' }] }],
			}),
			false,
		);
		const controls = target.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select');

		expect(controls).toHaveLength(3);
		expect(Array.from(controls).every((control) => control.disabled)).toBeTruthy();
	});
});
