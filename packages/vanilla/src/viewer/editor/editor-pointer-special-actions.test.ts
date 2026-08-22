import type { PptxElement, PptxTableData } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createInitialViewerState, createStore } from '../state';
import { createEditorOps } from './editor-operations';
import {
	handleSpecialPointerAction,
	snapSiblings,
	snapToGrid,
} from './editor-pointer-special-actions';

describe('editor pointer special actions', () => {
	it('snaps geometry to the ten-pixel grid (default)', () => {
		expect(snapToGrid({ x: 14, y: 26, width: 10 }, true)).toMatchObject({ x: 10, y: 30 });
		expect(snapToGrid({ x: 14, y: 26 }, false)).toStrictEqual({ x: 14, y: 26 });
	});

	// Regression: `snapToGrid` used to hardcode a 10px step with no way to pass
	// a different one, so the deck's authored `viewProperties.gridSpacing` had
	// no path into the snap step at all. `gridSize` is a third, optional
	// parameter so callers derive it via `computeGridSpacingPx` and existing
	// two-argument call sites are unaffected.
	it('snaps to a caller-supplied grid size instead of the 10px default', () => {
		expect(snapToGrid({ x: 55, y: 55 }, true, 40)).toStrictEqual({ x: 40, y: 40 });
		expect(snapToGrid({ x: 55, y: 55 }, true, 10)).toStrictEqual({ x: 60, y: 60 });
	});

	it('gates shape snap siblings with viewer state', () => {
		const element = { type: 'shape', id: 'a', x: 1, y: 2, width: 3, height: 4 } as const;
		const state = {
			...createInitialViewerState(),
			slides: [{ id: 's', rId: 'rId-s', slideNumber: 1, elements: [element] }],
		};
		expect(snapSiblings({ ...state, snapToShape: false })).toStrictEqual([]);
		expect(snapSiblings({ ...state, snapToShape: true })).toStrictEqual([
			{ id: 'a', x: 1, y: 2, width: 3, height: 4 },
		]);
	});
});

/** 3x3 grid whose middle cell spans two columns (1..2 on row 1). */
function mergedTableData(): PptxTableData {
	const cell = (overrides: Record<string, number> = {}) => ({ text: '', ...overrides });
	return {
		columnWidths: [1 / 3, 1 / 3, 1 / 3],
		rows: [
			{ cells: [cell(), cell(), cell()] },
			{ cells: [cell(), cell({ gridSpan: 2 }), cell()] },
			{ cells: [cell(), cell(), cell()] },
		],
	} as PptxTableData;
}

function shiftClickCell(tableData: PptxTableData | undefined, row: number, column: number) {
	const element = {
		type: 'table',
		id: 'tbl',
		x: 0,
		y: 0,
		width: 300,
		height: 150,
		...(tableData ? { tableData } : {}),
	} as PptxElement;
	const store = createStore({
		...createInitialViewerState(),
		editable: true,
		slides: [{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [element] }],
		selectedElementId: 'tbl',
		selectedElementIds: ['tbl'],
		selectedTableCell: { row: 0, column: 0 },
	});
	const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: () => {} });

	const td = document.createElement('td');
	td.dataset.rowIndex = String(row);
	td.dataset.cellIndex = String(column);
	const tr = document.createElement('tr');
	tr.appendChild(td);
	document.createElement('table').appendChild(tr);

	const handled = handleSpecialPointerAction({
		event: { shiftKey: true, target: td, preventDefault: vi.fn() } as unknown as PointerEvent,
		elementId: 'tbl',
		state: store.get(),
		store,
		ops,
	});
	return { handled, store };
}

describe('shift-click table cell range', () => {
	it('expands the range to cover a merged cell it crosses', () => {
		const { handled, store } = shiftClickCell(mergedTableData(), 1, 1);
		expect(handled).toBeTruthy();
		// Rows 0..1 x columns 0..2: the plain min/max rect would have stopped at
		// column 1, cutting the two-column merge in half.
		expect(store.get().selectedTableCells).toStrictEqual([
			{ row: 0, column: 0 },
			{ row: 0, column: 1 },
			{ row: 0, column: 2 },
			{ row: 1, column: 0 },
			{ row: 1, column: 1 },
			{ row: 1, column: 2 },
		]);
	});

	it('still builds the plain rectangle when no merge is crossed', () => {
		const { store } = shiftClickCell(mergedTableData(), 2, 0);
		expect(store.get().selectedTableCells).toStrictEqual([
			{ row: 0, column: 0 },
			{ row: 1, column: 0 },
			{ row: 2, column: 0 },
		]);
	});

	it('falls back to the plain rectangle when the element carries no tableData', () => {
		const { store } = shiftClickCell(undefined, 1, 1);
		expect(store.get().selectedTableCells).toStrictEqual([
			{ row: 0, column: 0 },
			{ row: 0, column: 1 },
			{ row: 1, column: 0 },
			{ row: 1, column: 1 },
		]);
	});
});
