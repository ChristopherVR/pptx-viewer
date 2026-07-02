import type { PptxTableData } from 'pptx-viewer-core';
import type { CellCoord, CellRect } from 'pptx-viewer-shared';
import { computeSelectionRect, isCellInRect, rectToCells } from 'pptx-viewer-shared';
import type { ComputedRef, InjectionKey, Ref } from 'vue';
import { computed, inject, provide } from 'vue';

/**
 * Table cell selection + resize context.
 *
 * Mirrors React's `tableEditorState` (`viewer/types-ui.ts`) but, following the
 * Vue viewer's provide/inject convention (see `table-edit` / `table-theme`), the
 * reactive selection is provided once at the viewer root and injected by both
 * `TableRenderer` (writes selection from cell clicks, reads it for the highlight
 * + drives resize) and the inspector `TablePanel` (reads the selected cell to
 * key structural / merge / cell-style edits). Absent in a read-only viewer, in
 * which case tables render without any selection affordance.
 */
export interface TableSelectionState {
	/** The table element the selection belongs to. */
	elementId: string;
	/** Anchor cell row (original grid coords). */
	rowIndex: number;
	/** Anchor cell column (original grid coords). */
	columnIndex: number;
	/** Rectangular multi-cell selection (Shift+Click range), row-major. */
	selectedCells?: CellCoord[];
}

export interface TableSelectionContext {
	/** The current selection, or `null` when no cell is selected. */
	selection: Ref<TableSelectionState | null>;
	/** Replace (or clear) the current selection. */
	select: (next: TableSelectionState | null) => void;
	/** Commit new column widths (proportions summing to 1) for a table. */
	resizeColumns: (elementId: string, widths: number[]) => void;
	/** Commit a new pixel height for a single row of a table. */
	resizeRow: (elementId: string, rowIndex: number, height: number) => void;
}

/** Typed injection key for the table selection context. */
export const TableSelectionKey: InjectionKey<TableSelectionContext> = Symbol(
	'pptx-vue-table-selection',
);

/** Provide the selection context at the viewer root. */
export function provideTableSelection(ctx: TableSelectionContext): void {
	provide(TableSelectionKey, ctx);
}

/** Resolve the injected selection context, if any (read-only viewers omit it). */
export function injectTableSelection(): TableSelectionContext | undefined {
	return inject(TableSelectionKey, undefined);
}

/**
 * Pure next-selection computation for a cell click. Shift+click within the same
 * table (anchored at the previous selection) yields a rectangular multi-cell
 * selection expanded across any merges it overlaps; any other click selects the
 * single clicked cell. Mirrors React's `table-render` onClick branch.
 */
export function computeCellSelection(
	prev: TableSelectionState | null,
	elementId: string,
	rowIndex: number,
	columnIndex: number,
	shiftKey: boolean,
	tableData: PptxTableData,
): TableSelectionState {
	if (shiftKey && prev && prev.elementId === elementId) {
		const rect = computeSelectionRect(
			prev.rowIndex,
			prev.columnIndex,
			rowIndex,
			columnIndex,
			tableData,
		);
		return {
			elementId,
			rowIndex: prev.rowIndex,
			columnIndex: prev.columnIndex,
			selectedCells: rectToCells(rect),
		};
	}
	return { elementId, rowIndex, columnIndex };
}

export interface TableCellSelectionApi {
	/** The selection restricted to this table element (else `null`). */
	activeSelection: ComputedRef<TableSelectionState | null>;
	/** The multi-cell bounding rect when >= 2 cells are selected. */
	selectionRect: ComputedRef<CellRect | undefined>;
	/** Whether `(row, col)` is the anchor (single) selected cell. */
	isCellSelected: (rowIndex: number, columnIndex: number) => boolean;
	/** Whether `(row, col)` falls inside the multi-cell selection rect. */
	isCellInSelection: (rowIndex: number, columnIndex: number) => boolean;
	/** Apply a click at `(row, col)` (single or Shift+range). */
	selectCell: (rowIndex: number, columnIndex: number, shiftKey: boolean) => void;
	/** Whether a selection context is available (edit-capable viewer). */
	hasContext: boolean;
}

/**
 * Cell-selection helpers for `TableRenderer`. Injects the shared selection
 * context and derives per-cell highlight state plus the click handler, keeping
 * the SFC script thin.
 */
export function useTableCellSelection(
	elementId: () => string,
	tableData: () => PptxTableData | undefined,
): TableCellSelectionApi {
	const ctx = injectTableSelection();

	const activeSelection = computed<TableSelectionState | null>(() => {
		const s = ctx?.selection.value ?? null;
		return s && s.elementId === elementId() ? s : null;
	});

	const selectionRect = computed<CellRect | undefined>(() => {
		const s = activeSelection.value;
		const td = tableData();
		if (!s?.selectedCells || s.selectedCells.length < 2 || !td) {
			return undefined;
		}
		const first = s.selectedCells[0];
		const last = s.selectedCells[s.selectedCells.length - 1];
		return computeSelectionRect(first.row, first.col, last.row, last.col, td);
	});

	function isCellSelected(rowIndex: number, columnIndex: number): boolean {
		const s = activeSelection.value;
		return s !== null && s.rowIndex === rowIndex && s.columnIndex === columnIndex;
	}

	function isCellInSelection(rowIndex: number, columnIndex: number): boolean {
		return isCellInRect(rowIndex, columnIndex, selectionRect.value);
	}

	function selectCell(rowIndex: number, columnIndex: number, shiftKey: boolean): void {
		const td = tableData();
		if (!ctx || !td) {
			return;
		}
		ctx.select(
			computeCellSelection(ctx.selection.value, elementId(), rowIndex, columnIndex, shiftKey, td),
		);
	}

	return {
		activeSelection,
		selectionRect,
		isCellSelected,
		isCellInSelection,
		selectCell,
		hasContext: Boolean(ctx),
	};
}
