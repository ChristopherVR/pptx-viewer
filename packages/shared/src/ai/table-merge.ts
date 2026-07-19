/**
 * {@link mergeTableElements}: a pure, deterministic merge of two table elements
 * into one. The AI `merge_tables` tool builds on this so "merge the two selected
 * tables" is a first-class capability rather than a fragile sequence of
 * primitive edits.
 *
 * Semantics:
 * - `vertical` (default): append B's rows beneath A's. Requires an equal column
 *   count; a mismatch throws a clear error (padding is rejected so columns never
 *   silently misalign).
 * - `horizontal`: append B's columns to A's rows. Requires an equal row count; a
 *   mismatch throws.
 *
 * The result keeps A's style, banding flags, and table-style id, takes the union
 * bounding box of A and B as its position/size, and is given a fresh id.
 */

import type { PptxTableData, PptxTableRow, TablePptxElement } from 'pptx-viewer-core';

/** Direction of a table merge. */
export type TableMergeDirection = 'vertical' | 'horizontal';

/** Options for {@link mergeTableElements}. */
export interface MergeTableOptions {
	/** How to combine the tables. Default `'vertical'`. */
	direction?: TableMergeDirection;
	/** Id for the merged element. A fresh one is generated when omitted. */
	id?: string;
}

/** Effective column count of a table (widest row, or declared column widths). */
function columnCount(data: PptxTableData): number {
	const widest = data.rows.reduce((max, row) => Math.max(max, row.cells.length), 0);
	return Math.max(widest, data.columnWidths?.length ?? 0);
}

/** Generate a fresh merged-table id. */
function newTableId(): string {
	return `tbl-merged-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Require a table to carry parsed data, or throw. */
function requireData(table: TablePptxElement, which: string): PptxTableData {
	if (!table.tableData) {
		throw new Error(`Cannot merge: ${which} table '${table.id}' has no table data.`);
	}
	return table.tableData;
}

/** Concatenate two proportional column-width arrays, renormalised to sum 1. */
function combineColumnWidths(a: number[], b: number[]): number[] {
	const combined = [...a, ...b];
	const total = combined.reduce((sum, w) => sum + w, 0);
	if (total <= 0) {
		return combined.map(() => 1 / combined.length);
	}
	return combined.map((w) => w / total);
}

/** Union bounding box of two elements as `{ x, y, width, height }`. */
function unionBounds(
	a: TablePptxElement,
	b: TablePptxElement,
): { x: number; y: number; width: number; height: number } {
	const x = Math.min(a.x, b.x);
	const y = Math.min(a.y, b.y);
	const right = Math.max(a.x + a.width, b.x + b.width);
	const bottom = Math.max(a.y + a.height, b.y + b.height);
	return { x, y, width: right - x, height: bottom - y };
}

/** Merge B's rows beneath A's (equal column count required). */
function mergeVertical(aData: PptxTableData, bData: PptxTableData): PptxTableData {
	const aCols = columnCount(aData);
	const bCols = columnCount(bData);
	if (aCols !== bCols) {
		throw new Error(
			`Cannot merge tables vertically: column counts differ (${aCols} vs ${bCols}). ` +
				'Align the columns or merge horizontally instead.',
		);
	}
	return {
		...aData,
		rows: [...structuredClone(aData.rows), ...structuredClone(bData.rows)],
	};
}

/** Merge B's columns onto A's rows (equal row count required). */
function mergeHorizontal(aData: PptxTableData, bData: PptxTableData): PptxTableData {
	if (aData.rows.length !== bData.rows.length) {
		throw new Error(
			`Cannot merge tables horizontally: row counts differ (${aData.rows.length} vs ` +
				`${bData.rows.length}). Align the rows or merge vertically instead.`,
		);
	}
	const aRows = structuredClone(aData.rows);
	const bRows = structuredClone(bData.rows);
	const rows: PptxTableRow[] = aRows.map((row, i) => ({
		...row,
		cells: [...row.cells, ...bRows[i].cells],
	}));
	return {
		...aData,
		rows,
		columnWidths: combineColumnWidths(aData.columnWidths ?? [], bData.columnWidths ?? []),
	};
}

/**
 * Merge two table elements into a single valid table element.
 *
 * @throws Error when either table lacks data, or the shared dimension does not
 *   match (columns for vertical, rows for horizontal).
 */
export function mergeTableElements(
	a: TablePptxElement,
	b: TablePptxElement,
	opts: MergeTableOptions = {},
): TablePptxElement {
	const direction = opts.direction ?? 'vertical';
	const aData = requireData(a, 'first');
	const bData = requireData(b, 'second');
	const tableData =
		direction === 'vertical' ? mergeVertical(aData, bData) : mergeHorizontal(aData, bData);
	// Drop A's `rawXml`. A table loaded from a real `.pptx` carries its original
	// `<a:tbl>` graphic frame; renderers (and the save fabricator) prefer that XML
	// over `tableData`. Copying A's stale XML verbatim would make the merged table
	// render only A's original rows (the exact "5 rows instead of 10" browser bug).
	// Removing it makes the freshly-merged `tableData` the single source of truth,
	// which every binding renders from and the save layer rebuilds XML from.
	const { rawXml: _staleXml, ...rest } = structuredClone(a);
	return {
		...rest,
		id: opts.id ?? newTableId(),
		...unionBounds(a, b),
		tableData,
	};
}
