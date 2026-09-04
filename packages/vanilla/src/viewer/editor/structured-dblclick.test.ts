// @vitest-environment happy-dom
/**
 * G8 (OpenXML parity audit, D3): `a:graphicFrameLocks/@noDrilldown` was
 * parsed and round-tripped but never enforced - a table cell double-click
 * still opened the inline cell editor on a locked table.
 */
import type { PptxElement, TablePptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import type { ViewerState } from '../state';
import type { EditorOps } from './editor-operations';
import { handleStructuredDblClick } from './structured-dblclick';

function table(overrides: Partial<TablePptxElement> = {}): TablePptxElement {
	return {
		id: 'tbl1',
		type: 'table',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		tableData: {
			columnWidths: [0.5, 0.5],
			rows: [{ cells: [{ text: 'A' }, { text: 'B' }] }],
		},
		...overrides,
	} as TablePptxElement;
}

function stateWith(element: PptxElement): ViewerState {
	return {
		editable: true,
		presenting: false,
		editTemplateMode: false,
		templateElementsBySlideId: {},
		currentSlide: 0,
		slides: [{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [element] }],
	} as unknown as ViewerState;
}

describe('handleStructuredDblClick table cell drilldown', () => {
	it('is not handled when the table locks noDrilldown', () => {
		const state = stateWith(table({ locks: { noDrilldown: true } } as Partial<TablePptxElement>));
		const cell = document.createElement('td');
		cell.dataset.rowIndex = '0';
		cell.dataset.cellIndex = '0';
		const result = handleStructuredDblClick({
			event: new Event('dblclick'),
			state,
			doc: document,
			stage: null,
			overlay: document.createElement('div'),
			ops: {} as EditorOps,
			elementId: 'tbl1',
			cell,
		});
		expect(result.handled).toBeFalsy();
		expect(result.tableSession).toBeNull();
		expect(cell.querySelector('input')).toBeNull();
	});

	it('opens the cell editor on an unlocked table', () => {
		const state = stateWith(table());
		const cell = document.createElement('td');
		cell.dataset.rowIndex = '0';
		cell.dataset.cellIndex = '0';
		const result = handleStructuredDblClick({
			event: new Event('dblclick'),
			state,
			doc: document,
			stage: null,
			overlay: document.createElement('div'),
			ops: { commitTableCellText: vi.fn() } as unknown as EditorOps,
			elementId: 'tbl1',
			cell,
		});
		expect(result.handled).toBeTruthy();
		expect(cell.querySelector('input')).not.toBeNull();
	});
});
