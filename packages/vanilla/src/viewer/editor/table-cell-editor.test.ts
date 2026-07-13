import type { TablePptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import type { EditorOps } from './editor-operations';
import { openTableCellEditor } from './table-cell-editor';

function setup() {
	const cell = document.createElement('td');
	cell.textContent = 'Starter';
	document.body.appendChild(cell);
	const commitTableCell = vi.fn();
	const session = openTableCellEditor({
		doc: document,
		cell,
		element: {
			id: 'table-1',
			type: 'table',
			x: 0,
			y: 0,
			width: 100,
			height: 50,
			tableData: { rows: [{ cells: [{ text: 'Starter' }] }], columnWidths: [100] },
		} as TablePptxElement,
		row: 0,
		column: 0,
		ops: { commitTableCell } as unknown as EditorOps,
	});
	return { cell, commitTableCell, input: cell.querySelector('input')!, session };
}

describe('openTableCellEditor', () => {
	it('mounts a selected text input in the cell and commits with Enter', () => {
		const { cell, commitTableCell, input } = setup();
		expect(input.type).toBe('text');
		expect(input.value).toBe('Starter');
		expect(input.selectionStart).toBe(0);
		expect(input.selectionEnd).toBe('Starter'.length);
		input.value = 'Free';
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(commitTableCell).toHaveBeenCalledWith('table-1', 0, 0, 'Free');
		expect(cell.querySelector('input')).toBeNull();
		expect(cell.textContent).toBe('Free');
		cell.remove();
	});

	it('commits on blur and keeps pointerdown inside the editor local', () => {
		const { cell, commitTableCell, input } = setup();
		const parentPointerDown = vi.fn();
		cell.addEventListener('pointerdown', parentPointerDown);
		input.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		expect(parentPointerDown).not.toHaveBeenCalled();
		input.value = 'Renamed';
		input.blur();
		expect(commitTableCell).toHaveBeenCalledWith('table-1', 0, 0, 'Renamed');
		expect(cell.textContent).toBe('Renamed');
		cell.remove();
	});
});
