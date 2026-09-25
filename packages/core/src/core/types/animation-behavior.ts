/**
 * Every behaviour child of one effect's `p:childTnLst`, as authored.
 *
 * The flattened fields on {@link import('./animation').PptxNativeAnimation}
 * (one rotation, one scale, one effect filter, `p:anim` ramps without their
 * own curves) describe most effects well enough to pick a canned keyframe,
 * but PowerPoint composes its presets from several behaviours that each keep
 * their own `dur`, `delay`, `accel`/`decel`, `autoRev` and `tmFilter` (Bounce
 * alone has five `p:anim` and eight `p:animScale` nodes). This list keeps all
 * of them so playback can follow the tree PowerPoint wrote instead of a
 * preset approximation.
 *
 * @module types/animation-behavior
 */
import type { PptxAnimationKeyframe } from './animation';

/** Timing of one behaviour, from its own `p:cBhvr/p:cTn`. */
export interface PptxAnimationBehaviorTiming {
	/** `p:cTn/@dur` in ms; absent when `indefinite` or unset. */
	durationMs?: number;
	/** Start offset in ms from `p:stCondLst/p:cond/@delay`, relative to the effect start. */
	delayMs?: number;
	/** `p:cTn/@accel` as a 0..1 fraction of the behaviour's duration. */
	accel?: number;
	/** `p:cTn/@decel` as a 0..1 fraction of the behaviour's duration. */
	decel?: number;
	/** `p:cTn/@autoRev`: play forward, then backward, doubling the active time. */
	autoReverse?: boolean;
	/** `p:cTn/@repeatCount` in plain iterations (OOXML stores thousandths). */
	repeatCount?: number;
	/** `p:cTn/@tmFilter`: the raw `"t,v; t,v; ..."` time remapping list. */
	tmFilter?: string;
}

interface BehaviorBase {
	/** Lower-cased `p:attrNameLst` entries, in document order. */
	attrNames: string[];
	/** `p:cBhvr/@additive` (`base`, `sum`, `repl`, `mult`, `none`). */
	additive?: string;
	timing: PptxAnimationBehaviorTiming;
}

/** `p:set`: a discrete value held from the behaviour's start. */
export interface PptxSetBehavior extends BehaviorBase {
	kind: 'set';
	value: string | number | boolean;
}

/** `p:anim`: a `p:tavLst` ramp or a `from`/`to`/`by` formula ramp. */
export interface PptxAnimBehavior extends BehaviorBase {
	kind: 'anim';
	calcMode?: 'discrete' | 'lin' | 'fmla';
	valueType?: string;
	from?: string;
	to?: string;
	by?: string;
	keyframes: PptxAnimationKeyframe[];
}

/** `p:animEffect`: a filter transition (`fade`, `wipe(down)`...). */
export interface PptxAnimEffectBehavior extends BehaviorBase {
	kind: 'animEffect';
	filter?: string;
	transition?: 'in' | 'out' | 'none';
}

/** A `p:animScale` factor pair (1 = unscaled) or a `p:animMotion` offset (slide fractions). */
export interface PptxBehaviorPoint {
	x: number;
	y: number;
}

/** `p:animScale`: scale factors as fractions (OOXML stores percent*1000, so `100000` = 1). */
export interface PptxAnimScaleBehavior extends BehaviorBase {
	kind: 'animScale';
	from?: PptxBehaviorPoint;
	to?: PptxBehaviorPoint;
	by?: PptxBehaviorPoint;
	zoomContents?: boolean;
}

/** `p:animRot`: rotation in degrees (OOXML stores 60000ths). */
export interface PptxAnimRotBehavior extends BehaviorBase {
	kind: 'animRot';
	from?: number;
	to?: number;
	by?: number;
}

/** `p:animMotion`: a path (slide fractions) or a `from`/`to`/`by` offset. */
export interface PptxAnimMotionBehavior extends BehaviorBase {
	kind: 'animMotion';
	path?: string;
	origin?: string;
	from?: PptxBehaviorPoint;
	to?: PptxBehaviorPoint;
	by?: PptxBehaviorPoint;
}

/** One behaviour child of an effect, tagged by its OOXML element. */
export type PptxAnimationBehavior =
	| PptxSetBehavior
	| PptxAnimBehavior
	| PptxAnimEffectBehavior
	| PptxAnimScaleBehavior
	| PptxAnimRotBehavior
	| PptxAnimMotionBehavior;
