/**
 * TableSelectionService: signal-based selection state for table cell editing.
 *
 * The Angular counterpart of React's viewer-level `tableEditorState`. It tracks
 * which table element + cell is currently selected (and optionally an active
 * Shift+Click rectangular range), so that BOTH the in-canvas table renderer
 * (highlighting) and the inspector's cell-formatting / merge panels read the
 * same source of truth.
 *
 * Selection math is delegated to `pptx-viewer-shared` (`computeSelectionRect` /
 * `rectToCells`); this service only wires the result to Angular signals.
 *
 * Provide it at the component level next to `EditorStateService`:
 * `@Component({ providers: [EditorStateService, TableSelectionService] })` so a
 * single instance is shared across the canvas and inspector subtrees.
 */

import { computed, Injectable, signal } from '@angular/core';
import type { PptxTableData } from 'pptx-viewer-core';

import type { CellCoord } from '../internal/shared';
import { computeSelectionRect, rectToCells } from '../internal/shared';

/** A selected table cell (and optional Shift+Click range) on one table element. */
export interface TableCellSelection {
	/** Id of the table element the selection belongs to. */
	elementId: string;
	/** Anchor cell row (0-based). */
	rowIndex: number;
	/** Anchor cell column (0-based). */
	columnIndex: number;
	/** When true, the anchor cell has an active inline text input. */
	isEditing?: boolean;
	/** Optional multi-cell rectangular selection (Shift+Click range). */
	selectedCells?: CellCoord[];
}

@Injectable()
export class TableSelectionService {
	/** The current table-cell selection, or null when nothing is selected. */
	readonly selection = signal<TableCellSelection | null>(null);

	/** The element id of the current selection (or undefined). */
	readonly elementId = computed<string | undefined>(() => this.selection()?.elementId);

	/**
	 * Select a single cell (clears any range). Passing the element id keeps the
	 * selection scoped so a stale selection from a different table is ignored.
	 */
	selectCell(elementId: string, rowIndex: number, columnIndex: number): void {
		this.selection.set({ elementId, rowIndex, columnIndex });
	}

	/**
	 * Extend the selection from the current anchor to `(rowIndex, columnIndex)`
	 * as a rectangular range (Shift+Click). Expands to cover any merge groups it
	 * overlaps. When there is no existing anchor on this element it falls back to
	 * a single-cell selection.
	 */
	extendTo(
		elementId: string,
		rowIndex: number,
		columnIndex: number,
		tableData: PptxTableData,
	): void {
		const current = this.selection();
		if (!current || current.elementId !== elementId) {
			this.selectCell(elementId, rowIndex, columnIndex);
			return;
		}
		const rect = computeSelectionRect(
			current.rowIndex,
			current.columnIndex,
			rowIndex,
			columnIndex,
			tableData,
		);
		this.selection.set({
			elementId,
			rowIndex: current.rowIndex,
			columnIndex: current.columnIndex,
			selectedCells: rectToCells(rect),
		});
	}

	/** Mark the anchor cell as actively editing (inline text input open). */
	beginEditing(elementId: string, rowIndex: number, columnIndex: number): void {
		this.selection.set({ elementId, rowIndex, columnIndex, isEditing: true });
	}

	/** Clear the editing flag while keeping the cell selected. */
	endEditing(): void {
		const current = this.selection();
		if (current?.isEditing) {
			this.selection.set({
				elementId: current.elementId,
				rowIndex: current.rowIndex,
				columnIndex: current.columnIndex,
			});
		}
	}

	/** Clear the selection entirely. */
	clear(): void {
		this.selection.set(null);
	}

	/** Clear the selection when it belongs to `elementId` (e.g. element deleted). */
	clearFor(elementId: string): void {
		if (this.selection()?.elementId === elementId) {
			this.selection.set(null);
		}
	}
}
