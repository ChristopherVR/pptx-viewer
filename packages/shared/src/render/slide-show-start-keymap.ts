/**
 * The start-a-show keys: PowerPoint's `F5` (From Beginning) and `Shift+F5`
 * (From Current Slide).
 *
 * These live apart from {@link mapEditorKey} on purpose. The editor keymap is
 * gated on "the host can edit" and on "the caret is not in a text field", and
 * both gates are wrong for F5: a read-only viewer can start a show from its
 * toolbar, so it can start one from the keyboard too, and PowerPoint starts the
 * show with the caret sitting in a text box. The only gate that applies is "no
 * show is running", because the show keymap owns the keyboard then and a second
 * F5 in PowerPoint does nothing.
 *
 * The browser owns F5 by default (reload), which is why no binding ever mapped
 * it; every one of the five shipped a "From Beginning" button and none of them
 * the key that PowerPoint users reach for first. A `keydown` listener that
 * calls `preventDefault()` keeps the reload from firing, and the modifier
 * check leaves `Ctrl+F5` (hard reload) to the browser.
 *
 * @module render/slide-show-start-keymap
 */

/** Which slide the show opens on. */
export type SlideShowStartAction = 'fromBeginning' | 'fromCurrent';

/** Keyboard event shape consumed by {@link mapSlideShowStartKey}. */
export interface SlideShowStartKeyInput {
	key: string;
	ctrlKey?: boolean;
	metaKey?: boolean;
	shiftKey?: boolean;
	altKey?: boolean;
}

/** The binding state the start keys gate on. */
export interface SlideShowStartKeyGuard {
	/** A slide show (or rehearsal) is already running; the show keymap owns F5. */
	isPresenting: boolean;
}

/**
 * Resolve one key press to a start-show action, or `null` when the key is not
 * F5, carries a Ctrl/Cmd/Alt modifier, or arrives while a show is running.
 *
 * `Shift+F5` is "From Current Slide"; a bare `F5` is "From Beginning". Both are
 * PowerPoint's own bindings. Callers must `preventDefault()` on a non-null
 * result, or the browser reloads the page underneath the show.
 */
export function mapSlideShowStartKey(
	input: SlideShowStartKeyInput,
	guard: SlideShowStartKeyGuard,
): SlideShowStartAction | null {
	if (guard.isPresenting || input.key !== 'F5') {
		return null;
	}
	if (input.ctrlKey || input.metaKey || input.altKey) {
		return null;
	}
	return input.shiftKey ? 'fromCurrent' : 'fromBeginning';
}
