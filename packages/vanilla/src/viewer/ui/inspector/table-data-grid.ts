import type { PptxTableData, TablePptxElement } from 'pptx-viewer-core';
import type { TableDataGridCell, TableDataGridModel } from 'pptx-viewer-shared';
import {
	appendTableElementColumn,
	appendTableElementRow,
	buildTableDataGrid,
	removeLastTableElementColumn,
	removeLastTableElementRow,
	removeTableElementColumn,
	removeTableElementRow,
	setTableElementCellText,
} from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import type { InspectorHandlers, InspectorState } from './types';

/**
 * The table data grid: an inspector-resident spreadsheet of one text input per
 * table cell, plus add/remove controls for rows and columns.
 *
 * WHY this exists: every binding already ships a chart data grid, so chart
 * values can be retyped from the sidebar. Tables had no equivalent, and the
 * only way to change a cell's text was to double-click it on the canvas, which
 * is awkward for a small table and impossible for a cell scrolled out of view.
 * This is the table analogue of `chart-data-grid.ts`, and it is deliberately
 * built the same way so both behave identically.
 *
 * Every mutation goes through the pure element-level helpers in
 * `pptx-viewer-shared/render/table-data-grid` (merge-aware, immutable), and is
 * committed via `handlers.setTableData`, i.e. the viewer's real edit path, so
 * an edit lands on the canvas, becomes one undo entry, and survives a save.
 */
export interface TableDataGridSection {
	el: HTMLElement;
	update(state: InspectorState): void;
	/** Hide the add/remove toolbar and freeze the inputs on a read-only deck. */
	setEditable(editable: boolean): void;
}

/** Options for one header cell (a column header or a row header). */
interface HeadCellOptions {
	role: 'columnheader' | 'rowheader';
	/** The 1-based index shown in the gutter. */
	text: string;
	/** Accessible name AND tooltip of the remove button. */
	removeLabel: string;
	/** False on the last row/column, which may not be removed. */
	canRemove: boolean;
	onRemove: () => void;
}

export function createTableDataGrid(
	doc: Document,
	t: Translator,
	handlers: InspectorHandlers,
): TableDataGridSection {
	const el = createEl(doc, 'section', 'pptxv-inspector-section pptxv-table-grid');
	el.setAttribute('aria-label', t('pptx.tableDataEditor.ariaLabel'));

	const header = createEl(doc, 'div', 'pptxv-table-grid-header');
	const title = createEl(doc, 'h4', 'pptxv-inspector-section-title');
	title.textContent = t('pptx.inspector.tableData');
	const toolbar = createEl(doc, 'div', 'pptxv-table-grid-toolbar');
	header.append(title, toolbar);

	// Deliberately NOT a <table>/<td>: the framework-neutral e2e contract drives
	// the in-slide cell editor with a `td input` selector, so real table cells
	// here would collide with it. ARIA roles carry the grid semantics instead.
	const scroll = createEl(doc, 'div', 'pptxv-table-grid-scroll');
	const grid = createEl(doc, 'div', 'pptxv-table-grid-body');
	grid.setAttribute('role', 'grid');
	scroll.appendChild(grid);
	el.append(header, scroll);

	/** The selected table element, the subject of every commit below. */
	let current: TablePptxElement | undefined;
	/** The `tableData` the visible DOM was built from (rebuild gate). */
	let rendered: PptxTableData | undefined;
	let editable = true;

	/**
	 * Commit a replacement element. The shared helpers return the input element
	 * unchanged when an edit is refused (last row, last column, no table data),
	 * so an identity result must not push a pointless history entry.
	 */
	const commit = (next: TablePptxElement): void => {
		if (!current || next === current || !next.tableData) {
			return;
		}
		// `rawXml` travels with `tableData`: a table from a real deck renders and
		// saves from its graphic-frame markup, so a tableData-only patch is invisible.
		handlers.setTableData(next.tableData, next.rawXml);
	};

	const toolbarButton = (
		labelKey: string,
		titleKey: string,
		run: (element: TablePptxElement) => TablePptxElement,
	): HTMLButtonElement => {
		const button = createEl(doc, 'button', 'pptxv-table-grid-btn');
		button.type = 'button';
		// The visible text IS the accessible name here (matching React), with the
		// longer phrasing kept as the tooltip.
		button.textContent = t(`pptx.tableDataEditor.${labelKey}`);
		button.title = t(`pptx.tableDataEditor.${titleKey}`);
		button.addEventListener('click', () => {
			if (current) {
				commit(run(current));
			}
		});
		return button;
	};

	const addRow = toolbarButton('addRowLabel', 'addRowTitle', appendTableElementRow);
	const removeRow = toolbarButton('removeRowLabel', 'removeRowTitle', removeLastTableElementRow);
	const addColumn = toolbarButton('addColumnLabel', 'addColumnTitle', appendTableElementColumn);
	const removeColumn = toolbarButton(
		'removeColumnLabel',
		'removeColumnTitle',
		removeLastTableElementColumn,
	);
	toolbar.append(addRow, removeRow, addColumn, removeColumn);

	const headCell = (options: HeadCellOptions): HTMLElement => {
		const cell = createEl(doc, 'div', 'pptxv-table-grid-head');
		cell.setAttribute('role', options.role);
		if (options.role === 'rowheader') {
			cell.classList.add('pptxv-table-grid-gutter');
		}
		const caption = doc.createElement('span');
		caption.textContent = options.text;
		cell.appendChild(caption);
		if (editable && options.canRemove) {
			const button = createEl(doc, 'button', 'pptxv-table-grid-remove');
			button.type = 'button';
			button.textContent = '×';
			button.title = options.removeLabel;
			button.setAttribute('aria-label', options.removeLabel);
			button.addEventListener('click', options.onRemove);
			cell.appendChild(button);
		}
		return cell;
	};

	const cellInput = (cell: TableDataGridCell): HTMLInputElement => {
		const input = doc.createElement('input');
		input.type = 'text';
		input.className = 'pptxv-table-grid-input';
		input.value = cell.text;
		input.disabled = !editable;
		input.dataset.pptxRow = String(cell.rowIndex);
		input.dataset.pptxCol = String(cell.colIndex);
		input.setAttribute(
			'aria-label',
			t('pptx.tableDataEditor.cellAriaLabel', {
				row: cell.rowIndex + 1,
				column: cell.colIndex + 1,
			}),
		);
		// Commit on `change` (blur / Enter), never on every keystroke: a commit
		// re-renders the inspector, and rebuilding the grid mid-word would tear
		// the caret out of the input being typed into. Same rule as the chart grid.
		input.addEventListener('change', () => {
			if (current) {
				commit(setTableElementCellText(current, cell.rowIndex, cell.colIndex, input.value));
			}
		});
		// The editor's global key handling treats Delete / arrows as canvas
		// commands, so keep them inside the cell being typed into.
		input.addEventListener('keydown', (event) => event.stopPropagation());
		return input;
	};

	// The two head-cell builders are declared out here (rather than inline in the
	// loops below) so their click closures are not re-declared per iteration.
	const columnHead = (colIndex: number, canRemove: boolean): HTMLElement =>
		headCell({
			role: 'columnheader',
			text: String(colIndex + 1),
			removeLabel: t('pptx.tableDataEditor.removeColumnN', { number: colIndex + 1 }),
			canRemove,
			onRemove: () => {
				if (current) {
					commit(removeTableElementColumn(current, colIndex));
				}
			},
		});

	const rowHead = (rowIndex: number, canRemove: boolean): HTMLElement =>
		headCell({
			role: 'rowheader',
			text: String(rowIndex + 1),
			removeLabel: t('pptx.tableDataEditor.removeRowN', { number: rowIndex + 1 }),
			canRemove,
			onRemove: () => {
				if (current) {
					commit(removeTableElementRow(current, rowIndex));
				}
			},
		});

	const buildHeaderRow = (model: TableDataGridModel): HTMLElement => {
		const row = createEl(doc, 'div', 'pptxv-table-grid-row');
		row.setAttribute('role', 'row');
		const corner = createEl(doc, 'div', 'pptxv-table-grid-head pptxv-table-grid-gutter');
		corner.setAttribute('role', 'columnheader');
		row.appendChild(corner);
		for (const colIndex of model.colIndices) {
			row.appendChild(columnHead(colIndex, model.canRemoveColumn));
		}
		return row;
	};

	const renderGrid = (model: TableDataGridModel): void => {
		grid.textContent = '';
		grid.appendChild(buildHeaderRow(model));
		for (const row of model.rows) {
			const rowEl = createEl(doc, 'div', 'pptxv-table-grid-row');
			rowEl.setAttribute('role', 'row');
			rowEl.appendChild(rowHead(row.rowIndex, model.canRemoveRow));
			for (const cell of row.cells) {
				const cellEl = createEl(doc, 'div', 'pptxv-table-grid-cell');
				cellEl.setAttribute('role', 'gridcell');
				cellEl.appendChild(cellInput(cell));
				rowEl.appendChild(cellEl);
			}
			grid.appendChild(rowEl);
		}
	};

	/** Coordinates of the focused cell input, so a rebuild can restore it. */
	const focusedCoords = (): [string, string] | null => {
		const active = doc.activeElement as HTMLElement | null;
		if (!active || active.tagName !== 'INPUT' || !grid.contains(active)) {
			return null;
		}
		const { pptxRow, pptxCol } = active.dataset;
		return pptxRow !== undefined && pptxCol !== undefined ? [pptxRow, pptxCol] : null;
	};

	const applyEditable = (): void => {
		toolbar.hidden = !editable;
		for (const input of grid.querySelectorAll('input')) {
			input.disabled = !editable;
		}
		for (const button of grid.querySelectorAll<HTMLButtonElement>('.pptxv-table-grid-remove')) {
			button.hidden = !editable;
		}
	};

	return {
		el,
		update(state) {
			current = state.tableElement;
			const model = current ? buildTableDataGrid(current) : undefined;
			const visible =
				state.hasSelection &&
				state.isTable &&
				model !== undefined &&
				model.rowCount > 0 &&
				model.colCount > 0;
			el.hidden = !visible;
			if (!visible || !model || !current) {
				rendered = undefined;
				grid.textContent = '';
				return;
			}
			toolbar.hidden = !editable;
			addRow.disabled = !editable;
			addColumn.disabled = !editable;
			removeRow.disabled = !editable || !model.canRemoveRow;
			removeColumn.disabled = !editable || !model.canRemoveColumn;
			if (current.tableData === rendered) {
				return;
			}
			const focus = focusedCoords();
			rendered = current.tableData;
			renderGrid(model);
			if (focus) {
				grid
					.querySelector<HTMLInputElement>(
						`input[data-pptx-row="${focus[0]}"][data-pptx-col="${focus[1]}"]`,
					)
					?.focus();
			}
		},
		setEditable(next) {
			editable = next;
			applyEditable();
			// Force the next update to rebuild, so the per-row/column remove
			// buttons come back (they are only created while editable).
			rendered = undefined;
		},
	};
}
