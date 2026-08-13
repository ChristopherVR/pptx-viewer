/**
 * `ribbon-transitions` - the Transitions ribbon tab expressed as a pure
 * decision function, so a click on a preset means the same thing in all five
 * bindings.
 *
 * WHY shared: the tab is a set of MODIFIERS (duration, advance-on-click,
 * advance-after, apply-to-all) that only make sense combined with the preset
 * the user clicked. Every binding had re-decided that combination for itself,
 * and two of them (react, vue) never decided it at all: their controls wrote
 * component-local state and nothing reached the deck, so a picked transition
 * highlighted in the gallery and the saved `.pptx` carried no `p:transition`.
 * The preset list itself was five hand-copied arrays.
 *
 * The shape here is the repo's standard one: shared owns the DRAFT (what the
 * controls currently say), the READ (what a slide's transition says the
 * controls should show) and the CHANGE (the `PptxSlideTransition` fields a
 * commit writes). A binding renders the draft and hands the change to whatever
 * slide-mutation path it already has.
 *
 * @module render/ribbon-transitions
 */
import type { PptxSlide, PptxSlideTransition, PptxTransitionType } from 'pptx-viewer-core';

import { mergeSlideTransition } from './slide-transition-edits';

/** One entry of the ribbon's transition gallery. */
export interface RibbonTransitionPreset {
	type: PptxTransitionType;
	labelKey: string;
}

/**
 * The gallery shown on the Transitions tab.
 *
 * Deliberately a SUBSET of `SLIDE_TRANSITION_OPTIONS` (which the inspector's
 * Type select uses): PowerPoint's ribbon shows a curated strip and its full
 * catalogue lives behind the gallery expander. Keeping the strip here keeps
 * the five bindings from drifting apart entry by entry, which they had already
 * begun to do.
 */
export const RIBBON_TRANSITION_PRESETS: readonly RibbonTransitionPreset[] = [
	{ type: 'none', labelKey: 'pptx.ribbon.transition.none' },
	{ type: 'fade', labelKey: 'pptx.ribbon.transition.fade' },
	{ type: 'push', labelKey: 'pptx.ribbon.transition.push' },
	{ type: 'wipe', labelKey: 'pptx.ribbon.transition.wipe' },
	{ type: 'split', labelKey: 'pptx.ribbon.transition.split' },
	{ type: 'reveal', labelKey: 'pptx.ribbon.transition.reveal' },
	{ type: 'cut', labelKey: 'pptx.ribbon.transition.cut' },
	{ type: 'cover', labelKey: 'pptx.ribbon.transition.cover' },
	{ type: 'uncover', labelKey: 'pptx.ribbon.transition.uncover' },
];

/** Seed value of the tab's Duration field, in seconds. */
export const DEFAULT_RIBBON_TRANSITION_DURATION_SEC = 0.7;

/** What the Advance-After field shows when no timed advance is set. */
export const NO_ADVANCE_AFTER_TEXT = '00:00.00';

/** Widest duration the tab accepts, in seconds (PowerPoint's own ceiling). */
const MAX_DURATION_SEC = 20;

/** Everything the Transitions tab's controls currently say. */
export interface RibbonTransitionDraft {
	/** The highlighted gallery entry. */
	type: PptxTransitionType;
	/** Duration field, in seconds. */
	durationSec: number;
	/** Advance Slide > On Mouse Click. */
	advanceOnClick: boolean;
	/** Advance Slide > After (whether the timed advance is armed at all). */
	advanceAfter: boolean;
	/** Advance Slide > After, as the `mm:ss.hh` text the field holds. */
	advanceAfterText: string;
}

/** The draft a tab starts from before any slide is read. */
export const EMPTY_RIBBON_TRANSITION_DRAFT: RibbonTransitionDraft = {
	type: 'none',
	durationSec: DEFAULT_RIBBON_TRANSITION_DURATION_SEC,
	advanceOnClick: true,
	advanceAfter: false,
	advanceAfterText: NO_ADVANCE_AFTER_TEXT,
};

/**
 * Parse the Advance-After field into milliseconds.
 *
 * Accepts `mm:ss.hh` (what the field seeds itself with), `ss.hh` and a plain
 * number of seconds, because all three are what a user actually types. Returns
 * null when the text cannot be read as a time, so a caller leaves the model
 * untouched rather than writing a NaN into `p:transition/@advTm`.
 */
export function parseAdvanceAfterMs(text: string): number | null {
	const trimmed = text.trim();
	if (trimmed === '') {
		return null;
	}
	const parts = trimmed.split(':');
	if (parts.length > 2) {
		return null;
	}
	let seconds = 0;
	for (const part of parts) {
		const value = Number(part);
		if (!Number.isFinite(value) || value < 0) {
			return null;
		}
		seconds = seconds * 60 + value;
	}
	return Math.round(seconds * 1000);
}

/** Render a stored `advanceAfterMs` back into the field's `mm:ss.hh` text. */
export function formatAdvanceAfterText(advanceAfterMs: number | undefined): string {
	if (
		typeof advanceAfterMs !== 'number' ||
		!Number.isFinite(advanceAfterMs) ||
		advanceAfterMs <= 0
	) {
		return NO_ADVANCE_AFTER_TEXT;
	}
	const totalHundredths = Math.round(advanceAfterMs / 10);
	const minutes = Math.floor(totalHundredths / 6000);
	const seconds = Math.floor((totalHundredths % 6000) / 100);
	const hundredths = totalHundredths % 100;
	const pad = (value: number): string => String(value).padStart(2, '0');
	return `${pad(minutes)}:${pad(seconds)}.${pad(hundredths)}`;
}

/**
 * What the tab's controls should read for a given slide.
 *
 * A ribbon that never reads the slide back is a ribbon that lies after every
 * navigation: it keeps showing the last preset the user clicked even once they
 * have moved to a slide with a different transition.
 */
export function readRibbonTransitionDraft(slide: PptxSlide | undefined): RibbonTransitionDraft {
	const transition = slide?.transition;
	if (!transition) {
		return { ...EMPTY_RIBBON_TRANSITION_DRAFT };
	}
	const advanceAfterMs = transition.advanceAfterMs;
	// PRESENCE, not magnitude: PowerPoint ticks "After" whenever `advTm` is
	// written at all, including `advTm="0"`. Requiring a positive value made the
	// checkbox untick itself the instant it was ticked, because a fresh tick
	// commits the field's `00:00.00` before the user has typed a time.
	const hasAdvanceAfter =
		typeof advanceAfterMs === 'number' && Number.isFinite(advanceAfterMs) && advanceAfterMs >= 0;
	return {
		type: transition.type ?? 'none',
		durationSec:
			typeof transition.durationMs === 'number' && Number.isFinite(transition.durationMs)
				? transition.durationMs / 1000
				: DEFAULT_RIBBON_TRANSITION_DURATION_SEC,
		advanceOnClick: transition.advanceOnClick !== false,
		advanceAfter: hasAdvanceAfter,
		advanceAfterText: formatAdvanceAfterText(advanceAfterMs),
	};
}

/**
 * The `PptxSlideTransition` fields a commit of the current draft writes.
 *
 * `advanceAfterMs` is set to `undefined` when the After box is unticked so the
 * merge clears a timed advance the deck already carried; leaving it out would
 * make unticking a silent no-op.
 */
export function ribbonTransitionUpdates(
	draft: RibbonTransitionDraft,
): Partial<PptxSlideTransition> {
	const durationSec = Number.isFinite(draft.durationSec)
		? Math.max(0, Math.min(MAX_DURATION_SEC, draft.durationSec))
		: DEFAULT_RIBBON_TRANSITION_DURATION_SEC;
	// An armed-but-unparseable field commits 0 rather than nothing, so ticking
	// the box is never silently undone by the text beside it.
	const advanceAfterMs = draft.advanceAfter
		? (parseAdvanceAfterMs(draft.advanceAfterText) ?? 0)
		: undefined;
	return {
		type: draft.type,
		durationMs: Math.round(durationSec * 1000),
		advanceOnClick: draft.advanceOnClick,
		advanceAfterMs,
	};
}

/**
 * The complete transition a slide ends up with when the draft is committed on
 * top of whatever it already carried (direction, spokes, sound, raw XML).
 */
export function applyRibbonTransitionDraft(
	slide: PptxSlide | undefined,
	draft: RibbonTransitionDraft,
): PptxSlideTransition {
	return mergeSlideTransition(slide?.transition, ribbonTransitionUpdates(draft));
}

/**
 * Which slide indexes a commit touches: just the active one, or every slide
 * when Apply to All is armed.
 */
export function ribbonTransitionTargets(
	slideCount: number,
	activeIndex: number,
	applyToAll: boolean,
): number[] {
	if (applyToAll) {
		return Array.from({ length: Math.max(0, slideCount) }, (_, index) => index);
	}
	return activeIndex >= 0 && activeIndex < slideCount ? [activeIndex] : [];
}
