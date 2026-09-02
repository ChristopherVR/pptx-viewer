/**
 * presentation-entry-slide.ts: which slide a show opens on.
 *
 * Every binding entered the show on the editor's active slide, unconditionally.
 * That is right for "From Current Slide" on a plain deck, and wrong the moment
 * the show does not include that slide: a deck authored with
 * `p:showPr/p:sldRg st="2" end="3"` (or a custom show, or a hidden active
 * slide) opened on slide 1, a slide the author took out of the show, and the
 * first forward press then jumped to slide 2 as if slide 1 had been part of it.
 * All five bindings computed the show order correctly and then ignored it for
 * the one decision that fixes the opening frame.
 *
 * This is the missing rule, kept next to the show-order helpers it composes
 * with, so the bindings agree on it by construction.
 *
 * @module render/presentation-entry-slide
 */

import { firstShowSlideIndex, nextShowSlideIndex } from './presentation-show-order';

/**
 * The deck index a show opens on when started from `activeDeckIndex`.
 *
 * - The active slide itself when the show includes it ("From Current Slide").
 * - Otherwise the first show slide that comes LATER in the deck, mirroring how
 *   forward navigation escapes an off-list slide: a presenter parked on the
 *   title slide of a deck whose range starts at 2 lands on 2, not on the end
 *   of the show.
 * - Otherwise the first show slide, for an active slide past the end of the
 *   range (PowerPoint's own behaviour when the current slide is outside the
 *   custom show: it plays the show from its start).
 * - `activeDeckIndex` unchanged when the show is empty, so the caller's own
 *   empty-show handling (the end screen or the whole-deck fallback) still runs.
 */
export function presentationEntrySlideIndex(
	activeDeckIndex: number,
	showIndexes: readonly number[],
): number {
	if (showIndexes.length === 0) {
		return activeDeckIndex;
	}
	if (showIndexes.includes(activeDeckIndex)) {
		return activeDeckIndex;
	}
	return (
		nextShowSlideIndex(activeDeckIndex, showIndexes) ??
		firstShowSlideIndex(showIndexes) ??
		activeDeckIndex
	);
}
