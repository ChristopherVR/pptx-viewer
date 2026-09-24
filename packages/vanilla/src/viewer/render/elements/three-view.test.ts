import type { PptxChartData, PptxElement, PptxSmartArtData } from 'pptx-viewer-core';
import type { PptxThreeViewElement, Rendering3DFlags } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../i18n';
import { createElementRendererRegistry } from '../registry';
import type { ElementRenderContext } from '../types';
import { renderChartElement } from './chart';
import { registerTableChartRenderers } from './register-table-chart';
import { renderSmartArtElement } from './smartart';

/**
 * `<pptx-three-view>` wiring in the Vanilla binding (replaces the five
 * per-kind `*-chart-3d.test.ts` suites and the SmartArt model test). The
 * element is real shared infrastructure, harmless without WebGL (its scene
 * mount fails and it keeps the slotted SVG), so these assert the DECISION
 * (does a view mount, with which spec / interactive state) and that its
 * select/drag events reach the SAME `onChartPartSelect` /
 * `onChartPointChange` path the 2D marks use. Mirrors React's
 * `ChartElementView.three-view.test.tsx`.
 */

const NO_FLAGS: Rendering3DFlags = {
	smartArt3D: false,
	surfaceChart3D: false,
	barChart3D: false,
	lineChart3D: false,
	areaChart3D: false,
	pieChart3D: false,
};

function buildContext(
	flags: Partial<Rendering3DFlags>,
	overrides: Partial<ElementRenderContext> = {},
): ElementRenderContext {
	const registry = createElementRendererRegistry();
	registerTableChartRenderers(registry);
	const context: ElementRenderContext = {
		document,
		slide: { id: 'slide-1', rId: 'rId1', slideNumber: 1, elements: [] },
		canvasSize: { width: 1280, height: 720 },
		scale: 1,
		mediaDataUrls: new Map<string, string>(),
		t: createTranslator(),
		...NO_FLAGS,
		...flags,
		presenting: false,
		registry,
		renderElement(element, zIndex) {
			return registry.resolve(element.type)(element, zIndex, context);
		},
		...overrides,
	};
	return context;
}

function chart(chartType: PptxChartData['chartType'], id = `ch_${chartType}`): PptxElement {
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

function viewIn(node: Element | null): PptxThreeViewElement | null {
	return node?.querySelector<PptxThreeViewElement>('pptx-three-view') ?? null;
}

const cases: Array<{ flag: keyof Rendering3DFlags; chartType: PptxChartData['chartType'] }> = [
	{ flag: 'barChart3D', chartType: 'bar3D' },
	{ flag: 'lineChart3D', chartType: 'line3D' },
	{ flag: 'areaChart3D', chartType: 'area3D' },
	{ flag: 'pieChart3D', chartType: 'pie3D' },
	{ flag: 'surfaceChart3D', chartType: 'surface' },
];

describe('<pptx-three-view> chart gating (vanilla)', () => {
	it.each(cases)(
		'mounts the view for a $chartType chart when $flag is on',
		({ flag, chartType }) => {
			const node = renderChartElement(
				chart(chartType),
				1,
				buildContext({ [flag]: true }),
			) as Element;
			const view = viewIn(node);
			expect(view?.spec?.kind).toBe('chart');
			// The flat SVG moved into the view as its fallback.
			expect(view?.querySelector('svg')).not.toBeNull();
		},
	);

	it.each(cases)(
		'stays on the SVG path for a $chartType chart when $flag is off',
		({ chartType }) => {
			const node = renderChartElement(chart(chartType), 1, buildContext({})) as Element;
			expect(viewIn(node)).toBeNull();
			expect(node.querySelector('svg')).not.toBeNull();
		},
	);

	it.each(cases)(
		'leaves a plain 2D bar chart on the SVG path even when $flag is on',
		({ flag }) => {
			const node = renderChartElement(
				chart('bar', 'ch_2d'),
				1,
				buildContext({ [flag]: true }),
			) as Element;
			expect(viewIn(node)).toBeNull();
		},
	);
});

describe('<pptx-three-view> chart wiring (vanilla)', () => {
	function editable() {
		const onChartPartSelect = vi.fn();
		const onChartPointChange = vi.fn();
		const element = chart('bar3D');
		const context = buildContext(
			{ barChart3D: true },
			{
				interactive: true,
				onChartPartSelect,
				onChartPointChange,
				selectedElementIds: new Set([element.id]),
			},
		);
		const view = viewIn(renderChartElement(element, 1, context) as Element)!;
		return { element, view, onChartPartSelect, onChartPointChange };
	}

	it('is interactive on the authoring canvas only, once the chart is selected', () => {
		expect(editable().view.interactive).toBeTruthy();
		const unselected = viewIn(
			renderChartElement(
				chart('bar3D'),
				1,
				buildContext(
					{ barChart3D: true },
					{ interactive: true, onChartPointChange: vi.fn(), selectedElementIds: new Set() },
				),
			) as Element,
		);
		expect(unselected?.interactive).toBeFalsy();
		const readOnly = viewIn(
			renderChartElement(chart('bar3D'), 1, buildContext({ barChart3D: true })) as Element,
		);
		expect(readOnly?.interactive).toBeFalsy();
	});

	it('seeds the persisted chart-part selection onto the scene', () => {
		const part = { role: 'dataPoint' as const, seriesIndex: 1, pointIndex: 0 };
		const context = buildContext(
			{ barChart3D: true },
			{ chartPartSelection: { elementId: 'ch_bar3D', part } },
		);
		expect(
			viewIn(renderChartElement(chart('bar3D'), 1, context) as Element)?.selectedPart,
		).toStrictEqual(part);
	});

	it('a pptx-three-select event reports the part through onChartPartSelect', () => {
		const { element, view, onChartPartSelect } = editable();
		const part = { role: 'dataPoint' as const, seriesIndex: 0, pointIndex: 1 };
		view.dispatchEvent(new CustomEvent('pptx-three-select', { detail: { part } }));
		expect(onChartPartSelect).toHaveBeenCalledExactlyOnceWith(element, part);
		expect(view.selectedPart).toStrictEqual(part);
	});

	it('a pptx-three-drag commit writes the value through onChartPointChange', () => {
		const { element, view, onChartPointChange } = editable();
		view.dispatchEvent(
			new CustomEvent('pptx-three-drag', {
				detail: {
					part: { role: 'dataPoint', seriesIndex: 0, pointIndex: 1 },
					value: 99,
					phase: 'commit',
				},
			}),
		);
		expect(onChartPointChange).toHaveBeenCalledOnce();
		const [committed, data] = onChartPointChange.mock.calls[0] as [PptxElement, PptxChartData];
		expect(committed).toBe(element);
		expect(data.series[0].values).toStrictEqual([10, 99]);
	});

	it('a drag move shows the value badge, and the commit clears it', () => {
		const { view } = editable();
		const wrapper = view.parentElement!;
		const part = { role: 'dataPoint', seriesIndex: 0, pointIndex: 1 };
		view.dispatchEvent(
			new CustomEvent('pptx-three-drag', { detail: { part, value: 42, phase: 'move' } }),
		);
		expect(wrapper.querySelector('.pptxv-chart-drag-badge')?.textContent).toBe('42');
		view.dispatchEvent(
			new CustomEvent('pptx-three-drag', { detail: { part, value: 42, phase: 'commit' } }),
		);
		expect(wrapper.querySelector('.pptxv-chart-drag-badge')).toBeNull();
	});

	it('a read-only mount ignores pptx-three-select', () => {
		const onChartPartSelect = vi.fn();
		const view = viewIn(
			renderChartElement(
				chart('bar3D'),
				1,
				buildContext({ barChart3D: true }, { onChartPartSelect }),
			) as Element,
		)!;
		view.dispatchEvent(
			new CustomEvent('pptx-three-select', {
				detail: { part: { role: 'dataPoint', seriesIndex: 0, pointIndex: 1 } },
			}),
		);
		expect(onChartPartSelect).not.toHaveBeenCalled();
	});
});

describe('<pptx-three-view> SmartArt (vanilla)', () => {
	const smartArt = {
		id: 'sa-1',
		type: 'smartArt',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		smartArtData: {
			layoutType: 'list',
			nodes: [{ id: 'n1', text: 'One' }],
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
		} as unknown as PptxSmartArtData,
	} as unknown as PptxElement;

	it('mounts the view with a smartart spec when smartArt3D is on', () => {
		const node = renderSmartArtElement(smartArt, 1, buildContext({ smartArt3D: true })) as Element;
		expect(viewIn(node)?.spec?.kind).toBe('smartart');
		expect(viewIn(node)?.querySelector('svg')).not.toBeNull();
	});

	it('stays on the SVG renderer when smartArt3D is off', () => {
		const node = renderSmartArtElement(smartArt, 1, buildContext({})) as Element;
		expect(viewIn(node)).toBeNull();
	});
});
