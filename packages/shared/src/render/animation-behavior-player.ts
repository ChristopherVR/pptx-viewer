/**
 * `animation-behavior-player` - plays a composed PowerPoint entrance/exit
 * effect from its own behaviour tree (`PptxNativeAnimation.behaviors`)
 * instead of a canned keyframe keyed on the preset id.
 *
 * Every behaviour runs on its own clock (`animation-behavior-timing`); at any
 * instant the ones that have started are applied in start order (later start
 * wins, document order breaks ties, as in SMIL), each holding its end value
 * once finished. `p:anim` geometry (`ppt_x`/`ppt_y`/`ppt_w`/`ppt_h`) resolves
 * against the shape's authored box, `p:animScale` multiplies the size,
 * `p:animRot` and `style.rotation` turn it, `p:animMotion` offsets it, a
 * `fade` `p:animEffect` drives opacity, a `wipe` one an element-local mask
 * (Peek, Ease In, Bounce), and `style.visibility` shows/hides it. Other
 * filters are ignored; the transform still plays.
 *
 * @module render/animation-behavior-player
 */
import type { PptxAnimationBehavior, PptxNativeAnimation } from 'pptx-viewer-core';

import type { BehaviorBase, BehaviorEntry } from './animation-behavior-accumulate';
import { createAccumulator, formulaVars } from './animation-behavior-accumulate';
import { behaviorClock } from './animation-behavior-timing';
import type { BehaviorValue } from './animation-behavior-values';
import { isResolvableAnim } from './animation-behavior-values';
import type { RevealEdge } from './animation-mask-reveal';
import { parseMotionPathPoints } from './animation-motion-path';
import type { PptFormulaVars } from './animation-ppt-formula';
import type { AnimationElementBox } from './animation-render-context';

/** The element's visual state at one instant, relative to its resting box. */
export interface BehaviorFrame {
	/** Centre offset from rest, in slide fractions. */
	dx: number;
	dy: number;
	scaleX: number;
	scaleY: number;
	/** Degrees clockwise. */
	rotation: number;
	/** `xshear` as a shear factor (x offset per unit of height). */
	shearX: number;
	opacity: number;
	/** Element-local wipe reveal (see `maskEdgePartialDecl`), when the tree has one. */
	wipe?: { edge: RevealEdge; revealed: number };
}

export interface BehaviorPlayer {
	/** Effect duration the clocks were resolved against, in ms. */
	durationMs: number;
	/** Effect-relative times (ms) where a behaviour starts, ends, reverses or hits a stop. */
	breakpointsMs: number[];
	/** True when every behaviour is linear between breakpoints. */
	piecewiseLinear: boolean;
	frameAt(timeMs: number): BehaviorFrame;
}

const GEOMETRY = new Set(['ppt_x', 'ppt_y', 'ppt_w', 'ppt_h']);
const SUPPORTED_ANIM = new Set([
	...GEOMETRY,
	'style.rotation',
	'r',
	'xshear',
	'style.visibility',
	'style.opacity',
]);

type Entry = BehaviorEntry;

function isTransformBehavior(behavior: PptxAnimationBehavior): boolean {
	switch (behavior.kind) {
		case 'animScale':
		case 'animRot':
		case 'animMotion':
			return true;
		case 'anim':
		case 'set':
			return behavior.attrNames.some(
				(name) => name !== 'style.visibility' && name !== 'style.opacity',
			);
		default:
			return false;
	}
}

function isSupported(behavior: PptxAnimationBehavior, vars: PptFormulaVars): boolean {
	switch (behavior.kind) {
		case 'anim':
			return (
				behavior.attrNames.length === 1 &&
				SUPPORTED_ANIM.has(behavior.attrNames[0]) &&
				isResolvableAnim(behavior, vars)
			);
		case 'set':
			return behavior.attrNames.every((name) => SUPPORTED_ANIM.has(name));
		case 'animMotion':
			return behavior.path === undefined || parseMotionPathPoints(behavior.path).length >= 2;
		default:
			return true;
	}
}

function toNumber(value: BehaviorValue | undefined, fallback: number): number {
	if (typeof value === 'number') {
		return value;
	}
	const parsed = typeof value === 'string' ? Number.parseFloat(value) : Number.NaN;
	return Number.isFinite(parsed) ? parsed : fallback;
}

function breakpointsOf(entry: Entry): number[] {
	const { clock, behavior } = entry;
	const points = [clock.startMs, clock.startMs + clock.activeMs];
	if (clock.autoReverse) {
		points.push(clock.startMs + clock.simpleMs);
	}
	if (behavior.kind === 'anim') {
		for (const keyframe of behavior.keyframes) {
			if (typeof keyframe.tm === 'number') {
				points.push(clock.startMs + (keyframe.tm / 100000) * clock.simpleMs);
			}
		}
	}
	return points;
}

function isLinear(entry: Entry): boolean {
	const { clock, behavior } = entry;
	if (clock.accel || clock.decel || clock.filter) {
		return false;
	}
	if (behavior.kind === 'anim' && behavior.keyframes.some((keyframe) => keyframe.fmla)) {
		return false;
	}
	return !(behavior.kind === 'animMotion' && behavior.path);
}

/**
 * Build a player for an entrance/exit whose behaviour tree carries a
 * transform, or `undefined` when there is no tree, no box to resolve the
 * formulas against, or a behaviour this player cannot represent (the caller
 * then keeps its existing preset path).
 */
export function createBehaviorPlayer(
	anim: Pick<PptxNativeAnimation, 'behaviors' | 'durationMs' | 'presetClass' | 'accel' | 'decel'>,
	box: AnimationElementBox | undefined,
): BehaviorPlayer | undefined {
	const behaviors = anim.behaviors;
	if (!behaviors || !box || (anim.presetClass !== 'entr' && anim.presetClass !== 'exit')) {
		return undefined;
	}
	const base: BehaviorBase = {
		ppt_x: box.x + box.width / 2,
		ppt_y: box.y + box.height / 2,
		ppt_w: box.width,
		ppt_h: box.height,
	};
	const vars = formulaVars(base, { ...base });
	if (!behaviors.some(isTransformBehavior) || !behaviors.every((b) => isSupported(b, vars))) {
		return undefined;
	}
	const effectMs = Math.max(1, anim.durationMs ?? 500);
	const entries: Entry[] = behaviors
		.map((behavior, index) => ({
			behavior,
			clock: behaviorClock(behavior.timing, effectMs, { accel: anim.accel, decel: anim.decel }),
			index,
		}))
		.sort((a, b) => a.clock.startMs - b.clock.startMs || a.index - b.index);
	const breakpoints = new Set<number>([0, effectMs]);
	for (const entry of entries) {
		for (const point of breakpointsOf(entry)) {
			breakpoints.add(Math.max(0, Math.min(effectMs, point)));
		}
	}
	const accumulate = createAccumulator(entries, base, box.slideAspect);
	const safeW = base.ppt_w > 0 ? base.ppt_w : 1;
	const safeH = base.ppt_h > 0 ? base.ppt_h : 1;

	return {
		durationMs: effectMs,
		breakpointsMs: [...breakpoints].sort((a, b) => a - b),
		piecewiseLinear: entries.every(isLinear),
		frameAt(timeMs) {
			const state = accumulate(timeMs);
			const { values } = state;
			const hidden = values['style.visibility'] === 'hidden';
			const styleOpacity = toNumber(values['style.opacity'], 1);
			return {
				dx: toNumber(values.ppt_x, base.ppt_x) - base.ppt_x + state.motionX,
				dy: toNumber(values.ppt_y, base.ppt_y) - base.ppt_y + state.motionY,
				scaleX: (toNumber(values.ppt_w, base.ppt_w) / safeW) * state.scaleX,
				scaleY: (toNumber(values.ppt_h, base.ppt_h) / safeH) * state.scaleY,
				rotation: toNumber(values['style.rotation'], 0) + toNumber(values.r, 0) + state.spin,
				shearX: toNumber(values.xshear, 0),
				opacity: hidden ? 0 : Math.max(0, Math.min(1, state.opacity * styleOpacity)),
				...(state.wipe ? { wipe: state.wipe } : {}),
			};
		},
	};
}
