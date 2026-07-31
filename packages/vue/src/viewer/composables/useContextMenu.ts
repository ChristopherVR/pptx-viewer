import type { PptxElement, PptxTableData } from 'pptx-viewer-core';
import {
	buildContextMenuEntries,
	resolveContextMenuElementId,
	resolveTopLevelElementId,
} from 'pptx-viewer-shared';
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
	/**
	 * Two or more elements are selected. Ungroup needs no equivalent flag: the
	 * shared list derives it from the right-clicked element's own type, which is
	 * how React decides it too.
	 */
	canGroup: ComputedRef<boolean>;
	editTemplateMode: Ref<boolean>;
	selectedElementIds: Ref<string[]>;
	/**
	 * The element whose inline text editor is open, if any. The editor is a
	 * sibling overlay rather than a child of the element, so a right-click inside
	 * it hit-tests to nothing; this is what the menu falls back to.
	 */
	inlineEditingElementId: Ref<string | null>;
	ops: EditorOperations;
	cutElement: (id: string) => void;
	copyElement: (id: string) => void;
	pasteElement: () => void;
	onGroup: () => void;
	onUngroup: () => void;
	openHyperlinkDialog: (id: string) => void;
	/** "Add Comment": open the comments panel, as React's menu does. */
	onAddComment?: () => void;
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
		editTemplateMode,
		selectedElementIds,
		inlineEditingElementId,
		ops,
		cutElement,
		copyElement,
		pasteElement,
		onGroup,
		onUngroup,
		openHyperlinkDialog,
		onAddComment,
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
	/** The element the menu was opened on, whatever its type. */
	const contextElement = computed(() => {
		const id = contextMenu.value.elementId;
		return id ? findActiveElement(id) : undefined;
	});
	const contextTable = computed(() => {
		const el = contextElement.value;
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

	/**
	 * The menu, as the shared command list builds it.
	 *
	 * Vue used to hand-write this array and had quietly lost Bring to Front, Send
	 * to Back and Add Comment, while offering Group / Ungroup permanently greyed
	 * on a single shape where React offers neither. The list, its order and its
	 * separators are now decided once, in `pptx-viewer-shared`; this composable
	 * only translates the labels and routes the ids.
	 */
	const contextItems = computed<ContextMenuItem[]>(() => {
		const tbl = contextTable.value;
		const entries = buildContextMenuEntries({
			elementType: contextElement.value?.type ?? null,
			table: tbl ? { hasMultiCellSelection: tbl.hasMulti, isMergedCell: tbl.isMerged } : null,
			hasMultiSelection: canGroup.value,
			aiEnabled: aiEnabled?.(),
			hasClipboard: hasClipboard.value,
		});
		return entries.flatMap((entry, index) => {
			const item: ContextMenuItem = {
				id: entry.id,
				label: t(entry.labelKey),
				disabled: entry.disabled,
			};
			return entry.separatorBefore
				? [{ id: `sep-${index}`, label: '', separator: true }, item]
				: [item];
		});
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
		// Top-level, not innermost: a group nests its children's element nodes
		// inside its own, so a right-click on a grouped child must target the
		// GROUP. Targeting the child id instead matched no top-level element, so
		// the menu fell back to the empty-canvas one and never offered Ungroup.
		const hitId = resolveTopLevelElementId(event.target);
		// A single click on a text box mounts the inline editor, which renders as
		// an overlay beside the elements rather than inside the one it edits. The
		// hit-test above therefore comes back empty for a right-click on the very
		// element the user just picked, so fall back to the element being edited.
		const id = resolveContextMenuElementId(hitId, event.target, inlineEditingElementId.value);
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
			case 'bring-front':
				ops.bringToFront(target);
				break;
			case 'send-back':
				ops.sendToBack(target);
				break;
			case 'comment':
				onAddComment?.();
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
