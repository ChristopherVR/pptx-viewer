import type { TablePptxElement } from 'pptx-viewer-core';

import type { EditorOps } from './editor-operations';

export interface TableCellEditorSession {
	close(commit: boolean): void;
}

/** Open an inline text input inside a rendered table cell. */
export function openTableCellEditor(options: {
	doc: Document;
	cell: HTMLTableCellElement;
	element: TablePptxElement;
	row: number;
	column: number;
	ops: EditorOps;
}): TableCellEditorSession {
	const { doc, cell, element, row, column, ops } = options;
	const input = doc.createElement('input');
	input.type = 'text';
	input.className = 'pptxv-inline-editor pptxv-table-cell-editor';
	input.dataset.inlineEditor = '';
	input.value = element.tableData?.rows[row]?.cells[column]?.text ?? '';
	Object.assign(input.style, {
		boxSizing: 'border-box',
		width: '100%',
		height: '100%',
	});
	const originalContent = doc.createDocumentFragment();
	while (cell.firstChild) {
		originalContent.appendChild(cell.firstChild);
	}
	cell.appendChild(input);
	let closed = false;
	const commitOutside = (event: PointerEvent): void => {
		if (!event.composedPath().includes(input)) {
			close(true);
		}
	};
	const close = (commit: boolean): void => {
		if (closed) {
			return;
		}
		closed = true;
		doc.removeEventListener('pointerdown', commitOutside, true);
		if (commit) {
			ops.commitTableCell(element.id, row, column, input.value);
		}
		if (cell.isConnected) {
			cell.replaceChildren(commit ? doc.createTextNode(input.value) : originalContent);
		} else {
			input.remove();
		}
	};
	input.addEventListener('blur', () => close(true));
	input.addEventListener('pointerdown', (event) => event.stopPropagation());
	input.addEventListener('keydown', (event) => {
		event.stopPropagation();
		if (event.key === 'Escape') {
			close(false);
		} else if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			close(true);
		}
	});
	doc.addEventListener('pointerdown', commitOutside, true);
	input.focus();
	input.select();
	return { close };
}
