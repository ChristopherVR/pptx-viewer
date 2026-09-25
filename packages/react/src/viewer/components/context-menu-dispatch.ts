import type { TablePptxElement } from 'pptx-viewer-core';
import type { ContextMenuCommandId, ContextMenuContext } from 'pptx-viewer-shared';
import {
	canCropElement,
	hasMultipleSelectedTableCells,
	MERGE_SHAPES_MENU_ITEMS,
} from 'pptx-viewer-shared';

import type { ContextMenuProps } from './context-menu-types';
import type { ShapeFormatCommands } from './shape-format-context';

/**
 * What each context-menu command does in React, and what the menu should offer.
 *
 * Kept beside the component rather than inside it so the view stays a list
 * render: the entries themselves come from `pptx-viewer-shared`, which is what
 * stops the five bindings' menus drifting apart again, and this module is only
 * the React-side wiring from a command id to the handler the viewer passed in.
 */

/** A command with no handler is offered but greyed, never silently missing. */
export type ContextMenuHandlers = Partial<Record<ContextMenuCommandId, () => void>>;

/** True when the menu was opened on a table cell whose position is known. */
function tableCell(props: ContextMenuProps): ContextMenuContext['table'] {
	const { selectedElement, tableEditorState } = props;
	if (selectedElement?.type !== 'table' || tableEditorState === null) {
		return null;
	}
	const tableData = (selectedElement as TablePptxElement).tableData;
	const cell = tableData?.rows[tableEditorState.rowIndex]?.cells[tableEditorState.columnIndex];
	return {
		hasMultiCellSelection: hasMultipleSelectedTableCells(tableEditorState.selectedCells, tableData),
		isMergedCell: Boolean(cell && ((cell.gridSpan ?? 1) > 1 || (cell.rowSpan ?? 1) > 1)),
	};
}

/** The state the shared builder needs to decide what this menu contains. */
export function contextMenuContext(
	props: ContextMenuProps,
	shapeFormat: ShapeFormatCommands | null = null,
): ContextMenuContext {
	return {
		elementType: props.selectedElement?.type ?? null,
		table: tableCell(props),
		hasMultiSelection: Boolean(props.hasMultiSelection),
		selectionGroupable: props.selectionGroupable,
		hasClipboard: props.hasClipboard,
		editPoints: props.editPointsAvailability,
		// Both AI entries appear together or not at all, so a viewer that wired
		// only one of them does not produce a menu the other bindings cannot match.
		aiEnabled: Boolean(props.onAskAi) && Boolean(props.onFixAi),
		canMergeShapes: Boolean(shapeFormat?.canMergeShapes),
		canCrop: canCropElement(props.selectedElement),
	};
}

/** Merge Shapes and Crop entries, routed to the viewer's shape-format commands. */
function shapeFormatHandlers(
	shapeFormat: ShapeFormatCommands | null,
	andClose: (run: (() => void) | undefined) => (() => void) | undefined,
): ContextMenuHandlers {
	if (!shapeFormat) {
		return {};
	}
	const handlers: ContextMenuHandlers = { crop: andClose(shapeFormat.crop.enter) };
	for (const item of MERGE_SHAPES_MENU_ITEMS) {
		handlers[item.commandId] = andClose(() => shapeFormat.mergeShapes(item.operation));
	}
	return handlers;
}

/**
 * Command id to handler.
 *
 * EVERY entry closes the menu after running. The viewer's `onAction` does not
 * close it, and the other four bindings' menus all close on command, so an
 * unwrapped entry here left the invisible full-screen backdrop mounted and
 * eating the next click (live-verified with the "comment" entry).
 */
export function contextMenuHandlers(
	props: ContextMenuProps,
	shapeFormat: ShapeFormatCommands | null = null,
): ContextMenuHandlers {
	const { onAction, onClose } = props;
	const andClose = (run: (() => void) | undefined): (() => void) | undefined =>
		run &&
		(() => {
			run();
			onClose();
		});
	return {
		copy: andClose(() => onAction('copy')),
		cut: andClose(() => onAction('cut')),
		paste: andClose(() => onAction('paste')),
		duplicate: andClose(() => onAction('duplicate')),
		'bring-forward': andClose(() => onAction('bring-forward')),
		'send-backward': andClose(() => onAction('send-backward')),
		'bring-front': andClose(() => onAction('bring-front')),
		'send-back': andClose(() => onAction('send-back')),
		'ai-ask': andClose(props.onAskAi),
		'ai-fix': andClose(props.onFixAi),
		comment: andClose(() => onAction('comment')),
		hyperlink: andClose(() => onAction('editHyperlink')),
		'table-insert-row-above': andClose(() => props.onInsertTableRow('above')),
		'table-insert-row-below': andClose(() => props.onInsertTableRow('below')),
		'table-delete-row': andClose(props.onDeleteTableRow),
		'table-insert-col-left': andClose(() => props.onInsertTableColumn('left')),
		'table-insert-col-right': andClose(() => props.onInsertTableColumn('right')),
		'table-delete-col': andClose(props.onDeleteTableColumn),
		'table-merge-selected': andClose(props.onMergeSelectedCells),
		'table-merge-right': andClose(props.onMergeCellRight),
		'table-merge-down': andClose(props.onMergeCellDown),
		'table-split': andClose(props.onSplitCell),
		group: andClose(() => onAction('group')),
		ungroup: andClose(() => onAction('ungroup')),
		'edit-text': andClose(() => onAction('edit-text')),
		'edit-points': andClose(() => onAction('edit-points')),
		'save-as-picture': andClose(() => onAction('save-as-picture')),
		'edit-alt-text': andClose(() => onAction('edit-alt-text')),
		'size-and-position': andClose(() => onAction('size-and-position')),
		'format-shape': andClose(() => onAction('format-shape')),
		delete: andClose(() => onAction('delete')),
		...shapeFormatHandlers(shapeFormat, andClose),
	};
}
