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

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

/**
 * Slide pixels an unmodified arrow key moves the selection.
 *
 * PowerPoint nudges by the smallest unit it can draw, and the ribbon's position
 * boxes are authored in the same slide-pixel space the renderer lays out in, so
 * one arrow press must equal one slide pixel or the numbers in the inspector
 * disagree with what the keyboard does.
 */
export const NUDGE_SMALL = 1;

/** Slide pixels a Shift+arrow moves the selection (ten small steps). */
export const NUDGE_LARGE = 10;

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
	| 'toggleShortcuts';

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
	/** An inline text or table-cell editor is open. */
	isEditingText: boolean;
	/** A drawing tool other than the selection arrow is armed. */
	isDrawing: boolean;
	/** The event originated in an `<input>`, `<textarea>`, `<select>` or contenteditable. */
	isTextInputTarget: boolean;
}

/** Guard defaults, so a caller only states the flags it actually tracks. */
const GUARD_DEFAULTS: EditorKeyGuard = {
	canEdit: true,
	isPresenting: false,
	hasSelection: false,
	isEditingText: false,
	isDrawing: false,
	isTextInputTarget: false,
};

// ---------------------------------------------------------------------------
// Target inspection
// ---------------------------------------------------------------------------

const FORM_FIELD_TAGS = /^(?:INPUT|TEXTAREA|SELECT)$/u;

/**
 * True when a key press is the user typing into a field rather than driving the
 * editor. Kept here so every binding classifies the same targets: a binding that
 * forgot `<select>` would swallow the arrow keys of its own dropdowns.
 */
export function isEditorTextInputTarget(target: unknown): boolean {
	const element = target as { tagName?: string; isContentEditable?: boolean } | null;
	if (!element || typeof element.tagName !== 'string') {
		return false;
	}
	return FORM_FIELD_TAGS.test(element.tagName) || element.isContentEditable === true;
}

/** Map an arrow key to a nudge delta in slide pixels, or `null` for other keys. */
export function editorNudgeDelta(key: string, large: boolean): { dx: number; dy: number } | null {
	const step = large ? NUDGE_LARGE : NUDGE_SMALL;
	switch (key) {
		case 'ArrowLeft':
			return { dx: -step, dy: 0 };
		case 'ArrowRight':
			return { dx: step, dy: 0 };
		case 'ArrowUp':
			return { dx: 0, dy: -step };
		case 'ArrowDown':
			return { dx: 0, dy: step };
		default:
			return null;
	}
}

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
 *  3. Ctrl/Cmd+F, live mid-edit for the same reason (see below);
 *  4. the typing gates, so a shortcut never fires out of a text field;
 *  5. `?` and Ctrl/Cmd+`/` (one command, two keys), before the other chords,
 *     because `?` is a bare printable key;
 *  6. Delete/Backspace, chords, arrows.
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

	// Ctrl/Cmd+F is the second chord that outranks the typing gates. PowerPoint
	// opens Find with the caret sitting in a text box, and the browser's own
	// find bar is what the user gets otherwise, so gating it on "not typing"
	// would make the shortcut fail in the one place people reach for it most.
	// It is still behind the mode gate above: a read-only or presenting host
	// leaves Ctrl+F to the browser.
	if ((input.ctrlKey || input.metaKey) && !input.altKey && key.toLowerCase() === 'f') {
		return { action: 'find' };
	}

	if (state.isEditingText || state.isDrawing || state.isTextInputTarget) {
		return NO_ACTION;
	}

	const mod = Boolean(input.ctrlKey || input.metaKey);
	const alt = Boolean(input.altKey);

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

	if (mod && !alt) {
		const chord = resolveChord(key, Boolean(input.shiftKey), state.hasSelection);
		if (chord) {
			return chord;
		}
	}

	if (state.hasSelection) {
		const delta = editorNudgeDelta(key, Boolean(input.shiftKey));
		if (delta) {
			return { action: 'nudge', dx: delta.dx, dy: delta.dy };
		}
		return NO_ACTION;
	}

	// With nothing selected the horizontal arrows page through the deck, which
	// is what a viewer-first user expects when no element has the keyboard.
	if (key === 'ArrowLeft') {
		return { action: 'prevSlide' };
	}
	if (key === 'ArrowRight') {
		return { action: 'nextSlide' };
	}

	return NO_ACTION;
}

/** Resolve a Ctrl/Cmd chord, or `null` when the chord is not part of the map. */
function resolveChord(
	key: string,
	shiftKey: boolean,
	hasSelection: boolean,
): EditorKeyResult | null {
	switch (key.toLowerCase()) {
		case 'z':
			return { action: shiftKey ? 'redo' : 'undo' };
		case 'y':
			return { action: 'redo' };
		case 'c':
			return hasSelection ? { action: 'copy' } : null;
		case 'x':
			return hasSelection ? { action: 'cut' } : null;
		case 'v':
			return { action: 'paste' };
		case 'd':
			return hasSelection ? { action: 'duplicate' } : null;
		case 'a':
			return { action: 'selectAll' };
		case 'g':
			// Shift+Ctrl+G is PowerPoint's ungroup; both need something selected.
			return hasSelection ? { action: shiftKey ? 'ungroup' : 'group' } : null;
		default:
			return null;
	}
}
