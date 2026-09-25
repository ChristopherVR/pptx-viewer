/**
 * `animation-behavior-accumulate` - fold a composed effect's behaviours into
 * one element state at an instant (see `animation-behavior-player`).
 *
 * Behaviours arrive sorted by start time (document order breaks ties); each
 * one that has started overrides or adds to what the earlier ones left, as
 * in SMIL, and holds its end value once finished. A formula's bare `ppt_x`
 * reads the attribute as it stood when that behaviour started, so every
 * behaviour gets a snapshot of the state accumulated up to its own start.
 *
 * @module render/animation-behavior-accumulate
 */
import type { PptxAnimationBehavior } from 'pptx-viewer-core';

import type { BehaviorClock } from './animation-behavior-timing';
import { behaviorPhaseAt } from './animation-behavior-timing';
import type { BehaviorValue } from './animation-behavior-values';
import {
	AUTHORED_VAR_PREFIX,
	animValueAt,
	evaluateBehaviorFormula,
} from './animation-behavior-values';
import type { RevealEdge } from './animation-mask-reveal';
import type { MotionPoint } from './animation-motion-path';
import { parseMotionPathPoints } from './animation-motion-path';
import { DEFAULT_SLIDE_ASPECT, pacedFractions, pacedPointAt } from './animation-motion-path-paced';
import type { PptFormulaVars } from './animation-ppt-formula';

export interface BehaviorEntry {
	behavior: PptxAnimationBehavior;
	clock: BehaviorClock;
	index: number;
}

/** Geometry the formulas read: the authored centre/size, slide fractions. */
export interface BehaviorBase {
	ppt_x: number;
	ppt_y: number;
	ppt_w: number;
	ppt_h: number;
}

/** The accumulated state after applying some behaviours. */
export interface BehaviorAccum {
	values: Record<string, BehaviorValue>;
	scaleX: number;
	scaleY: number;
	spin: number;
	motionX: number;
	motionY: number;
	opacity: number;
	/** An element-local `wipe` reveal, when one is running or has run. */
	wipe?: { edge: RevealEdge; revealed: number };
}

const ZERO_BASED = new Set(['r', 'style.rotation', 'xshear']);

const WIPE_FILTER = /^wipe\((up|down|left|right)\)$/u;

const WIPE_EDGE: Readonly<Record<string, RevealEdge>> = {
	up: 'top',
	down: 'bottom',
	left: 'left',
	right: 'right',
};

const OPPOSITE_EDGE: Readonly<Record<RevealEdge, RevealEdge>> = {
	top: 'bottom',
	bottom: 'top',
	left: 'right',
	right: 'left',
};

function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

/** A `p:set` value: formulas (`#ppt_x`) resolve, discrete strings stay strings. */
function setValue(value: string | number | boolean, vars: PptFormulaVars): BehaviorValue {
	if (typeof value !== 'string') {
		return typeof value === 'boolean' ? String(value) : value;
	}
	return evaluateBehaviorFormula(value, vars) ?? value;
}

const pathCache = new WeakMap<object, { points: MotionPoint[]; fractions: number[] }>();

function motionOffset(
	behavior: Extract<PptxAnimationBehavior, { kind: 'animMotion' }>,
	progress: number,
	aspect: number,
): { x: number; y: number } {
	if (behavior.path) {
		let paced = pathCache.get(behavior);
		if (!paced) {
			const points = parseMotionPathPoints(behavior.path);
			paced = { points, fractions: pacedFractions(points, aspect) };
			pathCache.set(behavior, paced);
		}
		const point = pacedPointAt(paced.points, paced.fractions, progress);
		// Parsed points are percent of the slide.
		return { x: point.x / 100, y: point.y / 100 };
	}
	const from = behavior.from ?? { x: 0, y: 0 };
	const to = behavior.to ?? {
		x: from.x + (behavior.by?.x ?? 0),
		y: from.y + (behavior.by?.y ?? 0),
	};
	return { x: lerp(from.x, to.x, progress), y: lerp(from.y, to.y, progress) };
}

/** Formula variables: authored geometry under `orig_`, current geometry bare. */
export function formulaVars(base: BehaviorBase, current: BehaviorAccum['values']): PptFormulaVars {
	const vars: Record<string, number> = {};
	for (const key of ['ppt_x', 'ppt_y', 'ppt_w', 'ppt_h'] as const) {
		vars[`${AUTHORED_VAR_PREFIX}${key}`] = base[key];
		const now = current[key];
		vars[key] = typeof now === 'number' ? now : base[key];
	}
	return vars;
}

function applyEntry(
	state: BehaviorAccum,
	entry: BehaviorEntry,
	t: number,
	vars: PptFormulaVars,
	aspect: number,
): void {
	const { behavior } = entry;
	switch (behavior.kind) {
		case 'set':
			for (const name of behavior.attrNames) {
				state.values[name] = setValue(behavior.value, vars);
			}
			return;
		case 'anim': {
			const name = behavior.attrNames[0];
			const underlying = state.values[name] ?? (ZERO_BASED.has(name) ? 0 : undefined);
			const value = animValueAt(behavior, t, underlying, vars);
			if (value !== undefined) {
				state.values[name] = value;
			}
			return;
		}
		case 'animScale': {
			const from = behavior.from ?? { x: state.scaleX, y: state.scaleY };
			const to = behavior.to ?? {
				x: from.x * (behavior.by?.x ?? 1),
				y: from.y * (behavior.by?.y ?? 1),
			};
			state.scaleX = lerp(from.x, to.x, t);
			state.scaleY = lerp(from.y, to.y, t);
			return;
		}
		case 'animRot':
			state.spin =
				behavior.by !== undefined
					? state.spin + behavior.by * t
					: lerp(behavior.from ?? state.spin, behavior.to ?? state.spin, t);
			return;
		case 'animMotion': {
			const offset = motionOffset(behavior, t, aspect);
			state.motionX = offset.x;
			state.motionY = offset.y;
			return;
		}
		case 'animEffect': {
			const filter = behavior.filter?.trim().toLowerCase();
			const out = behavior.transition === 'out';
			if (filter === 'fade') {
				state.opacity = out ? 1 - t : t;
				return;
			}
			const wipe = filter ? WIPE_FILTER.exec(filter) : null;
			if (wipe) {
				// `wipe(X)` works from edge X in the element's own frame: an
				// entrance reveals from X, an exit conceals from X, leaving the
				// far edge last (CreateVideo: Wipe subtype 4 `wipe(down)` grows
				// up from the bottom; Peek from the bottom, `wipe(up)`, shows
				// the shape's top first as it rises).
				const edge = WIPE_EDGE[wipe[1]];
				state.wipe = out ? { edge: OPPOSITE_EDGE[edge], revealed: 1 - t } : { edge, revealed: t };
			}
		}
	}
}

/**
 * Accumulates `entries` at an effect-relative time, caching each entry's
 * start snapshot (it depends only on the entries before it).
 */
export function createAccumulator(
	entries: readonly BehaviorEntry[],
	base: BehaviorBase,
	aspect: number = DEFAULT_SLIDE_ASPECT,
): (timeMs: number) => BehaviorAccum {
	const snapshots = new Map<number, PptFormulaVars>();
	const fresh = (): BehaviorAccum => ({
		values: { ...base },
		scaleX: 1,
		scaleY: 1,
		spin: 0,
		motionX: 0,
		motionY: 0,
		opacity: 1,
	});
	const run = (timeMs: number, count: number): BehaviorAccum => {
		const state = fresh();
		for (let i = 0; i < count; i++) {
			const entry = entries[i];
			const phase = behaviorPhaseAt(entry.clock, timeMs);
			if (phase.state === 'before') {
				continue;
			}
			applyEntry(state, entry, phase.progress, snapshotFor(i), aspect);
		}
		return state;
	};
	const snapshotFor = (i: number): PptFormulaVars => {
		let vars = snapshots.get(i);
		if (!vars) {
			vars = formulaVars(base, run(entries[i].clock.startMs, i).values);
			snapshots.set(i, vars);
		}
		return vars;
	};
	return (timeMs) => run(timeMs, entries.length);
}
