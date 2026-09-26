/**
 * The editor keymap: one source of truth for "what does this key do".
 *
 * The keymap is the part of the editor a user memorises, so it is also the part
 * that must be identical in every binding. Before this module each binding
 * carried its own hand-ported copy (a React `switch`, a Vue matcher table, an
 * Angular service, two vanilla/Svelte handlers), and they drifted: the nudge
 * step was 2/20 in two of them and 1/10 in the other three, Ctrl+A existed in
 * three, Ctrl+G in one, and `?` in one. Key-to-action resolution therefore lives
 * here, framework-free and unit-testable, and each binding only supplies the
 * guard state and the callbacks.
 *
 * The same drift recurred with Ctrl+F: all five bindings ship a find bar, but
 * only React and Vue ever hand-wired the chord to open it, so on Angular,
 * Svelte and Vanilla the shortcut fell through to the browser's own find (which
 * cannot see text inside the slide model). It is in the map now, which is the
 * point: a shortcut that is not here is a shortcut three bindings will miss.
 *
 * Deliberately NOT here: what "escape" or "toggleShortcuts" then does. Closing a
 * format painter, an inline editor, a context menu or the help panel is view
 * state that only the binding owns, so the map stops at naming the action.
 *
 * @module render/editor-keymap
 */

import { editorNudgeDelta, editorSlideStep } from './editor-keymap-arrows';
import { resolveChord, resolveLiveFormatChord } from './editor-keymap-chords';

export {
	NUDGE_LARGE,
	NUDGE_SMALL,
	editorNudgeDelta,
	editorSlideStep,
} from './editor-keymap-arrows';
export { mapInlineTextFormatKey } from './editor-keymap-chords';
export { isEditorControlTarget, isEditorTextInputTarget } from './editor-key-target';
export type { InlineTextFormatProperty } from './editor-keymap-chords';

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** A logical editor command produced by one key press. */
export type EditorKeyActionName =
	| 'undo'
	| 'redo'
	| 'copy'
	| 'cut'
	| 'paste'
	| 'duplicate'
	| 'delete'
	| 'selectAll'
	| 'group'
	| 'ungroup'
	| 'nudge'
	| 'prevSlide'
	| 'nextSlide'
	| 'escape'
	| 'find'
	| 'findReplace'
	| 'toggleShortcuts'
	| 'alignLeft'
	| 'alignCenter'
	| 'alignRight'
	| 'alignJustify'
	| 'increaseFontSize'
	| 'decreaseFontSize'
	| 'copyFormat'
	| 'pasteFormat'
	| 'newSlide'
	| 'hyperlink'
	| 'clearFormatting'
	| 'cycleSelectionNext'
	| 'cycleSelectionPrev'
	| 'pasteSpecial';

/** Result of resolving one key press; `null` means "not ours, leave it alone". */
export interface EditorKeyResult {
	action: EditorKeyActionName | null;
	/** Horizontal nudge in slide pixels (only set when `action === 'nudge'`). */
	dx?: number;
	/** Vertical nudge in slide pixels (only set when `action === 'nudge'`). */
	dy?: number;
}

/** Keyboard event shape consumed by {@link mapEditorKey}. */
export interface EditorKeyInput {
	key: string;
	ctrlKey?: boolean;
	metaKey?: boolean;
	shiftKey?: boolean;
	altKey?: boolean;
}

/** The binding state the keymap gates on. */
export interface EditorKeyGuard {
	/** Editing is enabled on the host. */
	canEdit: boolean;
	/** A slide show is running; the show keymap owns the keyboard instead. */
	isPresenting: boolean;
	/** At least one element is selected. */
	hasSelection: boolean;
	/** False leaves paste to the browser/host when no internal paste is available. */
	canPaste?: boolean;
	/** An inline text or table-cell editor is open. */
	isEditingText: boolean;
	/** A drawing tool other than the selection arrow is armed. */
	isDrawing: boolean;
	/** The event originated in an `<input>`, `<textarea>`, `<select>` or contenteditable. */
	isTextInputTarget: boolean;
	/**
	 * The event originated on a focusable chrome control (see
	 * `isEditorControlTarget`), where Tab is the browser's focus navigation.
	 */
	isControlTarget: boolean;
}

/** Guard defaults, so a caller only states the flags it actually tracks. */
const GUARD_DEFAULTS: EditorKeyGuard = {
	canEdit: true,
	isPresenting: false,
	hasSelection: false,
	canPaste: true,
	isEditingText: false,
	isDrawing: false,
	isTextInputTarget: false,
	isControlTarget: false,
};

// ---------------------------------------------------------------------------
// Target inspection
// ---------------------------------------------------------------------------

// `isEditorTextInputTarget` / `isEditorControlTarget` live in
// `./editor-key-target` and are re-exported above.

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

/** Nothing matched; hoisted so the common path allocates no object. */
const NO_ACTION: EditorKeyResult = { action: null };

/**
 * Resolve one key press to an editor command.
 *
 * Order is load-bearing:
 *  1. the mode gate (no editing while presenting or on a read-only host);
 *  2. `Escape`, which stays live even mid-edit so it can always cancel;
 *  3. Ctrl/Cmd+F and Ctrl/Cmd+H, live mid-edit for the same reason (see below);
 *  4. the live-format chords (alignment, font size, format painter, hyperlink,
 *     clear formatting), which survive the typing gate but only when the key
 *     press targets our own text (mid-edit, or a selection with nothing else
 *     focused) so a foreign input field is never hijacked;
 *  5. the typing gates, so every other shortcut never fires out of a text field;
 *  6. `?` and Ctrl/Cmd+`/` (one command, two keys), before the other chords,
 *     because `?` is a bare printable key;
 *  7. Delete/Backspace, Tab (selection cycling), chords, arrows.
 *
 * Selection-gated commands (copy, cut, duplicate, delete, nudge, group,
 * ungroup) return `null` with an empty selection rather than firing a no-op, so
 * the caller does not `preventDefault()` a key it did not act on. Undo, redo,
 * paste, select-all and the help panel are not selection-gated.
 */
export function mapEditorKey(
	input: EditorKeyInput,
	guard: Partial<EditorKeyGuard> = {},
): EditorKeyResult {
	const state = { ...GUARD_DEFAULTS, ...guard };
	const { key } = input;

	if (state.isPresenting || !state.canEdit) {
		return NO_ACTION;
	}

	// Escape is handled even while inline-editing: it is the way out.
	if (key === 'Escape') {
		return { action: 'escape' };
	}

	const mod = Boolean(input.ctrlKey || input.metaKey);
	const alt = Boolean(input.altKey);

	// Ctrl/Cmd+F is the second chord that outranks the typing gates. PowerPoint
	// opens Find with the caret sitting in a text box, and the browser's own
	// find bar is what the user gets otherwise, so gating it on "not typing"
	// would make the shortcut fail in the one place people reach for it most.
	// It is still behind the mode gate above: a read-only or presenting host
	// leaves Ctrl+F to the browser.
	if (mod && !alt && key.toLowerCase() === 'f') {
		return { action: 'find' };
	}

	// Ctrl/Cmd+H (Find & Replace) is the same category of command as Ctrl+F, so
	// it gets the same exemption for the same reason.
	if (mod && !alt && key.toLowerCase() === 'h') {
		return { action: 'findReplace' };
	}

	// Ctrl/Cmd+Alt+V (Paste Special) is exempt from the typing gate for the
	// same reason Ctrl+F is: PowerPoint offers Paste Special with the caret
	// sitting inside a text box, and `isTextInputTarget` still keeps it out of
	// a foreign input/textarea/select. It shares plain Paste's `canPaste`
	// guard so a host with nothing internal to offer leaves it to the browser.
	if (mod && alt && key.toLowerCase() === 'v' && !state.isTextInputTarget) {
		return state.canPaste === false ? NO_ACTION : { action: 'pasteSpecial' };
	}

	// Alignment, font-size stepping, format painter, hyperlink and clear-format
	// are PowerPoint text commands: their main use is a caret or a text range
	// mid-edit, which the typing gate below would otherwise swallow entirely.
	// They still must not steal a chord aimed at some other field (a rename box,
	// a dialog input), so the guard here is narrower than Ctrl+F's: allowed
	// while actively editing our text, or with a selection and nothing else
	// (foreign) focused. A match that fails the guard is claimed and dropped
	// (NO_ACTION) rather than falling through, so e.g. Ctrl+K with nothing
	// selected does not leak to the browser's own shortcut for that chord.
	if (mod && !alt) {
		const liveFormat = resolveLiveFormatChord(key, Boolean(input.shiftKey));
		if (liveFormat) {
			const targetsOurText =
				state.isEditingText || (state.hasSelection && !state.isTextInputTarget);
			return !state.isDrawing && targetsOurText ? liveFormat : NO_ACTION;
		}
	}

	if (state.isEditingText || state.isDrawing || state.isTextInputTarget) {
		return NO_ACTION;
	}

	// "?" is Shift+/ on most layouts, so it cannot be gated on `!shiftKey`.
	if (key === '?' && !mod && !alt) {
		return { action: 'toggleShortcuts' };
	}

	// Ctrl/Cmd+/ is the same command reached without a Shift: on a layout where
	// "?" needs AltGr (French, German) the bare key is close to unusable, so Vue
	// hand-wired this chord and the other four never got it. It sits here, WITH
	// "?" and below the typing gates, on purpose: the two keys are one command,
	// and a command that opened a full-screen cheat sheet over the caret while
	// the user was mid-sentence would be worse from one key than the other.
	if (mod && !alt && key === '/') {
		return { action: 'toggleShortcuts' };
	}

	if ((key === 'Delete' || key === 'Backspace') && state.hasSelection) {
		return { action: 'delete' };
	}

	// Tab cycles the selection through the slide's elements when nothing is
	// being typed into; Ctrl+Tab / Cmd+Tab are the browser/OS's own tab
	// switchers and must be left alone. Tab on a chrome control (a ribbon
	// button, a File backstage row, a dialog field) is focus navigation.
	if (key === 'Tab' && !mod && !alt && !state.isControlTarget) {
		return { action: input.shiftKey ? 'cycleSelectionPrev' : 'cycleSelectionNext' };
	}

	if (mod && !alt) {
		const chord = resolveChord(key, Boolean(input.shiftKey), state.hasSelection);
		if (chord) {
			if (chord.action === 'paste' && state.canPaste === false) {
				return NO_ACTION;
			}
			return chord;
		}
	}

	const paging = editorSlideStep(key, state.hasSelection, mod || alt);
	if (paging) {
		return { action: paging };
	}
	if (state.hasSelection) {
		const delta = editorNudgeDelta(key, Boolean(input.shiftKey));
		return delta ? { action: 'nudge', dx: delta.dx, dy: delta.dy } : NO_ACTION;
	}

	return NO_ACTION;
}
