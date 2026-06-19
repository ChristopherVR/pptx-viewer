/**
 * table-layout.ts — framework-agnostic table structure mutations.
 *
 * Pure, merge-aware insert / delete of rows and columns over the structured
 * {@link PptxTableData} model. Each function returns a new `PptxTableData`
 * (the input is never mutated) with:
 *  - new blank cells inserted (marked as merge continuations where the
 *    insertion falls inside an existing merge span);
 *  - the `gridSpan` / `rowSpan` of merge anchors that straddle the insertion
 *    point grown by one;
 *  - on delete, merge anchors whose span is reduced — moving the anchor (and
 *    its text/style) onto the next surviving row/column when the deleted line
 *    was itself the anchor.
 *  - column-width arrays kept normalised to sum to 1.
 *
 * Lifted from the pure structural math inside the React viewer's stateful
 * `viewer/hooks/table-struct-handlers.ts` (the `createTableStructHandlers`
 * factory). The React hook now calls these and applies the result to its
 * editor state + rawXml sync; the algorithm itself lives here so every binding
 * can share it.
 *
 * NOTE: a separate, deliberately *conservative* family of structure helpers
 * (`addTableRow` / `removeTableRow` / `addTableColumn` / `removeTableColumn`)
 * lives in the Angular binding (`table-data-helpers.ts`). Those clear *all*
 * merges on any structural change (a safe but lossy strategy) and operate on
 * `TablePptxElement` rather than `PptxTableData`; they are intentionally NOT
 * merged here because their semantics differ. See that file's header.
 */
import type { PptxTableCell, PptxTableData } from 'pptx-viewer-core';

/** Create a default empty cell for insertion. */
function createDefaultCell(): PptxTableCell {
	return { text: '', style: {} };
}

/** Default pixel height assigned to a freshly-inserted row. */
export const DEFAULT_INSERTED_ROW_HEIGHT = 40;

// ---------------------------------------------------------------------------
// Insert row
// ---------------------------------------------------------------------------

/**
 * Insert a blank row into `tableData`.
 *
 * @param tableData - Source table (not mutated).
 * @param rowIdx - The reference row the insertion is relative to.
 * @param position - `'above'` inserts before `rowIdx`, `'below'` after it.
 * @returns A new `PptxTableData` with the row inserted and any vertical merge
 *   anchors that span the insertion point grown by one.
 */
export function insertTableRow(
	tableData: PptxTableData,
	rowIdx: number,
	position: 'above' | 'below',
): PptxTableData {
	const insertIdx = position === 'above' ? rowIdx : rowIdx + 1;
	const colCount = tableData.columnWidths.length;

	// Build new cells, handling merges that span across the insertion point.
	const newCells: PptxTableCell[] = [];
	for (let c = 0; c < colCount; c++) {
		let insideMerge = false;
		for (let r = 0; r < insertIdx; r++) {
			const cell = tableData.rows[r]?.cells[c];
			if (!cell) {
				continue;
			}
			const rs = Math.max(1, cell.rowSpan ?? 1);
			if (rs > 1 && r + rs > insertIdx && !cell.vMerge && !cell.hMerge) {
				insideMerge = true;
				break;
			}
		}
		if (insideMerge) {
			newCells.push({ text: '', vMerge: true });
		} else {
			newCells.push(createDefaultCell());
		}
	}

	// Adjust rowSpan of anchor cells above that span across the insertion point.
	const adjustedRows = tableData.rows.map((row, ri) => {
		if (ri >= insertIdx) {
			return row;
		}
		let needsUpdate = false;
		const updatedCells = row.cells.map((cell) => {
			const rs = Math.max(1, cell.rowSpan ?? 1);
			if (rs > 1 && ri + rs > insertIdx && !cell.vMerge && !cell.hMerge) {
				needsUpdate = true;
				return { ...cell, rowSpan: rs + 1 };
			}
			return cell;
		});
		return needsUpdate ? { ...row, cells: updatedCells } : row;
	});

	const newRows = [...adjustedRows];
	newRows.splice(insertIdx, 0, { cells: newCells, height: DEFAULT_INSERTED_ROW_HEIGHT });

	return { ...tableData, rows: newRows };
}

// ---------------------------------------------------------------------------
// Delete row
// ---------------------------------------------------------------------------

/**
 * Delete a row from `tableData`, adjusting vertical merge spans.
 *
 * Returns the original `tableData` unchanged when there is only one row or the
 * index is out of range.
 */
export function deleteTableRow(tableData: PptxTableData, rowIdx: number): PptxTableData {
	if (tableData.rows.length <= 1) {
		return tableData;
	}
	if (rowIdx < 0 || rowIdx >= tableData.rows.length) {
		return tableData;
	}

	const removedRow = tableData.rows[rowIdx];
	const adjustedRows = [...tableData.rows];

	// Helper to update a single cell's rowSpan in a row's cells array.
	const updateCellRowSpan = (
		cells: (typeof adjustedRows)[number]['cells'],
		colIdx: number,
		newRowSpan: number | undefined,
	) => cells.map((cc, ci) => (ci === colIdx ? { ...cc, rowSpan: newRowSpan } : cc));

	// Handle merge spans.
	for (let c = 0; c < removedRow.cells.length; c++) {
		const cell = removedRow.cells[c];

		if (cell.vMerge) {
			// Continuation of a vertical merge — decrement anchor's rowSpan.
			for (let r = rowIdx - 1; r >= 0; r--) {
				const aboveCell = adjustedRows[r]?.cells[c];
				if (!aboveCell) {
					break;
				}
				if (!aboveCell.vMerge) {
					const rs = Math.max(1, aboveCell.rowSpan ?? 1);
					if (rs > 1) {
						adjustedRows[r] = {
							...adjustedRows[r],
							cells: updateCellRowSpan(adjustedRows[r].cells, c, rs - 1 > 1 ? rs - 1 : undefined),
						};
					}
					break;
				}
			}
		} else {
			const rs = Math.max(1, cell.rowSpan ?? 1);
			if (rs > 1) {
				// Anchor of a vertical merge — move anchor to next row.
				const nextRowIdx = rowIdx + 1;
				if (nextRowIdx < adjustedRows.length) {
					adjustedRows[nextRowIdx] = {
						...adjustedRows[nextRowIdx],
						cells: adjustedRows[nextRowIdx].cells.map((cc, ci) => {
							if (ci !== c) {
								return cc;
							}
							const newRs = rs - 1;
							return {
								...cc,
								text: cell.text || cc.text,
								style: cc.style || cell.style,
								rowSpan: newRs > 1 ? newRs : undefined,
								vMerge: undefined,
								gridSpan: cell.gridSpan,
							};
						}),
					};
				}
			}
		}
	}

	const newRows = adjustedRows.filter((_, i) => i !== rowIdx);
	return { ...tableData, rows: newRows };
}

// ---------------------------------------------------------------------------
// Insert column
// ---------------------------------------------------------------------------

/** Renormalise a column-width array so the entries sum to 1. */
function normalizeWidths(widths: number[]): number[] {
	const sum = widths.reduce((a, b) => a + b, 0);
	return sum > 0 ? widths.map((w) => w / sum) : widths;
}

/**
 * Insert a blank column into `tableData`.
 *
 * The source column's width is split in half between it and the new column,
 * then the whole array is renormalised. Horizontal merge spans that straddle
 * the insertion point are grown by one.
 *
 * @param tableData - Source table (not mutated).
 * @param colIdx - Reference column.
 * @param position - `'left'` inserts before `colIdx`, `'right'` after it.
 */
export function insertTableColumn(
	tableData: PptxTableData,
	colIdx: number,
	position: 'left' | 'right',
): PptxTableData {
	const insertIdx = position === 'left' ? colIdx : colIdx + 1;

	// Determine new column widths — split the source column.
	const newWidths = [...tableData.columnWidths];
	const splitSourceIdx = insertIdx < newWidths.length ? insertIdx : newWidths.length - 1;
	const originalWidth = newWidths[splitSourceIdx] ?? 1 / newWidths.length;
	const halfWidth = originalWidth / 2;
	newWidths[splitSourceIdx] = halfWidth;
	newWidths.splice(insertIdx, 0, halfWidth);
	const normalizedWidths = normalizeWidths(newWidths);

	// Insert cells in each row, handling horizontal merges.
	const newRows = tableData.rows.map((row) => {
		let insideMerge = false;
		for (let c = 0; c < insertIdx && c < row.cells.length; c++) {
			const cell = row.cells[c];
			if (!cell) {
				continue;
			}
			const gs = Math.max(1, cell.gridSpan ?? 1);
			if (gs > 1 && c + gs > insertIdx && !cell.hMerge) {
				insideMerge = true;
				break;
			}
		}

		const newCells = [...row.cells];
		const newCell: PptxTableCell = insideMerge ? { text: '', hMerge: true } : createDefaultCell();
		newCells.splice(insertIdx, 0, newCell);
		return { ...row, cells: newCells };
	});

	// Adjust gridSpan of anchor cells that span across the insertion point.
	const finalRows = newRows.map((row) => {
		let needsUpdate = false;
		const updatedCells = row.cells.map((cell, ci) => {
			if (ci >= insertIdx) {
				return cell;
			}
			const gs = Math.max(1, cell.gridSpan ?? 1);
			if (gs > 1 && ci + gs > insertIdx && !cell.hMerge && !cell.vMerge) {
				needsUpdate = true;
				return { ...cell, gridSpan: gs + 1 };
			}
			return cell;
		});
		return needsUpdate ? { ...row, cells: updatedCells } : row;
	});

	return { ...tableData, rows: finalRows, columnWidths: normalizedWidths };
}

// ---------------------------------------------------------------------------
// Delete column
// ---------------------------------------------------------------------------

/**
 * Delete a column from `tableData`, adjusting horizontal merge spans and
 * renormalising the column widths.
 *
 * Returns the original `tableData` unchanged when there is only one column or
 * the index is out of range.
 */
export function deleteTableColumn(tableData: PptxTableData, colIdx: number): PptxTableData {
	if (tableData.columnWidths.length <= 1) {
		return tableData;
	}
	if (colIdx < 0 || colIdx >= tableData.columnWidths.length) {
		return tableData;
	}

	// Adjust merge spans and remove the column from each row.
	const newRows = tableData.rows.map((row) => {
		const adjustedCells = [...row.cells];
		const cell = adjustedCells[colIdx];

		if (cell) {
			if (cell.hMerge) {
				// Continuation of a horizontal merge — decrement anchor's gridSpan.
				for (let c = colIdx - 1; c >= 0; c--) {
					const leftCell = adjustedCells[c];
					if (!leftCell) {
						break;
					}
					if (!leftCell.hMerge) {
						const gs = Math.max(1, leftCell.gridSpan ?? 1);
						if (gs > 1) {
							adjustedCells[c] = {
								...leftCell,
								gridSpan: gs - 1 > 1 ? gs - 1 : undefined,
							};
						}
						break;
					}
				}
			} else {
				const gs = Math.max(1, cell.gridSpan ?? 1);
				if (gs > 1) {
					// Anchor of a horizontal merge — move anchor to next column.
					const nextColIdx = colIdx + 1;
					if (nextColIdx < adjustedCells.length) {
						const nextCell = adjustedCells[nextColIdx];
						adjustedCells[nextColIdx] = {
							...nextCell,
							text: cell.text || nextCell.text,
							style: nextCell.style || cell.style,
							gridSpan: gs - 1 > 1 ? gs - 1 : undefined,
							hMerge: undefined,
							rowSpan: cell.rowSpan,
						};
					}
				}
			}
		}

		return {
			...row,
			cells: adjustedCells.filter((_, i) => i !== colIdx),
		};
	});

	// Remove column width and renormalise.
	const newWidths = normalizeWidths(tableData.columnWidths.filter((_, i) => i !== colIdx));

	return { ...tableData, rows: newRows, columnWidths: newWidths };
}
