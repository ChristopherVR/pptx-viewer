// @vitest-environment happy-dom
/**
 * The canvas context menu has to be a menu to assistive tech, not a stack of
 * anonymous buttons.
 *
 * React is the binding the cross-framework context-menu spec diffs the other
 * four against, and it was the only one of the four with a menu that declared
 * no `role` at all: Vue, Angular and Svelte all exposed `role="menu"` plus
 * `role="menuitem"`. A screen reader therefore announced React's menu as loose
 * buttons with no container, no item count and no name, which is invisible to
 * every test that does not look for it. Hence this test.
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

const { ContextMenu } = await import('./ContextMenu');
type ContextMenuProps = import('./context-menu-types').ContextMenuProps;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
});

function props(overrides: Partial<ContextMenuProps> = {}): ContextMenuProps {
	return {
		contextMenuState: { x: 40, y: 60, elementId: 'sp_1' },
		mode: 'edit',
		selectedElement: null,
		tableEditorState: null,
		onAction: vi.fn(),
		onInsertTableRow: vi.fn(),
		onDeleteTableRow: vi.fn(),
		onInsertTableColumn: vi.fn(),
		onDeleteTableColumn: vi.fn(),
		onClose: vi.fn(),
		...overrides,
	};
}

function render(overrides: Partial<ContextMenuProps> = {}): void {
	act(() => {
		root.render(<ContextMenu {...props(overrides)} />);
	});
}

/** The menu container, found through the neutral cross-binding hook. */
function menu(): HTMLElement | null {
	return container.querySelector<HTMLElement>('[data-pptx-context-menu="true"]');
}

describe('contextMenu accessibility roles', () => {
	it('exposes the container as a named menu', () => {
		render();
		expect(menu()?.getAttribute('role')).toBe('menu');
		expect(menu()?.getAttribute('aria-label')).toBe('pptx.contextMenu.ariaLabel');
	});

	it('gives every command a menuitem role', () => {
		render();
		const buttons = Array.from(menu()?.querySelectorAll('button') ?? []);
		expect(buttons.length).toBeGreaterThan(4);
		expect(buttons.every((button) => button.getAttribute('role') === 'menuitem')).toBeTruthy();
	});

	it('marks the rules between command groups as separators', () => {
		render();
		expect(menu()?.querySelectorAll('[role="separator"]').length ?? 0).toBeGreaterThan(0);
	});

	/**
	 * The extracted item component must not have changed what a command does:
	 * Delete still reports through `onAction`, and still reads as destructive.
	 */
	it('keeps each command wired to its action', () => {
		const onAction = vi.fn();
		render({ onAction });
		const remove = Array.from(menu()?.querySelectorAll('button') ?? []).find(
			(button) => button.textContent === 'pptx.contextMenu.delete',
		);
		act(() => {
			remove?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		});
		expect(onAction).toHaveBeenCalledWith('delete');
	});

	it('renders nothing outside edit mode', () => {
		render({ mode: 'view' });
		expect(menu()).toBeNull();
	});
});

/** Labels of the rendered commands, in order (the i18n mock echoes the key). */
function labels(): string[] {
	return Array.from(menu()?.querySelectorAll('button') ?? []).map(
		(button) => button.textContent ?? '',
	);
}

describe('contextMenu command set', () => {
	/**
	 * React is the reference the other four bindings are diffed against, so the
	 * set it renders is the contract. It now comes from `buildContextMenuEntries`
	 * in `pptx-viewer-shared`; this pins what that produces once it is wired to
	 * React's handlers, so a change to the shared list cannot silently reshape
	 * the reference.
	 */
	it('offers clipboard, z-order, comment and hyperlink on a plain shape', () => {
		render();
		expect(labels()).toStrictEqual([
			'pptx.contextMenu.copy',
			'pptx.contextMenu.cut',
			'pptx.contextMenu.paste',
			'pptx.contextMenu.duplicate',
			'pptx.contextMenu.bringForward',
			'pptx.contextMenu.sendBackward',
			'pptx.contextMenu.bringToFront',
			'pptx.contextMenu.sendToBack',
			'pptx.contextMenu.addComment',
			'pptx.contextMenu.editHyperlink',
			'pptx.contextMenu.delete',
		]);
	});

	it('offers a usable Group once more than one element is selected', () => {
		render({ hasMultiSelection: true });
		const group = Array.from(menu()?.querySelectorAll('button') ?? []).find(
			(button) => button.textContent === 'pptx.contextMenu.group',
		);
		expect(group).toBeDefined();
		expect(group?.hasAttribute('disabled')).toBeFalsy();
	});

	it('greys out a command the host wired no handler for', () => {
		// No `onAskAi`/`onFixAi` here, so the AI entries are absent rather than
		// dead; the greying applies to optional table callbacks.
		render({
			selectedElement: {
				id: 'tbl_1',
				type: 'table',
				x: 0,
				y: 0,
				width: 10,
				height: 10,
				tableData: { rows: [{ cells: [{ text: '' }] }] },
			} as unknown as ContextMenuProps['selectedElement'],
			tableEditorState: {
				elementId: 'tbl_1',
				rowIndex: 0,
				columnIndex: 0,
			} as unknown as ContextMenuProps['tableEditorState'],
		});
		const merge = Array.from(menu()?.querySelectorAll('button') ?? []).find(
			(button) => button.textContent === 'pptx.contextMenu.mergeCells',
		);
		expect(merge).toBeDefined();
		expect(merge?.hasAttribute('disabled')).toBeTruthy();
	});
});
