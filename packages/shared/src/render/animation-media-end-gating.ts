/**
 * `animation-media-end-gating`: bridges a real `<audio>`/`<video>` element's
 * `ended` DOM event to the {@link TimelineStep}s whose OOXML start condition
 * is `p:cond/@evt="onStopAudio"` targeting that SPECIFIC media element,
 * whether named by time-node id (`@_tn`, `dependsOnTimeNodeId`) or by shape
 * (`p:tgtEl/p:spTgt`, `dependsOnShapeId`) - `CT_TLTimeCondition` (ECMA-376
 * S19.5.28/19.5.31) allows either as an alternative way to say "this specific
 * one" - rather than the estimated-duration delay `animation-timeline-builder`
 * bakes into `TimelineStep.delayMs` (and into `TimelineStep.cssAnimation`'s
 * own `animation-delay`) as a fallback.
 *
 * PowerPoint's own duration for the referenced audio node is only an ESTIMATE
 * of how long the clip actually plays: a variable-length or `p14:trim`med
 * file desyncs the follow-on effect's start from real playback. This module
 * gives a binding what it needs to fire the dependent step's CSS the moment
 * the real media element fires `ended`, instead of waiting out (or firing too
 * early relative to) that estimate:
 *
 *  - {@link findMediaEndGatedSteps} finds which of a click-group's steps wait
 *    on a specific media node.
 *  - {@link zeroDelayCssAnimation} rewrites a step's pre-built `cssAnimation`
 *    shorthand to start immediately (the real event IS the zero point), since
 *    the string was built with the ESTIMATED delay baked in.
 *  - {@link applyMediaEndedStep} applies that corrected step onto the same
 *    `PlaybackContext` state map `animation-playback-engine`'s
 *    `applyAnimationGroupSteps` uses, and schedules its own correctly-timed
 *    cleanup.
 *
 * A binding still schedules the ordinary fallback timer from `delayMs`
 * (`applyAnimationGroupSteps` already does this unconditionally) for
 * headless/export contexts with no real media element; `applyMediaEndedStep`
 * is additive, correcting the effect to the ACTUAL completion time when a
 * real `<audio>`/`<video>` element does exist.
 *
 * @module render/animation-media-end-gating
 */

import type { PptxNativeAnimation } from 'pptx-viewer-core';

import { findMediaElementByElementId } from './animation-media-playback';
import type { PlaybackContext } from './animation-playback-engine';
import type { TimelineClickGroup, TimelineStep } from './animation-timeline-types';

/**
 * Whether `step` waits for a SPECIFIC media element's real completion
 * (`p:cond/@evt="onStopAudio"` naming its dependency by either `@tn`
 * (`dependsOnTimeNodeId`) or `p:tgtEl/p:spTgt` (`dependsOnShapeId`)), rather
 * than resolving entirely from a fixed computed delay.
 */
export function isMediaEndGated(step: TimelineStep): boolean {
	return (
		step.dependsOnEvent === 'onStopAudio' &&
		(step.dependsOnTimeNodeId !== undefined || step.dependsOnShapeId !== undefined)
	);
}

/**
 * Steps in `group` gated on the given media time node id's real completion.
 * A binding calls this from the corresponding `<audio>`/`<video>` element's
 * `ended` handler (matched by that media's own timeline node id) to apply
 * those steps immediately via {@link zeroDelayCssAnimation}, rather than
 * waiting out (or racing) the pre-computed `delayMs` estimate.
 *
 * Only matches the `@tn` (time-node id) dependency form; a `p:tgtEl/p:spTgt`
 * (shape id) dependency is resolved directly by {@link wireMediaEndedSteps}
 * without going through a node-id lookup, so it has no equivalent id to pass
 * here.
 */
export function findMediaEndGatedSteps(
	group: TimelineClickGroup | null | undefined,
	mediaNodeId: number,
): TimelineStep[] {
	if (!group) {
		return [];
	}
	return group.steps.filter(
		(step) => isMediaEndGated(step) && step.dependsOnTimeNodeId === mediaNodeId,
	);
}

/**
 * A `TimelineStep.cssAnimation` shorthand is always generated as
 * `<keyframe> <duration>ms <easing> <delay>ms <iterations> <direction> <fill>`
 * (7 space-separated tokens; `animation-timeline-builder`'s
 * `baseCssAnimation`/`resolveAfterAnimationStepFields`), optionally joined
 * with a second such list by `, ` when two behaviours were parallel-composed
 * (`composeParallelSteps`). The delay token is always index 3.
 */
const CSS_ANIMATION_TOKEN_COUNT = 7;
const DELAY_TOKEN_INDEX = 3;

/**
 * Rewrite every comma-joined segment of a `cssAnimation` shorthand's DELAY
 * token to `0ms`: the real `ended` event that triggered this call IS the
 * zero point, so the ESTIMATED delay baked in at build time no longer
 * applies. A segment that does not match the expected 7-token shape (should
 * not happen for a generated `cssAnimation`, but a defensive fallback matters
 * more than a crash here) is returned unchanged.
 */
export function zeroDelayCssAnimation(cssAnimation: string): string {
	return cssAnimation
		.split(', ')
		.map((segment) => {
			const tokens = segment.trim().split(/\s+/u);
			if (tokens.length !== CSS_ANIMATION_TOKEN_COUNT) {
				return segment;
			}
			tokens[DELAY_TOKEN_INDEX] = '0ms';
			return tokens.join(' ');
		})
		.join(', ');
}

/**
 * Apply a single `onStopAudio`-gated step's CSS the moment the media node it
 * depends on REALLY finishes, rather than the estimated `delayMs` baked into
 * `step.cssAnimation` at build time. A binding calls this from the
 * corresponding `<audio>`/`<video>` element's `ended` handler (steps found
 * via {@link findMediaEndGatedSteps}).
 *
 * `animation-playback-engine`'s `applyAnimationGroupSteps` already scheduled
 * this same step's normal (estimate-based) apply + cleanup unconditionally as
 * the fallback for a context with no real media element (export/headless);
 * this call is additive, correcting the effect to the ACTUAL completion time
 * when a real element does exist, using {@link zeroDelayCssAnimation} since
 * the real event IS the zero point.
 */
/**
 * Wire every media-end-gated step in `group` to its real `<audio>`/`<video>`
 * element's `ended` event. The target element is resolved one of two ways,
 * matching the OOXML choice `p:cond` makes between `@tn` and `p:tgtEl`:
 *
 *  - {@link TimelineStep.dependsOnShapeId} (`p:tgtEl/p:spTgt`): resolved
 *    DIRECTLY by `data-element-id` via {@link findMediaElementByElementId},
 *    scoped to `ctx.frameRoot`. No per-slide map needed since the shape id
 *    already names the element.
 *  - {@link TimelineStep.dependsOnTimeNodeId} (`@tn`): looked up through
 *    `ctx.mediaTimeNodeElementIds` (see {@link resolveMediaTimeNodeElementIds})
 *    first, since a time-node id is not itself an element id.
 *
 * Called once per group application by `animation-playback-engine`'s
 * `applyAnimationGroupSteps`; a context with no real media element for the
 * dependency (export/headless, an unmounted element, or
 * `mediaTimeNodeElementIds` omitted for the `@tn` form) is a no-op, leaving
 * the estimate-based fallback as the only trigger.
 */
export function wireMediaEndedSteps(group: TimelineClickGroup, ctx: PlaybackContext): void {
	for (const step of group.steps) {
		if (step.command || !isMediaEndGated(step)) {
			continue;
		}
		const mediaElementId =
			step.dependsOnShapeId ??
			(step.dependsOnTimeNodeId !== undefined
				? ctx.mediaTimeNodeElementIds?.get(step.dependsOnTimeNodeId)
				: undefined);
		const mediaEl = mediaElementId
			? findMediaElementByElementId(mediaElementId, ctx.frameRoot?.())
			: undefined;
		mediaEl?.addEventListener('ended', () => applyMediaEndedStep(step, ctx), { once: true });
	}
}

/**
 * Map each `p:audio`/`p:video` animation's OWN timing-tree node id
 * (`p:cTn/@id`) to the element id (shape id) it plays, from the slide's
 * parsed native animations. Built once per slide load and passed as
 * `PlaybackContext.mediaTimeNodeElementIds`, so {@link wireMediaEndedSteps}
 * can resolve a `dependsOnTimeNodeId` back to the REAL DOM element to listen
 * for `ended` on (via `findMediaElementByElementId`'s `data-element-id`
 * lookup, exactly like the `p:cmd` media-command resolver already uses).
 */
export function resolveMediaTimeNodeElementIds(
	animations: readonly PptxNativeAnimation[],
): ReadonlyMap<number, string> {
	const map = new Map<number, string>();
	for (const anim of animations) {
		if (anim.kind === 'media' && anim.nodeId !== undefined && anim.targetId) {
			map.set(anim.nodeId, anim.targetId);
		}
	}
	return map;
}

export function applyMediaEndedStep(step: TimelineStep, ctx: PlaybackContext): void {
	const cssAnimation = zeroDelayCssAnimation(step.cssAnimation);
	ctx.setStates((previous) => {
		const next = new Map(previous);
		const current = next.get(step.elementId) ?? { visible: true, cssAnimation: undefined };
		const shouldBeVisible = step.presetClass === 'exit' ? current.visible : true;
		next.set(step.elementId, {
			visible: shouldBeVisible,
			cssAnimation,
			animatesFill: step.colorTargets?.includes('fill') ? true : undefined,
			animatesStroke: step.colorTargets?.includes('stroke') ? true : undefined,
		});
		return next;
	});

	const timer = window.setTimeout(
		() => {
			ctx.setStates((previous) => {
				const next = new Map(previous);
				const current = next.get(step.elementId) ?? { visible: true, cssAnimation: undefined };
				const visibleAfter =
					step.presetClass === 'exit' || step.hideAfterEffect ? false : current.visible;
				next.set(step.elementId, {
					visible: visibleAfter,
					cssAnimation: step.holdEndState ? cssAnimation : undefined,
				});
				return next;
			});
		},
		Math.max(0, step.durationMs + 8),
	);
	ctx.timers.push(timer);
}
