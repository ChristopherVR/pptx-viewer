import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EditorState } from '../editor/editor-state.svelte';
import SelectionPane from './SelectionPane.svelte';

/**
 * Svelte was the one binding whose Selection Pane listed objects with no
 * visibility toggle at all, so hiding a shape was unreachable here while the
 * other four shipped the eye button. These pin the restored parity: every
 * object gets a toggle, hidden objects stay listed and stay selectable, and the
 * toggle writes `hidden` through the same history-tracked element patch the
 * other bindings use.
 */

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function shape(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		id: 'sp_1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		...overrides,
	} as PptxElement;
}

function createEditor(
	elements: PptxElement[],
): EditorState & { applyElementPatch: ReturnType<typeof vi.fn>; select: ReturnType<typeof vi.fn> } {
	return {
		activeElements: elements,
		selection: { ids: [] },
		selectedElementId: null,
		select: vi.fn(),
		applyElementPatch: vi.fn(),
		reorderSelected: vi.fn(),
	} as unknown as EditorState & {
		applyElementPatch: ReturnType<typeof vi.fn>;
		select: ReturnType<typeof vi.fn>;
	};
}

function mountPane(editor: EditorState): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(SelectionPane, { target, props: { editor, onclose: () => {} } });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

describe('svelte selection pane visibility toggle', () => {
	it('renders one eye toggle per element, hidden ones included', () => {
		const target = mountPane(
			createEditor([shape({ id: 'sp_1' }), shape({ id: 'sp_2', hidden: true })]),
		);
		expect(target.querySelectorAll('button.eye')).toHaveLength(2);
		expect(target.querySelectorAll('button.eye[aria-pressed="true"]')).toHaveLength(1);
	});

	it('hides an element through the editor patch channel', () => {
		const editor = createEditor([shape({ id: 'sp_1' })]);
		const target = mountPane(editor);
		target.querySelector<HTMLButtonElement>('button.eye')!.click();
		flushSync();
		expect(editor.applyElementPatch).toHaveBeenCalledWith('sp_1', { hidden: true });
	});

	it('shows a hidden element again', () => {
		const editor = createEditor([shape({ id: 'sp_1', hidden: true })]);
		const target = mountPane(editor);
		target.querySelector<HTMLButtonElement>('button.eye')!.click();
		flushSync();
		expect(editor.applyElementPatch).toHaveBeenCalledWith('sp_1', { hidden: false });
	});

	it('keeps a hidden element selectable from its row', () => {
		const editor = createEditor([shape({ id: 'sp_1', hidden: true })]);
		const target = mountPane(editor);
		target.querySelector<HTMLButtonElement>('button.name')!.click();
		flushSync();
		expect(editor.select).toHaveBeenCalledWith('sp_1');
	});
});

describe('svelte selection pane rename', () => {
	function beginRename(target: HTMLElement): HTMLInputElement {
		const label = target.querySelector<HTMLElement>('[data-pptx-selection-name]')!;
		label.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		flushSync();
		const input = target.querySelector<HTMLInputElement>('input[type="text"]');
		expect(input).not.toBeNull();
		return input!;
	}
	function setValue(input: HTMLInputElement, value: string): void {
		input.value = value;
		input.dispatchEvent(new Event('input', { bubbles: true }));
		flushSync();
	}

	it('stamps the pane root and the name label for the e2e contract', () => {
		const target = mountPane(createEditor([shape({ id: 'sp_1' })]));
		expect(target.querySelector('[data-pptx-selection-pane]')).not.toBeNull();
		expect(target.querySelector('[data-pptx-selection-name]')).not.toBeNull();
	});

	it('opens an inline input on double-click, prefilled with the current name', () => {
		const target = mountPane(createEditor([shape({ id: 'sp_1', name: 'Hero shape' })]));
		const input = beginRename(target);
		expect(input.value).toBe('Hero shape');
		expect(input.getAttribute('aria-label')).toBe('Rename element');
	});

	it('commits the trimmed name on Enter through the editor patch channel', () => {
		const editor = createEditor([shape({ id: 'sp_1', name: 'Old' })]);
		const target = mountPane(editor);
		const input = beginRename(target);
		setValue(input, '  New name  ');
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		flushSync();
		expect(editor.applyElementPatch).toHaveBeenCalledExactlyOnceWith('sp_1', { name: 'New name' });
		expect(target.querySelector('input[type="text"]')).toBeNull();
	});

	it('clears the name when committed empty', () => {
		const editor = createEditor([shape({ id: 'sp_1', name: 'Old' })]);
		const target = mountPane(editor);
		const input = beginRename(target);
		setValue(input, '   ');
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		flushSync();
		expect(editor.applyElementPatch).toHaveBeenCalledExactlyOnceWith('sp_1', { name: undefined });
	});

	it('cancels the rename on Escape without touching the element', () => {
		const editor = createEditor([shape({ id: 'sp_1', name: 'Old' })]);
		const target = mountPane(editor);
		const input = beginRename(target);
		setValue(input, 'Discarded');
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		flushSync();
		expect(editor.applyElementPatch).not.toHaveBeenCalled();
		expect(target.querySelector('input[type="text"]')).toBeNull();
	});

	it('commits on blur', () => {
		const editor = createEditor([shape({ id: 'sp_1' })]);
		const target = mountPane(editor);
		const input = beginRename(target);
		setValue(input, 'Named on blur');
		input.dispatchEvent(new FocusEvent('blur'));
		flushSync();
		expect(editor.applyElementPatch).toHaveBeenCalledExactlyOnceWith('sp_1', {
			name: 'Named on blur',
		});
	});
});

/**
 * Ending a rename must hand the keyboard back to the viewer root. This binding
 * listens for `keydown` on that root, so a commit that leaves focus on
 * `document.body` (where it lands once the input unmounts) makes the very next
 * Ctrl+Z a no-op: the rename went through history, but undo could not be
 * reached.
 */
describe('svelte selection pane rename focus', () => {
	/** Mount the pane inside a focusable viewer root, as the real shell renders it. */
	function mountInViewer(editor: EditorState): { root: HTMLDivElement; target: HTMLElement } {
		const root = document.createElement('div');
		root.setAttribute('tabindex', '0');
		document.body.appendChild(root);
		const target = document.createElement('div');
		root.appendChild(target);
		const instance = mount(SelectionPane, { target, props: { editor, onclose: () => {} } });
		flushSync();
		cleanup = () => {
			unmount(instance);
			root.remove();
		};
		return { root, target };
	}

	function startRename(target: HTMLElement): HTMLInputElement {
		target
			.querySelector<HTMLElement>('[data-pptx-selection-name]')!
			.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		flushSync();
		return target.querySelector<HTMLInputElement>('input[type="text"]')!;
	}

	it('returns focus to the viewer root when Enter commits', () => {
		const editor = createEditor([shape({ id: 'sp_1', name: 'Old' })]);
		const { root, target } = mountInViewer(editor);
		const input = startRename(target);
		expect(document.activeElement).toBe(input);

		input.value = 'New name';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		flushSync();

		expect(document.activeElement).toBe(root);
		// The blur that focus move causes must not commit a second time.
		expect(editor.applyElementPatch).toHaveBeenCalledExactlyOnceWith('sp_1', { name: 'New name' });
	});

	it('returns focus to the viewer root when Escape cancels', () => {
		const editor = createEditor([shape({ id: 'sp_1', name: 'Old' })]);
		const { root, target } = mountInViewer(editor);
		const input = startRename(target);
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		flushSync();

		expect(document.activeElement).toBe(root);
		expect(editor.applyElementPatch).not.toHaveBeenCalled();
	});
});
