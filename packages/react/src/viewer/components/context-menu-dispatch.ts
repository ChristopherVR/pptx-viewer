import type { TablePptxElement } from 'pptx-viewer-core';
import type { ContextMenuCommandId, ContextMenuContext } from 'pptx-viewer-shared';

import type { ContextMenuProps } from './context-menu-types';

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
	const rows = (selectedElement as TablePptxElement).tableData?.rows;
	const cell = rows?.[tableEditorState.rowIndex]?.cells[tableEditorState.columnIndex];
	return {
		hasMultiCellSelection:
			Array.isArray(tableEditorState.selectedCells) && tableEditorState.selectedCells.length >= 2,
		isMergedCell: Boolean(cell && ((cell.gridSpan ?? 1) > 1 || (cell.rowSpan ?? 1) > 1)),
	};
}

/** The state the shared builder needs to decide what this menu contains. */
export function contextMenuContext(props: ContextMenuProps): ContextMenuContext {
	return {
		elementType: props.selectedElement?.type ?? null,
		table: tableCell(props),
		hasMultiSelection: Boolean(props.hasMultiSelection),
		// Both AI entries appear together or not at all, so a viewer that wired
		// only one of them does not produce a menu the other bindings cannot match.
		aiEnabled: Boolean(props.onAskAi) && Boolean(props.onFixAi),
	};
}

/**
 * Command id to handler.
 *
 * The entries that mutate structure (hyperlink, table, group) close the menu
 * because they open a dialog or reshape what is under it; the plain ones leave
 * it to the viewer, which is the behaviour React shipped with.
 */
export function contextMenuHandlers(props: ContextMenuProps): ContextMenuHandlers {
	const { onAction, onClose } = props;
	const andClose = (run: (() => void) | undefined): (() => void) | undefined =>
		run &&
		(() => {
			run();
			onClose();
		});
	return {
		copy: () => onAction('copy'),
		cut: () => onAction('cut'),
		paste: () => onAction('paste'),
		duplicate: () => onAction('duplicate'),
		'bring-forward': () => onAction('bring-forward'),
		'send-backward': () => onAction('send-backward'),
		'bring-front': () => onAction('bring-front'),
		'send-back': () => onAction('send-back'),
		'ai-ask': props.onAskAi,
		'ai-fix': props.onFixAi,
		comment: () => onAction('comment'),
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
		delete: () => onAction('delete'),
	};
}
