/* oxlint-disable eslint/one-var -- pervasive pre-existing pattern in this file
   (independent short-lived `const`s per operation); merging them isn't a
   style choice here. */
import type { PptxTableCellStyle, PptxTableData } from 'pptx-viewer-core';
import {
	canMergeCells,
	computeSplitCell,
	deleteTableColumn,
	deleteTableRow,
	insertTableColumn,
	insertTableRow,
	mergeCells,
	redistributeColumnWidth,
} from 'pptx-viewer-shared';

export interface TableCellPosition {
	row: number;
	column: number;
}

export type TableStructureAction =
	| 'insertRowAbove'
	| 'insertRowBelow'
	| 'deleteRow'
	| 'insertColumnLeft'
	| 'insertColumnRight'
	| 'deleteColumn';

export function patchTableCells(
	data: PptxTableData,
	cells: TableCellPosition[],
	patch: Partial<PptxTableCellStyle>,
): PptxTableData {
	const keys = new Set(cells.map(({ row, column }) => `${row}:${column}`));
	return {
		...data,
		rows: data.rows.map((row, rowIndex) => ({
			...row,
			cells: row.cells.map((cell, columnIndex) =>
				keys.has(`${rowIndex}:${columnIndex}`)
					? { ...cell, style: { ...cell.style, ...patch } }
					: cell,
			),
		})),
	};
}

export function mutateTableStructure(
	data: PptxTableData,
	cell: TableCellPosition,
	action: TableStructureAction,
): PptxTableData {
	switch (action) {
		case 'insertRowAbove':
			return insertTableRow(data, cell.row, 'above');
		case 'insertRowBelow':
			return insertTableRow(data, cell.row, 'below');
		case 'deleteRow':
			return deleteTableRow(data, cell.row);
		case 'insertColumnLeft':
			return insertTableColumn(data, cell.column, 'left');
		case 'insertColumnRight':
			return insertTableColumn(data, cell.column, 'right');
		case 'deleteColumn':
			return deleteTableColumn(data, cell.column);
	}
}

/**
 * Set column `column` to `percent` (0-100), proportionally rescaling every
 * other column to preserve their relative ratios and keep the row summing to
 * 1. Delegates to `pptx-viewer-shared`'s `redistributeColumnWidth`, the same
 * formula every binding's column-width control uses.
 */
export function setTableColumnWidth(
	data: PptxTableData,
	column: number,
	percent: number,
): PptxTableData {
	if (!data.columnWidths[column] || data.columnWidths.length < 2) {
		return data;
	}
	const requested = Math.min(0.95, Math.max(0.05, percent / 100));
	return {
		...data,
		columnWidths: redistributeColumnWidth(data.columnWidths, column, requested),
	};
}

export function setTableRowHeight(
	data: PptxTableData,
	rowIndex: number,
	height: number,
): PptxTableData {
	return {
		...data,
		rows: data.rows.map((row, index) =>
			index === rowIndex ? { ...row, height: Math.max(1, height) } : row,
		),
	};
}

/**
 * Merge a rectangular selection of cells.
 *
 * Delegates to `pptx-viewer-shared`'s `canMergeCells` / `mergeCells`, which
 * first expand the selection rect to fully cover any merge group it only
 * partially overlaps before validating and applying the merge. Mirrors
 * Vue's `applyMergeSelected` / Svelte's `table-merge-selected` command; a
 * hand-rolled bounding-rect + cell-count check here (as this used to be)
 * rejects, or incorrectly merges, a selection that partially overlaps an
 * existing merged cell.
 */
export function mergeTableCellRange(
	data: PptxTableData,
	cells: TableCellPosition[],
): PptxTableData {
	const coords = cells.map(({ row, column }) => ({ row, col: column }));
	if (!canMergeCells(coords, data)) {
		return data;
	}
	return mergeCells(coords, data);
}

export function splitTableCell(data: PptxTableData, cell: TableCellPosition): PptxTableData {
	const anchor = data.rows[cell.row]?.cells[cell.column];
	const rowSpan = Math.max(1, anchor?.rowSpan ?? 1);
	const gridSpan = Math.max(1, anchor?.gridSpan ?? 1);
	const rows = computeSplitCell(data, cell.row, cell.column);
	if (!rows) {
		return data;
	}
	return {
		...data,
		rows: rows.map((row, rowIndex) => ({
			...row,
			cells: row.cells.map((tableCell, columnIndex) =>
				rowIndex >= cell.row &&
				rowIndex < cell.row + rowSpan &&
				columnIndex >= cell.column &&
				columnIndex < cell.column + gridSpan
					? { ...tableCell, hMerge: undefined, vMerge: undefined }
					: tableCell,
			),
		})),
	};
}
