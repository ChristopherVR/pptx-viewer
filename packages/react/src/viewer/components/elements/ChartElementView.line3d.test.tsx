// @vitest-environment happy-dom
/**
 * Regression tests for the opt-in interactive 3D line-chart wiring.
 *
 * {@link Line3DChartRenderer} itself dynamically imports `three` and mounts a
 * WebGL scene, which is not worth exercising in a jsdom/happy-dom unit test
 * (no real WebGL context). These tests instead assert the DECISION made by
 * `ChartElementView`: given the `LineChart3DContext` flag and the chart's
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
import { LineChart3DContext } from './line-chart-3d-context';

vi.mock(import('./Line3DChartRenderer'), () => ({
	Line3DChartRenderer: () => React.createElement('div', { 'data-testid': 'line3d-stub' }),
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

function makeLine3DElement(): ChartPptxElement {
	const chartData: PptxChartData = {
		chartType: 'line3D',
		categories: ['Q1', 'Q2'],
		series: [
			{ name: 'A', values: [10, 20] },
			{ name: 'B', values: [15, 25] },
		],
	};
	return {
		id: 'ch_line3d',
		type: 'chart',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData,
	} as ChartPptxElement;
}

function makeLineElement(): ChartPptxElement {
	const chartData: PptxChartData = {
		chartType: 'line',
		categories: ['Q1', 'Q2'],
		series: [{ name: 'A', values: [10, 20] }],
	};
	return {
		id: 'ch_line',
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
				LineChart3DContext.Provider,
				{ value: use3D },
				React.createElement(ChartElementView, { element, editable: false }),
			),
		);
	});
}

describe('chartElementView - lineChart3D opt-in', () => {
	it('renders the SVG path (no 3D stub) when the context flag is off', () => {
		render(makeLine3DElement(), false);
		expect(container.querySelector('[data-testid="line3d-stub"]')).toBeNull();
		expect(container.querySelector('svg')).not.toBeNull();
	});

	it('renders the 3D stub for a line3D chart when the context flag is on', () => {
		render(makeLine3DElement(), true);
		expect(container.querySelector('[data-testid="line3d-stub"]')).not.toBeNull();
	});

	it('leaves a plain (non-3D) line chart on the SVG path even when the flag is on', () => {
		render(makeLineElement(), true);
		expect(container.querySelector('[data-testid="line3d-stub"]')).toBeNull();
		expect(container.querySelector('svg')).not.toBeNull();
	});

	it('defaults to the SVG path when no provider is present (context default false)', () => {
		act(() => {
			root.render(
				React.createElement(ChartElementView, { element: makeLine3DElement(), editable: false }),
			);
		});
		expect(container.querySelector('[data-testid="line3d-stub"]')).toBeNull();
	});
});
