/**
 * `presentation-animation-controller`: a pure, framework-agnostic controller
 * that encapsulates the native-animation (`p:timing`) element playback a binding
 * needs while running a slide show, WITHOUT owning the clock or the DOM.
 *
 * It wraps a {@link TimelineEngine} built from a slide's `nativeAnimations`,
 * expanding staged text-build animations (by-paragraph / by-word / by-char) into
 * per-segment sub-animations first, and caches the derived per-slide data every
 * binding needs up front:
 *  - {@link keyframesCss}: the `@keyframes` blocks to inject once per slide.
 *  - {@link interactiveTriggerShapeIds} / {@link hoverTriggerShapeIds}: the shape
 *    ids that trigger an interactive / hover sequence (for cursor styling).
 *  - {@link elementIds}: every element id (plus text-build sub-element ids) to
 *    track state for.
 *
 * Contract for the binding (it owns the clock + DOM, the controller is pure):
 *  1. Build one controller per active slide with {@link fromSlide}.
 *  2. Inject {@link keyframesCss} once, style the {@link interactiveTriggerShapeIds}
 *     / {@link hoverTriggerShapeIds} shapes as clickable / hoverable.
 *  3. Seed element state with {@link computeStates}(), then advance a click-group
 *     on each click via {@link advance} (or {@link advanceInteractive} /
 *     {@link advanceHover}), applying the returned {@link TimelineClickGroup}'s
 *     steps (visibility, CSS animation, sound, media command) itself.
 *  4. Auto-advance chains via {@link peekNext} / {@link shouldAutoAdvance} /
 *     {@link getAutoAdvanceDelay}.
 *  5. For a staged chart / SmartArt build, {@link collectBuildStepIds} on the just
 *     -played group tells the binding whether to run a requestAnimationFrame loop
 *     that re-reads {@link computeStatesFor}(buildIds, { elapsedMs }) as the clock
 *     advances and merges each `build` descriptor onto the element states.
 *
 * Pure: NO DOM, NO requestAnimationFrame, NO timers. The binding drives the clock
 * and applies the resulting {@link ElementAnimationState}s to its view layer.
 *
 * @module render/presentation-animation-controller
 */

import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxNativeAnimation, PptxSlide } from 'pptx-viewer-core';

import { applyAfterAnimationFromEditorList } from './animation-after-effect';
import { buildAnimationRenderContext } from './animation-render-context';
import { resolveAnimationTargetId } from './animation-target-id';
import type { ElementStatesOptions } from './animation-timeline-engine';
import { TimelineEngine } from './animation-timeline-engine';
import {
	countTextSegments,
	effectiveTextBuildType,
	expandTextBuildAnimations,
	TEXT_BUILD_ID_SEP,
} from './animation-timeline-text-build';
import type { TextBuildSegmentCounts } from './animation-timeline-text-build';
import { expandTextRangeAnimations } from './animation-timeline-text-range';
import type { ElementAnimationState, TimelineClickGroup } from './animation-timeline-types';
import { motionPathNativeAnimations } from './motion-path-authoring';
import { flattenSlideElements } from './presentation-action';

/**
 * Options accepted by {@link PresentationAnimationController.computeStates} and
 * {@link PresentationAnimationController.computeStatesFor}. Re-exported alias of
 * the engine's {@link ElementStatesOptions} (carries the staged-build
 * `elapsedMs`), so a binding imports it from the controller.
 */
export type PresentationStatesOptions = ElementStatesOptions;

/**
 * Optional context {@link PresentationAnimationController.fromSlide} threads
 * into the timeline builder so it can resolve a `p:anim` formula that needs
 * the animated shape's REAL box (e.g. Grow And Turn's `-#ppt_w/2` fly-in) and
 * a scheme-colour (`a:schemeClr`) stop in a `p:animClr` / colour ramp. Both
 * fields are independently optional: a binding with only the slide's canvas
 * size (no theme yet loaded) still gets geometry-formula resolution, and vice
 * versa. Omitting the options object entirely keeps the previous behaviour
 * (self-only formula resolution, scheme colours falling back), so this is a
 * strictly additive, non-breaking change to `fromSlide`'s signature.
 */
export interface PresentationAnimationControllerOptions {
	/** The slide canvas width, in the SAME px unit `PptxElement.x/width` are authored in. */
	slideWidthPx?: number;
	/** The slide canvas height, in the SAME px unit `PptxElement.y/height` are authored in. */
	slideHeightPx?: number;
	/** The deck's resolved theme colour map (`PptxData.themeColorMap`). */
	themeColorMap?: Readonly<Record<string, string>>;
}

/**
 * Build the per-target text-build segment counts for a slide: for every
 * animation carrying a non-`allAtOnce` `buildType` OR a `p:txEl` text-level
 * target (`textTarget`), count the paragraphs / words / chars of its target
 * element's text so {@link expandTextBuildAnimations} /
 * {@link expandTextRangeAnimations} can split the reveal. Elements without
 * text (or with an empty body) are skipped.
 */
function buildSegmentCounts(
	slide: PptxSlide,
	nativeAnims: ReadonlyArray<PptxNativeAnimation>,
): Map<string, TextBuildSegmentCounts> {
	const segmentCounts = new Map<string, TextBuildSegmentCounts>();
	for (const anim of nativeAnims) {
		if ((effectiveTextBuildType(anim) || anim.textTarget) && anim.targetId) {
			const el = slide.elements.find((e) => e.id === anim.targetId);
			if (el && hasTextProperties(el) && el.textSegments && el.textSegments.length > 0) {
				segmentCounts.set(anim.targetId, countTextSegments(el.textSegments));
			}
		}
	}
	return segmentCounts;
}

/**
 * Framework-agnostic native-animation playback controller for a single slide.
 * See the module header for the binding contract.
 */
export class PresentationAnimationController {
	private readonly engine: TimelineEngine;
	private readonly keyframes: string;
	private readonly interactiveIds: ReadonlySet<string>;
	private readonly hoverIds: ReadonlySet<string>;
	private readonly ids: readonly string[];

	private constructor(engine: TimelineEngine, elementIds: readonly string[]) {
		this.engine = engine;
		this.keyframes = engine.getTimeline().keyframesCss;
		this.interactiveIds = engine.getInteractiveTriggerShapeIds();
		this.hoverIds = engine.getHoverTriggerShapeIds();
		this.ids = elementIds;
	}

	/**
	 * Build a controller from a slide. Expands staged text-build animations into
	 * per-segment sub-animations before constructing the {@link TimelineEngine},
	 * then caches the keyframes CSS, trigger-shape id sets, and the full element
	 * id list (base element ids + text-build sub-element ids) to track.
	 */
	public static fromSlide(
		slide: PptxSlide,
		options?: PresentationAnimationControllerOptions,
	): PresentationAnimationController {
		// Motion paths authored in this session live on the editor model until the
		// deck is saved; project them in so pressing play right after applying one
		// actually moves the shape.
		const rawNativeAnims = [
			...(slide.nativeAnimations ?? []),
			...motionPathNativeAnimations(slide),
		];
		// Merge each element's authored "after animation" end-state in from the
		// editor's per-element animation list before anything else touches the
		// native list: both are already keyed by the same `element.id` (see
		// `reconcileAnimationTargets`), and the native-timing parser has no
		// single `p:cTn` attribute of its own to carry this.
		const nativeAnims = applyAfterAnimationFromEditorList(rawNativeAnims, slide.animations);
		const segmentCounts = buildSegmentCounts(slide, nativeAnims);
		// Scope `p:txEl` (paragraph/character range) targets to their named
		// sub-elements FIRST, then expand any remaining staged build: the two
		// features are independent OOXML concepts and rarely combine, but running
		// range-scoping first means a `p:bldP` build on a DIFFERENT (whole-shape)
		// animation for the same slide is unaffected either way.
		const rangedAnims =
			segmentCounts.size > 0 ? expandTextRangeAnimations(nativeAnims, segmentCounts) : nativeAnims;
		const expandedAnims =
			segmentCounts.size > 0 ? expandTextBuildAnimations(rangedAnims, segmentCounts) : rangedAnims;

		const renderContext = buildAnimationRenderContext(
			slide,
			options?.slideWidthPx !== undefined && options?.slideHeightPx !== undefined
				? { heightPx: options.slideHeightPx, widthPx: options.slideWidthPx }
				: undefined,
			options?.themeColorMap,
		);
		const engine = TimelineEngine.fromAnimations(expandedAnims, renderContext);

		// Animations may target a shape nested inside a group (`p:grpSp`), so
		// track every descendant id, not just the top-level elements.
		const elementIds: string[] = flattenSlideElements(slide.elements).map((element) => element.id);
		for (const anim of expandedAnims) {
			const targetId = resolveAnimationTargetId(anim);
			if (targetId.includes(TEXT_BUILD_ID_SEP)) {
				elementIds.push(targetId);
			}
		}

		return new PresentationAnimationController(engine, elementIds);
	}

	/** The `@keyframes` CSS blocks a binding injects once per slide. */
	public get keyframesCss(): string {
		return this.keyframes;
	}

	/** Shape ids that trigger an interactive (`onShapeClick`) sequence. */
	public get interactiveTriggerShapeIds(): ReadonlySet<string> {
		return this.interactiveIds;
	}

	/** Shape ids that trigger a hover (`onHover`) sequence. */
	public get hoverTriggerShapeIds(): ReadonlySet<string> {
		return this.hoverIds;
	}

	/** Every element id (plus text-build sub-element ids) tracked for state. */
	public get elementIds(): readonly string[] {
		return this.ids;
	}

	// -----------------------------------------------------------------------
	// Main click-group stepping (delegated to the engine)
	// -----------------------------------------------------------------------

	/** True when more click-groups remain to play. */
	public hasMoreSteps(): boolean {
		return this.engine.hasMoreSteps();
	}

	/**
	 * Advance to the next click-group; `null` when none remain, or when the
	 * active group's `@concurrent`/`@nextAc` (ECMA-376 S19.5.60) swallow this
	 * request instead. `nowMs` defaults to `Date.now()`.
	 */
	public advance(nowMs?: number): TimelineClickGroup | null {
		return this.engine.advance(nowMs);
	}

	/** Peek at the next click-group without advancing. */
	public peekNext(): TimelineClickGroup | null {
		return this.engine.peekNext();
	}

	/** True when the next click-group should auto-play without a click. */
	public shouldAutoAdvance(): boolean {
		return this.engine.shouldAutoAdvance();
	}

	/** Auto-advance delay (ms) for the next group; 0 when not applicable. */
	public getAutoAdvanceDelay(): number {
		return this.engine.getAutoAdvanceDelay();
	}

	/** Reset all playback state to the slide's initial (nothing played). */
	public reset(): void {
		this.engine.reset();
	}

	/**
	 * Seed the slide as fully built: every group counted as played, nothing
	 * animating. Bindings use it when the presenter steps BACKWARD onto a slide,
	 * which PowerPoint shows with its builds already complete.
	 */
	public completeAll(): void {
		this.engine.completeAll();
	}

	// -----------------------------------------------------------------------
	// Interactive + hover sequences (delegated to the engine)
	// -----------------------------------------------------------------------

	/** True when `shapeId` triggers an interactive sequence. */
	public hasInteractiveSequence(shapeId: string): boolean {
		return this.engine.hasInteractiveSequence(shapeId);
	}

	/**
	 * Advance the interactive sequence for `shapeId`; `null` when exhausted or
	 * swallowed by `@concurrent`/`@nextAc` (see {@link advance}).
	 */
	public advanceInteractive(shapeId: string, nowMs?: number): TimelineClickGroup | null {
		return this.engine.advanceInteractive(shapeId, nowMs);
	}

	/** True when `shapeId` triggers a hover sequence. */
	public hasHoverSequence(shapeId: string): boolean {
		return this.engine.hasHoverSequence(shapeId);
	}

	/**
	 * Advance the hover sequence for `shapeId`; `null` when exhausted or
	 * swallowed by `@concurrent`/`@nextAc` (see {@link advance}).
	 */
	public advanceHover(shapeId: string, nowMs?: number): TimelineClickGroup | null {
		return this.engine.advanceHover(shapeId, nowMs);
	}

	/**
	 * Reset the hover sequence for `shapeId` so the next hover replays it,
	 * unless its `@prevAc` says to defer the reset while still active (see
	 * `shouldBlockReset` in `animation-sequence-gating`). `nowMs` defaults to
	 * `Date.now()`.
	 */
	public resetHover(shapeId: string, nowMs?: number): void {
		this.engine.resetHover(shapeId, nowMs);
	}

	// -----------------------------------------------------------------------
	// State snapshots
	// -----------------------------------------------------------------------

	/**
	 * Snapshot the current animation state for every tracked element id.
	 * Pass `{ elapsedMs }` to project staged-build `progress` at that playback
	 * time (see the module header's build-reveal contract).
	 */
	public computeStates(options?: PresentationStatesOptions): Map<string, ElementAnimationState> {
		return this.engine.getElementStates(this.ids, options);
	}

	/**
	 * Snapshot the animation state for a specific subset of element ids. Used by
	 * a binding's staged-build requestAnimationFrame loop to re-read only the
	 * build elements' `build` descriptor at the current `elapsedMs`.
	 */
	public computeStatesFor(
		elementIds: readonly string[],
		options?: PresentationStatesOptions,
	): Map<string, ElementAnimationState> {
		return this.engine.getElementStates(elementIds, options);
	}

	/**
	 * Element ids of the steps in a click-group that reveal a staged chart /
	 * SmartArt build (`p:bldChart` / `p:bldDgm`). A non-empty result tells a
	 * binding the group needs a requestAnimationFrame reveal loop; an empty result
	 * means ordinary discrete click-advance is enough.
	 */
	public static collectBuildStepIds(group: TimelineClickGroup): string[] {
		const ids: string[] = [];
		for (const step of group.steps) {
			if (step.build) {
				ids.push(step.elementId);
			}
		}
		return ids;
	}
}
