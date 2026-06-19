/**
 * table-merge.ts — framework-agnostic table cell merge / split / selection math.
 *
 * Pure operations over the structured {@link PptxTableData} model: compute the
 * bounding rectangle of a cell selection, expand it to cover any merge groups
 * it overlaps, validate whether a selection can be merged or a cell split, and
 * produce new (immutable) `PptxTableData` copies with the merge/split applied.
 *
 * Consolidated from the React viewer's:
 *   - `viewer/utils/table-merge-core.ts`      → merge / split + rect helpers
 *   - `viewer/utils/table-selection-utils.ts` → selection rect / enumeration
 *
 * No framework imports — consumed by every binding (each re-exports these
 * symbols through its own thin shim so colocated consumers keep their import
 * paths unchanged).
 */
import type { PptxTableCell, PptxTableData } from 'pptx-viewer-core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A cell coordinate within a table (0-based). */
export interface CellCoord {
	row: number;
	col: number;
}

/** The bounding rectangle of a cell selection (inclusive end coordinates). */
export interface CellRect {
	startRow: number;
	startCol: number;
	endRow: number; // inclusive
	endCol: number; // inclusive
}

// ---------------------------------------------------------------------------
// Rect helpers
// ---------------------------------------------------------------------------

/**
 * Given an array of cell coordinates, compute the smallest bounding rectangle
 * that encloses them.  Returns `undefined` when the array is empty.
 */
export function computeBoundingRect(cells: CellCoord[]): CellRect | undefined {
	if (cells.length === 0) {
		return undefined;
	}

	let startRow = cells[0].row;
	let startCol = cells[0].col;
	let endRow = cells[0].row;
	let endCol = cells[0].col;

	for (const { row, col } of cells) {
		if (row < startRow) {
			startRow = row;
		}
		if (col < startCol) {
			startCol = col;
		}
		if (row > endRow) {
			endRow = row;
		}
		if (col > endCol) {
			endCol = col;
		}
	}

	return { startRow, startCol, endRow, endCol };
}

/**
 * Expand a bounding rect to include any cells that are already part of a
 * merge whose anchor overlaps the rect.  This prevents partial overlap with
 * existing merged regions.
 *
 * Returns the (possibly enlarged) rect.
 */
export function expandRectForExistingMerges(rect: CellRect, tableData: PptxTableData): CellRect {
	let { startRow, startCol, endRow, endCol } = rect;
	let changed = true;

	// Iterate until stable — each expansion may reveal more overlaps.
	while (changed) {
		changed = false;
		for (let r = startRow; r <= endRow; r++) {
			const row = tableData.rows[r];
			if (!row) {
				continue;
			}
			for (let c = startCol; c <= endCol; c++) {
				const cell = row.cells[c];
				if (!cell) {
					continue;
				}

				// If this cell is anchor of an existing merge, expand rect to cover it
				const gs = Math.max(1, cell.gridSpan ?? 1);
				const rs = Math.max(1, cell.rowSpan ?? 1);
				if (c + gs - 1 > endCol) {
					endCol = c + gs - 1;
					changed = true;
				}
				if (r + rs - 1 > endRow) {
					endRow = r + rs - 1;
					changed = true;
				}

				// If this cell is a merge continuation, we need to find the anchor
				// and expand to include it (though the anchor should be top-left of us).
				if (cell.hMerge) {
					// Walk left to find the anchor
					for (let cc = c - 1; cc >= 0; cc--) {
						const leftCell = row.cells[cc];
						if (!leftCell) {
							break;
						}
						if (!leftCell.hMerge) {
							if (cc < startCol) {
								startCol = cc;
								changed = true;
							}
							// Include full gridSpan of that anchor
							const anchorSpan = Math.max(1, leftCell.gridSpan ?? 1);
							if (cc + anchorSpan - 1 > endCol) {
								endCol = cc + anchorSpan - 1;
								changed = true;
							}
							break;
						}
					}
				}
				if (cell.vMerge) {
					// Walk up to find the anchor
					for (let rr = r - 1; rr >= 0; rr--) {
						const aboveCell = tableData.rows[rr]?.cells[c];
						if (!aboveCell) {
							break;
						}
						if (!aboveCell.vMerge) {
							if (rr < startRow) {
								startRow = rr;
								changed = true;
							}
							const anchorRSpan = Math.max(1, aboveCell.rowSpan ?? 1);
							if (rr + anchorRSpan - 1 > endRow) {
								endRow = rr + anchorRSpan - 1;
								changed = true;
							}
							break;
						}
					}
				}
			}
		}
	}

	return { startRow, startCol, endRow, endCol };
}

/**
 * Check whether a set of cells forms a valid rectangular merge:
 * - At least 2 cells
 * - All cells within the bounding rect exist
 * - The bounding rect (once expanded for existing merges) is > 1 cell
 */
export function canMergeCells(cells: CellCoord[], tableData: PptxTableData): boolean {
	if (cells.length < 2) {
		return false;
	}

	const rawRect = computeBoundingRect(cells);
	if (!rawRect) {
		return false;
	}

	const rect = expandRectForExistingMerges(rawRect, tableData);

	// Must span more than 1 cell
	if (rect.startRow === rect.endRow && rect.startCol === rect.endCol) {
		return false;
	}

	// All rows/cells in the rectangle must exist
	for (let r = rect.startRow; r <= rect.endRow; r++) {
		if (!tableData.rows[r]) {
			return false;
		}
		for (let c = rect.startCol; c <= rect.endCol; c++) {
			if (!tableData.rows[r].cells[c]) {
				return false;
			}
		}
	}

	return true;
}

/**
 * Check whether a cell can be split (i.e. it is the anchor of a merge).
 */
export function canSplitCell(row: number, col: number, tableData: PptxTableData): boolean {
	const cell = tableData.rows[row]?.cells[col];
	if (!cell) {
		return false;
	}
	const gs = Math.max(1, cell.gridSpan ?? 1);
	const rs = Math.max(1, cell.rowSpan ?? 1);
	return gs > 1 || rs > 1;
}

// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------

/**
 * Merge an arbitrary rectangular selection of cells.
 *
 * Returns a new `PptxTableData` with:
 * - The top-left cell of the rect given `gridSpan` (if >1 columns) and
 *   `rowSpan` (if >1 rows), with text content combined from all cells.
 * - All other cells in the rect marked `hMerge` / `vMerge` with empty text.
 */
export function mergeCells(cells: CellCoord[], tableData: PptxTableData): PptxTableData {
	const rawRect = computeBoundingRect(cells);
	if (!rawRect) {
		return tableData;
	}

	const rect = expandRectForExistingMerges(rawRect, tableData);
	const colCount = rect.endCol - rect.startCol + 1;
	const rowCount = rect.endRow - rect.startRow + 1;

	if (colCount <= 1 && rowCount <= 1) {
		return tableData;
	}

	// Collect non-empty text from all cells in the rect (skip merge continuations)
	const textParts: string[] = [];
	for (let r = rect.startRow; r <= rect.endRow; r++) {
		for (let c = rect.startCol; c <= rect.endCol; c++) {
			const cell = tableData.rows[r]?.cells[c];
			if (!cell) {
				continue;
			}
			if (cell.hMerge || cell.vMerge) {
				continue;
			}
			const txt = (cell.text ?? '').trim();
			if (txt.length > 0) {
				textParts.push(txt);
			}
		}
	}
	const combinedText = textParts.join(' ');

	const newRows = tableData.rows.map((row, ri) => {
		if (ri < rect.startRow || ri > rect.endRow) {
			return row;
		}

		const newCells = row.cells.map((cell, ci): PptxTableCell => {
			if (ci < rect.startCol || ci > rect.endCol) {
				return cell;
			}

			// Top-left anchor cell
			if (ri === rect.startRow && ci === rect.startCol) {
				return {
					...cell,
					text: combinedText,
					gridSpan: colCount > 1 ? colCount : undefined,
					rowSpan: rowCount > 1 ? rowCount : undefined,
					hMerge: undefined,
					vMerge: undefined,
				};
			}

			// Same row as anchor, different column → hMerge
			if (ri === rect.startRow) {
				return {
					...cell,
					text: '',
					hMerge: true,
					vMerge: undefined,
					gridSpan: undefined,
					rowSpan: undefined,
				};
			}

			// Different row, same column as anchor → vMerge
			if (ci === rect.startCol) {
				return {
					...cell,
					text: '',
					vMerge: true,
					hMerge: undefined,
					gridSpan: undefined,
					rowSpan: undefined,
				};
			}

			// Interior cell (both hMerge and vMerge apply, but OpenXML uses vMerge for rows
			// below the first row and hMerge for columns after the first column in that row)
			return {
				...cell,
				text: '',
				hMerge: true,
				vMerge: true,
				gridSpan: undefined,
				rowSpan: undefined,
			};
		});

		return { ...row, cells: newCells };
	});

	return { ...tableData, rows: newRows };
}

// ---------------------------------------------------------------------------
// Split
// ---------------------------------------------------------------------------

/**
 * Split a previously merged cell at (row, col) back into individual cells.
 *
 * Returns a new `PptxTableData` where:
 * - The anchor cell's `gridSpan` and `rowSpan` are removed
 * - All `hMerge` / `vMerge` cells in the previously merged region have
 *   those flags cleared and become normal empty cells.
 */
export function splitCell(row: number, col: number, tableData: PptxTableData): PptxTableData {
	const anchor = tableData.rows[row]?.cells[col];
	if (!anchor) {
		return tableData;
	}

	const spanX = Math.max(1, anchor.gridSpan ?? 1);
	const spanY = Math.max(1, anchor.rowSpan ?? 1);

	if (spanX === 1 && spanY === 1) {
		return tableData;
	}

	const newRows = tableData.rows.map((r, ri) => {
		if (ri < row || ri >= row + spanY) {
			return r;
		}

		const newCells = r.cells.map((c, ci): PptxTableCell => {
			if (ci < col || ci >= col + spanX) {
				return c;
			}

			// Anchor cell — remove merge attrs
			if (ri === row && ci === col) {
				return {
					...c,
					gridSpan: undefined,
					rowSpan: undefined,
				};
			}

			// Continuation cells — clear merge flags
			return {
				...c,
				hMerge: undefined,
				vMerge: undefined,
				gridSpan: undefined,
				rowSpan: undefined,
			};
		});

		return { ...r, cells: newCells };
	});

	return { ...tableData, rows: newRows };
}

// ---------------------------------------------------------------------------
// Selection helpers
// ---------------------------------------------------------------------------

/**
 * Compute the bounding rectangle between two cells (e.g. anchor and Shift+Click
 * target).  Expands for existing merges so the visual selection is always
 * rectangular.
 */
export function computeSelectionRect(
	anchorRow: number,
	anchorCol: number,
	targetRow: number,
	targetCol: number,
	tableData: PptxTableData,
): CellRect {
	const rawRect: CellRect = {
		startRow: Math.min(anchorRow, targetRow),
		startCol: Math.min(anchorCol, targetCol),
		endRow: Math.max(anchorRow, targetRow),
		endCol: Math.max(anchorCol, targetCol),
	};
	return expandRectForExistingMerges(rawRect, tableData);
}

/** Enumerate all cell coordinates within a rect (row-major order). */
export function rectToCells(rect: CellRect): CellCoord[] {
	const result: CellCoord[] = [];
	for (let r = rect.startRow; r <= rect.endRow; r++) {
		for (let c = rect.startCol; c <= rect.endCol; c++) {
			result.push({ row: r, col: c });
		}
	}
	return result;
}

/** Check whether a given cell coordinate is inside a rect. */
export function isCellInRect(row: number, col: number, rect: CellRect | undefined): boolean {
	if (!rect) {
		return false;
	}
	return row >= rect.startRow && row <= rect.endRow && col >= rect.startCol && col <= rect.endCol;
}
