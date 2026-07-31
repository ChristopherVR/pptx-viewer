/**
 * Every command the shared menu can render must actually do something here.
 *
 * The Angular menu used to hand-write its items, and the drift that produced
 * was invisible: Edit Hyperlink, Add Comment, Group and Ungroup were simply
 * absent, and the three merge commands rendered on every cell regardless of
 * whether that cell could be merged or split. Nothing threw, no test failed,
 * and only a user right-clicking found out. These tests pin the two halves of
 * the fix: the id -> operation routing (exhaustively, so a command added to
 * shared cannot render as a no-op), and the cell-state rules.
 *
 * All pure: this package has no TestBed (see `vitest.config.ts`).
 *
 * @module angular-viewer/editor-context-menu-dispatch.test
 */

import type { TablePptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { ContextMenuCommandId } from '../internal/shared';
import { buildContextMenuEntries } from '../internal/shared';
import { isMergedTableCell, tableMenuContext } from './editor-context-menu-context';
import type { ContextMenuActions, TableCommandOp } from './editor-context-menu-dispatch';
import { runContextMenuCommand, tableCommandOp } from './editor-context-menu-dispatch';
import type { TableCellSelection } from './table-selection.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** An actions object that records which method the dispatch called. */
function recorder(): { calls: string[]; actions: ContextMenuActions } {
	const calls: string[] = [];
	const note = (name: string) => (): void => {
		calls.push(name);
	};
	return {
		calls,
		actions: {
			copy: note('copy'),
			cut: note('cut'),
			paste: note('paste'),
			duplicate: note('duplicate'),
			bringForward: note('bringForward'),
			sendBackward: note('sendBackward'),
			bringToFront: note('bringToFront'),
			sendToBack: note('sendToBack'),
			askAi: note('askAi'),
			fixAi: note('fixAi'),
			comment: note('comment'),
			hyperlink: note('hyperlink'),
			group: note('group'),
			ungroup: note('ungroup'),
			remove: note('remove'),
			applyTable: (_op: TableCommandOp) => {
				calls.push('applyTable');
			},
		},
	};
}

/** A 3x3 table of "r{row}c{col}" cells. */
function makeTable(): TablePptxElement {
	return {
		type: 'table',
		id: 'tbl-1',
		x: 0,
		y: 0,
		width: 300,
		height: 150,
		tableData: {
			columnWidths: [1 / 3, 1 / 3, 1 / 3],
			rows: [0, 1, 2].map((r) => ({
				cells: [0, 1, 2].map((c) => ({ text: `r${r}c${c}` })),
			})),
		},
	};
}

function selectionAt(rowIndex: number, columnIndex: number): TableCellSelection {
	return { elementId: 'tbl-1', rowIndex, columnIndex };
}

/** The non-table commands, paired with the action each must reach. */
const ELEMENT_ROUTES: [ContextMenuCommandId, string][] = [
	['copy', 'copy'],
	['cut', 'cut'],
	['paste', 'paste'],
	['duplicate', 'duplicate'],
	['bring-forward', 'bringForward'],
	['send-backward', 'sendBackward'],
	['bring-front', 'bringToFront'],
	['send-back', 'sendToBack'],
	['ai-ask', 'askAi'],
	['ai-fix', 'fixAi'],
	['comment', 'comment'],
	['hyperlink', 'hyperlink'],
	['group', 'group'],
	['ungroup', 'ungroup'],
	['delete', 'remove'],
];

// ---------------------------------------------------------------------------
// runContextMenuCommand
// ---------------------------------------------------------------------------

describe('runContextMenuCommand', () => {
	it.each(ELEMENT_ROUTES)('routes %s to the %s operation', (id, expected) => {
		const { calls, actions } = recorder();
		runContextMenuCommand(id, actions);
		expect(calls).toStrictEqual([expected]);
	});

	it('routes every table command through the single table commit path', () => {
		const tableIds = buildContextMenuEntries({
			elementType: 'table',
			table: { hasMultiCellSelection: false, isMergedCell: false },
		})
			.map((entry) => entry.id)
			.filter((id) => id.startsWith('table-'));
		expect(tableIds.length).toBeGreaterThan(4);
		for (const id of tableIds) {
			const { calls, actions } = recorder();
			runContextMenuCommand(id, actions);
			expect(calls).toStrictEqual(['applyTable']);
		}
	});

	/**
	 * The guard that matters: adding a command to the shared list without wiring
	 * it here would render an item that silently does nothing, which is the exact
	 * failure the shared list exists to prevent.
	 */
	it('leaves no command in the shared menu unrouted', () => {
		const everyCommand = new Set<ContextMenuCommandId>([
			...buildContextMenuEntries({
				elementType: 'group',
				table: { hasMultiCellSelection: true, isMergedCell: false },
				hasMultiSelection: true,
				aiEnabled: true,
			}).map((entry) => entry.id),
			...buildContextMenuEntries({
				table: { hasMultiCellSelection: false, isMergedCell: true },
			}).map((entry) => entry.id),
			'table-merge-right',
			'table-merge-down',
		]);
		for (const id of everyCommand) {
			const { calls, actions } = recorder();
			runContextMenuCommand(id, actions);
			expect(calls, `command "${id}" reached no operation`).toHaveLength(1);
		}
	});
});

// ---------------------------------------------------------------------------
// tableCommandOp
// ---------------------------------------------------------------------------

describe('tableCommandOp', () => {
	it('is undefined for element commands', () => {
		expect(tableCommandOp('copy')).toBeUndefined();
		expect(tableCommandOp('group')).toBeUndefined();
	});

	it('inserts a row above the selected cell', () => {
		const op = tableCommandOp('table-insert-row-above');
		const updated = op?.(makeTable(), selectionAt(1, 0));
		expect(updated?.tableData?.rows).toHaveLength(4);
		expect(updated?.tableData?.rows[2]?.cells[0]?.text).toBe('r1c0');
	});

	it('deletes the selected column', () => {
		const op = tableCommandOp('table-delete-col');
		const updated = op?.(makeTable(), selectionAt(0, 1));
		expect(updated?.tableData?.rows[0]?.cells.map((c) => c.text)).toStrictEqual(['r0c0', 'r0c2']);
	});

	it('merges the rectangular selection into its anchor', () => {
		const op = tableCommandOp('table-merge-selected');
		const updated = op?.(makeTable(), {
			...selectionAt(0, 0),
			selectedCells: [
				{ row: 0, col: 0 },
				{ row: 0, col: 1 },
			],
		});
		expect(updated?.tableData?.rows[0]?.cells[0]?.gridSpan).toBe(2);
	});

	it('leaves the table alone when a block merge has no selected cells', () => {
		const op = tableCommandOp('table-merge-selected');
		const table = makeTable();
		expect(op?.(table, selectionAt(0, 0))).toBe(table);
	});
});

// ---------------------------------------------------------------------------
// Cell state
// ---------------------------------------------------------------------------

describe('tableMenuContext', () => {
	it('reports a plain cell as neither merged nor a block selection', () => {
		expect(tableMenuContext(makeTable(), selectionAt(0, 0))).toStrictEqual({
			hasMultiCellSelection: false,
			isMergedCell: false,
		});
	});

	it('reports a cell that already spans as merged, so it can only be split', () => {
		const table = makeTable();
		const merged = tableCommandOp('table-merge-right')?.(table, selectionAt(0, 0));
		expect(isMergedTableCell(merged as TablePptxElement, 0, 0)).toBeTruthy();
		expect(
			tableMenuContext(merged as TablePptxElement, selectionAt(0, 0)).isMergedCell,
		).toBeTruthy();
	});

	it('reports two or more selected cells as a block selection', () => {
		const selection: TableCellSelection = {
			...selectionAt(0, 0),
			selectedCells: [
				{ row: 0, col: 0 },
				{ row: 1, col: 0 },
			],
		};
		expect(tableMenuContext(makeTable(), selection).hasMultiCellSelection).toBeTruthy();
	});

	it('treats a missing cell as unmerged rather than throwing', () => {
		expect(isMergedTableCell(makeTable(), 9, 9)).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// The rendered menu
// ---------------------------------------------------------------------------

describe('the Angular menu contents', () => {
	it('offers the four commands the hand-written menu was missing', () => {
		const ids = buildContextMenuEntries({
			elementType: 'group',
			hasMultiSelection: true,
		}).map((entry) => entry.id);
		expect(ids).toContain('hyperlink');
		expect(ids).toContain('comment');
		expect(ids).toContain('group');
		expect(ids).toContain('ungroup');
	});

	it('offers exactly one merge state per cell', () => {
		const forCell = (table: {
			hasMultiCellSelection: boolean;
			isMergedCell: boolean;
		}): ContextMenuCommandId[] =>
			buildContextMenuEntries({ elementType: 'table', table })
				.map((entry) => entry.id)
				.filter((id) => id.startsWith('table-merge') || id === 'table-split');

		expect(forCell({ hasMultiCellSelection: false, isMergedCell: false })).toStrictEqual([
			'table-merge-right',
			'table-merge-down',
		]);
		expect(forCell({ hasMultiCellSelection: false, isMergedCell: true })).toStrictEqual([
			'table-split',
		]);
		expect(forCell({ hasMultiCellSelection: true, isMergedCell: false })).toStrictEqual([
			'table-merge-selected',
		]);
	});

	it('greys Paste out with an empty clipboard instead of hiding it', () => {
		const paste = buildContextMenuEntries({ hasClipboard: false }).find(
			(entry) => entry.id === 'paste',
		);
		expect(paste?.disabled).toBeTruthy();
	});
});
