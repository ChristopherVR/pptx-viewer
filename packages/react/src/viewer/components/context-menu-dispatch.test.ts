/**
 * Regression tests for the context-menu command dispatch.
 *
 * The viewer's `onAction` does not close the menu, so every wired handler must
 * close it itself; an unwrapped entry leaves the invisible backdrop mounted and
 * eating the next click (live-verified with the "comment" entry, suspected for
 * ai-ask/ai-fix and the z-order commands).
 */
import type { TablePptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { contextMenuContext, contextMenuHandlers } from './context-menu-dispatch';
import type { ContextMenuProps } from './context-menu-types';

function makeProps(): ContextMenuProps & { onClose: ReturnType<typeof vi.fn> } {
	const onClose = vi.fn();
	return {
		contextMenuState: { x: 10, y: 10, elementId: 'el-1' },
		mode: 'edit',
		selectedElement: null,
		tableEditorState: null,
		hasMultiSelection: false,
		onAction: vi.fn(),
		onInsertTableRow: vi.fn(),
		onDeleteTableRow: vi.fn(),
		onInsertTableColumn: vi.fn(),
		onDeleteTableColumn: vi.fn(),
		onMergeCellRight: vi.fn(),
		onMergeCellDown: vi.fn(),
		onMergeSelectedCells: vi.fn(),
		onSplitCell: vi.fn(),
		onAskAi: vi.fn(),
		onFixAi: vi.fn(),
		onClose,
	};
}

describe('contextMenuHandlers', () => {
	it('closes the menu after EVERY wired command (no backdrop leak)', () => {
		const props = makeProps();
		const handlers = contextMenuHandlers(props);
		const entries = Object.entries(handlers).filter(
			(pair): pair is [string, () => void] => typeof pair[1] === 'function',
		);
		expect(entries.length).toBeGreaterThan(0);
		for (const [id, run] of entries) {
			props.onClose.mockClear();
			run();
			expect(props.onClose, `command "${id}" must close the menu`).toHaveBeenCalledOnce();
		}
	});

	it('still invokes the underlying action for representative commands', () => {
		const props = makeProps();
		const handlers = contextMenuHandlers(props);
		handlers.comment?.();
		expect(props.onAction).toHaveBeenCalledWith('comment');
		handlers['bring-forward']?.();
		expect(props.onAction).toHaveBeenCalledWith('bring-forward');
		handlers['ai-ask']?.();
		expect(props.onAskAi).toHaveBeenCalledOnce();
		handlers.delete?.();
		expect(props.onAction).toHaveBeenCalledWith('delete');
	});

	it('leaves commands without a handler undefined (offered greyed, not dropped)', () => {
		const props = makeProps();
		props.onAskAi = undefined;
		props.onFixAi = undefined;
		const handlers = contextMenuHandlers(props);
		expect(handlers['ai-ask']).toBeUndefined();
		expect(handlers['ai-fix']).toBeUndefined();
	});
});

describe('merged table cell menu context', () => {
	it('does not count a hidden merge continuation as a second selected cell', () => {
		const props = makeProps();
		props.selectedElement = {
			id: 'table',
			type: 'table',
			x: 0,
			y: 0,
			width: 200,
			height: 50,
			tableData: {
				columnWidths: [0.3, 0.3, 0.4],
				rows: [
					{
						cells: [
							{ text: 'Merged', gridSpan: 2 },
							{ text: '', hMerge: true },
							{ text: 'Neighbor' },
						],
					},
				],
			},
		} satisfies TablePptxElement;
		props.tableEditorState = {
			rowIndex: 0,
			columnIndex: 0,
			selectedCells: [
				{ row: 0, col: 0 },
				{ row: 0, col: 1 },
			],
		};

		expect(contextMenuContext(props).table).toStrictEqual({
			hasMultiCellSelection: false,
			isMergedCell: true,
		});

		props.tableEditorState.selectedCells.push({ row: 0, col: 2 });
		expect(contextMenuContext(props).table).toStrictEqual({
			hasMultiCellSelection: true,
			isMergedCell: true,
		});
	});
});
