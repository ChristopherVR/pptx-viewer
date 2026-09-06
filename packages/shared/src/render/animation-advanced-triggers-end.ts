/**
 * `animation-advanced-triggers-end`: the `p:endCondLst` half of
 * `animation-advanced-triggers`, split out to keep that module under the
 * repo's 300-line file-size convention. See `animation-advanced-triggers` for
 * the full module doc (start-condition resolution, `TIMENODE_EVENTS`,
 * `CLICK_EVENTS`).
 *
 * @module render/animation-advanced-triggers-end
 */

import type { PptxNativeAnimation, AnimationCondition } from 'pptx-viewer-core';

import {
	CLICK_EVENTS,
	TIMENODE_EVENTS,
	normalizeDelay,
} from './animation-advanced-triggers-shared';

/**
 * Effective interpretation of a node's `endCondLst`. Used mainly for hover
 * (mouse-out reverses) and for nodes that persist until a click / node end.
 */
export interface EffectiveEndCondition {
	/** True when a mouse-out ends (reverses) the node. */
	endsOnMouseOut: boolean;
	/** True when a click ends the node. */
	endsOnClick: boolean;
	/** Click target shape that ends the node, if specified. */
	clickTargetShapeId?: string;
	/** Time node whose end ends this node, if specified. */
	endsWithTimeNodeId?: number;
	/** Fixed end delay (ms), when the node ends after a finite delay. */
	delayMs?: number;
	/** True when the end is "indefinite" (never auto-ends). */
	indefinite: boolean;
}

/** Collapse a node's `endConditions` OR-set into a playback-ready summary. */
export function resolveEffectiveEndCondition(
	conditions: ReadonlyArray<AnimationCondition> | undefined,
): EffectiveEndCondition | undefined {
	if (!conditions || conditions.length === 0) {
		return undefined;
	}

	const result: EffectiveEndCondition = {
		endsOnMouseOut: false,
		endsOnClick: false,
		indefinite: false,
	};

	for (const cond of conditions) {
		const evt = cond.event;
		if (evt === 'onMouseOut') {
			result.endsOnMouseOut = true;
		} else if (evt && CLICK_EVENTS.has(evt)) {
			result.endsOnClick = true;
			if (cond.targetShapeId) {
				result.clickTargetShapeId = cond.targetShapeId;
			}
		} else if (evt && TIMENODE_EVENTS.has(evt) && cond.targetTimeNodeId !== undefined) {
			result.endsWithTimeNodeId = cond.targetTimeNodeId;
		}

		const { ms, indefinite } = normalizeDelay(cond.delay);
		if (indefinite) {
			result.indefinite = true;
		} else if (ms > 0 && result.delayMs === undefined) {
			result.delayMs = ms;
		}
	}

	return result;
}

/** Resolve the effective end condition for a parsed native animation. */
export function resolveAnimationEnd(anim: PptxNativeAnimation): EffectiveEndCondition | undefined {
	return resolveEffectiveEndCondition(anim.endConditions);
}
