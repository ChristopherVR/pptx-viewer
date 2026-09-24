/**
 * Editor keyboard-shortcut customisation: turning shortcuts off and remapping
 * them onto other chords, layered over the shared `mapEditorKey` so every
 * binding keeps a single call site.
 *
 * @module render/customization/customization-keymap
 */
import { mapEditorKey } from '../editor-keymap';
import type {
	EditorKeyActionName,
	EditorKeyGuard,
	EditorKeyInput,
	EditorKeyResult,
} from '../editor-keymap';
import type { KeyboardCustomization, ShortcutChord } from './customization-types';

/** A parsed `Mod+Shift+D` chord. */
export interface ParsedShortcutChord {
	key: string;
	mod: boolean;
	ctrl: boolean;
	meta: boolean;
	alt: boolean;
	shift: boolean;
}

/** The normalised keyboard slice of a resolved customisation. */
export interface ResolvedKeyboardCustomization {
	disableAll: boolean;
	disabled: ReadonlySet<EditorKeyActionName>;
	remap: ReadonlyMap<EditorKeyActionName, readonly ParsedShortcutChord[]>;
}

/**
 * Commands a remap cannot move: `nudge` carries a direction and distance per
 * arrow key, and `escape` must stay the way out of every mode.
 */
const NOT_REMAPPABLE: ReadonlySet<EditorKeyActionName> = new Set(['nudge', 'escape']);

/** Commands the built-in keymap only fires with a selection. */
const SELECTION_GATED: ReadonlySet<EditorKeyActionName> = new Set([
	'copy',
	'cut',
	'duplicate',
	'delete',
	'group',
	'ungroup',
]);

/**
 * Parse `Mod+Shift+D` (case-insensitive modifiers, `+` separated; the last
 * segment is the `KeyboardEvent.key`). Returns `null` for an empty chord.
 * A literal plus key is written `Mod+Plus`.
 */
export function parseShortcutChord(chord: ShortcutChord): ParsedShortcutChord | null {
	const parts = chord
		.split('+')
		.map((part) => part.trim())
		.filter((part) => part.length > 0);
	const rawKey = parts.pop();
	if (!rawKey) {
		return null;
	}
	const parsed: ParsedShortcutChord = {
		key: rawKey.toLowerCase() === 'plus' ? '+' : rawKey,
		mod: false,
		ctrl: false,
		meta: false,
		alt: false,
		shift: false,
	};
	for (const part of parts) {
		switch (part.toLowerCase()) {
			case 'mod':
			case 'cmdorctrl':
				parsed.mod = true;
				break;
			case 'ctrl':
			case 'control':
				parsed.ctrl = true;
				break;
			case 'meta':
			case 'cmd':
				parsed.meta = true;
				break;
			case 'alt':
			case 'option':
				parsed.alt = true;
				break;
			case 'shift':
				parsed.shift = true;
				break;
			default:
				return null;
		}
	}
	return parsed;
}

/** True when a key press is `chord`. Letter keys compare case-insensitively. */
export function matchesShortcutChord(input: EditorKeyInput, chord: ParsedShortcutChord): boolean {
	const ctrl = Boolean(input.ctrlKey);
	const meta = Boolean(input.metaKey);
	if (chord.mod) {
		if (!(ctrl || meta) || (chord.ctrl && !ctrl) || (chord.meta && !meta)) {
			return false;
		}
	} else if (ctrl !== chord.ctrl || meta !== chord.meta) {
		return false;
	}
	if (Boolean(input.altKey) !== chord.alt) {
		return false;
	}
	// A shifted symbol ("?") is typed WITH Shift, so Shift is implied there.
	const shiftImplied = chord.key.length === 1 && !/[a-z0-9]/iu.test(chord.key);
	if (!shiftImplied && Boolean(input.shiftKey) !== chord.shift) {
		return false;
	}
	return input.key.toLowerCase() === chord.key.toLowerCase();
}

/** Normalise the keyboard slice of a customisation. */
export function resolveKeyboardCustomization(
	keyboard: KeyboardCustomization | undefined,
): ResolvedKeyboardCustomization {
	const remap = new Map<EditorKeyActionName, ParsedShortcutChord[]>();
	for (const [action, value] of Object.entries(keyboard?.remap ?? {}) as Array<
		[EditorKeyActionName, ShortcutChord | readonly ShortcutChord[] | undefined]
	>) {
		if (value === undefined || NOT_REMAPPABLE.has(action)) {
			continue;
		}
		const chords = (typeof value === 'string' ? [value] : value)
			.map(parseShortcutChord)
			.filter((chord): chord is ParsedShortcutChord => chord !== null);
		remap.set(action, chords);
	}
	return {
		disableAll: keyboard?.disableAll === true,
		disabled: new Set(keyboard?.disabled ?? []),
		remap,
	};
}

const NO_ACTION: EditorKeyResult = { action: null };

function remappedAction(
	input: EditorKeyInput,
	guard: Partial<EditorKeyGuard>,
	keyboard: ResolvedKeyboardCustomization,
): EditorKeyActionName | null {
	for (const [action, chords] of keyboard.remap) {
		if (keyboard.disabled.has(action) || !chords.some((c) => matchesShortcutChord(input, c))) {
			continue;
		}
		if (SELECTION_GATED.has(action) && !guard.hasSelection) {
			return null;
		}
		return action;
	}
	return null;
}

/**
 * `mapEditorKey` with the host's keyboard customisation applied: disabled
 * commands never fire, remapped commands answer to their new chord(s) instead
 * of the built-in one, and `disableAll` silences the editor keymap entirely.
 * The built-in mode and typing gates still apply to remapped chords.
 */
export function mapCustomizedEditorKey(
	input: EditorKeyInput,
	guard: Partial<EditorKeyGuard> = {},
	keyboard?: ResolvedKeyboardCustomization,
): EditorKeyResult {
	if (!keyboard) {
		return mapEditorKey(input, guard);
	}
	if (keyboard.disableAll) {
		return NO_ACTION;
	}
	const blocked =
		guard.isPresenting === true ||
		guard.canEdit === false ||
		guard.isEditingText === true ||
		guard.isDrawing === true ||
		guard.isTextInputTarget === true;
	if (!blocked && keyboard.remap.size > 0) {
		const action = remappedAction(input, guard, keyboard);
		if (action) {
			return { action };
		}
	}
	const result = mapEditorKey(input, guard);
	if (
		result.action &&
		(keyboard.disabled.has(result.action) || keyboard.remap.has(result.action))
	) {
		return NO_ACTION;
	}
	return result;
}
