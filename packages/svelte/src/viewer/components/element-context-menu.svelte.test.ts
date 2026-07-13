import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EditorState } from '../editor/editor-state.svelte';
import ElementContextMenu from './ElementContextMenu.svelte';

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function createEditor(): EditorState {
	return {
		clipboardOps: {
			copySelected: vi.fn(),
			cutSelected: vi.fn(),
			pasteClipboard: vi.fn(),
		},
		duplicateSelected: vi.fn(),
		reorderSelected: vi.fn(),
		deleteSelected: vi.fn(),
	} as unknown as EditorState;
}

function mountMenu(editor: EditorState, onclose = vi.fn()): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ElementContextMenu, { target, props: { x: 24, y: 40, editor, onclose } });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

describe('elementContextMenu', () => {
	it('routes duplication and z-order actions to the selected editor element', () => {
		const editor = createEditor();
		const target = mountMenu(editor);
		const items = Array.from(target.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));

		items[3].click();
		items[4].click();
		items[7].click();

		expect(editor.duplicateSelected).toHaveBeenCalledOnce();
		expect(editor.reorderSelected).toHaveBeenNthCalledWith(1, 'forward');
		expect(editor.reorderSelected).toHaveBeenNthCalledWith(2, 'back');
	});

	it('closes on Escape and routes clipboard commands', () => {
		const editor = createEditor();
		const onclose = vi.fn();
		const target = mountMenu(editor, onclose);
		const items = Array.from(target.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));

		items[0].click();
		items[1].click();
		items[2].click();
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

		expect(editor.clipboardOps.copySelected).toHaveBeenCalledOnce();
		expect(editor.clipboardOps.cutSelected).toHaveBeenCalledOnce();
		expect(editor.clipboardOps.pasteClipboard).toHaveBeenCalledOnce();
		expect(onclose).toHaveBeenCalledTimes(4);
	});
});
