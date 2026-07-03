import type { PptxElement } from 'pptx-viewer-core';
import { provide, ref } from 'vue';
import type { Ref } from 'vue';

import { TableCellEditKey } from './table-edit';
import { provideTableSelection } from './table-selection';
import type { TableSelectionState } from './table-selection';

export interface UseTableCellEditingContextInput {
	/** Plain "editing enabled" flag; gates the column/row resize handlers. */
	canEdit: () => boolean;
	/** Whether inline cell editing is currently allowed (edit mode + not presenting); gates `TableCellEditKey`. */
	canEditInline: () => boolean;
	findActiveElement: (id: string) => PptxElement | undefined;
	/** Wraps `ops.updateElement`; a plain function so this composable can be called before `ops` exists. */
	updateElement: (id: string, patch: Partial<PptxElement>) => void;
	/** Commit a single cell's new text (element-level inline table-cell edit). */
	commitTableCell: (elementId: string, rowIndex: number, colIndex: number, text: string) => void;
}

export interface UseTableCellEditingContextResult {
	tableSelection: Ref<TableSelectionState | null>;
}

/**
 * useTableCellEditingContext: provides the inline table-cell editing context
 * (`TableCellEditKey`, injected by `TableRenderer`) and the table cell
 * selection + drag-resize context (`provideTableSelection`, injected by
 * `TableRenderer` / `TablePanel`). Both are provided once at the viewer root
 * so the hot `SlideStage` -> `ElementRenderer` chain doesn't thread an
 * `editable` flag and commit callbacks through every element. Extracted
 * verbatim from `PowerPointViewer.vue`.
 */
export function useTableCellEditingContext(
	input: UseTableCellEditingContextInput,
): UseTableCellEditingContextResult {
	const { canEdit, canEditInline, findActiveElement, updateElement, commitTableCell } = input;

	// Inline table-cell editing context for `TableRenderer` (double-tap a cell ->
	// inline input -> commit).
	provide(TableCellEditKey, {
		canEdit: canEditInline,
		commit: (elementId: string, rowIndex: number, colIndex: number, text: string) =>
			commitTableCell(elementId, rowIndex, colIndex, text),
	});

	// Table cell selection + drag-resize context for `TableRenderer` / `TablePanel`.
	// The reactive selection drives the inspector's cell formatting + merge-aware
	// structural ops and the canvas highlight; resize callbacks commit new column
	// widths / row heights through the history-tracked editor op.
	const tableSelection = ref<TableSelectionState | null>(null);
	function resizeTableColumns(elementId: string, widths: number[]): void {
		const el = findActiveElement(elementId);
		if (!canEdit() || !el || el.type !== 'table' || !el.tableData) {
			return;
		}
		updateElement(elementId, {
			tableData: { ...el.tableData, columnWidths: widths },
		} as Partial<PptxElement>);
	}
	function resizeTableRow(elementId: string, rowIndex: number, height: number): void {
		const el = findActiveElement(elementId);
		if (!canEdit() || !el || el.type !== 'table' || !el.tableData) {
			return;
		}
		const rows = el.tableData.rows.map((r, i) => (i === rowIndex ? { ...r, height } : r));
		updateElement(elementId, { tableData: { ...el.tableData, rows } } as Partial<PptxElement>);
	}
	provideTableSelection({
		selection: tableSelection,
		select: (next) => {
			tableSelection.value = next;
		},
		resizeColumns: resizeTableColumns,
		resizeRow: resizeTableRow,
	});

	return { tableSelection };
}
