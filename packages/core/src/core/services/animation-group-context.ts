/**
 * Grouping context for the OOXML timing-tree walk.
 *
 * The parsed animation list is FLAT, but `p:timing` is a tree whose shape
 * carries sequencing meaning that a flat list cannot express:
 *
 * - A direct `p:par` child of the `mainSeq` is one **click step**. It waits for
 *   a click when its only start condition is `<p:cond delay="indefinite"/>`;
 *   it starts on slide entry when it also carries a time-node condition
 *   (`onBegin`/`onEnd` with a `@tn`) or a finite delay. Without this, the very
 *   first group was always treated as click-gated, so a deck whose opening
 *   effects are "With Previous" rendered blank until the viewer clicked.
 * - Effects sharing an **effect-wrapper `p:par`** are siblings: they all start
 *   when that wrapper starts, so each `p:cond/@delay` is an offset from the
 *   wrapper, not from the effect before it.
 *
 * This module derives both facts during the walk so playback can honour them.
 *
 * @module animation-group-context
 */

import type { XmlObject } from '../types';
import { ensureArray } from './native-animation-helpers';

/** Timing-condition events that chain a node off another time node. */
const TIME_NODE_EVENTS = new Set(['onBegin', 'onEnd', 'begin', 'end']);

/**
 * Context threaded down the timing-tree walk. `parCounter` is shared by
 * reference so every wrapper `p:par` in the slide gets a distinct index.
 */
export interface AnimationGroupContext {
	/** Whether the enclosing click-level group starts without a click. */
	groupAutoStart?: boolean;
	/** Index of the enclosing effect-wrapper `p:par`. */
	parGroupIndex?: number;
	/** Shared monotonic counter used to mint wrapper indexes. */
	parCounter: { next: number };
	/** `p:seq/@concurrent` of the innermost enclosing sequence, if any. */
	seqConcurrent?: boolean;
	/** `p:seq/@nextAc` of the innermost enclosing sequence, if any. */
	seqNextAction?: 'none' | 'seek';
	/** `p:seq/@prevAc` of the innermost enclosing sequence, if any. */
	seqPrevAction?: 'none' | 'skipTimeNode';
}

/** A fresh root context for one slide's timing tree. */
export function createGroupContext(): AnimationGroupContext {
	return { parCounter: { next: 0 } };
}

/**
 * Whether a `p:cTn`'s start conditions let it begin without user interaction.
 *
 * ECMA-376 S19.5.28: a `stCondLst` is an OR-set, so ANY auto-satisfiable
 * condition starts the node. A lone indefinite delay (PowerPoint's "On Click"
 * gate) is the only common form that is NOT auto-satisfiable. A node with no
 * `stCondLst` at all is ungated and therefore automatic.
 */
export function conditionsStartAutomatically(cTn: XmlObject | undefined): boolean {
	if (!cTn) {
		return true;
	}
	const stCondLst = cTn['p:stCondLst'] as XmlObject | undefined;
	if (!stCondLst) {
		return true;
	}
	const conditions = ensureArray(stCondLst['p:cond']);
	if (conditions.length === 0) {
		return true;
	}
	for (const condition of conditions) {
		const event = condition['@_evt'] === undefined ? undefined : String(condition['@_evt']);
		const hasTimeNode = condition['p:tn'] !== undefined || condition['@_tn'] !== undefined;
		if (event !== undefined && TIME_NODE_EVENTS.has(event) && hasTimeNode) {
			return true;
		}
		if (event !== undefined) {
			// onClick / onNext / onMouseOver / onPrev etc. all need interaction.
			continue;
		}
		const delay = condition['@_delay'];
		if (delay !== undefined && Number.isFinite(Number.parseInt(String(delay), 10))) {
			return true;
		}
	}
	return false;
}

/** True when this `p:cTn` is the `mainSeq` node of a slide's timing tree. */
export function isMainSequence(cTn: XmlObject | undefined): boolean {
	return cTn !== undefined && String(cTn['@_nodeType'] ?? '') === 'mainSeq';
}

/**
 * True when a `p:cTn` describes an effect (it carries the preset attributes)
 * rather than acting as a structural wrapper. Only wrappers mint a new
 * {@link AnimationGroupContext.parGroupIndex}; effects inherit their wrapper's.
 */
export function isEffectNode(cTn: XmlObject | undefined): boolean {
	return cTn !== undefined && cTn['@_presetClass'] !== undefined;
}

/** Derive the child context for descending into a `p:par`/`p:seq` node. */
export function childGroupContext(
	parent: AnimationGroupContext,
	cTn: XmlObject | undefined,
	options: { isClickLevelGroup: boolean },
): AnimationGroupContext {
	if (options.isClickLevelGroup) {
		return {
			groupAutoStart: conditionsStartAutomatically(cTn),
			parGroupIndex: parent.parGroupIndex,
			parCounter: parent.parCounter,
			// The innermost enclosing `p:seq`'s attrs are unrelated to click-level
			// grouping; carry them through rather than dropping them here.
			seqConcurrent: parent.seqConcurrent,
			seqNextAction: parent.seqNextAction,
			seqPrevAction: parent.seqPrevAction,
		};
	}
	if (isEffectNode(cTn)) {
		return parent;
	}
	return {
		groupAutoStart: parent.groupAutoStart,
		parGroupIndex: parent.parCounter.next++,
		parCounter: parent.parCounter,
		seqConcurrent: parent.seqConcurrent,
		seqNextAction: parent.seqNextAction,
		seqPrevAction: parent.seqPrevAction,
	};
}
