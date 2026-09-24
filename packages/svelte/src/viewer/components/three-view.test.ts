import type { PptxChartData, PptxElement, PptxSmartArtData } from 'pptx-viewer-core';
import type { PptxThreeViewElement, Rendering3DFlags } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	DEFAULT_RENDERING_3D_FLAGS,
	Rendering3DFlagsContextKey,
} from '../state/rendering-3d-flags-context';
import ChartView from './ChartView.svelte';
import ElementRenderer from './ElementRenderer.svelte';

/**
 * `<pptx-three-view>` wiring in the Svelte binding (replaces the five per-kind
 * `*-chart-3d-view.test.ts` suites and `smart-art-3d-view.test.ts`). The
 * element is real shared infrastructure, harmless without WebGL (its scene
 * mount fails and it keeps the slotted SVG), so these assert the DECISION
 * (does a view mount, with which spec / interactive state) and that its
 * select/drag events reach the SAME selection / `onchartpointcommit` path the
 * 2D marks use. Mirrors React's `ChartElementView.three-view.test.tsx`.
 */

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function flagsContext(flags: Partial<Rendering3DFlags>): Map<unknown, unknown> {
	return new Map([
		[Rendering3DFlagsContextKey, () => ({ ...DEFAULT_RENDERING_3D_FLAGS, ...flags })],
	]);
}

function chart(chartType: string, id = `ch_${chartType}`): PptxElement {
	const chartData: PptxChartData = {
		chartType,
		categories: ['Q1', 'Q2'],
		series: [
			{ name: 'A', values: [10, 20] },
			{ name: 'B', values: [15, 25] },
		],
		...(chartType === 'surface' ? { view3D: { rotX: 15, rotY: 20 } } : {}),
	};
	return { id, type: 'chart', x: 0, y: 0, width: 400, height: 300, chartData } as PptxElement;
}

function mountInto<P extends Record<string, unknown>>(
	component: typeof ElementRenderer | typeof ChartView,
	props: P,
	context: Map<unknown, unknown>,
): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(component as typeof ElementRenderer, {
		target,
		props: props as never,
		context,
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

function view(target: HTMLElement): PptxThreeViewElement | null {
	return target.querySelector<PptxThreeViewElement>('pptx-three-view');
}

const cases: Array<{ flag: keyof Rendering3DFlags; chartType: string }> = [
	{ flag: 'barChart3D', chartType: 'bar3D' },
	{ flag: 'lineChart3D', chartType: 'line3D' },
	{ flag: 'areaChart3D', chartType: 'area3D' },
	{ flag: 'pieChart3D', chartType: 'pie3D' },
	{ flag: 'surfaceChart3D', chartType: 'surface' },
];

const baseProps = { mediaDataUrls: new Map<string, string>(), zIndex: 1 };

describe('<pptx-three-view> chart gating (svelte)', () => {
	it.each(cases)(
		'mounts the view for a $chartType chart when $flag is on',
		({ flag, chartType }) => {
			const target = mountInto(
				ElementRenderer,
				{ ...baseProps, element: chart(chartType) },
				flagsContext({ [flag]: true }),
			);
			expect(view(target)?.spec?.kind).toBe('chart');
			expect(view(target)?.querySelector('svg')).not.toBeNull();
		},
	);

	it.each(cases)(
		'stays on the SVG path for a $chartType chart when $flag is off',
		({ chartType }) => {
			const target = mountInto(
				ElementRenderer,
				{ ...baseProps, element: chart(chartType) },
				flagsContext({}),
			);
			expect(view(target)).toBeNull();
			expect(target.querySelector('svg')).not.toBeNull();
		},
	);

	it.each(cases)(
		'leaves a plain 2D bar chart on the SVG path even when $flag is on',
		({ flag }) => {
			const target = mountInto(
				ElementRenderer,
				{ ...baseProps, element: chart('bar', 'ch_bar_2d') },
				flagsContext({ [flag]: true }),
			);
			expect(view(target)).toBeNull();
		},
	);
});

describe('<pptx-three-view> chart wiring (svelte)', () => {
	function mountEditable(onchartpointcommit = vi.fn()) {
		const target = mountInto(
			ChartView,
			{
				...baseProps,
				element: chart('bar3D'),
				interactive: true,
				selected: true,
				onchartpointcommit,
			},
			flagsContext({ barChart3D: true }),
		);
		return { target, onchartpointcommit };
	}

	it('is interactive on the editable canvas and read-only elsewhere', () => {
		const { target } = mountEditable();
		expect(view(target)?.interactive).toBeTruthy();
		cleanup?.();
		const readOnly = mountInto(
			ChartView,
			{ ...baseProps, element: chart('bar3D') },
			flagsContext({ barChart3D: true }),
		);
		expect(view(readOnly)?.interactive).toBeFalsy();
	});

	it('a pptx-three-select event selects the part, mirrored onto the scene', () => {
		const { target } = mountEditable();
		const part = { role: 'dataPoint' as const, seriesIndex: 0, pointIndex: 1 };
		view(target)!.dispatchEvent(new CustomEvent('pptx-three-select', { detail: { part } }));
		flushSync();
		expect(view(target)?.selectedPart).toStrictEqual(part);
	});

	it('a pptx-three-drag commit goes through onchartpointcommit', () => {
		const { target, onchartpointcommit } = mountEditable();
		view(target)!.dispatchEvent(
			new CustomEvent('pptx-three-drag', {
				detail: {
					part: { role: 'dataPoint', seriesIndex: 0, pointIndex: 1 },
					value: 99,
					phase: 'commit',
				},
			}),
		);
		expect(onchartpointcommit).toHaveBeenCalledOnce();
		const [id, data] = onchartpointcommit.mock.calls[0] as [string, PptxChartData];
		expect(id).toBe('ch_bar3D');
		expect(data.series[0].values).toStrictEqual([10, 99]);
	});

	it('a read-only mount ignores pptx-three-select', () => {
		const target = mountInto(
			ChartView,
			{ ...baseProps, element: chart('bar3D') },
			flagsContext({ barChart3D: true }),
		);
		view(target)!.dispatchEvent(
			new CustomEvent('pptx-three-select', {
				detail: { part: { role: 'dataPoint', seriesIndex: 0, pointIndex: 1 } },
			}),
		);
		flushSync();
		expect(view(target)?.selectedPart).toBeNull();
	});
});

describe('<pptx-three-view> SmartArt (svelte)', () => {
	const data = {
		layoutType: 'list',
		nodes: [
			{ id: 'n1', text: 'One' },
			{ id: 'n2', text: 'Two' },
		],
		drawingShapes: [
			{
				id: 'a',
				shapeType: 'roundRect',
				x: 0,
				y: 0,
				width: 400,
				height: 140,
				fillColor: '#4472C4',
				text: 'One',
			},
		],
	} as unknown as PptxSmartArtData;
	const smartArt = {
		id: 'sa-1',
		type: 'smartArt',
		x: 50,
		y: 60,
		width: 400,
		height: 300,
		rotation: 30,
		smartArtData: data,
	} as unknown as PptxElement;

	it('mounts the view with a smartart spec when smartArt3D is on', () => {
		const target = mountInto(
			ElementRenderer,
			{ ...baseProps, element: smartArt },
			flagsContext({ smartArt3D: true }),
		);
		expect(view(target)?.spec?.kind).toBe('smartart');
		// The SVG fallback renders in the container's own frame.
		const fallback = view(target)?.querySelector<HTMLElement>('[data-element-id="sa-1"]');
		expect(fallback?.style.left).toBe('0px');
		expect(fallback?.style.transform ?? '').not.toContain('rotate');
	});

	it('stays on the SVG renderer when smartArt3D is off', () => {
		const target = mountInto(
			ElementRenderer,
			{ ...baseProps, element: smartArt },
			flagsContext({}),
		);
		expect(view(target)).toBeNull();
	});
});
