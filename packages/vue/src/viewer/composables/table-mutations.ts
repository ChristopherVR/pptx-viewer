import type { PptxTableData } from 'pptx-viewer-core';
import type { CellCoord } from 'pptx-viewer-shared';
import {
	canMergeCells,
	computeMergeCellDown,
	computeMergeCellRight,
	computeSplitCell,
	deleteTableColumn,
	deleteTableRow,
	insertTableColumn,
	insertTableRow,
	mergeCells,
} from 'pptx-viewer-shared';

/**
 * table-mutations: thin, pure wrappers over the framework-agnostic table
 * transforms in `pptx-viewer-shared`, returning a new `PptxTableData` (or `null`
 * for a no-op) so both the inspector `TablePanel` (emits an element patch) and
 * the canvas context menu (applies via `useEditorOperations`) drive edits from
 * one merge-aware implementation. Mirrors React's table operation handlers.
 */

/** Insert a blank row above/below `rowIndex` (merge span aware). */
export function applyInsertRow(
	td: PptxTableData,
	rowIndex: number,
	position: 'above' | 'below',
): PptxTableData {
	return insertTableRow(td, rowIndex, position);
}

/** Delete the row at `rowIndex`; returns `null` when the delete is a no-op. */
export function applyDeleteRow(td: PptxTableData, rowIndex: number): PptxTableData | null {
	const next = deleteTableRow(td, rowIndex);
	return next === td ? null : next;
}

/** Insert a blank column left/right of `colIndex` (merge span aware). */
export function applyInsertColumn(
	td: PptxTableData,
	colIndex: number,
	position: 'left' | 'right',
): PptxTableData {
	return insertTableColumn(td, colIndex, position);
}

/** Delete the column at `colIndex`; returns `null` when the delete is a no-op. */
export function applyDeleteColumn(td: PptxTableData, colIndex: number): PptxTableData | null {
	const next = deleteTableColumn(td, colIndex);
	return next === td ? null : next;
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
