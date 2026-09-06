/**
 * `animation-advanced-triggers` (pure evaluation of compound and simultaneous
 * OOXML timing-tree start/end conditions (`p:stCondLst` / `p:endCondLst`).
 *
 * The parse layer (`pptx-viewer-core`) preserves the FULL set of `p:cond`
 * entries per node on {@link PptxNativeAnimation.startConditions} /
 * {@link PptxNativeAnimation.endConditions}, but the historic playback model
 * collapsed every node down to a single `trigger` + `triggerDelayMs`. That lost
 * compound triggers (e.g. "fire on click OR after a 2s delay") and conditions
 * that depend on another time node ending (e.g. "after several preceding
 * effects"). This module re-derives correct sequencing semantics from the full
 * condition set so {@link import('./animation-timeline-builder').buildTimeline}
 * and {@link import('./animation-sequencer').AnimationSequencer} can honour them.
 *
 * ECMA-376 §19.5.28 (CT_TLTimeCondition): a `stCondLst` holds one OR MORE
 * conditions; the node may begin as soon as ANY one of them is satisfied (a
 * logical OR). `endCondLst` ends the node when ANY of its conditions fire. We
 * therefore model the set, then pick the condition that governs auto-playback
 * (the earliest auto-satisfiable one) while still recording whether a click /
 * hover alternative exists.
 *
 * @module render/animation-advanced-triggers
 */

import type {
	PptxNativeAnimation,
	PptxAnimationTrigger,
	AnimationCondition,
	AnimationConditionEvent,
} from 'pptx-viewer-core';

import {
	CLICK_EVENTS,
	TIMENODE_EVENTS,
	normalizeDelay,
} from './animation-advanced-triggers-shared';

export {
	resolveEffectiveEndCondition,
	resolveAnimationEnd,
	type EffectiveEndCondition,
} from './animation-advanced-triggers-end';

// ==========================================================================
// Condition classification
// ==========================================================================

/** Events that begin a node as the result of a mouse hover. */
const HOVER_EVENTS: ReadonlySet<AnimationConditionEvent> = new Set(['onMouseOver']);

/**
 * Effective, playback-ready interpretation of a node's compound start
 * conditions. Captures the single semantics that drives auto-sequencing plus
 * the alternative interaction paths that coexist in the OR set.
 */
export interface EffectiveStartCondition {
	/**
	 * The trigger that governs automatic timeline sequencing. When the OR set
	 * contains a time-based or time-node condition we play on that; a pure
	 * click/hover-only set keeps its interactive trigger.
	 */
	trigger: PptxAnimationTrigger;
	/**
	 * Extra start delay (ms) contributed by the governing condition's `@_delay`.
	 * Negative ("indefinite", parsed as -1) is treated as 0 for layout but
	 * surfaced via {@link indefinite}.
	 */
	delayMs: number;
	/**
	 * When the governing condition waits on another time node, its id (`@_tn`).
	 * Used to sequence relative to that node finishing (multiple preceding
	 * effects) rather than only the immediately previous step.
	 */
	dependsOnTimeNodeId?: number;
	/**
	 * When the governing condition is an `onStopAudio` naming its dependency by
	 * SHAPE instead of time-node id (`p:tgtEl/p:spTgt/@_spid`, no `@_tn`), the
	 * shape id of the media element it waits on. Mutually exclusive with
	 * {@link dependsOnTimeNodeId}: `CT_TLTimeCondition` allows only one of
	 * `tgtEl` or `@_tn` per condition. `animation-media-end-gating` resolves
	 * this directly against the live DOM (`data-element-id`), unlike
	 * {@link dependsOnTimeNodeId}, which needs the node-id -> element-id map
	 * built at slide load (there is no time-node id to look up here).
	 */
	dependsOnShapeId?: string;
	/** The event of the time-node dependency, when present (begin vs end). */
	dependsOnEvent?: AnimationConditionEvent;
	/** A click target shape, when one of the OR conditions is a shape click. */
	clickTargetShapeId?: string;
	/** True when the OR set also permits a click to start the node early. */
	hasClickAlternative: boolean;
	/** True when the OR set also permits a hover to start the node. */
	hasHoverAlternative: boolean;
	/** True when the governing delay was "indefinite" (waits forever / manual). */
	indefinite: boolean;
	/**
	 * True when the node genuinely waits for the viewer before it starts.
	 *
	 * {@link EffectiveStartCondition.trigger} cannot answer that on its own,
	 * because a condition list that carries no actionable semantics keeps the
	 * node's already-derived `fallbackTrigger` (case 4 below), and that fallback
	 * is `'onClick'` for anything OOXML did not label otherwise. A media
	 * `p:cmd` whose only start condition is `<p:cond delay="0"/>` therefore
	 * looks click-gated while the deck means "start with the slide", which is
	 * how `solution-explorer.pptx` slide 2 ended up with a video that never
	 * started until the presenter pressed Next.
	 */
	requiresInteraction: boolean;
}

/** Triggers that only fire once the viewer does something. */
function isInteractiveTrigger(trigger: PptxAnimationTrigger): boolean {
	return trigger === 'onClick' || trigger === 'onShapeClick' || trigger === 'onHover';
}

function classifyCondition(cond: AnimationCondition): 'click' | 'hover' | 'timenode' | 'delay' {
	const evt = cond.event;
	if (evt && CLICK_EVENTS.has(evt)) {
		return 'click';
	}
	if (evt && HOVER_EVENTS.has(evt)) {
		return 'hover';
	}
	if (evt && TIMENODE_EVENTS.has(evt)) {
		if (cond.targetTimeNodeId !== undefined) {
			return 'timenode';
		}
		// `onStopAudio` alone among TIMENODE_EVENTS may name its dependency by
		// shape (`p:tgtEl/p:spTgt`) instead of `@_tn` (see the TIMENODE_EVENTS
		// doc comment). A shape-targeted `onBegin`/`onEnd` has never been
		// observed and stays a plain delay, unchanged.
		if (evt === 'onStopAudio' && cond.targetShapeId !== undefined) {
			return 'timenode';
		}
	}
	// No event (or onBegin without a tn) with a delay is a pure time offset.
	return 'delay';
}

/**
 * Collapse a node's full `startConditions` OR-set into the single
 * {@link EffectiveStartCondition} that should drive playback, while preserving
 * the alternative interaction paths.
 *
 * Selection (OOXML "fire when ANY applies"):
 *  1. A time-node dependency (onEnd/onBegin of another node) governs sequencing
 *     when present, so the effect chains after the referenced effect(s).
 *  2. Otherwise a pure delay governs (afterDelay / afterPrevious style).
 *  3. Otherwise the interactive trigger (click / hover) governs.
 * In every case, a coexisting click or hover condition is recorded as an
 * alternative so the engine can start the node early on user interaction.
 *
 * `fallbackTrigger` is the node's already-derived simple trigger; it is used
 * when the condition list is empty or carries no actionable semantics.
 */
export function resolveEffectiveStartCondition(
	conditions: ReadonlyArray<AnimationCondition> | undefined,
	fallbackTrigger: PptxAnimationTrigger,
): EffectiveStartCondition {
	const base: EffectiveStartCondition = {
		trigger: fallbackTrigger,
		delayMs: 0,
		hasClickAlternative: false,
		hasHoverAlternative: false,
		indefinite: false,
		requiresInteraction: isInteractiveTrigger(fallbackTrigger),
	};

	if (!conditions || conditions.length === 0) {
		return base;
	}

	let timenode: AnimationCondition | undefined;
	let delayCond: AnimationCondition | undefined;
	let clickCond: AnimationCondition | undefined;
	let hoverCond: AnimationCondition | undefined;

	for (const cond of conditions) {
		switch (classifyCondition(cond)) {
			case 'timenode':
				// Prefer a `@_tn`-identified condition over a shape-targeted one
				// (deterministic: a real node id is more specific than a shape),
				// then the smallest target node id among those; otherwise keep the
				// first shape-targeted condition encountered.
				if (!timenode) {
					timenode = cond;
				} else if (cond.targetTimeNodeId !== undefined) {
					if (
						timenode.targetTimeNodeId === undefined ||
						cond.targetTimeNodeId < timenode.targetTimeNodeId
					) {
						timenode = cond;
					}
				}
				break;
			case 'delay':
				// Prefer the smallest delay (earliest auto-fire) among delay conds.
				if (!delayCond || (cond.delay ?? 0) < (delayCond.delay ?? 0)) {
					delayCond = cond;
				}
				break;
			case 'click':
				if (!clickCond) {
					clickCond = cond;
				}
				break;
			case 'hover':
				if (!hoverCond) {
					hoverCond = cond;
				}
				break;
		}
	}

	base.hasClickAlternative = clickCond !== undefined;
	base.hasHoverAlternative = hoverCond !== undefined;
	if (clickCond?.targetShapeId) {
		base.clickTargetShapeId = clickCond.targetShapeId;
	}

	// 1. Time-node dependency governs sequencing.
	if (timenode) {
		const { ms, indefinite } = normalizeDelay(timenode.delay);
		base.trigger =
			timenode.event === 'onBegin' || timenode.event === 'begin' ? 'withPrevious' : 'afterPrevious';
		base.delayMs = ms;
		base.indefinite = indefinite;
		base.dependsOnTimeNodeId = timenode.targetTimeNodeId;
		base.dependsOnShapeId =
			timenode.targetTimeNodeId === undefined ? timenode.targetShapeId : undefined;
		base.dependsOnEvent = timenode.event;
		// Chained off another node's begin/end: the timeline starts it, not a click.
		base.requiresInteraction = false;
		return base;
	}

	// 2. Pure delay governs.
	if (delayCond && (delayCond.delay ?? 0) !== 0) {
		const { ms, indefinite } = normalizeDelay(delayCond.delay);
		// A delay alongside a click means "auto after delay, or sooner on click".
		base.trigger = clickCond ? 'onClick' : 'afterDelay';
		base.delayMs = ms;
		base.indefinite = indefinite;
		// The delay fires on its own; a coexisting click only brings it forward,
		// so this node does not WAIT for the viewer even when `trigger` says
		// `onClick` (that spelling exists so the engine offers the early-out).
		base.requiresInteraction = indefinite;
		return base;
	}

	// 3. Interactive trigger governs.
	if (clickCond) {
		base.trigger = clickCond.targetShapeId ? 'onShapeClick' : 'onClick';
		base.requiresInteraction = true;
		return base;
	}
	if (hoverCond) {
		base.trigger = 'onHover';
		base.requiresInteraction = true;
		return base;
	}

	// 4. Zero-delay-only condition (onBegin / @_delay="0"): keep fallback but
	// surface that nothing interactive is required (auto with previous).
	if (delayCond) {
		base.trigger = fallbackTrigger;
		base.delayMs = 0;
		base.requiresInteraction = false;
	}
	return base;
}

/**
 * Resolve the effective start condition for a parsed native animation,
 * combining its full `startConditions` OR-set with its already-derived simple
 * `trigger` as a fallback.
 */
export function resolveAnimationStart(anim: PptxNativeAnimation): EffectiveStartCondition {
	return resolveEffectiveStartCondition(anim.startConditions, anim.trigger ?? 'onClick');
}
