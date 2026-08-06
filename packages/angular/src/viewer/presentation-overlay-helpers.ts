/**
 * presentation-overlay-helpers.ts
 *
 * Pure functions used by PresentationOverlayComponent.
 * Exported separately so they can be unit-tested without TestBed.
 */
import type { PptxSlide } from 'pptx-viewer-core';

import type { CanvasSize } from '../internal/shared';
import {
	attachPresentationVisibilityPause,
	firstShowSlideIndex,
	hasShowSlideAfter,
	isClickAdvanceAllowed,
	lastShowSlideIndex,
	nextShowSlideIndex,
	previousShowSlideIndex,
	resolveAutoAdvanceDelayMs,
	resolveShowSlideIndexes,
	stopAllPersistentAudio,
} from '../internal/shared';

/**
 * Whether a click/tap/swipe advance must be swallowed instead of moving to the
 * next slide. A click still steps the current slide's remaining animation
 * builds, so this only blocks once they are exhausted (`playbackComplete`) and
 * only when the slide's transition sets advanceOnClick to false. Keyboard and
 * the on-screen next/prev buttons never consult this.
 */
export function shouldBlockClickAdvance(
	playbackComplete: boolean,
	slide: PptxSlide | undefined,
): boolean {
	return playbackComplete && !isClickAdvanceAllowed(slide);
}

/**
 * Delay in ms before the show steps to the next slide on its own, or
 * `undefined` when the current slide waits for input.
 *
 * The counterpart to {@link shouldBlockClickAdvance}: PowerPoint's
 * `p:transition/@advTm` ("Advance slide: After <n>"). A slide authored
 * `advClick="0" advTm="…"` is advanced ONLY by this timer, so honouring the
 * click gate without also arming the timer strands the show on that slide with
 * no visible response to any input. Nothing is scheduled once the end-of-show
 * screen is up, or when the show is set to advance manually.
 */
export function resolveSlideAutoAdvanceMs(
	slide: PptxSlide | undefined,
	useTimings: boolean,
	endOfShow: boolean,
): number | undefined {
	if (endOfShow) {
		return undefined;
	}
	return resolveAutoAdvanceDelayMs(slide, { useTimings });
}

/**
 * Attach the show's visibility pause: while the tab is hidden the shared
 * handler pauses the stage's playing media and the cross-slide persistent
 * audio, and the binding-provided callbacks cancel / re-arm the timed
 * auto-advance so the deck does not run on unseen. Returns the detach
 * function. Kept TestBed-free so the wiring can be unit-tested directly.
 */
export function attachShowVisibilityPause(deps: {
	/** The overlay root containing the stage; only media inside it is paused. */
	root: ParentNode | undefined;
	/** Cancel the pending auto-advance timer (the tab was hidden). */
	cancelAutoAdvance: () => void;
	/** Re-arm the auto-advance timer for the current slide (tab visible again). */
	rearmAutoAdvance: () => void;
}): () => void {
	return attachPresentationVisibilityPause({
		root: deps.root,
		onHidden: deps.cancelAutoAdvance,
		onVisible: deps.rearmAutoAdvance,
	});
}

/**
 * The show has ENDED (never a slide change): stop and remove all cross-slide
 * "play across slides" persistent audio. Called by the host's exit paths
 * (`closePresentation` / `exitPresenter`), not by the overlay's own destroy,
 * because swapping to the presenter console destroys the overlay while the
 * show, and its background audio, carry on.
 */
export function endShowMediaCleanup(): void {
	stopAllPersistentAudio();
}

/**
 * Clamp `index` to the valid range [0, count - 1].
 * Returns 0 when `count` is 0 to avoid -1 states.
 */
export function clampIndex(index: number, count: number): number {
	if (count <= 0) {
		return 0;
	}
	if (index < 0) {
		return 0;
	}
	if (index >= count) {
		return count - 1;
	}
	return index;
}

/**
 * Return the next visible (non-hidden) slide index after `current`.
 * Wraps around to `current` if no subsequent visible slide exists.
 *
 * Thin adapter over the shared show-order rule: Angular used to own this logic
 * outright, which is exactly why the other four bindings presented hidden
 * slides. Kept as a named export because the overlay's tests and the navigator
 * read better in terms of "next visible slide" than raw index lists.
 */
export function nextVisibleIndex(current: number, slides: readonly PptxSlide[]): number {
	if (slides.length === 0) {
		return 0;
	}
	const order = resolveShowSlideIndexes(slides);
	return nextShowSlideIndex(current, order, { loop: true }) ?? current;
}

/**
 * Return the previous visible (non-hidden) slide index before `current`.
 * Returns `current` when no earlier visible slide exists: PowerPoint never
 * wraps backward off the first slide.
 */
export function prevVisibleIndex(current: number, slides: readonly PptxSlide[]): number {
	if (slides.length === 0) {
		return 0;
	}
	const order = resolveShowSlideIndexes(slides);
	return previousShowSlideIndex(current, order) ?? current;
}

/**
 * Compute the zoom level that fits a canvas of `canvasW × canvasH` pixels
 * into a viewport of `vw × vh` pixels, preserving aspect ratio.
 *
 * Returns 1 as a safe fallback when any dimension is zero or negative.
 */
export function fitZoom(canvasW: number, canvasH: number, vw: number, vh: number): number {
	if (canvasW <= 0 || canvasH <= 0 || vw <= 0 || vh <= 0) {
		return 1;
	}
	return Math.min(vw / canvasW, vh / canvasH);
}

/**
 * Whether a visible (non-hidden) slide exists strictly AFTER `current`.
 *
 * `nextVisibleIndex` wraps, which would make a show loop for ever. PowerPoint
 * only loops when "Loop continuously until Esc" is set; otherwise running past
 * the last slide ends the show. Callers use this to tell "there is a next
 * slide" from "we just wrapped".
 */
export function hasVisibleSlideAfter(current: number, slides: readonly PptxSlide[]): boolean {
	return hasShowSlideAfter(current, resolveShowSlideIndexes(slides));
}

/** The show's first visible slide (Home), or 0 for an empty deck. */
export function firstVisibleIndex(slides: readonly PptxSlide[]): number {
	return firstShowSlideIndex(resolveShowSlideIndexes(slides)) ?? 0;
}

/** The show's last visible slide (End), or 0 for an empty deck. */
export function lastVisibleIndex(slides: readonly PptxSlide[]): number {
	return lastShowSlideIndex(resolveShowSlideIndexes(slides)) ?? 0;
}

/**
 * Style record centring the scaled slide stage in the viewport.
 *
 * The offsets are computed numerically ((viewport - scaled size) / 2, exactly
 * how React's PresentationStage centres) rather than with the historical
 * `left/top: 50%` + `translate(-50%, -50%)`: a transform makes the stage a
 * stacking context, which trapped every z-index inside it (the ink annotation
 * overlay in particular) BELOW the sibling blackout sheet, so blackboard
 * strokes painted invisibly under the black screen. See the shared
 * `render/presentation-blackboard` module for the layering rules.
 */
export function presentationStageStyle(
	size: CanvasSize,
	zoom: number,
	viewportW: number,
	viewportH: number,
): Record<string, string> {
	const width = size.width * zoom;
	const height = size.height * zoom;
	return {
		position: 'absolute',
		top: `${(viewportH - height) / 2}px`,
		left: `${(viewportW - width) / 2}px`,
		width: `${width}px`,
		height: `${height}px`,
		// Motion-path keyframes translate by a fraction of the SLIDE (see
		// `slideOffset` in the shared timeline helpers), so the presentation
		// stage publishes the slide size the same way the editing stage does.
		// Without it every parsed path falls back to the 1280x720 default and a
		// deck authored at another size under-travels.
		'--pptx-slide-w': `${size.width}px`,
		'--pptx-slide-h': `${size.height}px`,
	};
}
