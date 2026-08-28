/**
 * Regression tests for the opt-in interactive 3D area-chart wiring.
 *
 * `Area3DChartRenderer.vue` itself dynamically imports `three` and mounts a
 * WebGL scene, which is not worth exercising in a jsdom unit test (no real
 * WebGL context). These tests instead assert the DECISION made by
 * `ChartRenderer`: given the `AreaChart3DKey` injection and the chart's
 * `c:chartType`, does it render the 3D renderer or the plain SVG path. The
 * renderer itself is stubbed via `vi.mock` so no `three` code runs. Mirrors
 * `ChartRenderer.bar3d.test.ts`.
 */
import { mount } from '@vue/test-utils';
import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { AreaChart3DKey } from '../composables/area-chart-3d';
import ChartRenderer from './ChartRenderer.vue';

vi.mock(import('./Area3DChartRenderer.vue'), () => ({
	default: {
		name: 'Area3DChartRendererStub',
		template: '<div data-testid="area3d-stub" />',
	},
}));

function area3DElement(): PptxElement {
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
	} as PptxElement;
}

function areaElement(): PptxElement {
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
	} as PptxElement;
}

function mountChart(element: PptxElement, use3D: boolean) {
	return mount(ChartRenderer, {
		props: { element, zIndex: 0 },
		global: { provide: { [AreaChart3DKey as symbol]: use3D } },
	});
}

describe('chartRenderer - areaChart3D opt-in', () => {
	it('renders the SVG path (no 3D stub) when the injected flag is off', () => {
		const wrapper = mountChart(area3DElement(), false);
		expect(wrapper.find('[data-testid="area3d-stub"]').exists()).toBeFalsy();
		expect(wrapper.find('svg').exists()).toBeTruthy();
	});

	it('renders the 3D stub for an area3D chart when the injected flag is on', () => {
		const wrapper = mountChart(area3DElement(), true);
		expect(wrapper.find('[data-testid="area3d-stub"]').exists()).toBeTruthy();
	});

	it('leaves a plain (non-3D) area chart on the SVG path even when the flag is on', () => {
		const wrapper = mountChart(areaElement(), true);
		expect(wrapper.find('[data-testid="area3d-stub"]').exists()).toBeFalsy();
		expect(wrapper.find('svg').exists()).toBeTruthy();
	});

	it('defaults to the SVG path when no provider is present (injection default false)', () => {
		const wrapper = mount(ChartRenderer, { props: { element: area3DElement(), zIndex: 0 } });
		expect(wrapper.find('[data-testid="area3d-stub"]').exists()).toBeFalsy();
	});
});
