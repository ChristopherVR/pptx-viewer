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
		selectAll: vi.fn(),
		groupSelected: vi.fn(),
		ungroupSelected: vi.fn(),
		nudgeSelected: vi.fn(),
		undo: vi.fn(),
		redo: vi.fn(),
		cancelFormatPainter: () => false,
		toggleShortcuts: vi.fn(),
		closeShortcuts: () => false,
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

	it('uses Escape to cancel an armed format painter before deselecting', () => {
		const cancelFormatPainter = vi.fn(() => true);
		const deps = makeDeps({ cancelFormatPainter });
		createEditorKeydownHandler(deps)(keydown('Escape'));
		expect(cancelFormatPainter).toHaveBeenCalledOnce();
		expect(deps.deselect).not.toHaveBeenCalled();
	});
});

describe('createEditorKeydownHandler: shortcuts ported from the other bindings', () => {
	it('selects every element on Ctrl+A', () => {
		const deps = makeDeps();
		createEditorKeydownHandler(deps)(keydown('a', { ctrlKey: true }));
		expect(deps.selectAll).toHaveBeenCalledOnce();
	});

	it('groups on Ctrl+G and ungroups on Ctrl+Shift+G', () => {
		const deps = makeDeps();
		const handler = createEditorKeydownHandler(deps);
		handler(keydown('g', { ctrlKey: true }));
		expect(deps.groupSelected).toHaveBeenCalledOnce();
		handler(keydown('g', { ctrlKey: true, shiftKey: true }));
		expect(deps.ungroupSelected).toHaveBeenCalledOnce();
	});

	it('opens the cheat sheet on "?" and closes it on Escape before deselecting', () => {
		const deps = makeDeps({ closeShortcuts: vi.fn(() => true) });
		const handler = createEditorKeydownHandler(deps);
		handler(keydown('?', { shiftKey: true }));
		expect(deps.toggleShortcuts).toHaveBeenCalledOnce();
		handler(keydown('Escape'));
		expect(deps.closeShortcuts).toHaveBeenCalledOnce();
		expect(deps.deselect).not.toHaveBeenCalled();
	});

	it('nudges one slide pixel bare and ten with shift', () => {
		const deps = makeDeps();
		const handler = createEditorKeydownHandler(deps);
		handler(keydown('ArrowRight'));
		expect(deps.nudgeSelected).toHaveBeenCalledWith(1, 0);
		handler(keydown('ArrowUp', { shiftKey: true }));
		expect(deps.nudgeSelected).toHaveBeenCalledWith(0, -10);
	});

	it('leaves the arrows to the root navigation handler when nothing is selected', () => {
		const deps = makeDeps({ getSelectedId: () => null });
		const event = keydown('ArrowRight');
		createEditorKeydownHandler(deps)(event);
		expect(deps.nudgeSelected).not.toHaveBeenCalled();
		// Not consumed: the slideshow navigation listener on the root still pages.
		expect(event.defaultPrevented).toBeFalsy();
	});
});
