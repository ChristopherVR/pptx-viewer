import { describe, expect, it } from 'vitest';

import {
	editorNudgeDelta,
	isEditorTextInputTarget,
	mapEditorKey,
	mapInlineTextFormatKey,
	NUDGE_LARGE,
	NUDGE_SMALL,
} from './editor-keymap';
import type { EditorKeyGuard, EditorKeyInput } from './editor-keymap';

/** A key press with the modifiers the test cares about and nothing else. */
function press(key: string, modifiers: Partial<EditorKeyInput> = {}): EditorKeyInput {
	return { key, ...modifiers };
}

const SELECTED: Partial<EditorKeyGuard> = { hasSelection: true };

describe('nudge steps', () => {
	it('is one slide pixel bare and ten with shift', () => {
		expect(NUDGE_SMALL).toBe(1);
		expect(NUDGE_LARGE).toBe(10);
	});

	it('maps each arrow key to a delta on one axis', () => {
		expect(editorNudgeDelta('ArrowLeft', false)).toStrictEqual({ dx: -1, dy: 0 });
		expect(editorNudgeDelta('ArrowRight', false)).toStrictEqual({ dx: 1, dy: 0 });
		expect(editorNudgeDelta('ArrowUp', false)).toStrictEqual({ dx: 0, dy: -1 });
		expect(editorNudgeDelta('ArrowDown', true)).toStrictEqual({ dx: 0, dy: 10 });
		expect(editorNudgeDelta('Enter', false)).toBeNull();
	});
});

describe('mapEditorKey guards', () => {
	it('does nothing while presenting or on a read-only host', () => {
		expect(mapEditorKey(press('Delete'), { ...SELECTED, isPresenting: true }).action).toBeNull();
		expect(mapEditorKey(press('Delete'), { ...SELECTED, canEdit: false }).action).toBeNull();
	});

	it('still resolves Escape while inline-editing, so there is always a way out', () => {
		expect(mapEditorKey(press('Escape'), { isEditingText: true }).action).toBe('escape');
	});

	it('suppresses shortcuts while typing, drawing, or focused in a field', () => {
		for (const guard of [
			{ isEditingText: true },
			{ isDrawing: true },
			{ isTextInputTarget: true },
		]) {
			expect(
				mapEditorKey(press('d', { ctrlKey: true }), { ...SELECTED, ...guard }).action,
			).toBeNull();
		}
	});
});

describe('mapEditorKey clipboard and history', () => {
	it.each([{ ctrlKey: true }, { metaKey: true }])(
		'leaves paste unclaimed when unavailable: %j',
		(modifiers) => {
			expect(mapEditorKey(press('v', modifiers), { canPaste: false }).action).toBeNull();
			expect(
				mapEditorKey(press('v', modifiers), { canPaste: true, hasSelection: false }).action,
			).toBe('paste');
		},
	);

	it('resolves the Ctrl chords', () => {
		expect(mapEditorKey(press('c', { ctrlKey: true }), SELECTED).action).toBe('copy');
		expect(mapEditorKey(press('x', { metaKey: true }), SELECTED).action).toBe('cut');
		expect(mapEditorKey(press('v', { ctrlKey: true })).action).toBe('paste');
		expect(mapEditorKey(press('d', { ctrlKey: true }), SELECTED).action).toBe('duplicate');
		expect(mapEditorKey(press('z', { ctrlKey: true })).action).toBe('undo');
		expect(mapEditorKey(press('z', { ctrlKey: true, shiftKey: true })).action).toBe('redo');
		expect(mapEditorKey(press('y', { ctrlKey: true })).action).toBe('redo');
		expect(mapEditorKey(press('a', { ctrlKey: true })).action).toBe('selectAll');
	});

	it('gates the selection-only chords but not paste, undo or select-all', () => {
		expect(mapEditorKey(press('c', { ctrlKey: true })).action).toBeNull();
		expect(mapEditorKey(press('x', { ctrlKey: true })).action).toBeNull();
		expect(mapEditorKey(press('d', { ctrlKey: true })).action).toBeNull();
		expect(mapEditorKey(press('v', { ctrlKey: true })).action).toBe('paste');
		expect(mapEditorKey(press('z', { ctrlKey: true })).action).toBe('undo');
		expect(mapEditorKey(press('a', { ctrlKey: true })).action).toBe('selectAll');
	});

	it('ignores a chord that also holds Alt (an AltGr composition, not a shortcut)', () => {
		expect(mapEditorKey(press('d', { ctrlKey: true, altKey: true }), SELECTED).action).toBeNull();
	});
});

describe('mapEditorKey grouping', () => {
	it('maps Ctrl+G to group and Ctrl+Shift+G to ungroup', () => {
		expect(mapEditorKey(press('g', { ctrlKey: true }), SELECTED).action).toBe('group');
		expect(mapEditorKey(press('g', { ctrlKey: true, shiftKey: true }), SELECTED).action).toBe(
			'ungroup',
		);
	});

	it('needs a selection', () => {
		expect(mapEditorKey(press('g', { ctrlKey: true })).action).toBeNull();
	});
});

describe('mapEditorKey deletion, nudge and paging', () => {
	it('deletes on Delete and Backspace only with a selection', () => {
		expect(mapEditorKey(press('Delete'), SELECTED).action).toBe('delete');
		expect(mapEditorKey(press('Backspace'), SELECTED).action).toBe('delete');
		expect(mapEditorKey(press('Delete')).action).toBeNull();
	});

	it('nudges the selection by one slide pixel, ten with shift', () => {
		expect(mapEditorKey(press('ArrowRight'), SELECTED)).toStrictEqual({
			action: 'nudge',
			dx: 1,
			dy: 0,
		});
		expect(mapEditorKey(press('ArrowUp', { shiftKey: true }), SELECTED)).toStrictEqual({
			action: 'nudge',
			dx: 0,
			dy: -10,
		});
	});

	it('pages the deck with the horizontal arrows when nothing is selected', () => {
		expect(mapEditorKey(press('ArrowLeft')).action).toBe('prevSlide');
		expect(mapEditorKey(press('ArrowRight')).action).toBe('nextSlide');
	});

	it('never pages while an element is selected: the arrows nudge instead', () => {
		expect(mapEditorKey(press('ArrowLeft'), SELECTED).action).toBe('nudge');
		expect(mapEditorKey(press('ArrowUp'), SELECTED).action).toBe('nudge');
	});
});

describe('mapEditorKey help panel', () => {
	it('opens the shortcut reference on a bare "?", which carries Shift on most layouts', () => {
		expect(mapEditorKey(press('?', { shiftKey: true })).action).toBe('toggleShortcuts');
		expect(mapEditorKey(press('?')).action).toBe('toggleShortcuts');
	});

	it('leaves Ctrl+? alone', () => {
		expect(mapEditorKey(press('?', { ctrlKey: true })).action).toBeNull();
	});
});

describe('isEditorTextInputTarget', () => {
	it('recognises form fields and contenteditable hosts', () => {
		expect(isEditorTextInputTarget({ tagName: 'INPUT' })).toBeTruthy();
		expect(isEditorTextInputTarget({ tagName: 'TEXTAREA' })).toBeTruthy();
		expect(isEditorTextInputTarget({ tagName: 'SELECT' })).toBeTruthy();
		expect(isEditorTextInputTarget({ tagName: 'DIV', isContentEditable: true })).toBeTruthy();
		expect(isEditorTextInputTarget({ tagName: 'DIV' })).toBeFalsy();
		expect(isEditorTextInputTarget(null)).toBeFalsy();
	});
});

describe('mapEditorKey find', () => {
	it('maps Ctrl+F and Cmd+F to "find"', () => {
		expect(mapEditorKey(press('f', { ctrlKey: true })).action).toBe('find');
		expect(mapEditorKey(press('f', { metaKey: true })).action).toBe('find');
	});

	it('matches the chord case-insensitively, so Ctrl+Shift+F still finds', () => {
		expect(mapEditorKey(press('F', { ctrlKey: true, shiftKey: true })).action).toBe('find');
	});

	it('stays live while text is being edited, the way PowerPoint does', () => {
		// This is the one behaviour that separates `find` from every other chord:
		// people reach for Ctrl+F with the caret already inside a text box, and
		// gating it on the typing guards would silently hand the chord back to
		// the browser exactly there.
		expect(mapEditorKey(press('f', { ctrlKey: true }), { isEditingText: true }).action).toBe(
			'find',
		);
		expect(mapEditorKey(press('f', { ctrlKey: true }), { isTextInputTarget: true }).action).toBe(
			'find',
		);
	});

	it('leaves a bare "f" and Ctrl+Alt+F to the host', () => {
		expect(mapEditorKey(press('f')).action).toBeNull();
		expect(mapEditorKey(press('f', { ctrlKey: true, altKey: true })).action).toBeNull();
	});

	it('is still gated on the editor being live', () => {
		expect(mapEditorKey(press('f', { ctrlKey: true }), { canEdit: false }).action).toBeNull();
		expect(mapEditorKey(press('f', { ctrlKey: true }), { isPresenting: true }).action).toBeNull();
	});
});

describe('mapEditorKey shortcut-panel chords', () => {
	it('maps both "?" and Ctrl/Cmd+/ to the same command', () => {
		expect(mapEditorKey(press('?')).action).toBe('toggleShortcuts');
		expect(mapEditorKey(press('/', { ctrlKey: true })).action).toBe('toggleShortcuts');
		expect(mapEditorKey(press('/', { metaKey: true })).action).toBe('toggleShortcuts');
	});

	it('leaves a bare "/" and Ctrl+Alt+/ alone, so typing a slash still types one', () => {
		expect(mapEditorKey(press('/')).action).toBeNull();
		expect(mapEditorKey(press('/', { ctrlKey: true, altKey: true })).action).toBeNull();
	});

	it('stands down while typing, exactly as "?" does', () => {
		// The two keys are one command, so they must share a side of the typing
		// gates. Opening a full-screen cheat sheet over the caret mid-sentence is
		// no better from Ctrl+/ than it would be from "?".
		expect(mapEditorKey(press('/', { ctrlKey: true }), { isEditingText: true }).action).toBeNull();
		expect(
			mapEditorKey(press('/', { ctrlKey: true }), { isTextInputTarget: true }).action,
		).toBeNull();
	});
});

describe('mapEditorKey paragraph alignment', () => {
	it.each([
		['l', 'alignLeft'],
		['e', 'alignCenter'],
		['r', 'alignRight'],
		['j', 'alignJustify'],
	] as const)('maps Ctrl+%s to %s while editing text', (key, action) => {
		expect(mapEditorKey(press(key, { ctrlKey: true }), { isEditingText: true }).action).toBe(
			action,
		);
	});

	it('also fires on a selected (not editing) text shape', () => {
		expect(mapEditorKey(press('e', { ctrlKey: true }), SELECTED).action).toBe('alignCenter');
	});

	it('does nothing with no selection and no active edit', () => {
		expect(mapEditorKey(press('l', { ctrlKey: true })).action).toBeNull();
	});

	it('does not hijack a foreign text input target that is not our editor', () => {
		expect(
			mapEditorKey(press('l', { ctrlKey: true }), { ...SELECTED, isTextInputTarget: true }).action,
		).toBeNull();
	});

	it('stands down while a drawing tool is armed', () => {
		expect(
			mapEditorKey(press('l', { ctrlKey: true }), { ...SELECTED, isDrawing: true }).action,
		).toBeNull();
	});
});

describe('mapEditorKey font-size ladder', () => {
	it('maps Ctrl+Shift+> and Ctrl+Shift+< while editing text', () => {
		expect(
			mapEditorKey(press('>', { ctrlKey: true, shiftKey: true }), { isEditingText: true }).action,
		).toBe('increaseFontSize');
		expect(
			mapEditorKey(press('<', { ctrlKey: true, shiftKey: true }), { isEditingText: true }).action,
		).toBe('decreaseFontSize');
	});

	it('maps the unshifted base key when shiftKey is still set', () => {
		expect(
			mapEditorKey(press('.', { ctrlKey: true, shiftKey: true }), { isEditingText: true }).action,
		).toBe('increaseFontSize');
		expect(
			mapEditorKey(press(',', { ctrlKey: true, shiftKey: true }), { isEditingText: true }).action,
		).toBe('decreaseFontSize');
	});

	it('leaves a bare "." or "," alone: they must not steal ordinary typing', () => {
		expect(mapEditorKey(press('.', { ctrlKey: true }), { isEditingText: true }).action).toBeNull();
		expect(mapEditorKey(press(',', { ctrlKey: true }), { isEditingText: true }).action).toBeNull();
	});

	it('maps Ctrl+] and Ctrl+[ (no Shift needed) on a selected text shape', () => {
		expect(mapEditorKey(press(']', { ctrlKey: true }), SELECTED).action).toBe('increaseFontSize');
		expect(mapEditorKey(press('[', { ctrlKey: true }), SELECTED).action).toBe('decreaseFontSize');
	});

	it('does nothing with no selection and no active edit', () => {
		expect(mapEditorKey(press(']', { ctrlKey: true })).action).toBeNull();
	});
});

describe('mapEditorKey format painter (copy/paste formatting)', () => {
	it('maps Ctrl+Shift+C and Ctrl+Shift+V while editing text', () => {
		expect(
			mapEditorKey(press('c', { ctrlKey: true, shiftKey: true }), { isEditingText: true }).action,
		).toBe('copyFormat');
		expect(
			mapEditorKey(press('v', { ctrlKey: true, shiftKey: true }), { isEditingText: true }).action,
		).toBe('pasteFormat');
	});

	it('also fires on a selected (not editing) shape', () => {
		expect(mapEditorKey(press('c', { ctrlKey: true, shiftKey: true }), SELECTED).action).toBe(
			'copyFormat',
		);
	});

	it('leaves plain Ctrl+C and Ctrl+V as ordinary clipboard copy/paste', () => {
		expect(mapEditorKey(press('c', { ctrlKey: true }), SELECTED).action).toBe('copy');
		expect(mapEditorKey(press('v', { ctrlKey: true })).action).toBe('paste');
	});

	it('does nothing with no selection and no active edit', () => {
		expect(mapEditorKey(press('c', { ctrlKey: true, shiftKey: true })).action).toBeNull();
	});
});

describe('mapEditorKey new slide', () => {
	it('maps Ctrl+M to newSlide', () => {
		expect(mapEditorKey(press('m', { ctrlKey: true })).action).toBe('newSlide');
	});

	it('is gated like an ordinary chord: not while editing text', () => {
		expect(mapEditorKey(press('m', { ctrlKey: true }), { isEditingText: true }).action).toBeNull();
	});
});

describe('mapEditorKey hyperlink dialog', () => {
	it('maps Ctrl+K while editing text', () => {
		expect(mapEditorKey(press('k', { ctrlKey: true }), { isEditingText: true }).action).toBe(
			'hyperlink',
		);
	});

	it('also fires on a selected (not editing) shape', () => {
		expect(mapEditorKey(press('k', { ctrlKey: true }), SELECTED).action).toBe('hyperlink');
	});

	it('does nothing with no selection and no active edit', () => {
		expect(mapEditorKey(press('k', { ctrlKey: true })).action).toBeNull();
	});
});

describe('mapEditorKey find & replace', () => {
	it('maps Ctrl/Cmd+H to findReplace', () => {
		expect(mapEditorKey(press('h', { ctrlKey: true })).action).toBe('findReplace');
		expect(mapEditorKey(press('h', { metaKey: true })).action).toBe('findReplace');
	});

	it('stays live while text is being edited, like Ctrl+F', () => {
		expect(mapEditorKey(press('h', { ctrlKey: true }), { isEditingText: true }).action).toBe(
			'findReplace',
		);
	});

	it('leaves a bare "h" and Ctrl+Alt+H to the host', () => {
		expect(mapEditorKey(press('h')).action).toBeNull();
		expect(mapEditorKey(press('h', { ctrlKey: true, altKey: true })).action).toBeNull();
	});
});

describe('mapEditorKey clear formatting', () => {
	it('maps Ctrl+Space while editing text', () => {
		expect(mapEditorKey(press(' ', { ctrlKey: true }), { isEditingText: true }).action).toBe(
			'clearFormatting',
		);
	});

	it('also fires on a selected (not editing) shape', () => {
		expect(mapEditorKey(press(' ', { ctrlKey: true }), SELECTED).action).toBe('clearFormatting');
	});

	it('does nothing with no selection and no active edit', () => {
		expect(mapEditorKey(press(' ', { ctrlKey: true })).action).toBeNull();
	});
});

describe('mapEditorKey selection cycling (Tab)', () => {
	it('maps Tab and Shift+Tab when nothing is being typed into', () => {
		expect(mapEditorKey(press('Tab')).action).toBe('cycleSelectionNext');
		expect(mapEditorKey(press('Tab', { shiftKey: true })).action).toBe('cycleSelectionPrev');
	});

	it('cycles with or without an existing selection', () => {
		expect(mapEditorKey(press('Tab'), SELECTED).action).toBe('cycleSelectionNext');
	});

	it('leaves Ctrl+Tab and Cmd+Tab to the browser/OS tab switcher', () => {
		expect(mapEditorKey(press('Tab', { ctrlKey: true })).action).toBeNull();
		expect(mapEditorKey(press('Tab', { metaKey: true })).action).toBeNull();
	});

	it('stands down while editing text, drawing, or in a foreign text field', () => {
		expect(mapEditorKey(press('Tab'), { isEditingText: true }).action).toBeNull();
		expect(mapEditorKey(press('Tab'), { isDrawing: true }).action).toBeNull();
		expect(mapEditorKey(press('Tab'), { isTextInputTarget: true }).action).toBeNull();
	});
});

describe('mapInlineTextFormatKey', () => {
	it('maps Ctrl/Cmd+B/I/U to their format property', () => {
		expect(mapInlineTextFormatKey(press('b', { ctrlKey: true }))).toBe('bold');
		expect(mapInlineTextFormatKey(press('i', { ctrlKey: true }))).toBe('italic');
		expect(mapInlineTextFormatKey(press('u', { metaKey: true }))).toBe('underline');
	});

	it('matches case-insensitively', () => {
		expect(mapInlineTextFormatKey(press('B', { ctrlKey: true }))).toBe('bold');
	});

	it('ignores a bare key and an Alt/Shift composition', () => {
		expect(mapInlineTextFormatKey(press('b'))).toBeNull();
		expect(mapInlineTextFormatKey(press('b', { ctrlKey: true, altKey: true }))).toBeNull();
		expect(mapInlineTextFormatKey(press('b', { ctrlKey: true, shiftKey: true }))).toBeNull();
	});

	it('ignores keys outside the b/i/u set', () => {
		expect(mapInlineTextFormatKey(press('x', { ctrlKey: true }))).toBeNull();
	});
});
