/**
 * `animation-behavior-values` - the value one `p:anim` behaviour contributes
 * at a given progress, following PowerPoint's formula semantics (see
 * `animation-ppt-formula-ground-truth.md`): `#ppt_x`/`#ppt_y` are the shape's
 * authored CENTRE and `#ppt_w`/`#ppt_h` its size, all as slide fractions and
 * all constant for the effect; a `p:tav/@fmla` transforms `$`, the value
 * interpolated between that stop's own `p:val` and the next one's.
 *
 * Without the `#`, `ppt_x`... name the attribute's value when the behaviour
 * STARTS. Boomerang's exit shrinks the width to `ppt_w*.05` over its first
 * half, then ramps `ppt_w` -> `ppt_w/.05`; PowerPoint's video shows the
 * second half growing from that sliver back to full width (14 px wide one
 * second in), not snapping back to `#ppt_w` and on to twenty times it.
 *
 * @module render/animation-behavior-values
 */
import type { PptxAnimBehavior, PptxAnimationKeyframe } from 'pptx-viewer-core';

import type { PptFormulaVars } from './animation-ppt-formula';
import { evaluatePptFormula } from './animation-ppt-formula';

/** A resolved behaviour value: a number, or a discrete string (`visible`). */
export type BehaviorValue = number | string;

interface Stop {
	at: number;
	raw: PptxAnimationKeyframe['value'];
	fmla?: string;
}

/** Variable prefix a `#ppt_*` (authored) reference is rewritten to. */
export const AUTHORED_VAR_PREFIX = 'orig_';

/**
 * Evaluate a behaviour formula: `#ppt_x` reads `orig_ppt_x` (the authored
 * geometry), a bare `ppt_x` reads `ppt_x` (the value at the behaviour's start).
 */
export function evaluateBehaviorFormula(formula: string, vars: PptFormulaVars): number | undefined {
	return evaluatePptFormula(
		formula.replace(/#\s*(ppt_[xywh])(?![a-z0-9_])/giu, `${AUTHORED_VAR_PREFIX}$1`),
		vars,
	);
}

function numericOrFormula(raw: unknown, vars: PptFormulaVars): number | undefined {
	if (typeof raw === 'number') {
		return raw;
	}
	if (typeof raw === 'boolean') {
		return raw ? 1 : 0;
	}
	if (typeof raw !== 'string') {
		return undefined;
	}
	const literal = Number(raw);
	return Number.isFinite(literal) && raw.trim() !== ''
		? literal
		: evaluateBehaviorFormula(raw, vars);
}

function stopsOf(behavior: PptxAnimBehavior): Stop[] | undefined {
	const stops: Stop[] = [];
	for (const keyframe of behavior.keyframes) {
		if (typeof keyframe.tm !== 'number' || !Number.isFinite(keyframe.tm)) {
			return undefined;
		}
		stops.push({
			at: Math.max(0, Math.min(1, keyframe.tm / 100000)),
			raw: keyframe.value,
			fmla: keyframe.fmla,
		});
	}
	stops.sort((a, b) => a.at - b.at);
	return stops;
}

function stopValue(stop: Stop, vars: PptFormulaVars, dollar?: number): BehaviorValue | undefined {
	if (stop.fmla) {
		const own = numericOrFormula(stop.raw, vars);
		return evaluateBehaviorFormula(stop.fmla, { ...vars, $: dollar ?? own ?? 0 });
	}
	if (typeof stop.raw === 'string' && numericOrFormula(stop.raw, vars) === undefined) {
		return stop.raw;
	}
	return numericOrFormula(stop.raw, vars);
}

function tavValueAt(
	stops: Stop[],
	progress: number,
	discrete: boolean,
	vars: PptFormulaVars,
): BehaviorValue | undefined {
	if (stops.length === 0) {
		return undefined;
	}
	if (progress <= stops[0].at || stops.length === 1) {
		return stopValue(stops[0], vars);
	}
	// The segment holding `progress`; past the last stop it is the final
	// segment at ratio 1, so a formula stop keeps shaping the end value
	// (Bounce's last `p:tav` is the bare `$` = 1, not a position).
	let i = 1;
	while (i < stops.length - 1 && progress > stops[i].at) {
		i++;
	}
	const left = stops[i - 1];
	const right = stops[i];
	if (discrete) {
		return stopValue(progress >= right.at ? right : left, vars);
	}
	const span = right.at - left.at;
	const ratio = span <= 0 ? 1 : Math.min(1, (progress - left.at) / span);
	const leftRaw = numericOrFormula(left.raw, vars);
	const rightRaw = numericOrFormula(right.raw, vars);
	if (leftRaw === undefined || rightRaw === undefined) {
		// Discrete strings (`visible` / `hidden`) never interpolate.
		return stopValue(ratio < 1 ? left : right, vars);
	}
	const dollar = leftRaw + (rightRaw - leftRaw) * ratio;
	return left.fmla ? stopValue(left, vars, dollar) : dollar;
}

/** Whether the behaviour's value can be resolved at all (every stop/formula parses). */
export function isResolvableAnim(behavior: PptxAnimBehavior, vars: PptFormulaVars): boolean {
	const stops = stopsOf(behavior);
	if (!stops) {
		return false;
	}
	if (stops.length > 0) {
		return stops.every((stop) => stopValue(stop, vars) !== undefined);
	}
	const formulas = [behavior.from, behavior.to, behavior.by].filter(
		(value): value is string => value !== undefined,
	);
	return (
		formulas.length > 0 &&
		formulas.every((formula) => numericOrFormula(formula, vars) !== undefined)
	);
}

/**
 * The value a `p:anim` produces at `progress` (already eased), given the
 * attribute's `underlying` value (what lower-priority behaviours left).
 */
export function animValueAt(
	behavior: PptxAnimBehavior,
	progress: number,
	underlying: BehaviorValue | undefined,
	vars: PptFormulaVars,
): BehaviorValue | undefined {
	const stops = stopsOf(behavior);
	const additive = behavior.additive === 'sum';
	if (stops && stops.length > 0) {
		const value = tavValueAt(stops, progress, behavior.calcMode === 'discrete', vars);
		if (additive && typeof value === 'number' && typeof underlying === 'number') {
			return underlying + value;
		}
		return value;
	}
	const base = typeof underlying === 'number' ? underlying : 0;
	const by = behavior.by !== undefined ? numericOrFormula(behavior.by, vars) : undefined;
	if (behavior.from === undefined && behavior.to === undefined && by !== undefined) {
		// A by-animation is additive by definition (SMIL): delta over the underlying value.
		return base + by * progress;
	}
	const from = behavior.from !== undefined ? numericOrFormula(behavior.from, vars) : base;
	const to =
		behavior.to !== undefined
			? numericOrFormula(behavior.to, vars)
			: by !== undefined && from !== undefined
				? from + by
				: base;
	if (from === undefined || to === undefined) {
		return undefined;
	}
	const value = from + (to - from) * progress;
	return additive ? base + value : value;
}
