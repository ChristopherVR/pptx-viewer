/**
 * The slide-sorter keymap: one source of truth for the sorter overlay's keys.
 *
 * The sorter is a second editing surface with its own keyboard, and it drifted
 * exactly the way the main editor keymap did before `mapEditorKey` existed. Only
 * React ever had the full set (Ctrl+C / V / D / A, Delete, Ctrl+plus / minus,
 * Escape); Vue had Delete and Ctrl+D; Angular had Escape alone; Svelte and
 * Vanilla had no sorter keyboard at all, so Escape did not even close the
 * overlay. Five hand-written handlers, five different answers.
 *
 * Resolution therefore lives here, framework-free, and each binding supplies the
 * guard state plus the callbacks for the commands its sorter can actually
 * perform. A binding that has no slide clipboard simply has no `copy` callback:
 * the map still names the action, so adding the capability later is wiring, not
 * another hand-written key test.
 *
 * @module render/slide-sorter-keymap
 */

// ---------------------------------------------------------------------------
// Zoom
// ---------------------------------------------------------------------------

/** Smallest thumbnail zoom the sorter allows, in percent. */
export const SORTER_MIN_ZOOM = 50;

/** Largest thumbnail zoom the sorter allows, in percent. */
export const SORTER_MAX_ZOOM = 200;

/** Percentage points one Ctrl+plus / Ctrl+minus press moves the zoom. */
export const SORTER_ZOOM_STEP = 10;

/** Clamp a sorter zoom percentage into the supported range. */
export function clampSorterZoom(zoom: number): number {
	return Math.min(SORTER_MAX_ZOOM, Math.max(SORTER_MIN_ZOOM, zoom));
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** A logical slide-sorter command produced by one key press. */
export type SlideSorterKeyActionName =
	/** Dismiss the overlay. */
	| 'close'
	/**
	 * Shrink a multi-slide selection back to the active slide. PowerPoint's
	 * Escape unwinds one layer at a time, so it only closes the sorter once
	 * there is nothing left to collapse.
	 */
	| 'collapseSelection'
	| 'copy'
	| 'paste'
	| 'duplicate'
	| 'delete'
	| 'selectAll'
	| 'zoomIn'
	| 'zoomOut';

/** Result of resolving one key press; `null` means "not ours, leave it alone". */
export interface SlideSorterKeyResult {
	action: SlideSorterKeyActionName | null;
}

/** Keyboard event shape consumed by {@link mapSlideSorterKey}. */
export interface SlideSorterKeyInput {
	key: string;
	ctrlKey?: boolean;
	metaKey?: boolean;
	shiftKey?: boolean;
	altKey?: boolean;
}

/** The binding state the sorter keymap gates on. */
export interface SlideSorterKeyGuard {
	/** Editing is enabled on the host; a read-only sorter still copies and closes. */
	canEdit: boolean;
	/** More than one slide is selected, so Escape collapses before it closes. */
	hasMultiSelection: boolean;
	/** The event originated in an `<input>`, `<textarea>`, `<select>` or contenteditable. */
	isTextInputTarget: boolean;
}

/** Guard defaults, so a caller only states the flags it actually tracks. */
const GUARD_DEFAULTS: SlideSorterKeyGuard = {
	canEdit: true,
	hasMultiSelection: false,
	isTextInputTarget: false,
};

/** Nothing matched; hoisted so the common path allocates no object. */
const NO_ACTION: SlideSorterKeyResult = { action: null };

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

/**
 * Resolve one key press to a slide-sorter command.
 *
 * Order is load-bearing:
 *  1. `Escape`, which stays live even from a rename field so it can always back
 *     out (it collapses a multi-selection first, then closes the overlay);
 *  2. the typing gate, so a slide-title rename does not lose a character to
 *     Delete or get duplicated by Ctrl+D;
 *  3. Delete/Backspace and the Ctrl/Cmd chords.
 *
 * Commands that write to the deck (paste, duplicate, delete) return `null` on a
 * read-only host rather than firing a no-op, so the caller does not
 * `preventDefault()` a key it did not act on. Copy, select-all, zoom and the two
 * Escape outcomes are not edit-gated: they only change what is on screen.
 */
export function mapSlideSorterKey(
	input: SlideSorterKeyInput,
	guard: Partial<SlideSorterKeyGuard> = {},
): SlideSorterKeyResult {
	const state = { ...GUARD_DEFAULTS, ...guard };
	const { key } = input;

	if (key === 'Escape') {
		return { action: state.hasMultiSelection ? 'collapseSelection' : 'close' };
	}

	if (state.isTextInputTarget) {
		return NO_ACTION;
	}

	if (key === 'Delete' || key === 'Backspace') {
		return state.canEdit ? { action: 'delete' } : NO_ACTION;
	}

	if (!(input.ctrlKey || input.metaKey) || input.altKey) {
		return NO_ACTION;
	}

	switch (key.toLowerCase()) {
		case 'c':
			return { action: 'copy' };
		case 'v':
			return state.canEdit ? { action: 'paste' } : NO_ACTION;
		case 'd':
			return state.canEdit ? { action: 'duplicate' } : NO_ACTION;
		case 'a':
			return { action: 'selectAll' };
		// The zoom pair is spelled differently by layout and by browser: the key
		// on a US keyboard is "=", it reports "+" when Shift is held, and the
		// numeric keypad sends "Add"/"Subtract" on older engines. Matching only
		// "=" (which is what a hand-written handler tends to do) leaves Ctrl+Shift
		// +plus dead on the very keyboards whose users press it.
		case '=':
		case '+':
		case 'add':
			return { action: 'zoomIn' };
		case '-':
		case '_':
		case 'subtract':
			return { action: 'zoomOut' };
		default:
			return NO_ACTION;
	}
}
