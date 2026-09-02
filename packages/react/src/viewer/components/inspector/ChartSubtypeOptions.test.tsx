// @vitest-environment happy-dom
import type { PptxChartData } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChartSubtypeOptions } from './ChartSubtypeOptions';

function chartData(overrides: Partial<PptxChartData>): PptxChartData {
	return {
		chartType: 'bar',
		categories: ['A', 'B'],
		series: [],
		...overrides,
	} as PptxChartData;
}

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

describe('chartSubtypeOptions', () => {
	it('renders nothing for a chart family with no subtype picker', () => {
		act(() =>
			root.render(
				<ChartSubtypeOptions
					chartData={chartData({ chartType: 'bar' })}
					canEdit
					onUpdateChartData={() => {}}
				/>,
			),
		);
		expect(container.querySelector('select')).toBeNull();
	});

	it('shows the bar3D shape select for a bar3D chart and applies the shared patch', () => {
		const onUpdateChartData = vi.fn();
		act(() =>
			root.render(
				<ChartSubtypeOptions
					chartData={chartData({ chartType: 'bar3D', barShape: 'box' })}
					canEdit
					onUpdateChartData={onUpdateChartData}
				/>,
			),
		);
		const select = container.querySelector(
			'[data-testid="pptx-chart-bar3d-shape"]',
		) as HTMLSelectElement | null;
		expect(select).not.toBeNull();
		expect(container.querySelector('[data-testid="pptx-chart-radar-style"]')).toBeNull();
		expect(container.querySelector('[data-testid="pptx-chart-surface-wireframe"]')).toBeNull();

		act(() => {
			select!.value = 'cylinder';
			select!.dispatchEvent(new Event('change', { bubbles: true }));
		});
		expect(onUpdateChartData).toHaveBeenCalledWith({ barShape: 'cylinder' });
	});

	it('shows the radar style select for a radar chart and applies the shared patch', () => {
		const onUpdateChartData = vi.fn();
		act(() =>
			root.render(
				<ChartSubtypeOptions
					chartData={chartData({ chartType: 'radar', radarStyle: 'standard' })}
					canEdit
					onUpdateChartData={onUpdateChartData}
				/>,
			),
		);
		const select = container.querySelector(
			'[data-testid="pptx-chart-radar-style"]',
		) as HTMLSelectElement | null;
		expect(select).not.toBeNull();

		act(() => {
			select!.value = 'filled';
			select!.dispatchEvent(new Event('change', { bubbles: true }));
		});
		expect(onUpdateChartData).toHaveBeenCalledWith({ radarStyle: 'filled' });
	});

	it('shows the surface wireframe select for a surface chart and applies the shared patch', () => {
		const onUpdateChartData = vi.fn();
		act(() =>
			root.render(
				<ChartSubtypeOptions
					chartData={chartData({ chartType: 'surface', wireframe: false })}
					canEdit
					onUpdateChartData={onUpdateChartData}
				/>,
			),
		);
		const select = container.querySelector(
			'[data-testid="pptx-chart-surface-wireframe"]',
		) as HTMLSelectElement | null;
		expect(select).not.toBeNull();

		act(() => {
			select!.value = 'true';
			select!.dispatchEvent(new Event('change', { bubbles: true }));
		});
		expect(onUpdateChartData).toHaveBeenCalledWith({ wireframe: true });
	});
});
