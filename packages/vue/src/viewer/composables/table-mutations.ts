import type { PptxTableData, TablePptxElement } from 'pptx-viewer-core';
import type { CellCoord } from 'pptx-viewer-shared';
import {
	canMergeCells,
	computeMergeCellDown,
	computeMergeCellRight,
	computeSplitCell,
	insertTableElementColumn,
	insertTableElementRow,
	mergeCells,
	removeTableElementColumn,
	removeTableElementRow,
} from 'pptx-viewer-shared';
import { toRaw } from 'vue';

/**
 * table-mutations: thin, pure wrappers over the framework-agnostic table
 * transforms in `pptx-viewer-shared`, returning a new table element (or `null`
 * for a structural no-op) so both the inspector `TablePanel` and
 * the canvas context menu (applies via `useEditorOperations`) drive edits from
 * one merge-aware implementation. Mirrors React's table operation handlers.
 */

/** Insert a blank row above/below `rowIndex` (merge span aware). */
export function applyInsertRow(
	element: TablePptxElement,
	rowIndex: number,
	position: 'above' | 'below',
): TablePptxElement {
	return insertTableElementRow(toRaw(element), rowIndex, position);
}

/** Delete the row at `rowIndex`; returns `null` when the delete is a no-op. */
export function applyDeleteRow(
	element: TablePptxElement,
	rowIndex: number,
): TablePptxElement | null {
	const source = toRaw(element);
	const next = removeTableElementRow(source, rowIndex);
	return next === source ? null : next;
}

/** Insert a blank column left/right of `colIndex` (merge span aware). */
export function applyInsertColumn(
	element: TablePptxElement,
	colIndex: number,
	position: 'left' | 'right',
): TablePptxElement {
	return insertTableElementColumn(toRaw(element), colIndex, position);
}

/** Delete the column at `colIndex`; returns `null` when the delete is a no-op. */
export function applyDeleteColumn(
	element: TablePptxElement,
	colIndex: number,
): TablePptxElement | null {
	const source = toRaw(element);
	const next = removeTableElementColumn(source, colIndex);
	return next === source ? null : next;
}

/** Merge the cursor cell with its right neighbour; `null` when not mergeable. */
export function applyMergeRight(
	td: PptxTableData,
	rowIndex: number,
	columnIndex: number,
): PptxTableData | null {
	const rows = computeMergeCellRight(td, rowIndex, columnIndex);
	return rows ? { ...td, rows } : null;
}

/** Merge the cursor cell with the cell below; `null` when not mergeable. */
export function applyMergeDown(
	td: PptxTableData,
	rowIndex: number,
	columnIndex: number,
): PptxTableData | null {
	const rows = computeMergeCellDown(td, rowIndex, columnIndex);
	return rows ? { ...td, rows } : null;
}

/** Split the merged cursor cell back into individual cells; `null` when not merged. */
export function applySplitCell(
	td: PptxTableData,
	rowIndex: number,
	columnIndex: number,
): PptxTableData | null {
	const rows = computeSplitCell(td, rowIndex, columnIndex);
	return rows ? { ...td, rows } : null;
}

/** Merge a rectangular multi-cell selection; `null` when the rect is not mergeable. */
export function applyMergeSelected(
	td: PptxTableData,
	cells: CellCoord[] | undefined,
): PptxTableData | null {
	if (!cells || cells.length < 2 || !canMergeCells(cells, td)) {
		return null;
	}
	return mergeCells(cells, td);
}
