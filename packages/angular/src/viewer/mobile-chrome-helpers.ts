/**
 * mobile-chrome-helpers.ts — Pure helper logic for mobile chrome state.
 *
 * Ported from: packages/react/src/viewer/components/mobile/MobileChromeOverlay.tsx
 *             and packages/react/src/viewer/components/mobile/MobileBottomBar.tsx
 *
 * No Angular imports — safe to use in both component and vitest contexts.
 *
 * These helpers capture the sheet open/close state machine that governs which
 * sheet is visible at any given time and which bottom-bar button appears active.
 * Keeping this logic as pure functions makes it straightforward to test and
 * trivial to adapt when the orchestrator wires the components together.
 */

// ---------------------------------------------------------------------------
// Sheet key type
// ---------------------------------------------------------------------------

/** All mobile sheets that can be open at one time. */
export type MobileSheetKey = 'slides' | 'menu' | null;

// ---------------------------------------------------------------------------
// Active-sheet toggle
// ---------------------------------------------------------------------------

/**
 * Compute the next sheet state when a bar button is tapped.
 *
 * Rules:
 *   - Tapping the already-open sheet closes it (returns `null`).
 *   - Tapping a different sheet opens it (and implicitly closes the other).
 *
 * @pure
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
 * The list is always the same six slots; only `disabled` changes. This makes
 * it easy to iterate in tests without spinning up Angular.
 *
 * @pure
 */
export function buildBarActions(opts: {
	activeIndex: number;
	slideCount: number;
	canPresent: boolean;
	slidesOpen: boolean;
	menuOpen: boolean;
}): ActionDescriptor[] {
	const { activeIndex, slideCount, canPresent } = opts;
	const noSlides = slideCount === 0;

	return [
		{ key: 'prev', label: 'Prev', disabled: activeIndex <= 0 },
		{ key: 'slides', label: 'Slides', disabled: noSlides },
		{ key: 'find', label: 'Find', disabled: noSlides },
		{ key: 'present', label: 'Present', disabled: !canPresent || noSlides },
		{ key: 'menu', label: 'More', disabled: false },
		{ key: 'next', label: 'Next', disabled: activeIndex >= slideCount - 1 },
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
 *
 * @pure
 */
export function sheetAfterNavigate(current: MobileSheetKey): MobileSheetKey {
	return current === 'menu' ? null : current;
}
