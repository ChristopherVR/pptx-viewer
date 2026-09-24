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
		selectAll: vi.fn(),
		groupSelected: vi.fn(),
		ungroupSelected: vi.fn(),
		toggleShortcuts: vi.fn(),
		closeShortcuts: () => false,
		toggleFindReplace: vi.fn(),
		setTextAlign: vi.fn(),
		stepFontSize: vi.fn(),
		copyFormat: vi.fn(),
		pasteFormat: vi.fn(),
		newSlide: vi.fn(),
		openHyperlink: vi.fn(),
		clearFormatting: vi.fn(),
		cycleSelection: vi.fn(),
		...over,
	};
}

function key(init: KeyboardEventInit): KeyboardEvent {
	const event = new KeyboardEvent('keydown', init);
	vi.spyOn(event, 'preventDefault');
	return event;
}

describe('createEditorKeydownHandler', () => {
	it.each([{ ctrlKey: true }, { metaKey: true }])(
		'does not prevent unavailable paste: %j',
		(modifiers) => {
			let available = false;
			const deps = makeDeps({ canPaste: () => available, getSelectedId: () => null });
			const handler = createEditorKeydownHandler(deps);
			const empty = new KeyboardEvent('keydown', { key: 'v', ...modifiers, cancelable: true });
			handler(empty);
			expect(empty.defaultPrevented).toBeFalsy();
			expect(deps.paste).not.toHaveBeenCalled();
			available = true;
			const populated = new KeyboardEvent('keydown', { key: 'v', ...modifiers, cancelable: true });
			handler(populated);
			expect(populated.defaultPrevented).toBeTruthy();
			expect(deps.paste).toHaveBeenCalledOnce();
		},
	);

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

describe('createEditorKeydownHandler: shortcuts ported from the other bindings', () => {
	it('selects every element on Ctrl+A', () => {
		const deps = makeDeps();
		createEditorKeydownHandler(deps)(key({ key: 'a', ctrlKey: true }));
		expect(deps.selectAll).toHaveBeenCalledOnce();
	});

	it('groups on Ctrl+G and ungroups on Ctrl+Shift+G', () => {
		const deps = makeDeps();
		const handler = createEditorKeydownHandler(deps);
		handler(key({ key: 'g', ctrlKey: true }));
		expect(deps.groupSelected).toHaveBeenCalledOnce();
		handler(key({ key: 'g', ctrlKey: true, shiftKey: true }));
		expect(deps.ungroupSelected).toHaveBeenCalledOnce();
	});

	it('opens the cheat sheet on "?" and closes it on Escape before deselecting', () => {
		const deps = makeDeps({ closeShortcuts: vi.fn(() => true) });
		const handler = createEditorKeydownHandler(deps);
		handler(key({ key: '?', shiftKey: true }));
		expect(deps.toggleShortcuts).toHaveBeenCalledOnce();
		handler(key({ key: 'Escape' }));
		expect(deps.closeShortcuts).toHaveBeenCalledOnce();
		expect(deps.deselect).not.toHaveBeenCalled();
	});

	it('leaves the arrows to the root navigation fall-through with nothing selected', () => {
		const deps = makeDeps({ getSelectedId: () => null });
		const event = key({ key: 'ArrowRight', cancelable: true });
		createEditorKeydownHandler(deps)(event);
		expect(deps.nudgeSelected).not.toHaveBeenCalled();
		expect(event.preventDefault).not.toHaveBeenCalled();
	});
});

describe('createEditorKeydownHandler: PowerPoint 365 shortcuts', () => {
	it('sets paragraph alignment on Ctrl+L/E/R/J', () => {
		const deps = makeDeps();
		const handler = createEditorKeydownHandler(deps);
		handler(key({ key: 'l', ctrlKey: true }));
		handler(key({ key: 'e', ctrlKey: true }));
		handler(key({ key: 'r', ctrlKey: true }));
		handler(key({ key: 'j', ctrlKey: true }));
		expect(deps.setTextAlign).toHaveBeenNthCalledWith(1, 'left');
		expect(deps.setTextAlign).toHaveBeenNthCalledWith(2, 'center');
		expect(deps.setTextAlign).toHaveBeenNthCalledWith(3, 'right');
		expect(deps.setTextAlign).toHaveBeenNthCalledWith(4, 'justify');
	});

	it('steps the font size on Ctrl+]/[ and Ctrl+Shift+>/<', () => {
		const deps = makeDeps();
		const handler = createEditorKeydownHandler(deps);
		handler(key({ key: ']', ctrlKey: true }));
		handler(key({ key: '[', ctrlKey: true }));
		handler(key({ key: '>', ctrlKey: true, shiftKey: true }));
		handler(key({ key: '<', ctrlKey: true, shiftKey: true }));
		expect(deps.stepFontSize).toHaveBeenNthCalledWith(1, 'increase');
		expect(deps.stepFontSize).toHaveBeenNthCalledWith(2, 'decrease');
		expect(deps.stepFontSize).toHaveBeenNthCalledWith(3, 'increase');
		expect(deps.stepFontSize).toHaveBeenNthCalledWith(4, 'decrease');
	});

	it('arms/applies the format painter on Ctrl+Shift+C/V', () => {
		const deps = makeDeps();
		const handler = createEditorKeydownHandler(deps);
		handler(key({ key: 'c', ctrlKey: true, shiftKey: true }));
		handler(key({ key: 'v', ctrlKey: true, shiftKey: true }));
		expect(deps.copyFormat).toHaveBeenCalledOnce();
		expect(deps.pasteFormat).toHaveBeenCalledOnce();
	});

	it('inserts a new slide on Ctrl+M', () => {
		const deps = makeDeps();
		createEditorKeydownHandler(deps)(key({ key: 'm', ctrlKey: true }));
		expect(deps.newSlide).toHaveBeenCalledOnce();
	});

	it('opens the hyperlink dialog on Ctrl+K', () => {
		const deps = makeDeps();
		createEditorKeydownHandler(deps)(key({ key: 'k', ctrlKey: true }));
		expect(deps.openHyperlink).toHaveBeenCalledOnce();
	});

	it('opens find & replace on Ctrl+H', () => {
		const deps = makeDeps();
		createEditorKeydownHandler(deps)(key({ key: 'h', ctrlKey: true }));
		expect(deps.toggleFindReplace).toHaveBeenCalledOnce();
	});

	it('clears character formatting on Ctrl+Space', () => {
		const deps = makeDeps();
		createEditorKeydownHandler(deps)(key({ key: ' ', ctrlKey: true }));
		expect(deps.clearFormatting).toHaveBeenCalledOnce();
	});

	it('cycles the selection forward/back on Tab/Shift+Tab', () => {
		const deps = makeDeps();
		const handler = createEditorKeydownHandler(deps);
		handler(key({ key: 'Tab' }));
		handler(key({ key: 'Tab', shiftKey: true }));
		expect(deps.cycleSelection).toHaveBeenNthCalledWith(1, 'next');
		expect(deps.cycleSelection).toHaveBeenNthCalledWith(2, 'prev');
	});

	it('leaves Tab on a chrome button to the browser focus order', () => {
		const deps = makeDeps();
		const button = document.createElement('button');
		document.body.appendChild(button);
		const event = key({ key: 'Tab', cancelable: true });
		Object.defineProperty(event, 'target', { value: button });
		createEditorKeydownHandler(deps)(event);
		expect(deps.cycleSelection).not.toHaveBeenCalled();
		expect(event.preventDefault).not.toHaveBeenCalled();
		button.remove();
	});

	it('leaves the live-format chords alone with no selection and no active edit', () => {
		const deps = makeDeps({ getSelectedId: () => null });
		const handler = createEditorKeydownHandler(deps);
		const event = key({ key: 'l', ctrlKey: true, cancelable: true });
		handler(event);
		expect(deps.setTextAlign).not.toHaveBeenCalled();
		expect(event.preventDefault).not.toHaveBeenCalled();
	});
});
