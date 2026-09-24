import { describe, expect, it } from 'vitest';

import {
	mapCustomizedEditorKey,
	matchesShortcutChord,
	parseShortcutChord,
	resolveKeyboardCustomization,
} from './customization-keymap';

describe('parseShortcutChord', () => {
	it('parses modifiers and the key', () => {
		expect(parseShortcutChord('Mod+Shift+D')).toStrictEqual({
			key: 'D',
			mod: true,
			ctrl: false,
			meta: false,
			alt: false,
			shift: true,
		});
		expect(parseShortcutChord('Mod+Plus')?.key).toBe('+');
		expect(parseShortcutChord('Hyper+D')).toBeNull();
		expect(parseShortcutChord('')).toBeNull();
	});

	it('matches Mod against Ctrl or Cmd, letters case-insensitively', () => {
		const chord = parseShortcutChord('Mod+Shift+D');
		expect(chord).not.toBeNull();
		if (!chord) {
			return;
		}
		expect(matchesShortcutChord({ key: 'd', ctrlKey: true, shiftKey: true }, chord)).toBeTruthy();
		expect(matchesShortcutChord({ key: 'D', metaKey: true, shiftKey: true }, chord)).toBeTruthy();
		expect(matchesShortcutChord({ key: 'd', ctrlKey: true }, chord)).toBeFalsy();
		expect(
			matchesShortcutChord({ key: 'd', ctrlKey: true, shiftKey: true, altKey: true }, chord),
		).toBeFalsy();
	});
});

describe('mapCustomizedEditorKey', () => {
	const selected = { hasSelection: true };

	it('behaves exactly like mapEditorKey with no customisation', () => {
		expect(mapCustomizedEditorKey({ key: 'd', ctrlKey: true }, selected).action).toBe('duplicate');
		expect(
			mapCustomizedEditorKey(
				{ key: 'd', ctrlKey: true },
				selected,
				resolveKeyboardCustomization({}),
			).action,
		).toBe('duplicate');
	});

	it('disables commands and everything', () => {
		const keyboard = resolveKeyboardCustomization({ disabled: ['duplicate'] });
		expect(
			mapCustomizedEditorKey({ key: 'd', ctrlKey: true }, selected, keyboard).action,
		).toBeNull();
		expect(mapCustomizedEditorKey({ key: 'z', ctrlKey: true }, selected, keyboard).action).toBe(
			'undo',
		);
		const all = resolveKeyboardCustomization({ disableAll: true });
		expect(mapCustomizedEditorKey({ key: 'z', ctrlKey: true }, selected, all).action).toBeNull();
	});

	it('moves a remapped command off its built-in chord onto the new one', () => {
		const keyboard = resolveKeyboardCustomization({ remap: { duplicate: 'Mod+Shift+D' } });
		expect(
			mapCustomizedEditorKey({ key: 'd', ctrlKey: true }, selected, keyboard).action,
		).toBeNull();
		expect(
			mapCustomizedEditorKey({ key: 'D', ctrlKey: true, shiftKey: true }, selected, keyboard)
				.action,
		).toBe('duplicate');
	});

	it('keeps the built-in gates for remapped chords', () => {
		const keyboard = resolveKeyboardCustomization({ remap: { duplicate: 'Mod+Shift+D' } });
		const chord = { key: 'D', ctrlKey: true, shiftKey: true };
		expect(mapCustomizedEditorKey(chord, { hasSelection: false }, keyboard).action).toBeNull();
		expect(
			mapCustomizedEditorKey(chord, { ...selected, canEdit: false }, keyboard).action,
		).toBeNull();
		expect(
			mapCustomizedEditorKey(chord, { ...selected, isTextInputTarget: true }, keyboard).action,
		).toBeNull();
	});

	it('ignores remaps of nudge and escape', () => {
		const keyboard = resolveKeyboardCustomization({ remap: { escape: 'Mod+Q', nudge: 'Mod+N' } });
		expect(keyboard.remap.size).toBe(0);
	});
});
