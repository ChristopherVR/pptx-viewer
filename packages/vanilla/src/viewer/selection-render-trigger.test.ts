import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { selectionChangeNeedsStageRender } from './selection-render-trigger';

const ELEMENTS = [
	{ id: 'chart1', type: 'chart', x: 0, y: 0, width: 10, height: 10 },
	{ id: 'table1', type: 'table', x: 0, y: 0, width: 10, height: 10 },
	{ id: 'shape1', type: 'shape', x: 0, y: 0, width: 10, height: 10 },
] as PptxElement[];

describe('selectionChangeNeedsStageRender', () => {
	it('re-renders when a chart enters or leaves the selection', () => {
		expect(selectionChangeNeedsStageRender([], ['chart1'], ELEMENTS)).toBeTruthy();
		expect(selectionChangeNeedsStageRender(['chart1'], [], ELEMENTS)).toBeTruthy();
		expect(
			selectionChangeNeedsStageRender(['shape1'], ['shape1', 'chart1'], ELEMENTS),
		).toBeTruthy();
	});

	it('keeps the stage DOM when only non-chart elements change selection', () => {
		// The first click of a double-click on a table cell selects the table;
		// a rebuild here would replace the cell under the pointer and the
		// browser would never form the `dblclick` that opens the cell editor.
		expect(selectionChangeNeedsStageRender([], ['table1'], ELEMENTS)).toBeFalsy();
		expect(selectionChangeNeedsStageRender(['table1'], ['shape1'], ELEMENTS)).toBeFalsy();
		expect(selectionChangeNeedsStageRender(['shape1'], [], ELEMENTS)).toBeFalsy();
	});

	it('ignores a chart that stays selected across the change', () => {
		expect(selectionChangeNeedsStageRender(['chart1'], ['chart1', 'shape1'], ELEMENTS)).toBeFalsy();
	});

	it('is a no-op for the same selection reference', () => {
		const ids = ['chart1'];
		expect(selectionChangeNeedsStageRender(ids, ids, ELEMENTS)).toBeFalsy();
	});
});
