// @vitest-environment happy-dom
import type { PptxChartData } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChartFilteredSeriesOptions } from './ChartFilteredSeriesOptions';

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

function baseChart(overrides: Partial<PptxChartData> = {}): PptxChartData {
	return {
		chartType: 'bar',
		categories: ['Cat1', 'Cat2'],
		series: [
			{ name: 'Series A', values: [1, 2] },
			{ name: 'Series B', values: [3, 4] },
		],
		...overrides,
	};
}

describe('chartFilteredSeriesOptions', () => {
	it('renders nothing for a single-series chart with no filtered series or range', () => {
		act(() =>
			root.render(
				<ChartFilteredSeriesOptions
					chartData={baseChart({ series: [{ name: 'Only', values: [1] }] })}
					canEdit
					onHideSeries={() => {}}
					onRestoreSeries={() => {}}
					onSetDataLabelsRangeCache={() => {}}
				/>,
			),
		);
		expect(container.textContent).toBe('');
	});

	it('calls onHideSeries with the clicked series index', () => {
		const onHideSeries = vi.fn();
		act(() =>
			root.render(
				<ChartFilteredSeriesOptions
					chartData={baseChart()}
					canEdit
					onHideSeries={onHideSeries}
					onRestoreSeries={() => {}}
					onSetDataLabelsRangeCache={() => {}}
				/>,
			),
		);
		const buttons = container.querySelectorAll('button');
		act(() => (buttons[1] as HTMLButtonElement).click());
		expect(onHideSeries).toHaveBeenCalledWith(1);
	});

	it('lists a filtered series and calls onRestoreSeries with its index', () => {
		const onRestoreSeries = vi.fn();
		const data = baseChart({
			series: [{ name: 'Series A', values: [1, 2] }],
			filteredSeries: [{ idx: 1, order: 1, name: 'Series B', values: [3, 4] }],
		});
		act(() =>
			root.render(
				<ChartFilteredSeriesOptions
					chartData={data}
					canEdit
					onHideSeries={() => {}}
					onRestoreSeries={onRestoreSeries}
					onSetDataLabelsRangeCache={() => {}}
				/>,
			),
		);
		expect(container.textContent).toContain('Series B');
		const restoreButton = [...container.querySelectorAll('button')].at(-1) as HTMLButtonElement;
		act(() => restoreButton.click());
		expect(onRestoreSeries).toHaveBeenCalledWith(0);
	});

	it('falls back to filteredSeriesTitle when the filtered entry has no cached name', () => {
		const data = baseChart({
			series: [{ name: 'Series A', values: [1, 2] }],
			filteredSeries: [{ idx: 1, order: 1, values: [3, 4] }],
			filteredSeriesTitle: 'Series 3',
		});
		act(() =>
			root.render(
				<ChartFilteredSeriesOptions
					chartData={data}
					canEdit
					onHideSeries={() => {}}
					onRestoreSeries={() => {}}
					onSetDataLabelsRangeCache={() => {}}
				/>,
			),
		);
		expect(container.textContent).toContain('Series 3');
	});

	it('renders one input per cached label and calls onSetDataLabelsRangeCache on edit', () => {
		const onSetDataLabelsRangeCache = vi.fn();
		const data = baseChart({
			series: [
				{
					name: 'Series A',
					values: [1, 2],
					dataLabelOptions: {
						dataLabelsRange: { formula: 'Sheet1!$D$2:$D$3', cache: ['Low', 'High'] },
					},
				},
			],
		});
		act(() =>
			root.render(
				<ChartFilteredSeriesOptions
					chartData={data}
					canEdit
					onHideSeries={() => {}}
					onRestoreSeries={() => {}}
					onSetDataLabelsRangeCache={onSetDataLabelsRangeCache}
				/>,
			),
		);
		const inputs = container.querySelectorAll('input[type="text"]');
		expect(inputs).toHaveLength(2);
		const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
		act(() => {
			setter!.call(inputs[1], 'Renamed');
			inputs[1]!.dispatchEvent(new Event('input', { bubbles: true }));
		});
		expect(onSetDataLabelsRangeCache).toHaveBeenCalledWith(0, 1, 'Renamed');
	});

	it('disables every control when canEdit is false', () => {
		const data = baseChart({
			series: [
				{
					name: 'Series A',
					values: [1, 2],
					dataLabelOptions: {
						dataLabelsRange: { formula: 'Sheet1!$D$2:$D$3', cache: ['Low'] },
					},
				},
			],
			filteredSeries: [{ idx: 1, order: 1, name: 'Series B', values: [3, 4] }],
		});
		act(() =>
			root.render(
				<ChartFilteredSeriesOptions
					chartData={data}
					canEdit={false}
					onHideSeries={() => {}}
					onRestoreSeries={() => {}}
					onSetDataLabelsRangeCache={() => {}}
				/>,
			),
		);
		for (const el of container.querySelectorAll('button, input')) {
			expect((el as HTMLButtonElement | HTMLInputElement).disabled).toBeTruthy();
		}
	});
});
