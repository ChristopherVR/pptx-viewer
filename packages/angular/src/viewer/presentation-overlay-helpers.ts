/**
 * presentation-overlay-helpers.ts
 *
 * Pure functions used by PresentationOverlayComponent.
 * Exported separately so they can be unit-tested without TestBed.
 */
import type { PptxSlide } from 'pptx-viewer-core';

import { isClickAdvanceAllowed, resolveAutoAdvanceDelayMs } from '../internal/shared';

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
 */
export function nextVisibleIndex(current: number, slides: readonly PptxSlide[]): number {
	const count = slides.length;
	if (count === 0) {
		return 0;
	}
	for (let offset = 1; offset < count; offset++) {
		const candidate = (current + offset) % count;
		if (!slides[candidate].hidden) {
			return candidate;
		}
	}
	// All remaining slides are hidden; stay at current.
	return current;
}

/**
 * Return the previous visible (non-hidden) slide index before `current`.
 * Wraps around to `current` if no earlier visible slide exists.
 */
export function prevVisibleIndex(current: number, slides: readonly PptxSlide[]): number {
	const count = slides.length;
	if (count === 0) {
		return 0;
	}
	for (let offset = 1; offset < count; offset++) {
		const candidate = (((current - offset) % count) + count) % count;
		if (!slides[candidate].hidden) {
			return candidate;
		}
	}
	// All preceding slides are hidden; stay at current.
	return current;
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
 * `nextVisibleIndex` wraps modulo the deck length, which makes a show loop for
 * ever. PowerPoint only loops when "Loop continuously until Esc" is set;
 * otherwise running past the last slide ends the show. Callers use this to tell
 * "there is a next slide" from "we just wrapped".
 */
export function hasVisibleSlideAfter(current: number, slides: readonly PptxSlide[]): boolean {
	for (let index = current + 1; index < slides.length; index++) {
		if (!slides[index].hidden) {
			return true;
		}
	}
	return false;
}
