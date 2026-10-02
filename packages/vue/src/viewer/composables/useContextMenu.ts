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
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { ContextMenuItem } from '../components/ContextMenu.vue';
import { saveContextMenuElementAsPicture } from '../export/save-element-as-picture';
import { runContextTableAction } from './context-menu-table-actions';
import type {
	ContextMenuState,
	UseContextMenuInput,
	UseContextMenuResult,
} from './context-menu-types';
import { isElementIdInteractive } from './template-editing';

export type {
	ContextMenuState,
	UseContextMenuInput,
	UseContextMenuResult,
} from './context-menu-types';

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
		const entries = customization
			? customizeContextMenuEntries(built, customization(), {
					slideIndex: input.slideIndex?.() ?? 0,
					elementIds: [...selectedElementIds.value],
				})
			: built;
		return entries.flatMap((entry, index) => {
			const item: ContextMenuItem = {
				id: entry.id,
				label: 'host' in entry ? entry.label : t(entry.labelKey),
				onSelect: 'host' in entry ? entry.onSelect : undefined,
				disabled: entry.disabled,
				danger: entry.danger,
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
