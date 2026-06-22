/**
 * table-cell-edit.ts: Pure, immutable table-cell editing helpers shared by
 * every binding so inline cell editing is not reimplemented per framework.
 *
 * All functions return new objects and leave the input element unchanged.
 *
 * @module render/table-cell-edit
 */
import type { TablePptxElement } from 'pptx-viewer-core';

/**
 * Return a new `TablePptxElement` with the text of a single cell replaced.
 *
 * The element is not mutated: the affected row and cell are shallow-cloned and
 * every other row/cell is reused by reference. Returns the original element
 * unchanged when it carries no `tableData`.
 *
 * @param element - The source table element (not mutated).
 * @param rowIndex - Zero-based row index of the cell.
 * @param colIndex - Zero-based column index of the cell.
 * @param text - New plain-text content for the cell.
 * @returns A new `TablePptxElement` with the cell text applied.
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
