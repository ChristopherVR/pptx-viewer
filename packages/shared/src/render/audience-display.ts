/**
 * `audience-display`: the policy that governs a tab opened as a presenter's
 * **audience display** (the second window a presenter puts on the projector).
 *
 * That tab is a mirror of the presenter's screen, not an editor. It is the same
 * viewer application as the presenter's, so without an explicit policy every
 * ordinary "leave the slide show" path (Escape, the exit button, leaving
 * fullscreen, the presenter's end-of-session signal) drops the audience into
 * the full editing chrome: ribbon, thumbnails and inspector, live in front of
 * the room (issue #106).
 *
 * The rule is therefore absolute: **an audience display never returns to edit
 * mode.** When the presenter ends the show the tab closes itself; browsers that
 * refuse `window.close()` (a tab the script did not open, or one the user
 * re-navigated) leave the end-of-slide-show screen up instead.
 *
 * Framework-agnostic: every binding routes its exit paths through
 * {@link mayLeaveSlideShow} and its presenter-exit handler through
 * {@link endAudienceDisplay}.
 *
 * @module render/audience-display
 */

import { PRESENTATION_HASH } from './presentation-session';

/**
 * Whether a URL hash marks the tab as an audience display.
 *
 * Accepts the bare hash and the `#pptx-audience&nonce=<uuid>` form the
 * presenter opens. Safe to call with `undefined` (non-browser contexts).
 */
export function isAudienceDisplayHash(hash: string | undefined): boolean {
	return typeof hash === 'string' && hash.startsWith(PRESENTATION_HASH);
}

/** Whether the current tab is an audience display. False outside a browser. */
export function isAudienceDisplayTab(): boolean {
	if (typeof window === 'undefined') {
		return false;
	}
	return isAudienceDisplayHash(window.location.hash);
}

/**
 * Whether a tab may leave the slide show for the editor.
 *
 * Bindings call this from EVERY exit path (Escape, the toolbar's end button,
 * the advance past the end-of-show screen, fullscreen change). An audience
 * display always answers `false`, so its editing chrome is unreachable.
 *
 * @param isAudienceDisplay - Pass the binding's audience-tab check; defaults to
 *        {@link isAudienceDisplayTab} so callers with no state can omit it.
 */
export function mayLeaveSlideShow(isAudienceDisplay: boolean = isAudienceDisplayTab()): boolean {
	return !isAudienceDisplay;
}

/**
 * Whether this tab may drive the deck from its own input.
 *
 * An audience display mirrors the presenter's screen, so its keyboard, clicks,
 * taps and swipes must not navigate. When they did, a stray key moved the
 * audience off the presenter's slide and the next presenter snapshot yanked it
 * straight back, which reads as the display refusing to turn the page.
 *
 * @param isAudienceDisplay - Pass the binding's audience-tab check; defaults to
 *        {@link isAudienceDisplayTab} so callers with no state can omit it.
 */
export function acceptsPresentationInput(
	isAudienceDisplay: boolean = isAudienceDisplayTab(),
): boolean {
	return !isAudienceDisplay;
}

/**
 * Act on the presenter's `presenter-exit` signal inside an audience tab.
 *
 * Attempts to close the tab. Returns `true` when the binding must raise its
 * end-of-slide-show screen because the tab is still open: `window.close()` is
 * refused for tabs the script did not open, and closing is asynchronous, so the
 * caller always shows the screen and simply never sees it if the tab goes away.
 */
export function endAudienceDisplay(win: Window | undefined = globalThis.window): boolean {
	if (!win) {
		return true;
	}
	try {
		win.close();
	} catch {
		// Browsers refuse close() for tabs they did not script-open.
	}
	return !win.closed;
}
