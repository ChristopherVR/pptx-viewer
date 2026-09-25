import { resolveCustomization } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import { resolveShortcutAction } from './useKeyboardShortcuts';
import type { ShortcutGuardState } from './useKeyboardShortcuts';

const GUARD: ShortcutGuardState = {
	canEdit: true,
	isPresenting: false,
	hasSelection: true,
	inlineEditingElementId: null,
	tableEditorIsEditing: false,
	activeTool: 'select',
	isTextInput: false,
};

describe('resolveShortcutAction with the host keyboard customisation', () => {
	it('keeps the built-in keymap when nothing is customised', () => {
		expect(resolveShortcutAction('z', true, false, GUARD).action).toBe('undo');
	});

	it('silences a disabled shortcut', () => {
		const { keyboard } = resolveCustomization({ keyboard: { disabled: ['undo'] } });
		expect(resolveShortcutAction('z', true, false, GUARD, false, keyboard).action).toBeNull();
	});

	it('moves a remapped shortcut onto its new chord', () => {
		const { keyboard } = resolveCustomization({
			keyboard: { remap: { duplicate: 'Mod+Shift+K' } },
		});
		expect(resolveShortcutAction('d', true, false, GUARD, false, keyboard).action).toBeNull();
		expect(resolveShortcutAction('K', true, true, GUARD, false, keyboard).action).toBe('duplicate');
	});

	it('silences everything under disableAll', () => {
		const { keyboard } = resolveCustomization({ keyboard: { disableAll: true } });
		expect(resolveShortcutAction('c', true, false, GUARD, false, keyboard).action).toBeNull();
	});
});
