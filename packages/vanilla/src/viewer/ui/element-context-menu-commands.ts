/**
 * Routing for the canvas context menu: read the table context the shared
 * command builder needs, and turn a {@link ContextMenuCommandId} into the
 * vanilla editor operation that performs it.
 *
 * Kept apart from `element-context-menu.ts` because the two halves change for
 * different reasons: a new command lands here, a positioning or dismissal fix
 * lands there. Together they would also push a single file past the size
 * budget, and the dispatch is the half worth unit-testing on its own.
 *
 * Every command routes to an action that already exists, so nothing here
 * mutates the store directly: the menu is a second entry point to the ribbon
 * and inspector operations, never a parallel implementation of them.
 */
import type { PptxElement } from 'pptx-viewer-core';
import type { ContextMenuCommandId, ContextMenuTableContext } from 'pptx-viewer-shared';

import type { EditActions } from '../editor';
import type { TableCellPosition } from '../editor/table-editor-mutations';
import type { Store, ViewerState } from '../state';

/** The AI hooks the two AI entries need (structurally the `AiFocusController`). */
export interface ContextMenuAiHooks {
	askAboutSelection(): void;
	fixElement(element: PptxElement | null, slideIndex: number): void;
}

/** The table cell the menu was opened on, plus what the shared builder asks about it. */
export interface ContextMenuTableTarget {
	cell: TableCellPosition;
	context: ContextMenuTableContext;
}

export interface ContextMenuCommandDeps {
	store: Store<ViewerState>;
	getEditActions(): EditActions;
	/** Slide review comments (React's context-menu "Add Comment" opens the same surface). */
	openComments(): void;
	/** Hyperlink dialog for the selected element. */
	openHyperlink(): void;
	/** AI focus controller when the host configured `ai`, otherwise null. */
	getAi(): ContextMenuAiHooks | null;
}

/** The `{row, column}` a right-click landed on, when it landed inside a table cell. */
export function readTableCellTarget(target: EventTarget | null): TableCellPosition | null {
	const cell = target instanceof Element ? target.closest<HTMLTableCellElement>('td') : null;
	if (!cell || cell.dataset.rowIndex === undefined || cell.dataset.cellIndex === undefined) {
		return null;
	}
	const position = { row: Number(cell.dataset.rowIndex), column: Number(cell.dataset.cellIndex) };
	return Number.isFinite(position.row) && Number.isFinite(position.column) ? position : null;
}

/**
 * The table context for the right-clicked element, or null when this is not a
 * table cell. The cell under the cursor wins over the stored selection so the
 * commands act on what the user actually aimed at.
 */
export function resolveTableTarget(
	state: ViewerState,
	element: PptxElement | null,
	target: EventTarget | null,
): ContextMenuTableTarget | null {
	if (element?.type !== 'table' || !element.tableData) {
		return null;
	}
	const cell = readTableCellTarget(target) ?? state.selectedTableCell;
	if (!cell) {
		return null;
	}
	const anchor = element.tableData.rows[cell.row]?.cells[cell.column];
	return {
		cell,
		context: {
			hasMultiCellSelection: state.selectedTableCells.length > 1,
			isMergedCell: (anchor?.gridSpan ?? 1) > 1 || (anchor?.rowSpan ?? 1) > 1,
		},
	};
}

/** Merge the anchor with the neighbour one step right / down (PowerPoint's pairwise merges). */
function neighbourMerge(
	actions: EditActions,
	cell: TableCellPosition,
	axis: 'right' | 'down',
): void {
	actions.mergeTableCells([
		cell,
		axis === 'right'
			? { row: cell.row, column: cell.column + 1 }
			: { row: cell.row + 1, column: cell.column },
	]);
}

/** Run `id` against the live editor actions. Table commands no-op without a cell. */
export function runContextMenuCommand(
	id: ContextMenuCommandId,
	deps: ContextMenuCommandDeps,
	table: ContextMenuTableTarget | null,
): void {
	const actions = deps.getEditActions();
	const cell = table?.cell ?? null;
	switch (id) {
		case 'copy':
			return actions.copy();
		case 'cut':
			return actions.cut();
		case 'paste':
			return actions.paste();
		case 'duplicate':
			return actions.duplicateSelected();
		case 'delete':
			return actions.deleteSelected();
		case 'bring-forward':
			return actions.bringForward();
		case 'send-backward':
			return actions.sendBackward();
		case 'bring-front':
			return actions.bringToFront();
		case 'send-back':
			return actions.sendToBack();
		case 'group':
			return actions.groupSelected();
		case 'ungroup':
			return actions.ungroupSelected();
		case 'comment':
			return deps.openComments();
		case 'hyperlink':
			return deps.openHyperlink();
		case 'ai-ask':
			return deps.getAi()?.askAboutSelection();
		case 'ai-fix':
			return runAiFix(deps);
		case 'table-insert-row-above':
			return cell ? actions.mutateTableStructure(cell, 'insertRowAbove') : undefined;
		case 'table-insert-row-below':
			return cell ? actions.mutateTableStructure(cell, 'insertRowBelow') : undefined;
		case 'table-delete-row':
			return cell ? actions.mutateTableStructure(cell, 'deleteRow') : undefined;
		case 'table-insert-col-left':
			return cell ? actions.mutateTableStructure(cell, 'insertColumnLeft') : undefined;
		case 'table-insert-col-right':
			return cell ? actions.mutateTableStructure(cell, 'insertColumnRight') : undefined;
		case 'table-delete-col':
			return cell ? actions.mutateTableStructure(cell, 'deleteColumn') : undefined;
		case 'table-merge-selected':
			return actions.mergeTableCells(deps.store.get().selectedTableCells);
		case 'table-merge-right':
			return cell ? neighbourMerge(actions, cell, 'right') : undefined;
		case 'table-merge-down':
			return cell ? neighbourMerge(actions, cell, 'down') : undefined;
		case 'table-split':
			return cell ? actions.splitTableCell(cell) : undefined;
	}
}

/** "Fix with AI" pins the assistant to the element that was right-clicked. */
function runAiFix(deps: ContextMenuCommandDeps): void {
	const state = deps.store.get();
	const element =
		state.slides[state.currentSlide]?.elements.find(({ id }) => id === state.selectedElementId) ??
		null;
	deps.getAi()?.fixElement(element, state.currentSlide);
}
