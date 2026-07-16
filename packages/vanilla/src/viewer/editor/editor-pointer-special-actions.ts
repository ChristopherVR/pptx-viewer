import type { SnapSibling } from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';
import { getActiveElements } from './editor-active-elements';
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
			? rectangle(anchor, nextCell)
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

function rectangle(
	anchor: { row: number; column: number },
	end: { row: number; column: number },
): Array<{ row: number; column: number }> {
	return Array.from({ length: Math.abs(end.row - anchor.row) + 1 }, (_row, rowOffset) =>
		Array.from({ length: Math.abs(end.column - anchor.column) + 1 }, (_column, columnOffset) => ({
			row: Math.min(anchor.row, end.row) + rowOffset,
			column: Math.min(anchor.column, end.column) + columnOffset,
		})),
	).flat();
}
