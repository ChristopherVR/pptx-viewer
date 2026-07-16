import type { PptxTableData } from 'pptx-viewer-core';

function normalizedWidths(count: number): number[] {
	return Array.from({ length: count }, () => 1 / count);
}

export function insertTableRow(table: PptxTableData, index: number): PptxTableData {
	const at = Math.max(0, Math.min(index, table.rows.length));
	const rows = [...table.rows];
	rows.splice(at, 0, {
		cells: Array.from({ length: table.columnWidths.length }, () => ({ text: '' })),
	});
	return { ...table, rows };
}

export function deleteTableRow(table: PptxTableData, index: number): PptxTableData {
	if (table.rows.length <= 1) {
		return table;
	}
	return { ...table, rows: table.rows.filter((_row, rowIndex) => rowIndex !== index) };
}

export function insertTableColumn(table: PptxTableData, index: number): PptxTableData {
	const at = Math.max(0, Math.min(index, table.columnWidths.length));
	const count = table.columnWidths.length + 1;
	return {
		...table,
		columnWidths: normalizedWidths(count),
		rows: table.rows.map((row) => {
			const cells = [...row.cells];
			cells.splice(at, 0, { text: '' });
			return { ...row, cells };
		}),
	};
}

export function deleteTableColumn(table: PptxTableData, index: number): PptxTableData {
	if (table.columnWidths.length <= 1) {
		return table;
	}
	const count = table.columnWidths.length - 1;
	return {
		...table,
		columnWidths: normalizedWidths(count),
		rows: table.rows.map((row) => ({
			...row,
			cells: row.cells.filter((_cell, cellIndex) => cellIndex !== index),
		})),
	};
}
