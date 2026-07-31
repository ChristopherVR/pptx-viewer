/**
 * table-data-grid-ops.ts: element-level, immutable row/column/cell operations
 * behind the inspector's table data grid.
 *
 * Split out of `table-data-grid.ts` (which owns the render model and its types)
 * to keep both files inside the repo's 300 LOC ceiling. Import either through
 * the package barrel; they are one feature in two files.
 *
 * WHY these wrap the primitives in `table-layout` rather than calling them
 * directly from a view:
 *
 *  1. **The "append / remove last" dance.** The grid's header buttons operate on
 *     the END of the table, but the primitives are positional
 *     (`insertTableRow(td, idx, 'below')`). Without these wrappers every binding
 *     re-writes the same `count - 1` clamp and gets it wrong for an empty table.
 *  2. **rawXml synchronisation**, which is load-bearing: see {@link withTableData}.
 *
 * They take and return a whole `TablePptxElement` so an inspector can hand the
 * result straight to the binding's `updateElement` edit path as a single history
 * entry. The underlying transforms are the merge-AWARE ones in `table-layout`,
 * so existing merge spans are adjusted rather than destroyed.
 *
 * Every function is pure: the input element is never mutated.
 *
 * @module render/table-data-grid-ops
 */
import type { PptxTableData, TablePptxElement } from 'pptx-viewer-core';
import { rebuildTableStructureInRawXml, updateCellTextInRawXml } from 'pptx-viewer-core';

import { setCellText } from './table-cell-edit';
import {
	deleteTableColumn,
	deleteTableRow,
	insertTableColumn,
	insertTableRow,
} from './table-layout';

/**
 * Apply a pure `PptxTableData` transform to an element, returning a new element.
 *
 * Returns the element unchanged when it carries no table data or the transform
 * was a no-op (returned the same reference), so a rejected edit does not push a
 * pointless history entry.
 *
 * CRITICAL: a table parsed from a real `.pptx` keeps its graphic-frame markup in
 * `rawXml`, and BOTH the renderers and the save writer read that markup in
 * preference to `tableData` (`tableData` is only the fallback for tables created
 * programmatically via Insert > Table). So a `tableData`-only patch is invisible:
 * the canvas keeps painting the old text and the edit is dropped on save. Every
 * structural edit therefore rebuilds `rawXml` alongside it, exactly as the
 * on-canvas cell editor does.
 */
function withTableData(
	element: TablePptxElement,
	transform: (data: PptxTableData) => PptxTableData,
): TablePptxElement {
	const tableData = element.tableData;
	if (!tableData) {
		return element;
	}
	const next = transform(tableData);
	if (next === tableData) {
		return element;
	}
	const updated: TablePptxElement = { ...element, tableData: next };
	if (element.rawXml) {
		const rawXml = rebuildTableStructureInRawXml(element, next);
		if (rawXml) {
			updated.rawXml = rawXml;
		}
	}
	return updated;
}

/**
 * Set one cell's text, keeping `rawXml` in sync so the edit actually paints and
 * survives a save. Prefer this over the bare `setCellText` whenever the edit
 * originates from a UI surface: see the note on {@link withTableData}.
 *
 * @param element - The source table element (not mutated).
 * @param rowIndex - Zero-based row index of the cell.
 * @param colIndex - Zero-based column index of the cell.
 * @param text - New plain-text content for the cell.
 * @returns A new element with the cell text applied to both representations.
 */
export function setTableElementCellText(
	element: TablePptxElement,
	rowIndex: number,
	colIndex: number,
	text: string,
): TablePptxElement {
	const updated = setCellText(element, rowIndex, colIndex, text);
	if (updated === element || !element.rawXml) {
		return updated;
	}
	const rawXml = updateCellTextInRawXml(element, rowIndex, colIndex, text);
	return rawXml ? { ...updated, rawXml } : updated;
}

/**
 * Insert a blank row above or below `rowIdx`, preserving merge spans.
 *
 * @param element - The source table element (not mutated).
 * @param rowIdx - Zero-based reference row.
 * @param position - Whether the new row goes above or below the reference row.
 * @returns A new element with the row inserted.
 */
export function insertTableElementRow(
	element: TablePptxElement,
	rowIdx: number,
	position: 'above' | 'below',
): TablePptxElement {
	return withTableData(element, (data) => insertTableRow(data, rowIdx, position));
}

/**
 * Remove the row at `rowIdx`, preserving merge spans. No-op on the last row.
 *
 * @param element - The source table element (not mutated).
 * @param rowIdx - Zero-based row to remove.
 * @returns A new element with the row removed.
 */
export function removeTableElementRow(element: TablePptxElement, rowIdx: number): TablePptxElement {
	return withTableData(element, (data) => deleteTableRow(data, rowIdx));
}

/**
 * Insert a blank column left or right of `colIdx`, preserving merge spans.
 *
 * @param element - The source table element (not mutated).
 * @param colIdx - Zero-based reference column.
 * @param position - Whether the new column goes left or right of the reference.
 * @returns A new element with the column inserted.
 */
export function insertTableElementColumn(
	element: TablePptxElement,
	colIdx: number,
	position: 'left' | 'right',
): TablePptxElement {
	return withTableData(element, (data) => insertTableColumn(data, colIdx, position));
}

/**
 * Remove the column at `colIdx`, preserving merge spans. No-op on the last one.
 *
 * @param element - The source table element (not mutated).
 * @param colIdx - Zero-based column to remove.
 * @returns A new element with the column removed.
 */
export function removeTableElementColumn(
	element: TablePptxElement,
	colIdx: number,
): TablePptxElement {
	return withTableData(element, (data) => deleteTableColumn(data, colIdx));
}

/**
 * Append a blank row after the last one.
 *
 * Clamped to index 0 so an element whose table data is empty is a no-op rather
 * than an insert at index -1.
 *
 * @param element - The source table element (not mutated).
 * @returns A new element with a trailing row.
 */
export function appendTableElementRow(element: TablePptxElement): TablePptxElement {
	const rowCount = element.tableData?.rows.length ?? 0;
	if (rowCount === 0) {
		return element;
	}
	return insertTableElementRow(element, rowCount - 1, 'below');
}

/**
 * Remove the trailing row. No-op when the table has one row or none.
 *
 * @param element - The source table element (not mutated).
 * @returns A new element with the last row removed.
 */
export function removeLastTableElementRow(element: TablePptxElement): TablePptxElement {
	const rowCount = element.tableData?.rows.length ?? 0;
	if (rowCount === 0) {
		return element;
	}
	return removeTableElementRow(element, rowCount - 1);
}

/**
 * Append a blank column after the last one.
 *
 * Clamped to index 0 for the same reason as {@link appendTableElementRow}.
 *
 * @param element - The source table element (not mutated).
 * @returns A new element with a trailing column.
 */
export function appendTableElementColumn(element: TablePptxElement): TablePptxElement {
	const colCount = element.tableData?.columnWidths.length ?? 0;
	if (colCount === 0) {
		return element;
	}
	return insertTableElementColumn(element, colCount - 1, 'right');
}

/**
 * Remove the trailing column. No-op when the table has one column or none.
 *
 * @param element - The source table element (not mutated).
 * @returns A new element with the last column removed.
 */
export function removeLastTableElementColumn(element: TablePptxElement): TablePptxElement {
	const colCount = element.tableData?.columnWidths.length ?? 0;
	if (colCount === 0) {
		return element;
	}
	return removeTableElementColumn(element, colCount - 1);
}
