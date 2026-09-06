import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../i18n';
import { createElementRendererRegistry } from '../registry';
import type { ElementRenderContext } from '../types';
import { buildChart3DValueDragInteraction, seedChart3DSelectedPart } from './chart-3d-interaction';

/**
 * `chart-3d-interaction.ts` is the bridge between a mounted 3D chart scene's
 * own click/drag pointer machinery and the SAME `context.onChartPartSelect` /
 * `context.onChartPointChange` commit path the flat 2D chart's
 * `chart-editable.ts` already threads through. These tests exercise the gate
 * (mirrors `attachChartEditing`'s own: interactive + editing wired up +
 * drilldown not locked) and the wiring itself, independent of any actual
 * three.js mount.
 */

const CHART_DATA: PptxChartData = {
	chartType: 'bar3D',
	categories: ['A', 'B'],
	series: [
		{ name: 'S1', values: [1, 2] },
		{ name: 'S2', values: [3, 4] },
	],
};

function chartElement(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'chart',
		id: 'c3d-1',
		x: 0,
		y: 0,
		width: 400,
		height: 240,
		chartData: CHART_DATA,
		...overrides,
	} as PptxElement;
}

function buildContext(overrides: Partial<ElementRenderContext> = {}): ElementRenderContext {
	const registry = createElementRendererRegistry();
	const context: ElementRenderContext = {
		document,
		slide: { id: 'slide-1', rId: 'rId1', slideNumber: 1, elements: [] },
		canvasSize: { width: 1280, height: 720 },
		scale: 1,
		mediaDataUrls: new Map<string, string>(),
		t: createTranslator(),
		smartArt3D: false,
		surfaceChart3D: false,
		barChart3D: false,
		lineChart3D: false,
		areaChart3D: false,
		pieChart3D: false,
		presenting: false,
		registry,
		renderElement: (el, z) => registry.resolve(el.type)(el, z, context),
		...overrides,
	};
	return context;
}

/** A fully "editing enabled" context: interactive canvas + both commit hooks wired. */
function editableContext(overrides: Partial<ElementRenderContext> = {}): ElementRenderContext {
	return buildContext({
		interactive: true,
		onChartPointChange: vi.fn(),
		onChartPartSelect: vi.fn(),
		...overrides,
	});
}

describe('buildChart3DValueDragInteraction', () => {
	it('returns undefined for a non-chart element', () => {
		const element: PptxElement = { type: 'shape', id: 's1', x: 0, y: 0, width: 10, height: 10 };
		expect(buildChart3DValueDragInteraction(element, editableContext())).toBeUndefined();
	});

	it('returns undefined when the canvas is not interactive', () => {
		expect(
			buildChart3DValueDragInteraction(chartElement(), editableContext({ interactive: false })),
		).toBeUndefined();
	});

	it('returns undefined when editing is not wired up (no onChartPointChange)', () => {
		expect(
			buildChart3DValueDragInteraction(
				chartElement(),
				editableContext({ onChartPointChange: undefined }),
			),
		).toBeUndefined();
	});

	it('returns undefined when the chart locks drilldown (a:graphicFrameLocks/@noDrilldown)', () => {
		const element = chartElement({ locks: { noDrilldown: true } });
		expect(buildChart3DValueDragInteraction(element, editableContext())).toBeUndefined();
	});

	it('reports a pressed mark through context.onChartPartSelect', () => {
		const context = editableContext();
		const element = chartElement();
		const interaction = buildChart3DValueDragInteraction(element, context);
		interaction?.onSelect?.({ role: 'dataPoint', seriesIndex: 0, pointIndex: 1 });
		expect(context.onChartPartSelect).toHaveBeenCalledExactlyOnceWith(element, {
			role: 'dataPoint',
			seriesIndex: 0,
			pointIndex: 1,
		});
	});

	it('leaves the current selection untouched on an empty-space click (part: null)', () => {
		const context = editableContext();
		const interaction = buildChart3DValueDragInteraction(chartElement(), context);
		interaction?.onSelect?.(null);
		expect(context.onChartPartSelect).not.toHaveBeenCalled();
	});

	it('commits a dragged value through withChartPointValue + context.onChartPointChange', () => {
		const context = editableContext();
		const element = chartElement();
		const interaction = buildChart3DValueDragInteraction(element, context);
		interaction?.onValueDragCommit?.({ role: 'dataPoint', seriesIndex: 1, pointIndex: 0 }, 9);
		expect(context.onChartPointChange).toHaveBeenCalledExactlyOnceWith(
			element,
			expect.objectContaining({
				series: [
					{ name: 'S1', values: [1, 2] },
					{ name: 'S2', values: [9, 4] },
				],
			}),
		);
	});

	it('does not commit when the part has no pointIndex (a series-level part)', () => {
		const context = editableContext();
		const interaction = buildChart3DValueDragInteraction(chartElement(), context);
		interaction?.onValueDragCommit?.({ role: 'series', seriesIndex: 0 }, 9);
		expect(context.onChartPointChange).not.toHaveBeenCalled();
	});

	it('does not commit when the element has no chartData', () => {
		const context = editableContext();
		const interaction = buildChart3DValueDragInteraction(
			chartElement({ chartData: undefined }),
			context,
		);
		interaction?.onValueDragCommit?.({ role: 'dataPoint', seriesIndex: 0, pointIndex: 0 }, 9);
		expect(context.onChartPointChange).not.toHaveBeenCalled();
	});
});

describe('seedChart3DSelectedPart', () => {
	it('seeds the persisted part when the store selection targets this element', () => {
		const element = chartElement();
		const context = buildContext({
			chartPartSelection: { elementId: element.id, part: { role: 'dataPoint', seriesIndex: 0 } },
		});
		const handle = { setSelectedPart: vi.fn() };
		seedChart3DSelectedPart(element, context, handle);
		expect(handle.setSelectedPart).toHaveBeenCalledExactlyOnceWith({
			role: 'dataPoint',
			seriesIndex: 0,
		});
	});

	it('seeds null when the store selection targets a different element', () => {
		const element = chartElement();
		const context = buildContext({
			chartPartSelection: {
				elementId: 'some-other-element',
				part: { role: 'dataPoint', seriesIndex: 0 },
			},
		});
		const handle = { setSelectedPart: vi.fn() };
		seedChart3DSelectedPart(element, context, handle);
		expect(handle.setSelectedPart).toHaveBeenCalledExactlyOnceWith(null);
	});

	it('seeds null when there is no store selection at all', () => {
		const handle = { setSelectedPart: vi.fn() };
		seedChart3DSelectedPart(chartElement(), buildContext(), handle);
		expect(handle.setSelectedPart).toHaveBeenCalledExactlyOnceWith(null);
	});
});
