/**
 * table-data-grid.ts: framework-agnostic render model for the inspector's table
 * data grid (the spreadsheet-like editor that edits table cell TEXT from the
 * sidebar, as opposed to on-canvas cell editing).
 *
 * The matching mutations live in `table-data-grid-ops.ts`; both are exported
 * from the package barrel and are one feature in two files, split only to stay
 * inside the repo's 300 LOC ceiling.
 *
 * WHY this model exists rather than each binding reading `tableData` directly:
 * the grid is the table analogue of the chart data grid every binding already
 * ships, and without a shared layer all five re-derive the same two awkward
 * details and drift apart.
 *
 *  1. **Ragged rows.** `PptxTableData.rows[i].cells` is not guaranteed to be
 *     `columnWidths.length` long (merged spans and malformed decks both produce
 *     short rows). A view that iterates `row.cells` renders a lopsided grid and
 *     silently hides the trailing cells. `buildTableDataGrid` normalises every
 *     row to exactly `colCount` entries so the view can iterate blindly.
 *  2. **The last-row/last-column floor.** A table may not be reduced to zero
 *     rows or zero columns, so remove controls must be disabled at 1. Exposing
 *     `canRemoveRow` / `canRemoveColumn` on the model keeps that rule in one
 *     place instead of in five templates.
 *
 * @module render/table-data-grid
 */
import type { TablePptxElement } from 'pptx-viewer-core';

/** One editable cell in the inspector grid, carrying its own coordinates. */
export interface TableDataGridCell {
	/** Zero-based row index within the table. */
	rowIndex: number;
	/** Zero-based column index within the table. */
	colIndex: number;
	/** Current plain-text content, `''` when the underlying cell is missing. */
	text: string;
}

/** One row of the inspector grid, normalised to the table's column count. */
export interface TableDataGridRow {
	/** Zero-based row index within the table. */
	rowIndex: number;
	/** Exactly `colCount` cells, left to right. */
	cells: TableDataGridCell[];
}

/** Everything a binding's table-data-grid view needs to render itself. */
export interface TableDataGridModel {
	/** Number of rows in the table. */
	rowCount: number;
	/** Number of columns, taken from `columnWidths` (the authoritative count). */
	colCount: number;
	/** `[0, 1, ... colCount - 1]`, so templates can render column headers. */
	colIndices: number[];
	/** Normalised rows; safe to iterate without bounds checks. */
	rows: TableDataGridRow[];
	/** False when removing a row would empty the table (or there is no data). */
	canRemoveRow: boolean;
	/** False when removing a column would empty the table (or there is no data). */
	canRemoveColumn: boolean;
}

/**
 * Build the render model for a table element's inspector data grid.
 *
 * Rows are normalised to `colCount` cells, so a deck with ragged rows renders a
 * rectangular grid instead of dropping cells off the right-hand edge.
 *
 * @param element - The table element being inspected (not mutated).
 * @returns A fully normalised, render-ready grid model.
 *
 * @example
 * ```ts
 * const grid = buildTableDataGrid(tableElement);
 * for (const row of grid.rows) {
 * 	for (const cell of row.cells) {
 * 		// cell.rowIndex / cell.colIndex / cell.text
 * 	}
 * }
 * ```
 */
export function buildTableDataGrid(element: TablePptxElement): TableDataGridModel {
	const tableData = element.tableData;
	const sourceRows = tableData?.rows ?? [];
	const colCount = tableData?.columnWidths.length ?? 0;
	const colIndices = Array.from({ length: colCount }, (_unused, index) => index);

	const rows = sourceRows.map((row, rowIndex) => ({
		rowIndex,
		cells: colIndices.map((colIndex) => ({
			rowIndex,
			colIndex,
			text: row.cells[colIndex]?.text ?? '',
		})),
	}));

	return {
		rowCount: sourceRows.length,
		colCount,
		colIndices,
		rows,
		canRemoveRow: sourceRows.length > 1,
		canRemoveColumn: colCount > 1,
	};
}
