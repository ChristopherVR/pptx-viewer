import type { PptxTableCellStyle, PptxTableData } from 'pptx-viewer-core';
import {
	computeSplitCell,
	deleteTableColumn,
	deleteTableRow,
	insertTableColumn,
	insertTableRow,
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

export function setTableColumnWidth(
	data: PptxTableData,
	column: number,
	percent: number,
): PptxTableData {
	if (!data.columnWidths[column] || data.columnWidths.length < 2) {
		return data;
	}
	const requested = Math.min(0.95, Math.max(0.05, percent / 100));
	const previous = data.columnWidths[column];
	const remaining = 1 - previous;
	const nextRemaining = 1 - requested;
	return {
		...data,
		columnWidths: data.columnWidths.map((width, index) =>
			index === column ? requested : remaining > 0 ? (width / remaining) * nextRemaining : width,
		),
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

export function mergeTableCellRange(
	data: PptxTableData,
	cells: TableCellPosition[],
): PptxTableData {
	if (cells.length < 2) {
		return data;
	}
	const rows = cells.map(({ row }) => row);
	const columns = cells.map(({ column }) => column);
	const top = Math.min(...rows);
	const bottom = Math.max(...rows);
	const left = Math.min(...columns);
	const right = Math.max(...columns);
	if (cells.length !== (bottom - top + 1) * (right - left + 1)) {
		return data;
	}
	const nextRows = data.rows.map((row, rowIndex) => ({
		...row,
		cells: row.cells.map((cell, columnIndex) => {
			if (rowIndex < top || rowIndex > bottom || columnIndex < left || columnIndex > right) {
				return cell;
			}
			if (rowIndex === top && columnIndex === left) {
				return {
					...cell,
					text: cells
						.map(({ row: selectedRow, column }) => data.rows[selectedRow]?.cells[column]?.text)
						.filter(Boolean)
						.join(' '),
					gridSpan: right > left ? right - left + 1 : undefined,
					rowSpan: bottom > top ? bottom - top + 1 : undefined,
				};
			}
			return {
				...cell,
				text: '',
				hMerge: columnIndex > left || undefined,
				vMerge: rowIndex > top || undefined,
			};
		}),
	}));
	return { ...data, rows: nextRows };
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
