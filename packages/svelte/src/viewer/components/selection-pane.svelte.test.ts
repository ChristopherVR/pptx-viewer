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
