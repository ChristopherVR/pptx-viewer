// @vitest-environment happy-dom
/**
 * Regression tests for the opt-in interactive 3D pie-chart wiring.
 *
 * {@link PieChart3DRenderer} itself dynamically imports `three` and mounts a
 * WebGL scene, which is not worth exercising in a jsdom/happy-dom unit test
 * (no real WebGL context). These tests instead assert the DECISION made by
 * `ChartElementView`: given the `PieChart3DContext` flag and the chart's
 * `c:chartType`, does it render the 3D renderer or the plain SVG path. The
 * renderer itself is stubbed via `vi.mock` so no `three` code runs. Mirrors
 * `ChartElementView.bar3d.test.tsx`.
 */
import type { ChartPptxElement, PptxChartData } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ChartElementView } from './ChartElementView';
import { PieChart3DContext } from './pie-chart-3d-context';

vi.mock(import('./PieChart3DRenderer'), () => ({
	PieChart3DRenderer: () => React.createElement('div', { 'data-testid': 'pie3d-stub' }),
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

function makePie3DElement(): ChartPptxElement {
	const chartData: PptxChartData = {
		chartType: 'pie3D',
		categories: ['Jan', 'Feb', 'Mar'],
		series: [{ name: 'Revenue', values: [10, 20, 30] }],
	};
	return {
		id: 'ch_pie3d',
		type: 'chart',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData,
	} as ChartPptxElement;
}

function makePieElement(): ChartPptxElement {
	const chartData: PptxChartData = {
		chartType: 'pie',
		categories: ['Jan', 'Feb'],
		series: [{ name: 'Revenue', values: [10, 20] }],
	};
	return {
		id: 'ch_pie',
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
				PieChart3DContext.Provider,
				{ value: use3D },
				React.createElement(ChartElementView, { element, editable: false }),
			),
		);
	});
}

describe('chartElementView - pieChart3D opt-in', () => {
	it('renders the SVG path (no 3D stub) when the context flag is off', () => {
		render(makePie3DElement(), false);
		expect(container.querySelector('[data-testid="pie3d-stub"]')).toBeNull();
		expect(container.querySelector('svg')).not.toBeNull();
	});

	it('renders the 3D stub for a pie3D chart when the context flag is on', () => {
		render(makePie3DElement(), true);
		expect(container.querySelector('[data-testid="pie3d-stub"]')).not.toBeNull();
	});

	it('leaves a plain (non-3D) pie chart on the SVG path even when the flag is on', () => {
		render(makePieElement(), true);
		expect(container.querySelector('[data-testid="pie3d-stub"]')).toBeNull();
		expect(container.querySelector('svg')).not.toBeNull();
	});

	it('defaults to the SVG path when no provider is present (context default false)', () => {
		act(() => {
			root.render(
				React.createElement(ChartElementView, { element: makePie3DElement(), editable: false }),
			);
		});
		expect(container.querySelector('[data-testid="pie3d-stub"]')).toBeNull();
	});
});
