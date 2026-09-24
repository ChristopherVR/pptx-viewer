// @vitest-environment happy-dom
/**
 * Regression tests for `ChartElementView`'s `<pptx-three-view>` wiring:
 * replaces the five per-kind `ChartElementView.*3d.test.tsx` files (one per
 * `Bar3DChartRenderer`/`Line3DChartRenderer`/... stub) plus
 * `build-chart3d-part-interaction.test.ts` and `chart3d-interaction-hooks.test.tsx`,
 * now that a single `<pptx-three-view>` element replaces all five per-kind
 * wrappers.
 *
 * `<pptx-three-view>` is real shared infrastructure (not stubbed): it is
 * harmless to mount without WebGL (its scene mount fails and it shows its
 * slotted 2D fallback), so these tests assert the DECISION `ChartElementView`
 * makes (does a `<pptx-three-view>` mount at all, with which `spec`/
 * `interactive`/`textStyle`) and that its `pptx-three-select`/`pptx-three-drag`
 * events reach the SAME selection/commit path the 2D mark interaction uses.
 */
import type { ChartPptxElement, PptxChartData, PptxElement } from 'pptx-viewer-core';
import type { PptxThreeViewElement, Rendering3DFlags } from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChartPartSelectionProvider } from '../chart-part-selection';
import { ChartElementView } from './ChartElementView';
import { DEFAULT_RENDERING_3D_FLAGS, Rendering3DFlagsContext } from './rendering-3d-flags-context';

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

function makeElement(chartType: string, id = `ch_${chartType}`): ChartPptxElement {
	const chartData: PptxChartData = {
		chartType,
		categories: ['Q1', 'Q2'],
		series: [
			{ name: 'A', values: [10, 20] },
			{ name: 'B', values: [15, 25] },
		],
		// `surface` covers both c:surfaceChart (2D top view) and c:surface3DChart;
		// only the 3D one carries c:view3D, which is what gates the 3D view.
		...(chartType === 'surface' ? { view3D: { rotX: 15, rotY: 20 } } : {}),
	};
	return { id, type: 'chart', x: 0, y: 0, width: 400, height: 300, chartData } as ChartPptxElement;
}

function threeView(): PptxThreeViewElement | null {
	return container.querySelector<PptxThreeViewElement>('pptx-three-view');
}

function renderWithFlags(
	element: ChartPptxElement,
	flags: Partial<Rendering3DFlags>,
	props: { editable?: boolean; onUpdateElement?: (updates: Partial<PptxElement>) => void } = {},
): void {
	act(() => {
		root.render(
			React.createElement(
				Rendering3DFlagsContext.Provider,
				{ value: { ...DEFAULT_RENDERING_3D_FLAGS, ...flags } },
				React.createElement(
					ChartPartSelectionProvider,
					null,
					React.createElement(ChartElementView, {
						element,
						editable: props.editable ?? false,
						onUpdateElement: props.onUpdateElement,
					}),
				),
			),
		);
	});
}

describe('chartElementView - <pptx-three-view> opt-in gating', () => {
	const cases: Array<{ flag: keyof Rendering3DFlags; chartType: string }> = [
		{ flag: 'barChart3D', chartType: 'bar3D' },
		{ flag: 'lineChart3D', chartType: 'line3D' },
		{ flag: 'areaChart3D', chartType: 'area3D' },
		{ flag: 'pieChart3D', chartType: 'pie3D' },
		{ flag: 'surfaceChart3D', chartType: 'surface' },
	];

	it.each(cases)(
		'mounts <pptx-three-view> for a $chartType chart when $flag is on',
		({ flag, chartType }) => {
			renderWithFlags(makeElement(chartType), { [flag]: true });
			const view = threeView();
			expect(view).not.toBeNull();
			expect(view?.spec?.kind).toBe('chart');
		},
	);

	it.each(cases)(
		'stays on the plain SVG path for a $chartType chart when $flag is off',
		({ chartType }) => {
			renderWithFlags(makeElement(chartType), {});
			expect(threeView()).toBeNull();
			expect(container.querySelector('svg')).not.toBeNull();
		},
	);

	it.each(cases)(
		'leaves a plain (2D) bar chart on the SVG path even when $flag is on',
		({ flag }) => {
			renderWithFlags(makeElement('bar', 'ch_bar_2d'), { [flag]: true });
			expect(threeView()).toBeNull();
			expect(container.querySelector('svg')).not.toBeNull();
		},
	);

	it('defaults to the SVG path with no Rendering3DFlagsContext provider', () => {
		act(() => {
			root.render(
				React.createElement(ChartElementView, { element: makeElement('bar3D'), editable: false }),
			);
		});
		expect(threeView()).toBeNull();
	});
});

describe('chartElementView - <pptx-three-view> property wiring', () => {
	it('sets interactive to the edit state and forwards textStyle', () => {
		act(() => {
			root.render(
				React.createElement(
					Rendering3DFlagsContext.Provider,
					{ value: { ...DEFAULT_RENDERING_3D_FLAGS, barChart3D: true } },
					React.createElement(
						ChartPartSelectionProvider,
						null,
						React.createElement(ChartElementView, {
							element: makeElement('bar3D'),
							editable: true,
							onUpdateElement: vi.fn(),
							animationState: { visible: true, cssAnimation: undefined, textStyle: { bold: true } },
						}),
					),
				),
			);
		});
		const view = threeView();
		expect(view?.interactive).toBeTruthy();
		expect(view?.textStyle).toStrictEqual({ bold: true });
	});
});

describe('chartElementView - <pptx-three-view> selection and drag wiring', () => {
	it('a pptx-three-select event applies to the chart-part selection like a 2D mark click', () => {
		const element = makeElement('bar3D');
		renderWithFlags(element, { barChart3D: true }, { editable: true, onUpdateElement: vi.fn() });
		const view = threeView();
		expect(view).not.toBeNull();

		act(() => {
			view!.dispatchEvent(
				new CustomEvent('pptx-three-select', {
					detail: { part: { role: 'dataPoint', seriesIndex: 0, pointIndex: 1 } },
				}),
			);
		});

		expect(threeView()?.selectedPart).toStrictEqual({
			role: 'dataPoint',
			seriesIndex: 0,
			pointIndex: 1,
		});
	});

	it('a pptx-three-drag commit event writes the value through onUpdateElement, like a 2D mark drag', () => {
		const element = makeElement('bar3D');
		const onUpdateElement = vi.fn();
		renderWithFlags(element, { barChart3D: true }, { editable: true, onUpdateElement });
		const view = threeView();

		act(() => {
			view!.dispatchEvent(
				new CustomEvent('pptx-three-drag', {
					detail: {
						part: { role: 'dataPoint', seriesIndex: 0, pointIndex: 1 },
						value: 99,
						phase: 'commit',
					},
				}),
			);
		});

		expect(onUpdateElement).toHaveBeenCalledWith({
			chartData: {
				...element.chartData,
				series: [
					{ name: 'A', values: [10, 99] },
					{ name: 'B', values: [15, 25] },
				],
			},
		});
	});

	it('a read-only (non-editable) mount ignores pptx-three-select', () => {
		const element = makeElement('bar3D');
		renderWithFlags(element, { barChart3D: true }, { editable: false });
		const view = threeView();

		act(() => {
			view!.dispatchEvent(
				new CustomEvent('pptx-three-select', {
					detail: { part: { role: 'dataPoint', seriesIndex: 0, pointIndex: 1 } },
				}),
			);
		});

		expect(threeView()?.selectedPart).toBeNull();
	});
});
