import type { PptxTableData } from 'pptx-viewer-core';
import type { SnapSibling } from 'pptx-viewer-shared';
import { computeSelectionRect, rectToCells } from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';
import { findActiveElement, getActiveElements } from './editor-active-elements';
import type { EditorOps } from './editor-operations';

export function handleSpecialPointerAction(options: {
	event: PointerEvent;
	elementId: string | null;
	state: ViewerState;
	store: Store<ViewerState>;
	ops: EditorOps;
	onEyedropper?(color: string): void;
}): boolean {
	const { event, elementId, state, store, ops } = options;
	if (state.eyedropperActive) {
		const target = event.target instanceof Element ? event.target : null;
		const style = target ? getComputedStyle(target) : null;
		const color = style?.backgroundColor || style?.color;
		if (color) {
			options.onEyedropper?.(color);
		}
		store.set({ eyedropperActive: false });
		return true;
	}
	const cell =
		event.target instanceof Element ? event.target.closest<HTMLTableCellElement>('td') : null;
	if (!elementId || cell?.dataset.rowIndex === undefined || cell.dataset.cellIndex === undefined) {
		return false;
	}
	const nextCell = {
		row: Number(cell.dataset.rowIndex),
		column: Number(cell.dataset.cellIndex),
	};
	const anchor = state.selectedTableCell;
	const selectedTableCells =
		event.shiftKey && state.selectedElementId === elementId && anchor
			? shiftClickRange(anchor, nextCell, tableDataOf(state, elementId))
			: [nextCell];
	ops.select(elementId, [elementId]);
	store.set({
		selectedTableCell: event.shiftKey && anchor ? anchor : nextCell,
		selectedTableCells,
	});
	return true;
}

export function snapToGrid<T extends { x: number; y: number }>(value: T, enabled: boolean): T {
	return enabled
		? { ...value, x: Math.round(value.x / 10) * 10, y: Math.round(value.y / 10) * 10 }
		: value;
}

export function snapSiblings(state: ViewerState): SnapSibling[] {
	return state.snapToShape
		? getActiveElements(state).map(({ id, x, y, width, height }) => ({ id, x, y, width, height }))
		: [];
}

/** A table with no rows: `computeSelectionRect` then returns the plain rect. */
const EMPTY_TABLE_DATA: PptxTableData = { rows: [], columnWidths: [] };

/** The `tableData` of the element being clicked, when it is a table. */
function tableDataOf(state: ViewerState, elementId: string): PptxTableData {
	const element = findActiveElement(state, elementId);
	return (element?.type === 'table' ? element.tableData : undefined) ?? EMPTY_TABLE_DATA;
}

/**
 * The cells a shift-click from `anchor` to `end` selects.
 *
 * Shared's `computeSelectionRect` is MERGE-AWARE: it grows the rectangle until
 * it covers every merged block it touches, so the range is one PowerPoint would
 * accept. A plain min/max rect (what this used to build) could stop halfway
 * through a merged cell.
 */
function shiftClickRange(
	anchor: { row: number; column: number },
	end: { row: number; column: number },
	tableData: PptxTableData,
): Array<{ row: number; column: number }> {
	const rect = computeSelectionRect(anchor.row, anchor.column, end.row, end.column, tableData);
	return rectToCells(rect).map(({ row, col }) => ({ row, column: col }));
}
