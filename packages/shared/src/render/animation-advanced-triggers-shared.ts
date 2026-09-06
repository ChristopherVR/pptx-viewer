/**
 * Internal helpers shared by `animation-advanced-triggers` (start conditions)
 * and `animation-advanced-triggers-end` (end conditions), split out purely to
 * avoid a circular import between the two (both need the same event-set
 * classification and delay normalisation). Not part of the public API: import
 * from `animation-advanced-triggers` / `animation-advanced-triggers-end`.
 *
 * @module render/animation-advanced-triggers-shared
 */

import type { AnimationConditionEvent } from 'pptx-viewer-core';

/** Events that begin (or end) a node as the result of a user click. */
export const CLICK_EVENTS: ReadonlySet<AnimationConditionEvent> = new Set(['onClick', 'onNext']);

/**
 * Events that chain a node off another time node's lifecycle (begin/end).
 * These are the "after preceding effect(s)" conditions and normally carry a
 * `targetTimeNodeId` (`@_tn`) pointing at the node they wait on.
 *
 * `onStopAudio` (ECMA-376 S19.5.28/19.5.31) is included here when it carries
 * EITHER a `@_tn` OR a `p:tgtEl/p:spTgt` shape target: PowerPoint's "After
 * Previous" + "Play Audio" combination authors the `@_tn` form against the
 * SPECIFIC audio time node it waits on, exactly like `onEnd`, so it chains
 * sequencing the same way. `CT_TLTimeCondition` makes `tgtEl` and `@_tn`
 * mutually exclusive alternatives for naming what a condition targets (the
 * same choice `onClick`/`onNext` already use via `targetShapeId` for "click
 * THIS shape"), and a media shape's own Play behaviour is 1:1 with its shape
 * id, so a `p:tgtEl/p:spTgt`-named `onStopAudio` condition is the same
 * dependency named by shape instead of by time-node id; see
 * `EffectiveStartCondition.dependsOnShapeId` in `animation-advanced-triggers`.
 * An `onStopAudio` condition with NEITHER `@_tn` NOR a shape target (waits on
 * "whichever audio is currently playing", or targets the slide itself, e.g.
 * `p:cMediaNode`'s own `endCondLst` stopping a clip when the slide ends)
 * falls through to the plain-delay bucket, unchanged from before.
 */
export const TIMENODE_EVENTS: ReadonlySet<AnimationConditionEvent> = new Set([
	'onBegin',
	'onEnd',
	'begin',
	'end',
	'onStopAudio',
]);

/** Normalise a possibly-indefinite delay to a non-negative number of ms. */
export function normalizeDelay(delay: number | undefined): { ms: number; indefinite: boolean } {
	if (delay === undefined) {
		return { ms: 0, indefinite: false };
	}
	if (delay < 0) {
		return { ms: 0, indefinite: true };
	}
	return { ms: delay, indefinite: false };
}
