import type { PptxTableData } from 'pptx-viewer-core';
import type { CellCoord, CellRect } from 'pptx-viewer-shared';
import { computeSelectionRect, isCellInRect, rectToCells } from 'pptx-viewer-shared';

/**
 * The block of table cells the user has marquee'd on the canvas.
 *
 * Svelte shipped without this model at all: `context-menu-dispatch` hard-coded
 * `hasMultiCellSelection: false`, so PowerPoint's "Merge Cells" could never be
 * offered and a user could only ever merge one cell rightwards or downwards.
 *
 * None of the rectangle math lives here. `computeSelectionRect` in
 * `pptx-viewer-shared` owns it, and it is merge-AWARE: dragging across a cell
 * that already spans expands the rectangle to cover the whole span, so the
 * highlighted block is always a real rectangle in model coordinates. (The
 * vanilla binding carries a private `rectangle()` helper that ignores spans;
 * that is a bug, not a second model, and is deliberately not copied.)
 *
 * @module editor/table-cell-selection
 */

/** A click on a `<td>`, in model (unmerged) coordinates. */
export interface TableCellPoint {
	rowIndex: number;
	columnIndex: number;
}

export class TableCellSelection {
	/** The table element the range belongs to, or null when there is none. */
	elementId = $state<string | null>(null);
	/** Where the range started (the un-shifted click). */
	anchor = $state.raw<CellCoord | null>(null);
	/** The current rectangle, already expanded over any merged cells it meets. */
	rect = $state.raw<CellRect | null>(null);

	/** Every cell in the current range, row-major. Empty when there is none. */
	get cells(): CellCoord[] {
		return this.rect ? rectToCells(this.rect) : [];
	}

	/** True once the range covers a block, i.e. once merging becomes possible. */
	get hasBlock(): boolean {
		const rect = this.rect;
		return rect !== null && (rect.endRow > rect.startRow || rect.endCol > rect.startCol);
	}

	/** The range on `elementId`, or an empty array when it belongs elsewhere. */
	cellsFor(elementId: string | null | undefined): CellCoord[] {
		return elementId && elementId === this.elementId ? this.cells : [];
	}

	/** Is this cell of this element inside the highlighted block? */
	contains(elementId: string, row: number, col: number): boolean {
		return this.elementId === elementId && isCellInRect(row, col, this.rect ?? undefined);
	}

	/** A plain click: the range collapses to the clicked cell, which anchors it. */
	begin(elementId: string, cell: TableCellPoint, tableData: PptxTableData): void {
		this.elementId = elementId;
		this.anchor = { row: cell.rowIndex, col: cell.columnIndex };
		this.rect = computeSelectionRect(
			cell.rowIndex,
			cell.columnIndex,
			cell.rowIndex,
			cell.columnIndex,
			tableData,
		);
	}

	/**
	 * A Shift-click: stretch anchor -> cell into a rectangle. Falls back to
	 * anchoring when there is no anchor yet (or it belongs to another table), so
	 * a Shift-click is never a no-op.
	 */
	extend(elementId: string, cell: TableCellPoint, tableData: PptxTableData): void {
		const anchor = this.elementId === elementId ? this.anchor : null;
		if (!anchor) {
			this.begin(elementId, cell, tableData);
			return;
		}
		this.elementId = elementId;
		this.rect = computeSelectionRect(
			anchor.row,
			anchor.col,
			cell.rowIndex,
			cell.columnIndex,
			tableData,
		);
	}

	clear(): void {
		this.elementId = null;
		this.anchor = null;
		this.rect = null;
	}

	/** Drop the range when the element selection has moved off its table. */
	syncElement(selectedElementId: string | null): void {
		if (this.elementId !== null && this.elementId !== selectedElementId) {
			this.clear();
		}
	}
}
