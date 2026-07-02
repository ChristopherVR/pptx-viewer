/**
 * table-data-helpers.ts: Element-level immutable helpers for table data editing.
 *
 * Thin wrappers that lift the framework-agnostic `PptxTableData` transforms in
 * `pptx-viewer-shared` up to the `TablePptxElement` level (so the inspector and
 * context menu can hand a whole element to the editor). Every function returns a
 * new element and leaves the input unchanged.
 *
 * Unlike the previous conservative implementation (which cleared ALL merges on
 * any structural change), these delegate to the shared merge-AWARE operations:
 *   - `insertTableRow` / `deleteTableRow`       (render/table-layout)
 *   - `insertTableColumn` / `deleteTableColumn`  (render/table-layout)
 *   - `mergeCells` / `splitCell`                 (render/table-merge)
 *   - `computeMergeCellRight` / `computeMergeCellDown` / `computeSplitCell`
 *                                                (render/table-cell-merge)
 * so existing merge spans are preserved / adjusted rather than destroyed.
 *
 * @module angular-viewer/table-data-helpers
 */

import type { PptxTableData, TablePptxElement } from 'pptx-viewer-core';

import type { CellCoord } from '../internal/shared';
import {
	computeMergeCellDown,
	computeMergeCellRight,
	computeSplitCell,
	deleteTableColumn,
	deleteTableRow,
	insertTableColumn,
	insertTableRow,
	mergeCells,
	splitCell,
} from '../internal/shared';

// `setCellText` is the framework-agnostic single-cell text edit. It lives in
// `pptx-viewer-shared` (`render/table-cell-edit`); re-exported here so existing
// consumers and the colocated test keep importing it from this module unchanged.
export { setCellText } from '../internal/shared';

export type { CellCoord };

// ---------------------------------------------------------------------------
// Internal utility
// ---------------------------------------------------------------------------

/**
 * Apply a pure `PptxTableData → PptxTableData` transform to an element's table
 * data, returning a new element. Returns the element unchanged when it has no
 * table data or the transform is a no-op (returns the same reference).
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
	return { ...element, tableData: next };
}

// ---------------------------------------------------------------------------
// Structural row / column operations (merge-aware)
// ---------------------------------------------------------------------------

/**
 * Insert a blank row above or below `rowIdx`, growing any vertical merge spans
 * that straddle the insertion point (delegates to the shared `insertTableRow`).
 */
export function insertRow(
	element: TablePptxElement,
	rowIdx: number,
	position: 'above' | 'below',
): TablePptxElement {
	return withTableData(element, (td) => insertTableRow(td, rowIdx, position));
}

/**
 * Delete the row at `rowIdx`, adjusting vertical merge spans. No-op (element
 * returned unchanged) when the table has a single row.
 */
export function removeRow(element: TablePptxElement, rowIdx: number): TablePptxElement {
	return withTableData(element, (td) => deleteTableRow(td, rowIdx));
}

/**
 * Insert a blank column left or right of `colIdx`, splitting the source column's
 * width and growing horizontal merge spans (delegates to `insertTableColumn`).
 */
export function insertColumn(
	element: TablePptxElement,
	colIdx: number,
	position: 'left' | 'right',
): TablePptxElement {
	return withTableData(element, (td) => insertTableColumn(td, colIdx, position));
}

/**
 * Delete the column at `colIdx`, adjusting horizontal merge spans and
 * renormalising widths. No-op when the table has a single column.
 */
export function removeColumn(element: TablePptxElement, colIdx: number): TablePptxElement {
	return withTableData(element, (td) => deleteTableColumn(td, colIdx));
}

// ---------------------------------------------------------------------------
// Merge / split operations
// ---------------------------------------------------------------------------

/** Merge a rectangular selection of cells into their top-left anchor. */
export function mergeSelection(element: TablePptxElement, cells: CellCoord[]): TablePptxElement {
	return withTableData(element, (td) => mergeCells(cells, td));
}

/** Split the merged cell anchored at `(row, col)` back into individual cells. */
export function splitMergedCell(
	element: TablePptxElement,
	row: number,
	col: number,
): TablePptxElement {
	return withTableData(element, (td) => splitCell(row, col, td));
}

/** Merge the cursor cell with its right-hand neighbour (no-op when invalid). */
export function mergeRight(element: TablePptxElement, row: number, col: number): TablePptxElement {
	return withTableData(element, (td) => {
		const rows = computeMergeCellRight(td, row, col);
		return rows ? { ...td, rows } : td;
	});
}

/** Merge the cursor cell with the cell below it (no-op when invalid). */
export function mergeDown(element: TablePptxElement, row: number, col: number): TablePptxElement {
	return withTableData(element, (td) => {
		const rows = computeMergeCellDown(td, row, col);
		return rows ? { ...td, rows } : td;
	});
}

/** Split the merged cursor cell (no-op when the cell is not merged). */
export function splitCursorCell(
	element: TablePptxElement,
	row: number,
	col: number,
): TablePptxElement {
	return withTableData(element, (td) => {
		const rows = computeSplitCell(td, row, col);
		return rows ? { ...td, rows } : td;
	});
}

// ---------------------------------------------------------------------------
// patchTableData
// ---------------------------------------------------------------------------

/**
 * Return a new `TablePptxElement` with arbitrary `PptxTableData` fields merged
 * in. Use for banding flags, style presets, column widths, row heights, etc.
 */
export function patchTableData(
	element: TablePptxElement,
	patch: Partial<PptxTableData>,
): TablePptxElement {
	if (!element.tableData) {
		return element;
	}
	return { ...element, tableData: { ...element.tableData, ...patch } };
}
