/* oxlint-disable eslint/one-var -- many independent `it()` blocks, each with
   its own short arrange/act/assert consts. */
import type { ChartPptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildInspectorState } from './inspector-state-builder';

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
