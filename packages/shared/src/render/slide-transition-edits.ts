/**
 * slide-transition-edits: the write side of the inspector's slide-transition
 * section (the read side, the option catalogue and direction grid, lives in
 * `slide-transition-options`).
 *
 * WHY shared: a transition is a single OOXML element whose attributes are
 * edited one control at a time, so every binding must MERGE each change onto
 * the slide's existing transition. Replacing it wholesale is the bug this
 * prevents: changing the duration would silently discard an authored sound,
 * direction or spoke count the deck already carried. The numeric clamp is here
 * for the same reason, so a duration typed into React and one typed into
 * Angular round to the same stored value.
 *
 * @module render/slide-transition-edits
 */
import type { PptxSlideTransition } from 'pptx-viewer-core';

/**
 * Merge a partial change onto a slide's existing transition. Always yields a
 * complete object (defaulting `type` to `none`, which the interface requires)
 * and preserves every field the change did not name.
 */
export function mergeSlideTransition(
	current: PptxSlideTransition | undefined,
	changes: Partial<PptxSlideTransition>,
): PptxSlideTransition {
	return { type: 'none', ...current, ...changes };
}

/**
 * Clamp and round an edited numeric transition field (duration, spokes),
 * returning null when the raw value is unusable so the caller can leave the
 * model untouched rather than writing a NaN.
 */
export function clampTransitionNumber(raw: number, min: number, max: number): number | null {
	if (!Number.isFinite(raw)) {
		return null;
	}
	return Math.max(min, Math.min(max, Math.round(raw)));
}
