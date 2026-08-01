/**
 * `presenter-show-lifecycle` - keeping a slide show alive across the fullscreen
 * bounce that opening the audience display causes.
 *
 * WHY this exists at all. A running show holds the Fullscreen API on the
 * presenter's own screen. Opening the audience display is a `window.open` with
 * `popup=yes`, and every engine drops the opener out of fullscreen when a popup
 * takes focus. The `fullscreenchange` that announces it is dispatched on a
 * later task, which puts a binding in a bind:
 *
 *   - Reading its own "am I presenting" state right after `window.open` reads a
 *     value the pending event has not updated yet, so the code concludes the
 *     show is still running and does not re-assert it. The event then lands,
 *     the generic "the user left fullscreen, so end the show" handler fires,
 *     and the presenter's deck collapses back to the editor the instant they
 *     ask for presenter view. That is exactly the Vanilla defect: the console
 *     mounts correctly and the show underneath it is torn down.
 *   - Reading `document.fullscreenElement` instead is no better. It is
 *     authoritative but it is sampled at a moment when the browser may or may
 *     not have released fullscreen yet, so the answer is a coin toss.
 *
 * Neither reading is wrong; the mistake is asking a state question at all. The
 * only thing that distinguishes "the popup stole fullscreen" from "the
 * presenter pressed Escape" is INTENT, and intent is known at the call site
 * that opened the popup. So the opener arms a one-shot latch here and the
 * fullscreen handler asks this module what the exit meant.
 *
 * React already had a private version of this (`switchingToPresenterRef` in
 * `usePresentationMode`), which is why React alone never lost its show. This
 * module is that latch, made shared, time-bounded and testable, so all five
 * bindings answer the question the same way.
 *
 * DOM-free by design: it holds no window, registers no listener, and only ever
 * answers a question. Each binding keeps its own fullscreen plumbing.
 *
 * @module render/presenter-show-lifecycle
 */

/**
 * How long after opening the audience display a fullscreen exit is still
 * attributed to the popup rather than to the presenter.
 *
 * The latch is one-shot, so this bound only matters when the popup never
 * triggers a bounce at all (a popup blocker, or an engine that keeps the opener
 * fullscreen). Without it the latch would sit armed forever and silently
 * swallow the presenter's next real Escape. A second is far longer than the
 * event needs and far shorter than any deliberate follow-up action.
 */
export const AUDIENCE_FULLSCREEN_BOUNCE_MS = 1000;

/** What a fullscreen exit during a running show should be taken to mean. */
export type ShowFullscreenExitVerdict =
	/** The presenter left: tear the show down. */
	| 'end-show'
	/** The audience popup stole fullscreen: re-assert the show instead. */
	| 'restore-show';

/** A one-shot latch describing why the show is about to leave fullscreen. */
export interface PresenterShowGuard {
	/**
	 * Call immediately BEFORE opening the audience display, from the same task
	 * as the `window.open`. Arming after the call is also safe (the event cannot
	 * be delivered until the current task yields) but reads worse.
	 */
	expectAudienceBounce(now?: number): void;
	/**
	 * Classify a fullscreen exit seen while the show is running, consuming the
	 * latch. Returns `'restore-show'` at most once per {@link expectAudienceBounce}.
	 */
	classifyFullscreenExit(now?: number): ShowFullscreenExitVerdict;
	/** Whether a bounce is still expected. For diagnostics and tests. */
	isExpectingBounce(now?: number): boolean;
	/**
	 * Drop the latch without consuming it: the presenter ended the show, or the
	 * console closed, so any later fullscreen exit is genuinely theirs.
	 */
	disarm(): void;
}

/**
 * Create a {@link PresenterShowGuard}.
 *
 * @param options.graceMs - Override {@link AUDIENCE_FULLSCREEN_BOUNCE_MS}; tests
 * pass a tiny value to prove the latch expires.
 */
export function createPresenterShowGuard(options?: { graceMs?: number }): PresenterShowGuard {
	const graceMs = options?.graceMs ?? AUDIENCE_FULLSCREEN_BOUNCE_MS;
	let armedAt: number | undefined;

	const stillArmed = (now: number): boolean =>
		armedAt !== undefined && now - armedAt >= 0 && now - armedAt <= graceMs;

	return {
		expectAudienceBounce(now = Date.now()): void {
			armedAt = now;
		},
		classifyFullscreenExit(now = Date.now()): ShowFullscreenExitVerdict {
			if (!stillArmed(now)) {
				armedAt = undefined;
				return 'end-show';
			}
			// One-shot: a popup causes exactly one bounce, and a second exit in the
			// same window is the presenter reacting to what they now see.
			armedAt = undefined;
			return 'restore-show';
		},
		isExpectingBounce(now = Date.now()): boolean {
			return stillArmed(now);
		},
		disarm(): void {
			armedAt = undefined;
		},
	};
}
