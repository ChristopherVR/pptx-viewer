/**
 * Pure (framework-agnostic) helpers for the table-level inspector panel
 * (header row / banded rows toggles + a uniform default cell padding). Mirrors
 * the reader + patch-builder pattern used by `gradient-picker.ts` /
 * `text-advanced.ts` / `image-adjustments.ts`.
 *
 * Scope note: this binding has no per-cell selection model, so cell-level
 * formatting (background/border for one specific cell) is out of scope here;
 * `applyUniformCellPaddingPatch` instead writes the same margin onto every
 * cell uniformly, which is the closest table-level equivalent.
 */

import type { PptxElement, PptxTableData, PptxTableRow } from 'pptx-viewer-core';

/** Table-level flags + a best-effort uniform cell padding reading. */
export interface TableInspectorState {
	firstRowHeader: boolean;
	bandedRows: boolean;
	bandedColumns: boolean;
	/** Uniform cell padding in px, read from the first cell (0 when unset/mixed). */
	cellPadding: number;
}

/** Read table-level flags off a table element (all false/0 for non-table elements). */
export function tableInspectorStateOf(el: PptxElement): TableInspectorState {
	if (el.type !== 'table' || !el.tableData) {
		return { firstRowHeader: false, bandedRows: false, bandedColumns: false, cellPadding: 0 };
	}
	const data = el.tableData;
	return {
		firstRowHeader: data.firstRowHeader ?? false,
		bandedRows: data.bandedRows ?? false,
		bandedColumns: data.bandedColumns ?? false,
		cellPadding: firstCellPadding(data),
	};
}

function firstCellPadding(data: PptxTableData): number {
	const firstCell = data.rows[0]?.cells[0];
	return firstCell?.style?.marginLeft ?? 0;
}

/** Changes to apply to the table-level flags (header row / banded rows / columns). */
export type TableInspectorChanges = Partial<
	Pick<PptxTableData, 'firstRowHeader' | 'bandedRows' | 'bandedColumns'>
>;

/**
 * Build a Partial<PptxElement> that merges the given flag changes into the
 * element's existing `tableData`. No-op (returns `{}`) for non-table elements
 * or a table with no parsed data.
 */
export function tableInspectorPatch(
	el: PptxElement,
	changes: TableInspectorChanges,
): Partial<PptxElement> {
	if (el.type !== 'table' || !el.tableData) {
		return {};
	}
	return {
		tableData: {
			...el.tableData,
			...changes,
		},
	} as Partial<PptxElement>;
}

/**
 * Build a Partial<PptxElement> that sets the same left/right/top/bottom margin
 * (in px) on every cell of every row, so the table gets uniform default
 * padding. No-op (returns `{}`) for non-table elements or a table with no rows.
 */
export function applyUniformCellPaddingPatch(
	el: PptxElement,
	padding: number,
): Partial<PptxElement> {
	if (el.type !== 'table' || !el.tableData) {
		return {};
	}
	const clamped = Math.max(0, Math.round(padding));
	const rows: PptxTableRow[] = el.tableData.rows.map((row) => ({
		...row,
		cells: row.cells.map((cell) => ({
			...cell,
			style: {
				...cell.style,
				marginLeft: clamped,
				marginRight: clamped,
				marginTop: clamped,
				marginBottom: clamped,
			},
		})),
	}));
	return {
		tableData: {
			...el.tableData,
			rows,
		},
	} as Partial<PptxElement>;
}
