import type { PptxElement } from 'pptx-viewer-core';
import {
	buildContextMenuEntries,
	canCropElement,
	contextMenuInspectorAnchor,
	customizeContextMenuEntries,
	hasMultipleSelectedTableCells,
	mergeOperationForCommand,
	resolveContextMenuElementId,
	resolveEditPointsAvailability,
	resolveTopLevelElementId,
	scrollInspectorSectionIntoView,
} from 'pptx-viewer-shared';
import type { ResolvedCustomization } from 'pptx-viewer-shared';
import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { ContextMenuItem } from '../components/ContextMenu.vue';
import { saveContextMenuElementAsPicture } from '../export/save-element-as-picture';
import { runContextTableAction } from './context-menu-table-actions';
import type { MergeCropController } from './merge-crop-context';
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
	/** Lock-only half of Group/Ungroup gating (`a:spLocks`/`a:grpSpLocks` `@noGrp`); disables, not hides. */
	selectionGroupable: ComputedRef<boolean>;
	editTemplateMode: Ref<boolean>;
	selectedElementIds: Ref<string[]>;
	/**
	 * The element whose inline text editor is open, if any. The editor is a
	 * sibling overlay rather than a child of the element, so a right-click inside
	 * it hit-tests to nothing; this is what the menu falls back to.
	 */
	inlineEditingElementId: Ref<string | null>;
	/** Whether the properties inspector is open; the format-object trio opens it. */
	inspectorOpen: Ref<boolean>;
	/** "Edit Text": the same effect as double-clicking the element. */
	enterInlineEdit: (id: string) => void;
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
	/**
	 * Right-click landed on empty canvas (no interactive element under the
	 * cursor). Wired to `useCanvasContextMenu`'s opener; when omitted the
	 * click is left unhandled (browser's own menu), matching the old behaviour.
	 */
	onEmptyCanvasContextMenu?: (x: number, y: number) => void;
	/** The host's resolved UI customisation (hidden commands / disabled menu). */
	customization?: () => ResolvedCustomization;
	/** "Edit Points": offered (per the shared lock / type rules) only when wired. */
	onEditPoints?: (element: PptxElement) => void;
	/** Merge Shapes + picture Crop (the `merge-*` and `crop` entries). */
	mergeCrop?: MergeCropController;
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
		selectionGroupable,
		editTemplateMode,
		selectedElementIds,
		inlineEditingElementId,
		inspectorOpen,
		enterInlineEdit,
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
		onEmptyCanvasContextMenu,
		customization,
		onEditPoints,
		mergeCrop,
	} = input;

	const contextMenu = ref<ContextMenuState>({
		open: false,
		x: 0,
		y: 0,
		elementId: null,
	});
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
		const hasMulti = hasMultipleSelectedTableCells(sel.selectedCells, el.tableData);
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
		const built = buildContextMenuEntries({
			elementType: contextElement.value?.type ?? null,
			table: tbl ? { hasMultiCellSelection: tbl.hasMulti, isMergedCell: tbl.isMerged } : null,
			hasMultiSelection: canGroup.value,
			selectionGroupable: selectionGroupable.value,
			aiEnabled: aiEnabled?.(),
			hasClipboard: hasClipboard.value,
			editPoints: onEditPoints ? resolveEditPointsAvailability(contextElement.value) : undefined,
			canMergeShapes: mergeCrop?.canMerge.value,
			canCrop: canCropElement(contextElement.value),
		});
		const entries = customization ? customizeContextMenuEntries(built, customization()) : built;
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
		if (!id) {
			// Empty canvas: offer Paste/Layout/Reset/Format Background/Grid/Ruler
			// instead of leaving this a no-op (the browser's own menu used to win).
			if (onEmptyCanvasContextMenu) {
				event.preventDefault();
				onEmptyCanvasContextMenu(event.clientX, event.clientY);
			}
			return;
		}
		// Locked template elements (edit-template mode off) are not actionable.
		if (!isElementIdInteractive(id, editTemplateMode.value)) {
			return;
		}
		event.preventDefault();
		if (!selectedElementIds.value.includes(id)) {
			selectedElementIds.value = [id];
		}
		contextMenu.value = { open: true, x: event.clientX, y: event.clientY, elementId: id };
		// The host removed every entry (or the whole menu): render nothing.
		if (contextItems.value.length === 0) {
			contextMenu.value = { ...contextMenu.value, open: false };
		}
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
			case 'edit-text':
				enterInlineEdit(target);
				break;
			case 'edit-points':
				if (contextElement.value) {
					onEditPoints?.(contextElement.value);
				}
				break;
			case 'save-as-picture':
				void saveContextMenuElementAsPicture(
					target,
					contextElement.value?.name,
					t('pptx.elementType.picture'),
				);
				break;
			case 'edit-alt-text':
				focusInspectorSection(contextMenuInspectorAnchor('edit-alt-text'));
				break;
			case 'size-and-position':
				focusInspectorSection(contextMenuInspectorAnchor('size-and-position'));
				break;
			case 'format-shape':
				focusInspectorSection(contextMenuInspectorAnchor('format-shape'));
				break;
			case 'crop':
				mergeCrop?.enterCrop(target);
				break;
			default: {
				const op = mergeOperationForCommand(actionId);
				if (op) {
					mergeCrop?.merge(op);
				} else {
					runContextTableAction(actionId, contextTable.value, ops);
				}
				break;
			}
		}
	}

	/**
	 * "Edit Alt Text" / "Size and Position" / "Format Shape": open the
	 * properties inspector and, once it has re-rendered, scroll the matching
	 * section into view. A no-op degrade when the section is not tagged.
	 */
	function focusInspectorSection(anchor: ReturnType<typeof contextMenuInspectorAnchor>): void {
		inspectorOpen.value = true;
		if (!anchor) {
			return;
		}
		requestAnimationFrame(() => {
			requestAnimationFrame(() => scrollInspectorSectionIntoView(document, anchor));
		});
	}

	return { contextMenu, contextItems, onCanvasContextMenu, onContextSelect };
}
