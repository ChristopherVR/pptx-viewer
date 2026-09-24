/**
 * `pslz:zmPr`/`psezm:zmPr`/`psuz:zmPr`'s `@returnToParent` and
 * `@transitionDur` (MS-PPTX `CT_ZoomObjectProperties`): what a Slide Zoom /
 * Section Zoom / Summary Zoom tile does to slide-show PLAYBACK, not just what
 * core parses and round-trips.
 *
 * `returnToParent`: once the show advances past the LAST slide of the
 * zoom's target (a single slide for a Slide Zoom, or the whole contiguous
 * section for a Section Zoom / Summary Zoom tile), a forward "next slide"
 * step jumps back to the slide the zoom was clicked FROM instead of
 * continuing linearly through the deck. This module tracks that pending
 * "excursion" as a plain value so every binding's own navigation hook stores
 * it in whatever reactive primitive it already uses (a ref, a signal, a
 * store field) and asks {@link resolveForwardSlideWithZoomReturn} what the
 * next slide is on every forward step.
 *
 * `transitionDur`: the zoom's own transition length, independent of
 * whatever `<p:transition>` the destination slide is authored with.
 * PowerPoint plays a `zoom` transition (see `slide-transition-css.ts`) for a
 * live Zoom link; {@link buildZoomTransitionOverride} produces the synthetic
 * `PptxSlideTransition` a binding's transition executor should play INSTEAD
 * of the destination's own, only for the duration of the click/return, so
 * this is additive and reversible: the destination slide's own transition
 * still plays normally on any later, non-zoom visit.
 *
 * @module render/zoom-return-navigation
 */
import type {
	PptxSlide,
	PptxSlideTransition,
	SummaryZoomTarget,
	ZoomPptxElement,
} from 'pptx-viewer-core';

/**
 * The navigation-relevant fields of a Zoom click target, independent of
 * `zoomType`.
 *
 * `returnToParent` is already resolved to its EFFECTIVE value here (not the
 * raw, possibly-`undefined` `ZoomPptxElement`/`SummaryZoomTarget` field):
 * `CT_ZoomObjectProperties/@returnToParent` (MS-PPTX) is `<xsd:attribute
 * name="returnToParent" type="xsd:boolean" use="optional" default="true"/>`,
 * so an ABSENT attribute means true, not false. Core deliberately stores
 * `undefined` rather than fabricating `true` (so a round-trip never invents
 * an attribute the source never had), which makes `Boolean(x)` the wrong way
 * to read it; the two `resolve*NavigationTarget` functions below are the only
 * place that distinction should be made.
 */
export interface ZoomNavigationTarget {
	targetSlideIndex: number;
	targetSectionId?: string;
	returnToParent: boolean;
	transitionDurationMs?: number;
}

/**
 * Resolve the click target for a Slide Zoom or Section Zoom element (NOT a
 * Summary Zoom, whose tiles each carry their own values; see
 * {@link resolveSummaryZoomTileNavigationTarget}).
 */
export function resolveZoomNavigationTarget(
	element: ZoomPptxElement,
): ZoomNavigationTarget | undefined {
	if (element.zoomType === 'summary') {
		return undefined;
	}
	return {
		targetSlideIndex: element.targetSlideIndex,
		targetSectionId: element.targetSectionId,
		returnToParent: element.returnToParent !== false,
		transitionDurationMs: element.transitionDurationMs,
	};
}

/** Resolve the click target for one Summary Zoom tile (its own `zmPr`, not the container's mirrored copy). */
export function resolveSummaryZoomTileNavigationTarget(
	tile: SummaryZoomTarget | undefined,
): ZoomNavigationTarget | undefined {
	if (!tile) {
		return undefined;
	}
	return {
		targetSlideIndex: tile.targetSlideIndex,
		targetSectionId: tile.sectionId,
		returnToParent: tile.returnToParent !== false,
		transitionDurationMs: tile.transitionDurationMs,
	};
}

/**
 * The last slide index (inclusive) of the zoom's target range: for a Section
 * Zoom / Summary Zoom tile, the last slide of the contiguous run of slides
 * sharing `targetSectionId` starting at `targetSlideIndex` (sections are
 * always contiguous); for a plain Slide Zoom (no section), just the target
 * slide itself.
 */
export function resolveZoomExcursionEndIndex(
	target: Pick<ZoomNavigationTarget, 'targetSlideIndex' | 'targetSectionId'>,
	slides: readonly Pick<PptxSlide, 'sectionId'>[],
): number {
	if (!target.targetSectionId) {
		return target.targetSlideIndex;
	}
	let end = target.targetSlideIndex;
	for (let i = target.targetSlideIndex + 1; i < slides.length; i++) {
		if (slides[i]?.sectionId !== target.targetSectionId) {
			break;
		}
		end = i;
	}
	return end;
}

/** A pending "return to the zoom's origin slide" excursion, tracked by the binding across forward-advance steps. */
export interface ZoomExcursion {
	/** The slide to jump back to once `endSlideIndex` is passed (the slide the zoom was clicked from). */
	returnSlideIndex: number;
	/** The last slide index of the zoom's target range; see {@link resolveZoomExcursionEndIndex}. */
	endSlideIndex: number;
	/** The zoom's own `transitionDur`, applied to the jump INTO the target and to the return jump. */
	transitionDurationMs?: number;
}

/**
 * Begin tracking a zoom excursion for a click on `target`, or `undefined`
 * when the target's `returnToParent` is not set (a plain, one-way jump).
 */
export function beginZoomExcursion(
	target: ZoomNavigationTarget,
	returnSlideIndex: number,
	slides: readonly Pick<PptxSlide, 'sectionId'>[],
): ZoomExcursion | undefined {
	if (!target.returnToParent) {
		return undefined;
	}
	return {
		returnSlideIndex,
		endSlideIndex: resolveZoomExcursionEndIndex(target, slides),
		transitionDurationMs: target.transitionDurationMs,
	};
}

/** The outcome of a forward "advance" step, honoring a pending zoom excursion. */
export interface ZoomReturnStep {
	/** The slide to advance to (unchanged from `naturalNextIndex` unless the excursion just closed). */
	nextSlideIndex: number | undefined;
	/** The excursion to keep tracking (`undefined` once it has been consumed). */
	excursion: ZoomExcursion | undefined;
	/** Whether this step was the automatic "return to zoom" jump. */
	returnedToZoom: boolean;
}

/**
 * Decide the next slide for a forward advance step, given a pending zoom
 * excursion. When the show is currently sitting on the excursion's last
 * slide, the step returns to the zoom's origin slide (and clears the
 * excursion) instead of `naturalNextIndex`. Otherwise the excursion is left
 * untouched and `naturalNextIndex` is used as-is. Backward steps should not
 * call this (PowerPoint's return jump is forward-only); a caller stepping
 * backward keeps its excursion by simply not calling this helper.
 */
export function resolveForwardSlideWithZoomReturn(
	currentSlideIndex: number,
	naturalNextIndex: number | undefined,
	excursion: ZoomExcursion | undefined,
): ZoomReturnStep {
	if (excursion && currentSlideIndex === excursion.endSlideIndex) {
		return {
			nextSlideIndex: excursion.returnSlideIndex,
			excursion: undefined,
			returnedToZoom: true,
		};
	}
	return { nextSlideIndex: naturalNextIndex, excursion, returnedToZoom: false };
}

/**
 * A synthetic `zoom`-type transition carrying the zoom's own `transitionDur`,
 * for a binding's transition executor to play INSTEAD of the destination
 * slide's own authored `<p:transition>` when navigating a Zoom click or its
 * automatic return. `undefined` when the zoom omitted `@transitionDur`
 * (per the field's doc comment, that means "use the destination slide's own
 * transition", so the caller should fall through to its normal resolution).
 */
export function buildZoomTransitionOverride(
	transitionDurationMs: number | undefined,
): PptxSlideTransition | undefined {
	if (typeof transitionDurationMs !== 'number' || transitionDurationMs <= 0) {
		return undefined;
	}
	return { type: 'zoom', durationMs: transitionDurationMs };
}
