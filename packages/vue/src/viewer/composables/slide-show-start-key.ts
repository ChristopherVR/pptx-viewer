import { mapSlideShowStartKey } from 'pptx-viewer-shared';

/**
 * The "From Beginning" / "From Current Slide" entry points, named exactly like
 * `usePresentationControls`'s `presentFromBeginning` / `startPresenting` so a
 * caller can pass those functions straight through: F5 and Shift+F5 must
 * behave identically to the ribbon buttons that call them, custom shows and
 * range-seeding included.
 */
export interface SlideShowStartKeyActions {
	/** Bare F5: the show's first slide, unconditionally. */
	presentFromBeginning: () => void;
	/** Shift+F5: the active slide (or the nearest show slide). */
	startPresenting: () => void;
}

/**
 * Resolve a keydown against the shared start-show keymap and dispatch it.
 *
 * Kept out of `useKeyboardShortcuts`'s registry on purpose: `mapSlideShowStartKey`
 * (pptx-viewer-shared) is gated only on "no show is already running", not on
 * `canEdit` or "not a text input" like the editor shortcuts are, because
 * PowerPoint starts a show with the caret sitting in a text box and a
 * read-only viewer can still start one from its toolbar. Callers must invoke
 * this BEFORE the editor keymap so it isn't shadowed by those gates.
 *
 * Returns whether the event was consumed (and `preventDefault()`ed already),
 * so the caller can skip its own dispatch when it was.
 */
export function dispatchSlideShowStartKey(
	event: KeyboardEvent,
	isPresenting: boolean,
	actions: SlideShowStartKeyActions,
): boolean {
	const action = mapSlideShowStartKey(event, { isPresenting });
	if (action === null) {
		return false;
	}
	event.preventDefault();
	if (action === 'fromBeginning') {
		actions.presentFromBeginning();
	} else {
		actions.startPresenting();
	}
	return true;
}
