/**
 * editor-context-menu-dispatch.ts: routing from a shared context-menu command
 * id to the Angular editor operation that performs it.
 *
 * `pptx-viewer-shared`'s `buildContextMenuEntries` decides WHAT the menu offers;
 * every binding still owns HOW each command runs. Keeping that routing here (a)
 * keeps the component down to its template plus reactive wiring, and (b) makes
 * the routing testable: Angular has no TestBed in this package, so a switch
 * buried inside a component is unreachable from a unit test, while this one can
 * be driven with a recording stub and checked command by command. Every id in
 * `ContextMenuCommandId` must land somewhere: a command that renders but does
 * nothing is exactly the silent gap the shared list was introduced to end.
 *
 * @module angular-viewer/editor-context-menu-dispatch
 */

import type { TablePptxElement } from 'pptx-viewer-core';

import type { ContextMenuCommandId } from '../internal/shared';
import {
	insertColumn,
	insertRow,
	mergeDown,
	mergeRight,
	mergeSelection,
	removeColumn,
	removeRow,
	splitCursorCell,
} from './table-data-helpers';
import type { TableCellSelection } from './table-selection.service';

/** A pure table transform run against the menu's table context. */
export type TableCommandOp = (
	element: TablePptxElement,
	selection: TableCellSelection,
) => TablePptxElement;

/**
 * The table commands, each as a pure transform. They are kept apart from the
 * element commands because they all share one shape (table + cell selection in,
 * new table out) and one commit path in the component.
 */
const TABLE_OPS: Partial<Record<ContextMenuCommandId, TableCommandOp>> = {
	'table-insert-row-above': (el, sel) => insertRow(el, sel.rowIndex, 'above'),
	'table-insert-row-below': (el, sel) => insertRow(el, sel.rowIndex, 'below'),
	'table-delete-row': (el, sel) => removeRow(el, sel.rowIndex),
	'table-insert-col-left': (el, sel) => insertColumn(el, sel.columnIndex, 'left'),
	'table-insert-col-right': (el, sel) => insertColumn(el, sel.columnIndex, 'right'),
	'table-delete-col': (el, sel) => removeColumn(el, sel.columnIndex),
	'table-merge-selected': (el, sel) =>
		sel.selectedCells ? mergeSelection(el, sel.selectedCells) : el,
	'table-merge-right': (el, sel) => mergeRight(el, sel.rowIndex, sel.columnIndex),
	'table-merge-down': (el, sel) => mergeDown(el, sel.rowIndex, sel.columnIndex),
	'table-split': (el, sel) => splitCursorCell(el, sel.rowIndex, sel.columnIndex),
};

/** The transform for a table command, or undefined for a non-table command. */
export function tableCommandOp(id: ContextMenuCommandId): TableCommandOp | undefined {
	return TABLE_OPS[id];
}

/**
 * Everything the menu can ask the viewer to do. The component supplies these as
 * thin closures over `EditorStateService` and its own outputs, so this module
 * never needs to know about slide indexes, history, or dialogs.
 */
export interface ContextMenuActions {
	copy(): void;
	cut(): void;
	paste(): void;
	duplicate(): void;
	bringForward(): void;
	sendBackward(): void;
	bringToFront(): void;
	sendToBack(): void;
	askAi(): void;
	fixAi(): void;
	/** Open the comments panel, the way "Add Comment" does in React. */
	comment(): void;
	/** Open the hyperlink dialog for the selected element. */
	hyperlink(): void;
	group(): void;
	ungroup(): void;
	remove(): void;
	/** Commit a table transform against the current cell selection. */
	applyTable(op: TableCommandOp): void;
}

/**
 * Run `id` against `actions`. Unknown ids cannot occur (the id type is closed),
 * but an id added to shared and not routed here would fall through silently, so
 * the switch is exhaustive over the non-table commands by construction.
 */
export function runContextMenuCommand(id: ContextMenuCommandId, actions: ContextMenuActions): void {
	const tableOp = TABLE_OPS[id];
	if (tableOp) {
		actions.applyTable(tableOp);
		return;
	}
	switch (id) {
		case 'copy':
			actions.copy();
			break;
		case 'cut':
			actions.cut();
			break;
		case 'paste':
			actions.paste();
			break;
		case 'duplicate':
			actions.duplicate();
			break;
		case 'bring-forward':
			actions.bringForward();
			break;
		case 'send-backward':
			actions.sendBackward();
			break;
		case 'bring-front':
			actions.bringToFront();
			break;
		case 'send-back':
			actions.sendToBack();
			break;
		case 'ai-ask':
			actions.askAi();
			break;
		case 'ai-fix':
			actions.fixAi();
			break;
		case 'comment':
			actions.comment();
			break;
		case 'hyperlink':
			actions.hyperlink();
			break;
		case 'group':
			actions.group();
			break;
		case 'ungroup':
			actions.ungroup();
			break;
		case 'delete':
			actions.remove();
			break;
		default:
			break;
	}
}
