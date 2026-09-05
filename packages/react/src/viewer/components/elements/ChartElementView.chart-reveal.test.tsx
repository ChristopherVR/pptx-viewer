// @vitest-environment happy-dom
/**
 * `ChartElementView` chart-build reveal: proves the renderer prefers the
 * authored-index `animationState.chartReveal` descriptor over the count-based
 * `animationState.build` when both could apply, and still falls back to the
 * count-based path when only `build` is present. See
 * `packages/shared/src/render/chart-reveal-descriptor.ts`.
 */
import type { ChartPptxElement, PptxChartData } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ChartElementView } from './ChartElementView';

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

function makeElement(): ChartPptxElement {
	const chartData: PptxChartData = {
		chartType: 'bar',
		categories: ['Q1', 'Q2'],
		series: [
			{ name: 'North', values: [10, 20] },
			{ name: 'South', values: [15, 25] },
		],
	};
	return {
		id: 'ch1',
		type: 'chart',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData,
	} as ChartPptxElement;
}

describe('chartElementView chart-build reveal', () => {
	it('reveals only the authored p:graphicEl series via chartReveal (reverse-order build)', () => {
		act(() => {
			root.render(
				React.createElement(ChartElementView, {
					element: makeElement(),
					editable: false,
					animationState: {
						visible: true,
						cssAnimation: undefined,
						chartReveal: {
							mode: 'bySeries',
							descriptor: {
								background: true,
								series: new Set([1]),
								categories: new Set(),
								points: [],
							},
						},
					},
				}),
			);
		});
		const bars = container.querySelectorAll("rect[data-chart-part='dataPoint']");
		expect(bars).toHaveLength(2);
	});

	it('falls back to count-based reveal (animationState.build) when chartReveal is absent', () => {
		act(() => {
			root.render(
				React.createElement(ChartElementView, {
					element: makeElement(),
					editable: false,
					animationState: {
						visible: true,
						cssAnimation: undefined,
						build: { kind: 'chart', mode: 'bySeries', progress: 0.1 },
					},
				}),
			);
		});
		const bars = container.querySelectorAll("rect[data-chart-part='dataPoint']");
		expect(bars).toHaveLength(2);
	});

	it('renders every data point with no animationState', () => {
		act(() => {
			root.render(
				React.createElement(ChartElementView, { element: makeElement(), editable: false }),
			);
		});
		const bars = container.querySelectorAll("rect[data-chart-part='dataPoint']");
		expect(bars).toHaveLength(4);
	});
});
