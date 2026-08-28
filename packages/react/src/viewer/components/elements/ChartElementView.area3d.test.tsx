// @vitest-environment happy-dom
/**
 * Regression tests for the opt-in interactive 3D area-chart wiring. Mirrors
 * `ChartElementView.line3d.test.tsx` / `ChartElementView.bar3d.test.tsx`.
 */
import type { ChartPptxElement, PptxChartData } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { AreaChart3DContext } from './area-chart-3d-context';
import { ChartElementView } from './ChartElementView';

vi.mock(import('./Area3DChartRenderer'), () => ({
	Area3DChartRenderer: () => React.createElement('div', { 'data-testid': 'area3d-stub' }),
}));

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

function makeArea3DElement(): ChartPptxElement {
	const chartData: PptxChartData = {
		chartType: 'area3D',
		categories: ['Q1', 'Q2'],
		series: [
			{ name: 'A', values: [10, 20] },
			{ name: 'B', values: [15, 25] },
		],
	};
	return {
		id: 'ch_area3d',
		type: 'chart',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData,
	} as ChartPptxElement;
}

function makeAreaElement(): ChartPptxElement {
	const chartData: PptxChartData = {
		chartType: 'area',
		categories: ['Q1', 'Q2'],
		series: [{ name: 'A', values: [10, 20] }],
	};
	return {
		id: 'ch_area',
		type: 'chart',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData,
	} as ChartPptxElement;
}

function render(element: ChartPptxElement, use3D: boolean) {
	act(() => {
		root.render(
			React.createElement(
				AreaChart3DContext.Provider,
				{ value: use3D },
				React.createElement(ChartElementView, { element, editable: false }),
			),
		);
	});
}

describe('chartElementView - areaChart3D opt-in', () => {
	it('renders the SVG path (no 3D stub) when the context flag is off', () => {
		render(makeArea3DElement(), false);
		expect(container.querySelector('[data-testid="area3d-stub"]')).toBeNull();
		expect(container.querySelector('svg')).not.toBeNull();
	});

	it('renders the 3D stub for an area3D chart when the context flag is on', () => {
		render(makeArea3DElement(), true);
		expect(container.querySelector('[data-testid="area3d-stub"]')).not.toBeNull();
	});

	it('leaves a plain (non-3D) area chart on the SVG path even when the flag is on', () => {
		render(makeAreaElement(), true);
		expect(container.querySelector('[data-testid="area3d-stub"]')).toBeNull();
		expect(container.querySelector('svg')).not.toBeNull();
	});

	it('defaults to the SVG path when no provider is present (context default false)', () => {
		act(() => {
			root.render(
				React.createElement(ChartElementView, { element: makeArea3DElement(), editable: false }),
			);
		});
		expect(container.querySelector('[data-testid="area3d-stub"]')).toBeNull();
	});
});
