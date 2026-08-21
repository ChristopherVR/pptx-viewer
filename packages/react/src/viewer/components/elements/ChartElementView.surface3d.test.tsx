// @vitest-environment happy-dom
/**
 * Regression tests for the opt-in interactive 3D surface-chart wiring.
 *
 * {@link SurfaceChart3DRenderer} itself dynamically imports `three` and mounts
 * a WebGL scene, which is not worth exercising in a jsdom/happy-dom unit test
 * (no real WebGL context). These tests instead assert the DECISION made by
 * `ChartElementView`: given the `SurfaceChart3DContext` flag and the chart's
 * resolved kind, does it render the 3D renderer or the plain SVG path. The
 * renderer itself is stubbed via `vi.mock` so no `three` code runs.
 */
import type { ChartPptxElement, PptxChartData } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ChartElementView } from './ChartElementView';
import { SurfaceChart3DContext } from './surface-chart-3d-context';

vi.mock(import('./SurfaceChart3DRenderer'), () => ({
	SurfaceChart3DRenderer: () => React.createElement('div', { 'data-testid': 'surface-3d-stub' }),
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

function makeSurfaceElement(): ChartPptxElement {
	const chartData: PptxChartData = {
		chartType: 'surface',
		categories: ['Q1', 'Q2'],
		series: [
			{ name: 'A', values: [10, 20] },
			{ name: 'B', values: [15, 25] },
		],
	};
	return {
		id: 'ch_surface',
		type: 'chart',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData,
	} as ChartPptxElement;
}

function makeBarElement(): ChartPptxElement {
	const chartData: PptxChartData = {
		chartType: 'bar',
		categories: ['Q1', 'Q2'],
		series: [{ name: 'A', values: [10, 20] }],
	};
	return {
		id: 'ch_bar',
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
				SurfaceChart3DContext.Provider,
				{ value: use3D },
				React.createElement(ChartElementView, { element, editable: false }),
			),
		);
	});
}

describe('chartElementView - surfaceChart3D opt-in', () => {
	it('renders the SVG path (no 3D stub) when the context flag is off', () => {
		render(makeSurfaceElement(), false);
		expect(container.querySelector('[data-testid="surface-3d-stub"]')).toBeNull();
		expect(container.querySelector('svg')).not.toBeNull();
	});

	it('renders the 3D stub for a surface chart when the context flag is on', () => {
		render(makeSurfaceElement(), true);
		expect(container.querySelector('[data-testid="surface-3d-stub"]')).not.toBeNull();
	});

	it('leaves a non-surface chart on the SVG path even when the flag is on', () => {
		render(makeBarElement(), true);
		expect(container.querySelector('[data-testid="surface-3d-stub"]')).toBeNull();
		expect(container.querySelector('svg')).not.toBeNull();
	});

	it('defaults to the SVG path when no provider is present (context default false)', () => {
		act(() => {
			root.render(
				React.createElement(ChartElementView, { element: makeSurfaceElement(), editable: false }),
			);
		});
		expect(container.querySelector('[data-testid="surface-3d-stub"]')).toBeNull();
	});
});
