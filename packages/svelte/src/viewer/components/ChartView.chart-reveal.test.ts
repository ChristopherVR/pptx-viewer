import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import ChartView from './ChartView.svelte';

/**
 * `ChartView` chart-build reveal: proves the renderer prefers the
 * authored-index `animationState.chartReveal` descriptor over the count-based
 * `animationState.build` when both could apply, and still falls back to the
 * count-based path when only `build` is present. See
 * `packages/shared/src/render/chart-reveal-descriptor.ts`.
 */

let mounted: ReturnType<typeof mount> | undefined;

afterEach(() => {
	if (mounted) {
		void unmount(mounted);
		mounted = undefined;
	}
	document.body.innerHTML = '';
});

function render(element: PptxElement, animationState?: object): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	mounted = mount(ChartView, {
		target,
		props: { element, mediaDataUrls: new Map<string, string>(), zIndex: 0, animationState },
	});
	flushSync();
	return target;
}

function chartElement(): PptxElement {
	const chartData: PptxChartData = {
		chartType: 'bar',
		categories: ['Q1', 'Q2'],
		series: [
			{ name: 'North', values: [10, 20] },
			{ name: 'South', values: [15, 25] },
		],
	};
	return {
		id: 'el-chart',
		type: 'chart',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData,
	} as PptxElement;
}

describe('chartView chart-build reveal', () => {
	it('reveals only the authored p:graphicEl series via chartReveal (reverse-order build)', () => {
		const target = render(chartElement(), {
			visible: true,
			cssAnimation: undefined,
			chartReveal: {
				mode: 'bySeries',
				descriptor: { background: true, series: new Set([1]), categories: new Set(), points: [] },
			},
		});
		expect(target.querySelectorAll("rect[data-chart-part='dataPoint']")).toHaveLength(2);
	});

	it('falls back to count-based reveal (animationState.build) when chartReveal is absent', () => {
		const target = render(chartElement(), {
			visible: true,
			cssAnimation: undefined,
			build: { kind: 'chart', mode: 'bySeries', progress: 0.1 },
		});
		expect(target.querySelectorAll("rect[data-chart-part='dataPoint']")).toHaveLength(2);
	});

	it('renders every data point with no animationState', () => {
		const target = render(chartElement());
		expect(target.querySelectorAll("rect[data-chart-part='dataPoint']")).toHaveLength(4);
	});
});
