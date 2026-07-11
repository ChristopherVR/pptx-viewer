import { describe, expect, it, vi } from 'vitest';

import { createEditorKeydownHandler } from './editor-keyboard';
import type { EditorKeyboardDeps } from './editor-keyboard';

function makeDeps(over: Partial<EditorKeyboardDeps> = {}): EditorKeyboardDeps {
	return {
		isActive: () => true,
		getSelectedId: () => 'e1',
		deselect: vi.fn(),
		deleteSelected: vi.fn(),
		duplicateSelected: vi.fn(),
		nudgeSelected: vi.fn(),
		undo: vi.fn(),
		redo: vi.fn(),
		copySelected: vi.fn(),
		cutSelected: vi.fn(),
		paste: vi.fn(),
		...over,
	};
}

function key(init: KeyboardEventInit): KeyboardEvent {
	const event = new KeyboardEvent('keydown', init);
	vi.spyOn(event, 'preventDefault');
	return event;
}

describe('createEditorKeydownHandler', () => {
	it('does nothing when inactive', () => {
		const deps = makeDeps({ isActive: () => false });
		createEditorKeydownHandler(deps)(key({ key: 'Delete' }));
		expect(deps.deleteSelected).not.toHaveBeenCalled();
	});

	it('ignores keystrokes from form fields / contenteditable', () => {
		const deps = makeDeps();
		const input = document.createElement('input');
		input.addEventListener('keydown', createEditorKeydownHandler(deps));
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
		expect(deps.deleteSelected).not.toHaveBeenCalled();
	});

	it('routes Ctrl+Z to undo and Ctrl+Shift+Z / Ctrl+Y to redo', () => {
		const deps = makeDeps();
		const handler = createEditorKeydownHandler(deps);
		handler(key({ key: 'z', ctrlKey: true }));
		handler(key({ key: 'z', ctrlKey: true, shiftKey: true }));
		handler(key({ key: 'y', ctrlKey: true }));
		expect(deps.undo).toHaveBeenCalledOnce();
		expect(deps.redo).toHaveBeenCalledTimes(2);
	});

	it('handles Escape / Delete / Backspace / Ctrl+D on a selection', () => {
		const deps = makeDeps();
		const handler = createEditorKeydownHandler(deps);
		handler(key({ key: 'Escape' }));
		handler(key({ key: 'Delete' }));
		handler(key({ key: 'Backspace' }));
		handler(key({ key: 'd', ctrlKey: true }));
		expect(deps.deselect).toHaveBeenCalledOnce();
		expect(deps.deleteSelected).toHaveBeenCalledTimes(2);
		expect(deps.duplicateSelected).toHaveBeenCalledOnce();
	});

	it('nudges by arrow keys, using the large step with Shift', () => {
		const deps = makeDeps();
		const handler = createEditorKeydownHandler(deps);
		handler(key({ key: 'ArrowRight' }));
		handler(key({ key: 'ArrowUp', shiftKey: true }));
		expect(deps.nudgeSelected).toHaveBeenNthCalledWith(1, 1, 0);
		expect(deps.nudgeSelected).toHaveBeenNthCalledWith(2, 0, -10);
	});

	it('does not delete / nudge when nothing is selected (undo still works)', () => {
		const deps = makeDeps({ getSelectedId: () => null });
		const handler = createEditorKeydownHandler(deps);
		handler(key({ key: 'Delete' }));
		handler(key({ key: 'ArrowRight' }));
		handler(key({ key: 'z', ctrlKey: true }));
		expect(deps.deleteSelected).not.toHaveBeenCalled();
		expect(deps.nudgeSelected).not.toHaveBeenCalled();
		expect(deps.undo).toHaveBeenCalledOnce();
	});

	it('routes Ctrl+C / Ctrl+X to copy/cut when something is selected', () => {
		const deps = makeDeps();
		const handler = createEditorKeydownHandler(deps);
		handler(key({ key: 'c', ctrlKey: true }));
		handler(key({ key: 'x', ctrlKey: true }));
		expect(deps.copySelected).toHaveBeenCalledOnce();
		expect(deps.cutSelected).toHaveBeenCalledOnce();
	});

	it('ignores Ctrl+C / Ctrl+X when nothing is selected', () => {
		const deps = makeDeps({ getSelectedId: () => null });
		const handler = createEditorKeydownHandler(deps);
		handler(key({ key: 'c', ctrlKey: true }));
		handler(key({ key: 'x', ctrlKey: true }));
		expect(deps.copySelected).not.toHaveBeenCalled();
		expect(deps.cutSelected).not.toHaveBeenCalled();
	});

	it('routes Ctrl+V to paste even without a selection', () => {
		const deps = makeDeps({ getSelectedId: () => null });
		const handler = createEditorKeydownHandler(deps);
		handler(key({ key: 'v', ctrlKey: true }));
		expect(deps.paste).toHaveBeenCalledOnce();
	});
});
