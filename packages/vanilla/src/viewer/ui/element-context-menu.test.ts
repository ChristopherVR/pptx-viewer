import type { PptxSlide } from 'pptx-viewer-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EditActions } from '../editor';
import { createTranslator } from '../i18n';
import { createInitialViewerState, createStore } from '../state';
import type { ViewerState } from '../state';
import { mountElementContextMenu } from './element-context-menu';

const t = createTranslator('en');

/** The subset of `EditActions` the menu can reach, all spies. */
function stubActions() {
	return {
		copy: vi.fn(),
		cut: vi.fn(),
		paste: vi.fn(),
		duplicateSelected: vi.fn(),
		deleteSelected: vi.fn(),
		bringForward: vi.fn(),
		sendBackward: vi.fn(),
		bringToFront: vi.fn(),
		sendToBack: vi.fn(),
		groupSelected: vi.fn(),
		ungroupSelected: vi.fn(),
		mutateTableStructure: vi.fn(),
		mergeTableCells: vi.fn(),
		splitTableCell: vi.fn(),
	};
}

function shapeSlide(): PptxSlide {
	return {
		id: 's1',
		slideNumber: 1,
		elements: [
			{ id: 'el-1', type: 'shape', x: 0, y: 0, width: 10, height: 10 },
			{ id: 'el-2', type: 'shape', x: 20, y: 0, width: 10, height: 10 },
		],
	} as unknown as PptxSlide;
}

function tableSlide(): PptxSlide {
	return {
		id: 's1',
		slideNumber: 1,
		elements: [
			{
				id: 'tbl-1',
				type: 'table',
				x: 0,
				y: 0,
				width: 100,
				height: 40,
				tableData: {
					columnWidths: [0.5, 0.5],
					rows: [
						{ cells: [{ text: 'a' }, { text: 'b' }] },
						{ cells: [{ text: 'c' }, { text: 'd' }] },
					],
				},
			},
		],
	} as unknown as PptxSlide;
}

interface Harness {
	actions: ReturnType<typeof stubActions>;
	openComments: ReturnType<typeof vi.fn>;
	openHyperlink: ReturnType<typeof vi.fn>;
	selectElement: ReturnType<typeof vi.fn>;
	store: ReturnType<typeof createStore<ViewerState>>;
	target: HTMLElement;
	destroy(): void;
}

/** Mount the menu over a one-slide stage; `build` decorates the element node. */
function harness(
	slide: PptxSlide,
	options: {
		state?: Partial<ViewerState>;
		ai?: { askAboutSelection: () => void; fixElement: () => void } | null;
		decorate?(element: HTMLElement): HTMLElement;
	} = {},
): Harness {
	const viewport = document.createElement('div');
	const stage = document.createElement('div');
	stage.className = 'pptxv-stage';
	const element = document.createElement('div');
	element.dataset.elementId = slide.elements[0].id;
	stage.appendChild(element);
	viewport.appendChild(stage);
	document.body.appendChild(viewport);

	const store = createStore<ViewerState>({
		...createInitialViewerState(),
		editable: true,
		slides: [slide],
		...options.state,
	});
	const actions = stubActions();
	const openComments = vi.fn();
	const openHyperlink = vi.fn();
	const selectElement = vi.fn((id: string) =>
		store.set({ selectedElementId: id, selectedElementIds: [id] }),
	);
	const menu = mountElementContextMenu({
		doc: document,
		store,
		getTranslator: () => t,
		viewport,
		getStageRoot: () => stage,
		getEditActions: () => actions as unknown as EditActions,
		selectElement,
		openComments,
		openHyperlink,
		getAi: () => options.ai ?? null,
	});
	return {
		actions,
		openComments,
		openHyperlink,
		selectElement,
		store,
		target: options.decorate?.(element) ?? element,
		destroy: () => menu.destroy(),
	};
}

function rightClick(target: HTMLElement): MouseEvent {
	const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
	target.dispatchEvent(event);
	return event;
}

function openMenu(): HTMLElement | null {
	return document.querySelector<HTMLElement>('[data-pptx-context-menu="true"]');
}

function labels(): string[] {
	return Array.from(document.querySelectorAll('.pptxv-context-menu-item')).map((node) =>
		(node.textContent ?? '').trim(),
	);
}

function clickCommand(label: string): void {
	const button = Array.from(
		document.querySelectorAll<HTMLButtonElement>('.pptxv-context-menu-item'),
	).find((node) => (node.textContent ?? '').trim() === label);
	button?.click();
}

afterEach(() => {
	document.body.replaceChildren();
});

describe('mountElementContextMenu', () => {
	it('opens an accessible menu of the shared command set on a right-clicked shape', () => {
		const context = harness(shapeSlide());
		const event = rightClick(context.target);

		expect(event.defaultPrevented).toBeTruthy();
		const menu = openMenu();
		expect(menu?.getAttribute('role')).toBe('menu');
		expect(menu?.getAttribute('aria-label')).toBe('Context menu');
		expect(menu?.querySelectorAll('[role="separator"]').length).toBeGreaterThan(0);
		for (const item of menu?.querySelectorAll('.pptxv-context-menu-item') ?? []) {
			expect(item.tagName).toBe('BUTTON');
			expect(item.getAttribute('type')).toBe('button');
			expect(item.getAttribute('role')).toBe('menuitem');
		}
		expect(labels()).toStrictEqual([
			'Copy',
			'Cut',
			'Paste',
			'Duplicate',
			'Bring Forward',
			'Send Backward',
			'Bring to Front',
			'Send to Back',
			'Add Comment',
			'Edit Hyperlink',
			'Delete',
		]);
		// The right-clicked element becomes the selection the commands act on.
		expect(context.selectElement).toHaveBeenCalledWith('el-1');
		context.destroy();
	});

	it('greys out Paste with an empty clipboard and offers Group on a multi-selection', () => {
		const context = harness(shapeSlide(), {
			state: { selectedElementId: 'el-2', selectedElementIds: ['el-1', 'el-2'] },
		});
		rightClick(context.target);

		const paste = Array.from(
			document.querySelectorAll<HTMLButtonElement>('.pptxv-context-menu-item'),
		).find((node) => node.textContent === 'Paste');
		expect(paste?.disabled).toBeTruthy();
		expect(labels()).toContain('Group');
		// Already part of the selection, so the multi-selection is left intact.
		expect(context.selectElement).not.toHaveBeenCalled();
		context.destroy();
	});

	it('dismisses on Escape and on a click outside the menu', () => {
		const context = harness(shapeSlide());

		rightClick(context.target);
		expect(openMenu()).not.toBeNull();
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(openMenu()).toBeNull();

		rightClick(context.target);
		expect(openMenu()).not.toBeNull();
		document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		expect(openMenu()).toBeNull();

		// A press inside the menu is not a dismissal.
		rightClick(context.target);
		openMenu()?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		expect(openMenu()).not.toBeNull();
		context.destroy();
	});

	it('dispatches each command to the editor operation that performs it', () => {
		const context = harness(shapeSlide());

		rightClick(context.target);
		clickCommand('Duplicate');
		expect(context.actions.duplicateSelected).toHaveBeenCalledOnce();
		// Choosing a command closes the menu.
		expect(openMenu()).toBeNull();

		rightClick(context.target);
		clickCommand('Bring to Front');
		expect(context.actions.bringToFront).toHaveBeenCalledOnce();

		rightClick(context.target);
		clickCommand('Add Comment');
		expect(context.openComments).toHaveBeenCalledOnce();

		rightClick(context.target);
		clickCommand('Edit Hyperlink');
		expect(context.openHyperlink).toHaveBeenCalledOnce();

		rightClick(context.target);
		clickCommand('Delete');
		expect(context.actions.deleteSelected).toHaveBeenCalledOnce();
		context.destroy();
	});

	it('offers the table commands on a cell and aims them at the clicked cell', () => {
		const context = harness(tableSlide(), {
			decorate(element) {
				const table = document.createElement('table');
				const row = document.createElement('tr');
				const cell = document.createElement('td');
				cell.dataset.rowIndex = '1';
				cell.dataset.cellIndex = '0';
				row.appendChild(cell);
				table.appendChild(row);
				element.appendChild(table);
				return cell;
			},
		});

		rightClick(context.target);
		expect(labels()).toStrictEqual(
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
		expect(context.store.get().selectedTableCell).toStrictEqual({ row: 1, column: 0 });

		clickCommand('Insert Row Above');
		expect(context.actions.mutateTableStructure).toHaveBeenCalledWith(
			{ row: 1, column: 0 },
			'insertRowAbove',
		);

		rightClick(context.target);
		clickCommand('Merge down');
		expect(context.actions.mergeTableCells).toHaveBeenCalledWith([
			{ row: 1, column: 0 },
			{ row: 2, column: 0 },
		]);
		context.destroy();
	});

	it('folds the AI entries in only when the host configured ai', () => {
		const askAboutSelection = vi.fn();
		const context = harness(shapeSlide(), {
			ai: { askAboutSelection, fixElement: vi.fn() },
		});

		rightClick(context.target);
		expect(labels()).toContain('Ask AI about this');
		expect(labels()).toContain('Fix with AI');
		clickCommand('Ask AI about this');
		expect(askAboutSelection).toHaveBeenCalledOnce();
		context.destroy();

		const plain = harness(shapeSlide());
		rightClick(plain.target);
		expect(labels()).not.toContain('Ask AI about this');
		plain.destroy();
	});

	it('lets the native menu through outside edit mode, while presenting, and off-element', () => {
		const readOnly = harness(shapeSlide(), { state: { editable: false } });
		expect(rightClick(readOnly.target).defaultPrevented).toBeFalsy();
		expect(openMenu()).toBeNull();
		readOnly.destroy();

		const presenting = harness(shapeSlide(), { state: { presenting: true } });
		expect(rightClick(presenting.target).defaultPrevented).toBeFalsy();
		expect(openMenu()).toBeNull();
		presenting.destroy();

		const editing = harness(shapeSlide());
		const stage = document.querySelector<HTMLElement>('.pptxv-stage');
		expect(rightClick(stage as HTMLElement).defaultPrevented).toBeFalsy();
		expect(openMenu()).toBeNull();
		editing.destroy();
	});
});
