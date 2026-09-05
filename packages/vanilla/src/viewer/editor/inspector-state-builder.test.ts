/* oxlint-disable eslint/one-var -- many independent `it()` blocks, each with
   its own short arrange/act/assert consts. */
import type { ChartPptxElement, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildInspectorState } from './inspector-state-builder';

function shapeEl(overrides: Record<string, unknown> = {}): PptxElement {
	return {
		type: 'shape',
		id: 's1',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		shapeType: 'rect',
		shapeStyle: {
			fillColor: '#4472c4',
			fillColorRef: { scheme: 'accent1' },
			strokeColor: '#ed7d31',
			strokeColorRef: { scheme: 'accent2' },
		},
		...overrides,
	} as PptxElement;
}

/**
 * `chartHighlightCell`: the pure derivation of the on-canvas chart part
 * selection into what the inspector's data grid / point-index picker read.
 * Mirrors Vue's `ChartPanel.vue` `highlightCell` computed (elementId match,
 * else null) as a plain function so it is unit-testable without the store.
 */
const chartElement: ChartPptxElement = {
	id: 'chart-1',
	type: 'chart',
	x: 0,
	y: 0,
	width: 400,
	height: 300,
	chartData: {
		chartType: 'bar',
		categories: ['A', 'B'],
		series: [{ name: 'S1', values: [1, 2] }],
	},
};

describe('buildInspectorState chartHighlightCell', () => {
	it('is null when nothing is selected on canvas', () => {
		const state = buildInspectorState(chartElement, null, [], null, new Map(), null);
		expect(state.chartHighlightCell).toBeNull();
	});

	it('is null when the selected element is not a chart', () => {
		const shape = { ...chartElement, type: 'shape' as const, chartData: undefined };
		const state = buildInspectorState(shape, null, [], null, new Map(), {
			elementId: chartElement.id,
			part: { role: 'dataPoint', seriesIndex: 0, pointIndex: 1 },
		});
		expect(state.chartHighlightCell).toBeNull();
	});

	it('is null when the selection belongs to a DIFFERENT chart element', () => {
		const state = buildInspectorState(chartElement, null, [], null, new Map(), {
			elementId: 'some-other-chart',
			part: { role: 'dataPoint', seriesIndex: 0, pointIndex: 1 },
		});
		expect(state.chartHighlightCell).toBeNull();
	});

	it('carries the seriesIndex/pointIndex through for the matching chart', () => {
		const state = buildInspectorState(chartElement, null, [], null, new Map(), {
			elementId: chartElement.id,
			part: { role: 'dataPoint', seriesIndex: 0, pointIndex: 1 },
		});
		expect(state.chartHighlightCell).toStrictEqual({ seriesIndex: 0, pointIndex: 1 });
	});

	it('carries a series-only selection with pointIndex left undefined', () => {
		const state = buildInspectorState(chartElement, null, [], null, new Map(), {
			elementId: chartElement.id,
			part: { role: 'series', seriesIndex: 0 },
		});
		expect(state.chartHighlightCell).toStrictEqual({ seriesIndex: 0, pointIndex: undefined });
	});
});

// G7/G9 (OpenXML parity audit, D3): a:picLocks/@noCrop and
// arrowheadsChangeable were both parsed/computed but nothing in the vanilla
// inspector consulted them.
describe('buildInspectorState croppable/arrowheadsChangeable', () => {
	it('is croppable and arrowheads-changeable by default (no locks)', () => {
		const state = buildInspectorState({ ...chartElement, type: 'image' } as never);
		expect(state.croppable).toBeTruthy();
		expect(state.arrowheadsChangeable).toBeTruthy();
	});

	it('reports not croppable when a:picLocks/@noCrop is set', () => {
		const picture = { ...chartElement, type: 'image', locks: { noCrop: true } } as never;
		expect(buildInspectorState(picture).croppable).toBeFalsy();
	});

	it('reports arrowheads not changeable when noChangeArrowheads is set', () => {
		const connector = {
			...chartElement,
			type: 'connector',
			locks: { noChangeArrowheads: true },
		} as never;
		expect(buildInspectorState(connector).arrowheadsChangeable).toBeFalsy();
	});
});

describe('buildInspectorState theme colour refs + themeColorMap (W3-G2)', () => {
	it('carries the fill/stroke theme refs through from shapeStyle', () => {
		const state = buildInspectorState(shapeEl(), null, [], null, new Map(), null, []);
		expect(state.fillColorRef).toStrictEqual({ scheme: 'accent1' });
		expect(state.strokeColorRef).toStrictEqual({ scheme: 'accent2' });
	});

	it('is undefined for elements with no shape properties', () => {
		const state = buildInspectorState(chartElement, null, [], null, new Map(), null, []);
		expect(state.fillColorRef).toBeUndefined();
		expect(state.strokeColorRef).toBeUndefined();
	});

	it('defaults themeColorMap to undefined and carries a passed map through', () => {
		expect(
			buildInspectorState(shapeEl(), null, [], null, new Map(), null, []).themeColorMap,
		).toBeUndefined();
		const map = { accent1: '#4472c4' };
		expect(
			buildInspectorState(shapeEl(), null, [], null, new Map(), null, [], map).themeColorMap,
		).toBe(map);
	});
});
