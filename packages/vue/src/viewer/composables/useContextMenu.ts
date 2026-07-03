import type { PptxElement, PptxTableData } from 'pptx-viewer-core';
import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';

import type { ContextMenuItem } from '../components/ContextMenu.vue';
import {
	applyDeleteColumn,
	applyDeleteRow,
	applyInsertColumn,
	applyInsertRow,
	applyMergeDown,
	applyMergeRight,
	applyMergeSelected,
	applySplitCell,
} from './table-mutations';
import type { TableSelectionState } from './table-selection';
import { isElementIdInteractive } from './template-editing';
import type { EditorOperations } from './useEditorOperations';

/** Reactive open/position/target state for the element context menu. */
export interface ContextMenuState {
	open: boolean;
	x: number;
	y: number;
	elementId: string | null;
}

export interface UseContextMenuInput {
	canEdit: () => boolean;
	findActiveElement: (id: string) => PptxElement | undefined;
	tableSelection: Ref<TableSelectionState | null>;
	hasClipboard: ComputedRef<boolean>;
	canGroup: ComputedRef<boolean>;
	canUngroup: ComputedRef<boolean>;
	editTemplateMode: Ref<boolean>;
	selectedElementIds: Ref<string[]>;
	ops: EditorOperations;
	cutElement: (id: string) => void;
	copyElement: (id: string) => void;
	pasteElement: () => void;
	onGroup: () => void;
	onUngroup: () => void;
	openHyperlinkDialog: (id: string) => void;
}

export interface UseContextMenuResult {
	contextMenu: Ref<ContextMenuState>;
	contextItems: ComputedRef<ContextMenuItem[]>;
	onCanvasContextMenu: (event: MouseEvent) => void;
	onContextSelect: (actionId: string) => void;
}

/**
 * useContextMenu: right-click / long-press element context menu for the Vue
 * editor. Owns the open/position state, derives the item list (including the
 * table row/column/merge entries gated on the current cell selection), and
 * dispatches each action. Extracted verbatim from `PowerPointViewer.vue`.
 */
export function useContextMenu(input: UseContextMenuInput): UseContextMenuResult {
	const {
		canEdit,
		findActiveElement,
		tableSelection,
		hasClipboard,
		canGroup,
		canUngroup,
		editTemplateMode,
		selectedElementIds,
		ops,
		cutElement,
		copyElement,
		pasteElement,
		onGroup,
		onUngroup,
		openHyperlinkDialog,
	} = input;

	const contextMenu = ref<ContextMenuState>({
		open: false,
		x: 0,
		y: 0,
		elementId: null,
	});
	/**
	 * The table element under the context menu, when it is a table whose selected
	 * cell is known: gates the row/column/merge entries. Mirrors React's ContextMenu
	 * `isTable` / `hasMultiCellSelection` / `isMergedCell` derivation.
	 */
	const contextTable = computed(() => {
		const id = contextMenu.value.elementId;
		const el = id ? findActiveElement(id) : undefined;
		if (!el || el.type !== 'table' || !el.tableData) {
			return null;
		}
		const sel =
			tableSelection.value && tableSelection.value.elementId === el.id
				? tableSelection.value
				: null;
		if (!sel) {
			return null;
		}
		const cell = el.tableData.rows[sel.rowIndex]?.cells[sel.columnIndex];
		const isMerged = Boolean(cell && ((cell.gridSpan ?? 1) > 1 || (cell.rowSpan ?? 1) > 1));
		const hasMulti = Array.isArray(sel.selectedCells) && sel.selectedCells.length >= 2;
		return { el, sel, isMerged, hasMulti };
	});

	const contextItems = computed<ContextMenuItem[]>(() => {
		const items: ContextMenuItem[] = [
			{ id: 'cut', label: 'Cut' },
			{ id: 'copy', label: 'Copy' },
			{ id: 'paste', label: 'Paste', disabled: !hasClipboard.value },
			{ id: 'sep1', label: '', separator: true },
			{ id: 'duplicate', label: 'Duplicate' },
			{ id: 'delete', label: 'Delete' },
			{ id: 'sep2', label: '', separator: true },
			{ id: 'bring-forward', label: 'Bring forward' },
			{ id: 'send-backward', label: 'Send backward' },
			{ id: 'sep3', label: '', separator: true },
			{ id: 'group', label: 'Group', disabled: !canGroup.value },
			{ id: 'ungroup', label: 'Ungroup', disabled: !canUngroup.value },
			{ id: 'sep4', label: '', separator: true },
			{ id: 'hyperlink', label: 'Hyperlink…' },
		];
		const tbl = contextTable.value;
		if (tbl) {
			items.push(
				{ id: 'sep-table', label: '', separator: true },
				{ id: 'table-insert-row-above', label: 'Insert row above' },
				{ id: 'table-insert-row-below', label: 'Insert row below' },
				{ id: 'table-delete-row', label: 'Delete row' },
				{ id: 'table-insert-col-left', label: 'Insert column left' },
				{ id: 'table-insert-col-right', label: 'Insert column right' },
				{ id: 'table-delete-col', label: 'Delete column' },
				{ id: 'sep-table-merge', label: '', separator: true },
			);
			if (tbl.hasMulti) {
				items.push({ id: 'table-merge-selected', label: 'Merge selected cells' });
			} else if (tbl.isMerged) {
				items.push({ id: 'table-split', label: 'Split cell' });
			} else {
				items.push(
					{ id: 'table-merge-right', label: 'Merge cells' },
					{ id: 'table-merge-down', label: 'Merge down' },
				);
			}
		}
		return items;
	});

	/** Apply a table op result (or no-op when null) to the context-menu table. */
	function applyContextTableData(next: PptxTableData | null): void {
		const tbl = contextTable.value;
		if (tbl && next) {
			ops.updateElement(tbl.el.id, { tableData: next } as Partial<PptxElement>);
		}
	}
	function onCanvasContextMenu(event: MouseEvent): void {
		if (!canEdit()) {
			return;
		}
		const host = (event.target as HTMLElement | null)?.closest(
			'[data-element-id]',
		) as HTMLElement | null;
		const id = host?.dataset.elementId;
		// Locked template elements (edit-template mode off) are not actionable.
		if (!id || !isElementIdInteractive(id, editTemplateMode.value)) {
			return;
		}
		event.preventDefault();
		if (!selectedElementIds.value.includes(id)) {
			selectedElementIds.value = [id];
		}
		contextMenu.value = { open: true, x: event.clientX, y: event.clientY, elementId: id };
	}
	function onContextSelect(actionId: string): void {
		const target = contextMenu.value.elementId;
		if (!target) {
			return;
		}
		switch (actionId) {
			case 'cut':
				cutElement(target);
				break;
			case 'copy':
				copyElement(target);
				break;
			case 'paste':
				pasteElement();
				break;
			case 'duplicate':
				ops.duplicateElement(target);
				break;
			case 'delete':
				ops.removeElement(target);
				selectedElementIds.value = selectedElementIds.value.filter((x) => x !== target);
				break;
			case 'bring-forward':
				ops.bringForward(target);
				break;
			case 'send-backward':
				ops.sendBackward(target);
				break;
			case 'group':
				onGroup();
				break;
			case 'ungroup':
				onUngroup();
				break;
			case 'hyperlink':
				openHyperlinkDialog(target);
				break;
			default:
				onContextTableSelect(actionId);
				break;
		}
	}

	/** Handle the table-specific context-menu entries (row / column / merge / split). */
	function onContextTableSelect(actionId: string): void {
		const tbl = contextTable.value;
		if (!tbl) {
			return;
		}
		const td = tbl.el.tableData;
		if (!td) {
			return;
		}
		const { rowIndex, columnIndex } = tbl.sel;
		switch (actionId) {
			case 'table-insert-row-above':
				applyContextTableData(applyInsertRow(td, rowIndex, 'above'));
				break;
			case 'table-insert-row-below':
				applyContextTableData(applyInsertRow(td, rowIndex, 'below'));
				break;
			case 'table-delete-row':
				applyContextTableData(applyDeleteRow(td, rowIndex));
				break;
			case 'table-insert-col-left':
				applyContextTableData(applyInsertColumn(td, columnIndex, 'left'));
				break;
			case 'table-insert-col-right':
				applyContextTableData(applyInsertColumn(td, columnIndex, 'right'));
				break;
			case 'table-delete-col':
				applyContextTableData(applyDeleteColumn(td, columnIndex));
				break;
			case 'table-merge-right':
				applyContextTableData(applyMergeRight(td, rowIndex, columnIndex));
				break;
			case 'table-merge-down':
				applyContextTableData(applyMergeDown(td, rowIndex, columnIndex));
				break;
			case 'table-merge-selected':
				applyContextTableData(applyMergeSelected(td, tbl.sel.selectedCells));
				break;
			case 'table-split':
				applyContextTableData(applySplitCell(td, rowIndex, columnIndex));
				break;
		}
	}

	return { contextMenu, contextItems, onCanvasContextMenu, onContextSelect };
}
