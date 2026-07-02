/**
 * table-cell-merge.ts - framework-agnostic cursor-anchored cell merge helpers.
 *
 * These complement the selection-rectangle operations in `table-merge.ts`.
 * Where `mergeCells` / `splitCell` operate on an arbitrary rectangular
 * selection, the helpers here act relative to a single cursor cell:
 *   - merge the cell to its right (`computeMergeCellRight`),
 *   - merge the cell below it (`computeMergeCellDown`),
 *   - split the merged cell under the cursor (`computeSplitCell`).
 *
 * Each returns a new (immutable) `rows` array with the merge/split applied, or
 * `null` when the operation is not valid at that position. Ported verbatim from
 * the React viewer's `inspector/table-cell-merge-helpers.ts` so React, Vue, and
 * Angular share one copy. No framework imports.
 */
import type { PptxTableData } from 'pptx-viewer-core';

/**
 * Merge the cell at `(rowIndex, columnIndex)` with the next cell to its right.
 * Returns the new `rows` array, or `null` when there is no mergeable neighbour.
 */
export function computeMergeCellRight(
	td: PptxTableData,
	rowIndex: number,
	columnIndex: number,
): PptxTableData['rows'] | null {
	const row = td.rows[rowIndex];
	if (!row) {
		return null;
	}
	const cellAtCursor = row.cells[columnIndex];
	const currentSpan = Math.max(1, cellAtCursor?.gridSpan ?? 1);
	const nextColumnIndex = columnIndex + currentSpan;
	const nextCell = row.cells[nextColumnIndex];
	if (!nextCell || nextCell.hMerge || nextCell.vMerge) {
		return null;
	}
	const nextSpan = Math.max(1, nextCell.gridSpan ?? 1);
	return td.rows.map((r, ri) => {
		if (ri !== rowIndex) {
			return r;
		}
		const newCells = r.cells.map((c, ci) => {
			if (ci === columnIndex) {
				return { ...c, gridSpan: currentSpan + nextSpan };
			}
			if (ci >= nextColumnIndex && ci < nextColumnIndex + nextSpan) {
				return { ...c, hMerge: true, text: '' };
			}
			return c;
		});
		return { ...r, cells: newCells };
	});
}

/**
 * Merge the cell at `(rowIndex, columnIndex)` with the next cell below it.
 * Returns the new `rows` array, or `null` when there is no mergeable neighbour.
 */
export function computeMergeCellDown(
	td: PptxTableData,
	rowIndex: number,
	columnIndex: number,
): PptxTableData['rows'] | null {
	const row = td.rows[rowIndex];
	if (!row) {
		return null;
	}
	const cellAtCursor = row.cells[columnIndex];
	if (!cellAtCursor) {
		return null;
	}
	const currentRowSpan = Math.max(1, cellAtCursor.rowSpan ?? 1);
	const targetNextRowIndex = rowIndex + currentRowSpan;
	if (targetNextRowIndex >= td.rows.length) {
		return null;
	}
	const targetNextRow = td.rows[targetNextRowIndex];
	const targetNextCell = targetNextRow?.cells[columnIndex];
	if (!targetNextCell || targetNextCell.hMerge || targetNextCell.vMerge) {
		return null;
	}
	const nextRowSpan = Math.max(1, targetNextCell.rowSpan ?? 1);
	return td.rows.map((r, ri) => {
		if (ri === rowIndex) {
			return {
				...r,
				cells: r.cells.map((c, ci) =>
					ci === columnIndex ? { ...c, rowSpan: currentRowSpan + nextRowSpan } : c,
				),
			};
		}
		if (ri === targetNextRowIndex) {
			return {
				...r,
				cells: r.cells.map((c, ci) => (ci === columnIndex ? { ...c, vMerge: true, text: '' } : c)),
			};
		}
		return r;
	});
}

/**
 * Split the merged cell at `(rowIndex, columnIndex)` back into individual
 * cells. Returns the new `rows` array, or `null` when the cell is not merged.
 */
export function computeSplitCell(
	td: PptxTableData,
	rowIndex: number,
	columnIndex: number,
): PptxTableData['rows'] | null {
	const row = td.rows[rowIndex];
	const cellAtCursor = row?.cells[columnIndex];
	if (!row || !cellAtCursor) {
		return null;
	}
	const spanX = Math.max(1, cellAtCursor.gridSpan ?? 1);
	const spanY = Math.max(1, cellAtCursor.rowSpan ?? 1);
	if (spanX === 1 && spanY === 1) {
		return null;
	}
	return td.rows.map((r, ri) => {
		const newCells = r.cells.map((c, ci) => {
			if (ri === rowIndex && ci === columnIndex) {
				return { ...c, gridSpan: undefined, rowSpan: undefined };
			}
			if (ri === rowIndex && ci > columnIndex && ci < columnIndex + spanX) {
				return { ...c, hMerge: undefined };
			}
			if (ri > rowIndex && ri < rowIndex + spanY && ci === columnIndex) {
				return { ...c, vMerge: undefined };
			}
			return c;
		});
		return { ...r, cells: newCells };
	});
}
