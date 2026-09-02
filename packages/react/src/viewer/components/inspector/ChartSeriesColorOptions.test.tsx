// @vitest-environment happy-dom
import type { PptxChartData } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChartSeriesColorOptions } from './ChartSeriesColorOptions';

/**
 * Pins the new "Use secondary axis" per-series checkbox, wired onto the
 * shared `isSeriesUsingSecondaryAxis` / `seriesSecondaryAxisPatch`
 * (render/chart-secondary-axis.ts) - a parity item React previously had no UI
 * for at all.
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

function chartData(seriesAxisId: number | undefined): PptxChartData {
	return {
		chartType: 'bar',
		categories: ['a'],
		series: [{ name: 'S1', values: [1], axisId: seriesAxisId }],
		axes: [
			{ axisType: 'valAx', axisId: 1, axPos: 'l' },
			{ axisType: 'valAx', axisId: 2, axPos: 'r' },
		],
	} as unknown as PptxChartData;
}

describe('chartSeriesColorOptions secondary-axis checkbox', () => {
	it('is unchecked when the series targets the primary (left) axis', () => {
		act(() =>
			root.render(
				<ChartSeriesColorOptions
					chartData={chartData(1)}
					canEdit
					onSetColor={() => {}}
					onToggleSecondaryAxis={() => {}}
				/>,
			),
		);
		const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
		expect(checkbox.checked).toBeFalsy();
	});

	it('is checked when the series targets the secondary (right) axis', () => {
		act(() =>
			root.render(
				<ChartSeriesColorOptions
					chartData={chartData(2)}
					canEdit
					onSetColor={() => {}}
					onToggleSecondaryAxis={() => {}}
				/>,
			),
		);
		const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
		expect(checkbox.checked).toBeTruthy();
	});

	it('calls onToggleSecondaryAxis with the series index and next state', () => {
		const onToggleSecondaryAxis = vi.fn();
		act(() =>
			root.render(
				<ChartSeriesColorOptions
					chartData={chartData(1)}
					canEdit
					onSetColor={() => {}}
					onToggleSecondaryAxis={onToggleSecondaryAxis}
				/>,
			),
		);
		const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
		act(() => {
			checkbox.click();
		});
		expect(onToggleSecondaryAxis).toHaveBeenCalledWith(0, true);
	});
});
