import type { PptxElement, PptxTableData } from 'pptx-viewer-core';
import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import { useI18n } from 'vue-i18n';

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
	/** Whether the AI assistant is enabled (adds the "Ask AI" / "Fix with AI" entries). */
	aiEnabled?: () => boolean;
	/** Open the AI panel scoped to the current element (empty composer). */
	onAskAi?: () => void;
	/** Open the AI panel with a prefilled "fix this element" directive (not sent). */
	onFixAi?: () => void;
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
	const { t } = useI18n();
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
		aiEnabled,
		onAskAi,
		onFixAi,
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
			{ id: 'cut', label: t('pptx.contextMenu.cut') },
			{ id: 'copy', label: t('pptx.contextMenu.copy') },
			{ id: 'paste', label: t('pptx.contextMenu.paste'), disabled: !hasClipboard.value },
			{ id: 'sep1', label: '', separator: true },
			{ id: 'duplicate', label: t('pptx.contextMenu.duplicate') },
			{ id: 'delete', label: t('pptx.contextMenu.delete') },
			{ id: 'sep2', label: '', separator: true },
			{ id: 'bring-forward', label: t('pptx.contextMenu.bringForward') },
			{ id: 'send-backward', label: t('pptx.contextMenu.sendBackward') },
			{ id: 'sep3', label: '', separator: true },
			{ id: 'group', label: t('pptx.contextMenu.group'), disabled: !canGroup.value },
			{ id: 'ungroup', label: t('pptx.contextMenu.ungroup'), disabled: !canUngroup.value },
			{ id: 'sep4', label: '', separator: true },
			{ id: 'hyperlink', label: t('pptx.contextMenu.editHyperlink') },
		];
		// AI assistant affordances (only when the host enabled the `ai` prop).
		if (aiEnabled?.()) {
			items.push(
				{ id: 'sep-ai', label: '', separator: true },
				{ id: 'ai-ask', label: t('pptx.ai.askAboutElement') },
				{ id: 'ai-fix', label: t('pptx.ai.fixElement') },
			);
		}
		const tbl = contextTable.value;
		if (tbl) {
			items.push(
				{ id: 'sep-table', label: '', separator: true },
				{ id: 'table-insert-row-above', label: t('pptx.contextMenu.insertRowAbove') },
				{ id: 'table-insert-row-below', label: t('pptx.contextMenu.insertRowBelow') },
				{ id: 'table-delete-row', label: t('pptx.contextMenu.deleteRow') },
				{ id: 'table-insert-col-left', label: t('pptx.contextMenu.insertColumnLeft') },
				{ id: 'table-insert-col-right', label: t('pptx.contextMenu.insertColumnRight') },
				{ id: 'table-delete-col', label: t('pptx.contextMenu.deleteColumn') },
				{ id: 'sep-table-merge', label: '', separator: true },
			);
			if (tbl.hasMulti) {
				items.push({
					id: 'table-merge-selected',
					label: t('pptx.contextMenu.mergeSelectedCells'),
				});
			} else if (tbl.isMerged) {
				items.push({ id: 'table-split', label: t('pptx.contextMenu.splitCell') });
			} else {
				items.push(
					{ id: 'table-merge-right', label: t('pptx.contextMenu.mergeCells') },
					{ id: 'table-merge-down', label: t('pptx.table.mergeDown') },
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
			case 'ai-ask':
				onAskAi?.();
				break;
			case 'ai-fix':
				onFixAi?.();
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
