import { describe, expect, it, vi } from 'vitest';

import { createEditorKeydownHandler } from './editor-keyboard';
import type { EditorKeyboardDeps } from './editor-keyboard';

function makeDeps(overrides: Partial<EditorKeyboardDeps> = {}): EditorKeyboardDeps {
	return {
		isActive: () => true,
		getSelectedId: () => 'el1',
		deselect: vi.fn(),
		deleteSelected: vi.fn(),
		duplicateSelected: vi.fn(),
		copySelected: vi.fn(),
		cutSelected: vi.fn(),
		paste: vi.fn(),
		nudgeSelected: vi.fn(),
		undo: vi.fn(),
		redo: vi.fn(),
		...overrides,
	};
}

function keydown(key: string, opts: Partial<KeyboardEventInit> = {}): KeyboardEvent {
	return new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts });
}

describe('createEditorKeydownHandler clipboard shortcuts', () => {
	it('fires copySelected on Ctrl+C when something is selected', () => {
		const deps = makeDeps();
		const handler = createEditorKeydownHandler(deps);
		handler(keydown('c', { ctrlKey: true }));
		expect(deps.copySelected).toHaveBeenCalledOnce();
	});

	it('fires cutSelected on Ctrl+X when something is selected', () => {
		const deps = makeDeps();
		const handler = createEditorKeydownHandler(deps);
		handler(keydown('x', { ctrlKey: true }));
		expect(deps.cutSelected).toHaveBeenCalledOnce();
	});

	it('fires paste on Ctrl+V even without a selection', () => {
		const deps = makeDeps({ getSelectedId: () => null });
		const handler = createEditorKeydownHandler(deps);
		handler(keydown('v', { ctrlKey: true }));
		expect(deps.paste).toHaveBeenCalledOnce();
	});

	it('does not copy/cut without a selection', () => {
		const deps = makeDeps({ getSelectedId: () => null });
		const handler = createEditorKeydownHandler(deps);
		handler(keydown('c', { ctrlKey: true }));
		handler(keydown('x', { ctrlKey: true }));
		expect(deps.copySelected).not.toHaveBeenCalled();
		expect(deps.cutSelected).not.toHaveBeenCalled();
	});

	it('supports the Cmd (meta) modifier on macOS', () => {
		const deps = makeDeps();
		const handler = createEditorKeydownHandler(deps);
		handler(keydown('c', { metaKey: true }));
		expect(deps.copySelected).toHaveBeenCalledOnce();
	});

	it('is a no-op while inactive (not editable / presenting / inline editing)', () => {
		const deps = makeDeps({ isActive: () => false });
		const handler = createEditorKeydownHandler(deps);
		handler(keydown('c', { ctrlKey: true }));
		handler(keydown('v', { ctrlKey: true }));
		expect(deps.copySelected).not.toHaveBeenCalled();
		expect(deps.paste).not.toHaveBeenCalled();
	});

	it('ignores shortcuts while typing in a form field', () => {
		const deps = makeDeps();
		const handler = createEditorKeydownHandler(deps);
		const input = document.createElement('input');
		document.body.appendChild(input);
		const event = keydown('v', { ctrlKey: true });
		Object.defineProperty(event, 'target', { value: input });
		handler(event);
		expect(deps.paste).not.toHaveBeenCalled();
		input.remove();
	});
});

describe('createEditorKeydownHandler existing shortcuts (regression)', () => {
	it('still handles delete/duplicate/undo/redo/escape', () => {
		const deps = makeDeps();
		const handler = createEditorKeydownHandler(deps);

		handler(keydown('Delete'));
		expect(deps.deleteSelected).toHaveBeenCalledOnce();

		handler(keydown('d', { ctrlKey: true }));
		expect(deps.duplicateSelected).toHaveBeenCalledOnce();

		handler(keydown('z', { ctrlKey: true }));
		expect(deps.undo).toHaveBeenCalledOnce();

		handler(keydown('z', { ctrlKey: true, shiftKey: true }));
		expect(deps.redo).toHaveBeenCalledOnce();

		handler(keydown('Escape'));
		expect(deps.deselect).toHaveBeenCalledOnce();
	});
});
