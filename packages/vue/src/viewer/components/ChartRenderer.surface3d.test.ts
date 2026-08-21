/**
 * Regression tests for the opt-in interactive 3D surface-chart wiring.
 *
 * `SurfaceChart3DRenderer.vue` itself dynamically imports `three` and mounts
 * a WebGL scene, which is not worth exercising in a jsdom unit test (no real
 * WebGL context). These tests instead assert the DECISION made by
 * `ChartRenderer`: given the `SurfaceChart3DKey` injection and the chart's
 * resolved kind, does it render the 3D renderer or the plain SVG path. The
 * renderer itself is stubbed via `vi.mock` so no `three` code runs.
 */
import { mount } from '@vue/test-utils';
import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { SurfaceChart3DKey } from '../composables/surface-chart-3d';
import ChartRenderer from './ChartRenderer.vue';

vi.mock(import('./SurfaceChart3DRenderer.vue'), () => ({
	default: {
		name: 'SurfaceChart3DRendererStub',
		template: '<div data-testid="surface-3d-stub" />',
	},
}));

function surfaceElement(): PptxElement {
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
	} as PptxElement;
}

function barElement(): PptxElement {
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
	} as PptxElement;
}

function mountChart(element: PptxElement, use3D: boolean) {
	return mount(ChartRenderer, {
		props: { element, zIndex: 0 },
		global: { provide: { [SurfaceChart3DKey as symbol]: use3D } },
	});
}

describe('chartRenderer - surfaceChart3D opt-in', () => {
	it('renders the SVG path (no 3D stub) when the injected flag is off', () => {
		const wrapper = mountChart(surfaceElement(), false);
		expect(wrapper.find('[data-testid="surface-3d-stub"]').exists()).toBeFalsy();
		expect(wrapper.find('svg').exists()).toBeTruthy();
	});

	it('renders the 3D stub for a surface chart when the injected flag is on', () => {
		const wrapper = mountChart(surfaceElement(), true);
		expect(wrapper.find('[data-testid="surface-3d-stub"]').exists()).toBeTruthy();
	});

	it('leaves a non-surface chart on the SVG path even when the flag is on', () => {
		const wrapper = mountChart(barElement(), true);
		expect(wrapper.find('[data-testid="surface-3d-stub"]').exists()).toBeFalsy();
		expect(wrapper.find('svg').exists()).toBeTruthy();
	});

	it('defaults to the SVG path when no provider is present (injection default false)', () => {
		const wrapper = mount(ChartRenderer, { props: { element: surfaceElement(), zIndex: 0 } });
		expect(wrapper.find('[data-testid="surface-3d-stub"]').exists()).toBeFalsy();
	});
});
