/**
 * Pure helper logic for mobile chrome state, shared by every binding.
 *
 * These helpers capture the sheet open/close state machine that governs which
 * sheet is visible at any given time and which bottom-bar button appears active.
 * Keeping this logic as pure functions makes it straightforward to test and
 * trivial to adapt when each binding wires the components together.
 */

// ---------------------------------------------------------------------------
// Sheet key type
// ---------------------------------------------------------------------------

/** All mobile sheets that can be open at one time. */
export type MobileSheetKey =
	| 'slides'
	| 'menu'
	| 'insert'
	| 'inspector'
	| 'comments'
	| 'notes'
	| null;

// ---------------------------------------------------------------------------
// Active-sheet toggle
// ---------------------------------------------------------------------------

/**
 * Compute the next sheet state when a bar button is tapped.
 *
 * Rules:
 *   - Tapping the already-open sheet closes it (returns `null`).
 *   - Tapping a different sheet opens it (and implicitly closes the other).
 */
export function toggleSheet(
	current: MobileSheetKey,
	tapped: Exclude<MobileSheetKey, null>,
): MobileSheetKey {
	return current === tapped ? null : tapped;
}

// ---------------------------------------------------------------------------
// Visible-action list builder
// ---------------------------------------------------------------------------

/** Lightweight descriptor for a visible action. */
export interface ActionDescriptor {
	key: string;
	label: string;
	disabled: boolean;
}

/**
 * Build the ordered list of visible bottom-bar action descriptors given the
 * current presentation state.
 *
 * The list is always the same five slots (Slides, Insert, Format, Comments,
 * Notes); only `disabled` changes. This makes it easy to iterate in tests
 * without spinning up a framework.
 */
export function buildBarActions(opts: { slideCount: number }): ActionDescriptor[] {
	const { slideCount } = opts;
	const noSlides = slideCount === 0;

	return [
		{ key: 'slides', label: 'Slides', disabled: noSlides },
		{ key: 'insert', label: 'Insert', disabled: noSlides },
		{ key: 'inspector', label: 'Format', disabled: noSlides },
		{ key: 'comments', label: 'Comments', disabled: noSlides },
		{ key: 'notes', label: 'Notes', disabled: noSlides },
	];
}

// ---------------------------------------------------------------------------
// Dismiss-on-navigate helper
// ---------------------------------------------------------------------------

/**
 * Return the sheet that should be open after the user navigates to a new slide
 * via the bottom bar prev/next buttons.
 *
 * Convention: navigation does NOT close the slides sheet (the user may want to
 * browse thumbnails while paging), but it DOES close the menu sheet (which is
 * an interruption).
 */
export function sheetAfterNavigate(current: MobileSheetKey): MobileSheetKey {
	return current === 'menu' ? null : current;
}
