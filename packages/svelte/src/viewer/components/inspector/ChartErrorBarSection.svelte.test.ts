import type { PptxChartData, PptxChartErrBars } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ChartErrorBarSection from './ChartErrorBarSection.svelte';

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function chartData(overrides: Partial<PptxChartData> = {}): PptxChartData {
	return {
		chartType: 'bar',
		categories: ['Q1'],
		series: [{ name: 'Revenue', values: [10] }],
		...overrides,
	};
}

function mountSection(
	data: PptxChartData,
	canEdit = true,
): { target: HTMLElement; onseterrorbars: ReturnType<typeof vi.fn> } {
	const onseterrorbars = vi.fn();
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ChartErrorBarSection, {
		target,
		props: { data, canEdit, onseterrorbars },
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return { target, onseterrorbars };
}

function setValue(control: HTMLSelectElement | HTMLInputElement, value: string): void {
	control.value = value;
	control.dispatchEvent(new Event('change', { bubbles: true }));
	flushSync();
}

describe('chartErrorBarSection', () => {
	it('hides itself on chart types that cannot carry error bars', () => {
		const { target } = mountSection(chartData({ chartType: 'pie' }));

		expect(target.querySelector('.pptx-svelte-chart-errbars')).toBeNull();
	});

	it('offers a translated value-type select per series', () => {
		const { target } = mountSection(chartData());
		const options = Array.from(target.querySelectorAll<HTMLOptionElement>('select option')).map(
			(option) => option.textContent,
		);

		expect(options).toStrictEqual([
			'None',
			'Fixed value',
			'Percentage',
			'Standard deviation',
			'Standard error',
		]);
	});

	it('builds a complete error-bar record when a value type is chosen', () => {
		const { target, onseterrorbars } = mountSection(chartData());

		setValue(target.querySelector<HTMLSelectElement>('select')!, 'percentage');

		expect(onseterrorbars).toHaveBeenCalledWith(0, {
			direction: 'y',
			barType: 'both',
			valType: 'percentage',
			val: undefined,
		});
	});

	it('clears the error bars when None is chosen again', () => {
		const bars: PptxChartErrBars = { direction: 'y', barType: 'both', valType: 'stdDev', val: 2 };
		const { target, onseterrorbars } = mountSection(
			chartData({ series: [{ name: 'Revenue', values: [10], errBars: [bars] }] }),
		);

		setValue(target.querySelector<HTMLSelectElement>('select')!, '');

		expect(onseterrorbars).toHaveBeenCalledWith(0, null);
	});

	it('shows the amount input only for value types that take one', () => {
		const withStdErr: PptxChartErrBars = { direction: 'y', barType: 'both', valType: 'stdErr' };
		const { target } = mountSection(
			chartData({ series: [{ name: 'Revenue', values: [10], errBars: [withStdErr] }] }),
		);
		expect(target.querySelector('input[type="number"]')).toBeNull();
		cleanup?.();

		const withFixed: PptxChartErrBars = {
			direction: 'y',
			barType: 'both',
			valType: 'fixedVal',
			val: 3,
		};
		const { target: fixedTarget } = mountSection(
			chartData({ series: [{ name: 'Revenue', values: [10], errBars: [withFixed] }] }),
		);
		expect(fixedTarget.querySelector('input[type="number"]')).not.toBeNull();
	});

	it('updates the bar direction while preserving the value type', () => {
		const bars: PptxChartErrBars = { direction: 'y', barType: 'both', valType: 'fixedVal', val: 3 };
		const { target, onseterrorbars } = mountSection(
			chartData({ series: [{ name: 'Revenue', values: [10], errBars: [bars] }] }),
		);

		const selects = Array.from(target.querySelectorAll<HTMLSelectElement>('select'));
		setValue(selects[1], 'plus');

		expect(onseterrorbars).toHaveBeenCalledWith(0, { ...bars, barType: 'plus' });
	});
});
