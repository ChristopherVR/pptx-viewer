/**
 * table-data-helpers.ts — Pure immutable helpers for table data editing.
 *
 * Ported from the React inspector's table editing logic in:
 *   packages/react/src/viewer/components/inspector/table-cell-merge-helpers.ts
 *   packages/react/src/viewer/components/inspector/TablePropertiesPanel.tsx
 *
 * All functions return new objects and leave the input unchanged.
 * Merged-cell invariants (hMerge / vMerge / gridSpan / rowSpan) are
 * honoured: mutating rows/columns that touch a merge group resets the
 * affected cells to un-merged single-occupancy cells to keep the grid
 * consistent.
 *
 * @module angular-viewer/table-data-helpers
 */

import type {
	PptxTableCell,
	PptxTableData,
	PptxTableRow,
	TablePptxElement,
} from 'pptx-viewer-core';

// ---------------------------------------------------------------------------
// Internal utilities
// ---------------------------------------------------------------------------

/** Create a plain, empty cell. */
function emptyCell(): PptxTableCell {
	return { text: '' };
}

/**
 * Return a copy of a cell with all merge-related fields stripped.
 * Used when structural changes invalidate merge state.
 */
function unmergedCell(cell: PptxTableCell): PptxTableCell {
	return { text: cell.text, style: cell.style };
}

/**
 * Return true when the cell participates in any merge (as a master, a
 * horizontal continuation, or a vertical continuation).
 */
function isMergeParticipant(cell: PptxTableCell): boolean {
	return (
		(cell.gridSpan !== undefined && cell.gridSpan > 1) ||
		(cell.rowSpan !== undefined && cell.rowSpan > 1) ||
		cell.hMerge === true ||
		cell.vMerge === true
	);
}

/**
 * Reset every cell in the rows array that participates in a merge to a
 * plain unmerged cell.  Used as a conservative safety step when a
 * structural row/column add or remove could corrupt an existing merge.
 */
function clearAllMerges(rows: readonly PptxTableRow[]): PptxTableRow[] {
	return rows.map((row) => ({
		...row,
		cells: row.cells.map((cell) => (isMergeParticipant(cell) ? unmergedCell(cell) : { ...cell })),
	}));
}

// ---------------------------------------------------------------------------
// setCellText
// ---------------------------------------------------------------------------

/**
 * Return a new `TablePptxElement` with the text of a single cell updated.
 *
 * @param element - The source table element (not mutated).
 * @param rowIndex - Zero-based row index.
 * @param colIndex - Zero-based column index.
 * @param text - New text content for the cell.
 * @returns A new `TablePptxElement`.
 *
 * @example
 * ```ts
 * const updated = setCellText(el, 0, 1, "Revenue");
 * ```
 */
export function setCellText(
	element: TablePptxElement,
	rowIndex: number,
	colIndex: number,
	text: string,
): TablePptxElement {
	const tableData = element.tableData;
	if (!tableData) {
		return element;
	}
	const rows = tableData.rows.map((row, ri) => {
		if (ri !== rowIndex) {
			return row;
		}
		return {
			...row,
			cells: row.cells.map((cell, ci) => (ci === colIndex ? { ...cell, text } : cell)),
		};
	});
	return { ...element, tableData: { ...tableData, rows } };
}

// ---------------------------------------------------------------------------
// addTableRow
// ---------------------------------------------------------------------------

/**
 * Return a new `TablePptxElement` with a blank row inserted after
 * `afterRowIndex`.
 *
 * Any existing merge state that could be corrupted by the insertion is
 * cleared from the entire table (conservative but always safe).
 *
 * @param element - The source table element (not mutated).
 * @param afterRowIndex - Insert after this zero-based row index.
 *   Pass `-1` to insert before the first row.
 * @returns A new `TablePptxElement` with the row added.
 *
 * @example
 * ```ts
 * const updated = addTableRow(el, 0); // insert after row 0
 * ```
 */
export function addTableRow(element: TablePptxElement, afterRowIndex: number): TablePptxElement {
	const tableData = element.tableData;
	if (!tableData) {
		return element;
	}
	const colCount = tableData.columnWidths.length;
	const newRow: PptxTableRow = {
		cells: Array.from({ length: colCount }, () => emptyCell()),
	};
	const cleaned = clearAllMerges(tableData.rows);
	const next: PptxTableRow[] = [...cleaned];
	next.splice(afterRowIndex + 1, 0, newRow);
	return { ...element, tableData: { ...tableData, rows: next } };
}

// ---------------------------------------------------------------------------
// removeTableRow
// ---------------------------------------------------------------------------

/**
 * Return a new `TablePptxElement` with the row at `rowIndex` removed.
 *
 * Requires at least 2 rows — returns the element unchanged if the table
 * already has only one row.  Merge state is cleared from the entire table
 * to avoid orphaned merge markers.
 *
 * @param element - The source table element (not mutated).
 * @param rowIndex - Zero-based index of the row to remove.
 * @returns A new `TablePptxElement`, or the original if removal is not
 *   possible.
 *
 * @example
 * ```ts
 * const updated = removeTableRow(el, 2);
 * ```
 */
export function removeTableRow(element: TablePptxElement, rowIndex: number): TablePptxElement {
	const tableData = element.tableData;
	if (!tableData || tableData.rows.length <= 1) {
		return element;
	}
	const cleaned = clearAllMerges(tableData.rows);
	const rows = cleaned.filter((_, i) => i !== rowIndex);
	return { ...element, tableData: { ...tableData, rows } };
}

// ---------------------------------------------------------------------------
// addTableColumn
// ---------------------------------------------------------------------------

/**
 * Return a new `TablePptxElement` with a blank column inserted after
 * `afterColIndex`.
 *
 * The new column is given an equal share of the total width (i.e. column
 * widths are renormalised so they still sum to 1).  Merge state is cleared.
 *
 * @param element - The source table element (not mutated).
 * @param afterColIndex - Insert after this zero-based column index.
 *   Pass `-1` to insert before the first column.
 * @returns A new `TablePptxElement` with the column added.
 *
 * @example
 * ```ts
 * const updated = addTableColumn(el, 1); // insert after column 1
 * ```
 */
export function addTableColumn(element: TablePptxElement, afterColIndex: number): TablePptxElement {
	const tableData = element.tableData;
	if (!tableData) {
		return element;
	}
	const oldCount = tableData.columnWidths.length;
	const newCount = oldCount + 1;
	// Equal-width distribution
	const newWidths = Array.from({ length: newCount }, () => 1 / newCount);

	const cleaned = clearAllMerges(tableData.rows);
	const rows = cleaned.map((row) => {
		const cells = [...row.cells];
		cells.splice(afterColIndex + 1, 0, emptyCell());
		return { ...row, cells };
	});

	return {
		...element,
		tableData: { ...tableData, columnWidths: newWidths, rows },
	};
}

// ---------------------------------------------------------------------------
// removeTableColumn
// ---------------------------------------------------------------------------

/**
 * Return a new `TablePptxElement` with the column at `colIndex` removed.
 *
 * Requires at least 2 columns — returns the element unchanged if the table
 * already has only one column.  Column widths are renormalised to sum to 1
 * after removal.  Merge state is cleared.
 *
 * @param element - The source table element (not mutated).
 * @param colIndex - Zero-based index of the column to remove.
 * @returns A new `TablePptxElement`, or the original if removal is not
 *   possible.
 *
 * @example
 * ```ts
 * const updated = removeTableColumn(el, 0);
 * ```
 */
export function removeTableColumn(element: TablePptxElement, colIndex: number): TablePptxElement {
	const tableData = element.tableData;
	if (!tableData || tableData.columnWidths.length <= 1) {
		return element;
	}

	// Remove the width entry and renormalise
	const filteredWidths = tableData.columnWidths.filter((_, i) => i !== colIndex);
	const total = filteredWidths.reduce((s, w) => s + w, 0);
	const newWidths = total > 0 ? filteredWidths.map((w) => w / total) : filteredWidths;

	const cleaned = clearAllMerges(tableData.rows);
	const rows = cleaned.map((row) => ({
		...row,
		cells: row.cells.filter((_, ci) => ci !== colIndex),
	}));

	return {
		...element,
		tableData: { ...tableData, columnWidths: newWidths, rows },
	};
}

// ---------------------------------------------------------------------------
// patchTableData
// ---------------------------------------------------------------------------

/**
 * Return a new `TablePptxElement` with arbitrary `PptxTableData` fields
 * merged in.  Use for banding flags, style ID, etc.
 *
 * @param element - The source table element (not mutated).
 * @param patch - Partial `PptxTableData` fields to merge.
 * @returns A new `TablePptxElement`.
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
