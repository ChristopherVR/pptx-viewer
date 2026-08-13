import type { PptxElement, PptxTableData } from 'pptx-viewer-core';
import type { CellCoord, ContextMenuCommandId, ContextMenuEntry } from 'pptx-viewer-shared';
import {
	buildContextMenuEntries,
	canMergeCells,
	computeMergeCellDown,
	computeMergeCellRight,
	computeSplitCell,
	deleteTableColumn,
	deleteTableRow,
	insertTableColumn,
	insertTableRow,
	mergeCells,
} from 'pptx-viewer-shared';

import type { EditorState } from './editor-state.svelte';

/**
 * What the canvas context menu offers, and what each command does.
 *
 * The item list is deliberately NOT decided here: `buildContextMenuEntries` in
 * `pptx-viewer-shared` owns the command ids, labels, order and separators for
 * all five bindings, so a command added there appears in all five at once. This
 * module only supplies the context (what is selected, which table cell was
 * right-clicked) and routes the chosen id at the editor's existing operations.
 * Svelte's menu used to hand-write its own items, which is exactly how it ended
 * up shipping without Group, Ungroup, Add Comment, Edit Hyperlink, or a single
 * table command.
 *
 * It lives in a plain `.ts` module rather than inside `ElementContextMenu.svelte`
 * so the SFC stays thin presentation (repo convention) and so the dispatch is
 * unit-testable without mounting a component.
 *
 * @module editor/context-menu-dispatch
 */

/** The table cell a right-click landed on, in model (unmerged) coordinates. */
export interface ContextMenuCellTarget {
	rowIndex: number;
	columnIndex: number;
}

/** Everything the menu needs to decide its items and to run one. */
export interface ContextMenuDispatchDeps {
	editor: EditorState;
	/** The right-clicked table cell, or null when the click was not in one. */
	cell?: ContextMenuCellTarget | null;
	/** "Ask AI about this"; presence of either AI callback enables the AI block. */
	onAskAi?: () => void;
	onFixAi?: () => void;
	/** Open the inspector's Comments tab (React's `case 'comment'`). */
	onComment?: () => void;
	/** Open the hyperlink dialog for the selected element. */
	onHyperlink?: () => void;
}

/**
 * `data-*` attributes `TableView` stamps on every rendered `<td>`.
 *
 * The right-clicked cell is read back off the DOM rather than from a stored
 * cursor: merge-absorbed cells are not rendered, so a cell's DOM position is
 * not its model position and only these attributes carry the truth. The block
 * range the user marquee'd lives separately, on `EditorState.tableCells`, and
 * targets only the block merge.
 */
const CELL_ROW_ATTR = 'data-cell-row';
const CELL_COLUMN_ATTR = 'data-cell-col';

/** The table cell under `target`, or null when `target` is not inside one. */
export function readTableCellTarget(target: EventTarget | null): ContextMenuCellTarget | null {
	if (!(target instanceof Element)) {
		return null;
	}
	const cell = target.closest(`[${CELL_ROW_ATTR}][${CELL_COLUMN_ATTR}]`);
	if (!cell) {
		return null;
	}
	const rowIndex = Number(cell.getAttribute(CELL_ROW_ATTR));
	const columnIndex = Number(cell.getAttribute(CELL_COLUMN_ATTR));
	return Number.isInteger(rowIndex) && Number.isInteger(columnIndex)
		? { rowIndex, columnIndex }
		: null;
}

/** The selected element's table model, or undefined when it is not a table. */
function selectedTableData(editor: EditorState): PptxTableData | undefined {
	const element = editor.selectedElement;
	return element?.type === 'table' ? element.tableData : undefined;
}

/** True when the targeted cell already spans, so it splits rather than merges. */
function isMergedCell(tableData: PptxTableData, cell: ContextMenuCellTarget): boolean {
	const target = tableData.rows[cell.rowIndex]?.cells[cell.columnIndex];
	if (!target) {
		return false;
	}
	return (target.gridSpan ?? 1) > 1 || (target.rowSpan ?? 1) > 1;
}

/** The menu for what is currently selected and right-clicked. */
export function buildEditorContextMenuEntries(deps: ContextMenuDispatchDeps): ContextMenuEntry[] {
	const { editor, cell = null } = deps;
	const tableData = selectedTableData(editor);
	// The real cell range, not a hard-coded `false`. Svelte used to pass the
	// literal, so PowerPoint's "Merge Cells" was unreachable in this binding and
	// a block of cells could never be merged however the user selected it.
	const selectedCells = editor.tableCells.cellsFor(editor.selectedElement?.id);
	return buildContextMenuEntries({
		elementType: editor.selectedElement?.type ?? null,
		// With a block selected the menu offers the block merge; with a single
		// cell it offers the two pairwise merges, or Split when it already spans.
		table:
			tableData && cell
				? {
						hasMultiCellSelection: selectedCells.length > 1,
						isMergedCell: isMergedCell(tableData, cell),
					}
				: null,
		hasMultiSelection: editor.selection.ids.length >= 2,
		aiEnabled: Boolean(deps.onAskAi ?? deps.onFixAi),
		// The editor tracks its own clipboard, so Paste can honestly grey out
		// instead of being offered and silently doing nothing.
		hasClipboard: editor.hasClipboard,
	});
}

/** The table model a command produces, or null when it is a no-op. */
function computeTableCommand(
	id: ContextMenuCommandId,
	tableData: PptxTableData,
	cell: ContextMenuCellTarget,
	selectedCells: readonly CellCoord[] = [],
): PptxTableData | null {
	const { rowIndex, columnIndex } = cell;
	switch (id) {
		case 'table-insert-row-above':
			return insertTableRow(tableData, rowIndex, 'above');
		case 'table-insert-row-below':
			return insertTableRow(tableData, rowIndex, 'below');
		case 'table-delete-row': {
			const next = deleteTableRow(tableData, rowIndex);
			return next === tableData ? null : next;
		}
		case 'table-insert-col-left':
			return insertTableColumn(tableData, columnIndex, 'left');
		case 'table-insert-col-right':
			return insertTableColumn(tableData, columnIndex, 'right');
		case 'table-delete-col': {
			const next = deleteTableColumn(tableData, columnIndex);
			return next === tableData ? null : next;
		}
		case 'table-merge-right': {
			const rows = computeMergeCellRight(tableData, rowIndex, columnIndex);
			return rows ? { ...tableData, rows } : null;
		}
		case 'table-merge-down': {
			const rows = computeMergeCellDown(tableData, rowIndex, columnIndex);
			return rows ? { ...tableData, rows } : null;
		}
		case 'table-split': {
			const rows = computeSplitCell(tableData, rowIndex, columnIndex);
			return rows ? { ...tableData, rows } : null;
		}
		case 'table-merge-selected': {
			// The block merge over the canvas cell range. `canMergeCells` is the
			// guard (it expands the rect over any spans it meets, so a range that
			// only looks 1x1 because a merged cell fills it is still mergeable),
			// and `mergeCells` produces the new model; neither is re-implemented
			// here.
			const cells = [...selectedCells];
			if (!canMergeCells(cells, tableData)) {
				return null;
			}
			const next = mergeCells(cells, tableData);
			return next === tableData ? null : next;
		}
		default:
			return null;
	}
}

/** Apply a table command to the selected table as one undoable step. */
function runTableCommand(id: ContextMenuCommandId, deps: ContextMenuDispatchDeps): void {
	const element = deps.editor.selectedElement;
	const tableData = selectedTableData(deps.editor);
	const cell = deps.cell;
	if (!element || !tableData || !cell) {
		return;
	}
	const next = computeTableCommand(
		id,
		tableData,
		cell,
		deps.editor.tableCells.cellsFor(element.id),
	);
	if (next) {
		deps.editor.applyElementPatch(element.id, { tableData: next } as Partial<PptxElement>);
		// The merged block is one cell now, so the range that produced it no
		// longer describes anything the user can see.
		deps.editor.tableCells.clear();
	}
}

/** Route a chosen command id at the editor. Closing the menu is the caller's job. */
export function runContextMenuCommand(
	id: ContextMenuCommandId,
	deps: ContextMenuDispatchDeps,
): void {
	const { editor } = deps;
	switch (id) {
		case 'copy':
			editor.clipboardOps.copySelected();
			return;
		case 'cut':
			editor.clipboardOps.cutSelected();
			return;
		case 'paste':
			editor.clipboardOps.pasteClipboard();
			return;
		case 'duplicate':
			editor.duplicateSelected();
			return;
		case 'bring-forward':
			editor.reorderSelected('forward');
			return;
		case 'send-backward':
			editor.reorderSelected('backward');
			return;
		case 'bring-front':
			editor.reorderSelected('front');
			return;
		case 'send-back':
			editor.reorderSelected('back');
			return;
		case 'ai-ask':
			deps.onAskAi?.();
			return;
		case 'ai-fix':
			deps.onFixAi?.();
			return;
		case 'comment':
			deps.onComment?.();
			return;
		case 'hyperlink':
			deps.onHyperlink?.();
			return;
		case 'group':
			editor.arrangeOps.groupSelected();
			return;
		case 'ungroup':
			editor.arrangeOps.ungroupSelected();
			return;
		case 'delete':
			editor.deleteSelected();
			return;
		default:
			runTableCommand(id, deps);
	}
}
