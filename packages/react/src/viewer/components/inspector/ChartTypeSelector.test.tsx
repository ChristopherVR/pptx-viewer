// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChartTypeSelector } from './ChartTypeSelector';

/**
 * W4-D: the title input must route through `onTitleChange` (the caller's
 * `collapseChartTitleRunsForEdit`-backed handler), not the generic
 * `onUpdateChartData({ title })` patch, so a multi-run title collapses to
 * the dominant style instead of leaving a stale second run's text behind.
 */

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

/** Set an `<input>`'s value via the native setter and fire a real `input` event, as React does. */
function setInputValue(input: HTMLInputElement, value: string): void {
	const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
	setter?.call(input, value);
	input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('chartTypeSelector title field', () => {
	it('calls onTitleChange, not onUpdateChartData, when the title input changes', () => {
		const onUpdateChartData = vi.fn();
		const onTitleChange = vi.fn();
		act(() =>
			root.render(
				<ChartTypeSelector
					title='Sales'
					chartType='bar'
					chartData={{ chartType: 'bar', series: [{ name: 'Sales', values: [1, 2] }] }}
					grouping={undefined}
					seriesCount={1}
					categoryCount={2}
					canEdit
					onUpdateChartData={onUpdateChartData}
					onTitleChange={onTitleChange}
				/>,
			),
		);
		const input = container.querySelector('input[type="text"]') as HTMLInputElement;
		act(() => setInputValue(input, 'New Title'));
		expect(onTitleChange).toHaveBeenCalledWith('New Title');
		expect(onUpdateChartData).not.toHaveBeenCalled();
	});

	it('still routes the chart-type select through onUpdateChartData', () => {
		const onUpdateChartData = vi.fn();
		act(() =>
			root.render(
				<ChartTypeSelector
					title='Sales'
					chartType='bar'
					chartData={{ chartType: 'bar', series: [{ name: 'Sales', values: [1, 2] }] }}
					grouping={undefined}
					seriesCount={1}
					categoryCount={2}
					canEdit
					onUpdateChartData={onUpdateChartData}
					onTitleChange={() => {}}
				/>,
			),
		);
		const select = container.querySelector('select') as HTMLSelectElement;
		act(() => {
			select.value = 'line';
			select.dispatchEvent(new Event('change', { bubbles: true }));
		});
		expect(onUpdateChartData).toHaveBeenCalledWith({ chartType: 'line' });
	});

	it('shows "Pareto" (not "Histogram") as selected for a histogram with a paretoLine series', () => {
		act(() =>
			root.render(
				<ChartTypeSelector
					title='Defects'
					chartType='histogram'
					chartData={{
						chartType: 'histogram',
						series: [
							{ name: 'Frequency', values: [3, 5, 2] },
							{
								name: 'Cumulative %',
								values: [30, 80, 100],
								histogramOptions: { layout: 'pareto' },
							},
						],
					}}
					grouping={undefined}
					seriesCount={2}
					categoryCount={3}
					canEdit
					onUpdateChartData={() => {}}
					onTitleChange={() => {}}
				/>,
			),
		);
		const select = container.querySelector('select') as HTMLSelectElement;
		expect(select.value).toBe('pareto');
	});
});
