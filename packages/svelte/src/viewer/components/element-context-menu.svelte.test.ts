import type { PptxElement, PptxTableData } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ContextMenuCellTarget } from '../editor/context-menu-dispatch';
import type { EditorState } from '../editor/editor-state.svelte';
import ElementContextMenu from './ElementContextMenu.svelte';

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

interface EditorStub {
	selectedElement?: PptxElement;
	selectionIds?: string[];
	hasClipboard?: boolean;
}

function createEditor(stub: EditorStub = {}): EditorState {
	return {
		clipboardOps: {
			copySelected: vi.fn(),
			cutSelected: vi.fn(),
			pasteClipboard: vi.fn(),
		},
		arrangeOps: {
			groupSelected: vi.fn(),
			ungroupSelected: vi.fn(),
		},
		duplicateSelected: vi.fn(),
		reorderSelected: vi.fn(),
		deleteSelected: vi.fn(),
		applyElementPatch: vi.fn(),
		selection: { ids: stub.selectionIds ?? [] },
		selectedElement: stub.selectedElement,
		hasClipboard: stub.hasClipboard ?? true,
	} as unknown as EditorState;
}

/** A 2x2 table element, the shape the row / column / merge commands act on. */
function tableElement(tableData?: Partial<PptxTableData>): PptxElement {
	return {
		id: 'table-1',
		type: 'table',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		tableData: {
			columnWidths: [0.5, 0.5],
			rows: [{ cells: [{ text: 'a' }, { text: 'b' }] }, { cells: [{ text: 'c' }, { text: 'd' }] }],
			...tableData,
		},
	} as unknown as PptxElement;
}

interface MenuOptions {
	onclose?: () => void;
	cell?: ContextMenuCellTarget | null;
	oncomment?: () => void;
	onhyperlink?: () => void;
	onaskai?: () => void;
}

function mountMenu(editor: EditorState, options: MenuOptions = {}): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ElementContextMenu, {
		target,
		props: { x: 24, y: 40, editor, onclose: options.onclose ?? vi.fn(), ...options },
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

function itemsOf(target: HTMLElement): HTMLButtonElement[] {
	return Array.from(target.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
}

function labelsOf(target: HTMLElement): string[] {
	return itemsOf(target).map((item) => (item.textContent ?? '').trim());
}

function clickLabel(target: HTMLElement, label: string): void {
	const item = itemsOf(target).find((candidate) => (candidate.textContent ?? '').trim() === label);
	expect(item, `no "${label}" entry in [${labelsOf(target).join(', ')}]`).toBeTruthy();
	item?.click();
}

describe('elementContextMenu', () => {
	it('routes duplication and z-order actions to the selected editor element', () => {
		const editor = createEditor();
		const target = mountMenu(editor);
		const items = itemsOf(target);

		items[3].click();
		items[4].click();
		items[7].click();

		expect(editor.duplicateSelected).toHaveBeenCalledOnce();
		expect(editor.reorderSelected).toHaveBeenNthCalledWith(1, 'forward');
		expect(editor.reorderSelected).toHaveBeenNthCalledWith(2, 'back');
	});

	/**
	 * The menu carried `aria-label="Slide"` (it borrowed the canvas's label), so
	 * a screen reader announced the context menu as the slide itself, and it
	 * omitted the neutral `data-pptx-context-menu` marker the other bindings use.
	 */
	it('names itself as a context menu and carries the neutral marker', () => {
		const target = mountMenu(createEditor());
		const menu = target.querySelector<HTMLElement>('[data-pptx-context-menu="true"]');

		expect(menu).not.toBeNull();
		expect(menu?.getAttribute('role')).toBe('menu');
		expect(menu?.getAttribute('aria-label')).toBe('Context menu');
	});

	it('closes on Escape and routes clipboard commands', () => {
		const editor = createEditor();
		const onclose = vi.fn();
		const target = mountMenu(editor, { onclose });
		const items = itemsOf(target);

		items[0].click();
		items[1].click();
		items[2].click();
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

		expect(editor.clipboardOps.copySelected).toHaveBeenCalledOnce();
		expect(editor.clipboardOps.cutSelected).toHaveBeenCalledOnce();
		expect(editor.clipboardOps.pasteClipboard).toHaveBeenCalledOnce();
		expect(onclose).toHaveBeenCalledTimes(4);
	});

	/** Paste is offered but unusable with nothing copied, not silently inert. */
	it('greys Paste out while the editor clipboard is empty', () => {
		const target = mountMenu(createEditor({ hasClipboard: false }));

		expect(itemsOf(target)[2].disabled).toBeTruthy();
	});

	/**
	 * The hand-written menu offered neither, so a Svelte user had no way to
	 * reach the hyperlink dialog or the comments pane from the canvas.
	 */
	it('offers Add Comment and Edit Hyperlink, and routes them to the host', () => {
		const oncomment = vi.fn();
		const onhyperlink = vi.fn();
		const target = mountMenu(createEditor(), { oncomment, onhyperlink });

		clickLabel(target, 'Add Comment');
		clickLabel(target, 'Edit Hyperlink');

		expect(oncomment).toHaveBeenCalledOnce();
		expect(onhyperlink).toHaveBeenCalledOnce();
	});

	it('offers Group only on a multi-selection and routes it to the arrange ops', () => {
		const single = mountMenu(createEditor());
		expect(labelsOf(single)).not.toContain('Group');
		cleanup?.();

		const editor = createEditor({ selectionIds: ['a', 'b'] });
		const target = mountMenu(editor);
		clickLabel(target, 'Group');

		expect(editor.arrangeOps.groupSelected).toHaveBeenCalledOnce();
	});

	it('offers Ungroup only on a group element and routes it to the arrange ops', () => {
		const editor = createEditor({
			selectedElement: { id: 'g1', type: 'group' } as unknown as PptxElement,
		});
		const target = mountMenu(editor);
		clickLabel(target, 'Ungroup');

		expect(editor.arrangeOps.ungroupSelected).toHaveBeenCalledOnce();
	});

	it('offers no table commands until a table cell is right-clicked', () => {
		const target = mountMenu(createEditor({ selectedElement: tableElement() }));

		expect(labelsOf(target)).not.toContain('Insert Row Above');
	});

	it('offers the row, column and merge commands on a table cell', () => {
		const target = mountMenu(createEditor({ selectedElement: tableElement() }), {
			cell: { rowIndex: 0, columnIndex: 0 },
		});

		expect(labelsOf(target)).toStrictEqual(
			expect.arrayContaining([
				'Insert Row Above',
				'Insert Row Below',
				'Delete Row',
				'Insert Column Left',
				'Insert Column Right',
				'Delete Column',
				'Merge Right',
				'Merge down',
			]),
		);
	});

	it('inserts a row below the right-clicked cell', () => {
		const editor = createEditor({ selectedElement: tableElement() });
		const target = mountMenu(editor, { cell: { rowIndex: 0, columnIndex: 1 } });

		clickLabel(target, 'Insert Row Below');

		const [id, patch] = vi.mocked(editor.applyElementPatch).mock.calls[0] as [
			string,
			{ tableData: PptxTableData },
		];
		expect(id).toBe('table-1');
		expect(patch.tableData.rows).toHaveLength(3);
		expect(patch.tableData.rows[1].cells.map((cell) => cell.text)).toStrictEqual(['', '']);
	});

	it('deletes the right-clicked column', () => {
		const editor = createEditor({ selectedElement: tableElement() });
		const target = mountMenu(editor, { cell: { rowIndex: 1, columnIndex: 0 } });

		clickLabel(target, 'Delete Column');

		const [, patch] = vi.mocked(editor.applyElementPatch).mock.calls[0] as [
			string,
			{ tableData: PptxTableData },
		];
		expect(patch.tableData.columnWidths).toHaveLength(1);
		expect(patch.tableData.rows.map((row) => row.cells.map((cell) => cell.text))).toStrictEqual([
			['b'],
			['d'],
		]);
	});

	it('merges the right-clicked cell with its right neighbour', () => {
		const editor = createEditor({ selectedElement: tableElement() });
		const target = mountMenu(editor, { cell: { rowIndex: 0, columnIndex: 0 } });

		clickLabel(target, 'Merge Right');

		const [, patch] = vi.mocked(editor.applyElementPatch).mock.calls[0] as [
			string,
			{ tableData: PptxTableData },
		];
		expect(patch.tableData.rows[0].cells[0].gridSpan).toBe(2);
	});

	/** A cell that already spans can only be split, never merged again. */
	it('offers Split Cell instead of the merges on a merged cell', () => {
		const merged = tableElement({
			rows: [
				{
					cells: [
						{ text: 'a', gridSpan: 2 },
						{ text: 'b', hMerge: true },
					],
				},
				{ cells: [{ text: 'c' }, { text: 'd' }] },
			],
		});
		const editor = createEditor({ selectedElement: merged });
		const target = mountMenu(editor, { cell: { rowIndex: 0, columnIndex: 0 } });

		const labels = labelsOf(target);
		expect(labels).toContain('Split Cell');
		expect(labels).not.toContain('Merge Right');

		clickLabel(target, 'Split Cell');
		expect(editor.applyElementPatch).toHaveBeenCalledOnce();
	});

	it('offers the AI commands only when the host wired them', () => {
		const without = mountMenu(createEditor());
		expect(labelsOf(without)).not.toContain('Ask AI about this');
		cleanup?.();

		const onaskai = vi.fn();
		const target = mountMenu(createEditor(), { onaskai });
		clickLabel(target, 'Ask AI about this');

		expect(onaskai).toHaveBeenCalledOnce();
	});
});
