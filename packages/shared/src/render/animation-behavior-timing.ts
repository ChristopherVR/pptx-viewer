/**
 * `animation-behavior-timing` - the local clock of one behaviour inside a
 * composed PowerPoint effect (see `animation-behavior-player`).
 *
 * Each behaviour in an effect's `p:childTnLst` has its own `p:cTn`: a start
 * delay and duration relative to the effect, optional `accel`/`decel`
 * (PowerPoint's half-cosine ramps, `animation-easing`), `autoRev` (play
 * forward then back, doubling the active time), `repeatCount` and a
 * `tmFilter` (a piecewise-linear remap of the simple time). This module turns
 * an effect-relative time into that behaviour's progress.
 *
 * @module render/animation-behavior-timing
 */
import type { PptxAnimationBehaviorTiming } from 'pptx-viewer-core';

import { powerPointAccelDecelProgress } from './animation-easing';

/** A behaviour's resolved clock, in ms relative to the effect start. */
export interface BehaviorClock {
	startMs: number;
	/** One forward pass (`p:cTn/@dur`). */
	simpleMs: number;
	/** Whole active time: simple x (autoRev ? 2 : 1) x repeatCount. */
	activeMs: number;
	accel?: number;
	decel?: number;
	autoReverse: boolean;
	filter?: ReadonlyArray<readonly [number, number]>;
}

/** Where a behaviour is at an effect-relative time. */
export type BehaviorPhase = { state: 'before' } | { state: 'active'; progress: number };

/**
 * Parse a `tmFilter` (`"0,0; .5, 1; 1, 1"`) into ascending (time, value)
 * pairs, or `undefined` when it is malformed.
 */
export function parseTmFilter(raw: string | undefined): Array<[number, number]> | undefined {
	if (!raw) {
		return undefined;
	}
	const pairs: Array<[number, number]> = [];
	for (const chunk of raw.split(';')) {
		if (chunk.trim() === '') {
			continue;
		}
		const [t, v] = chunk.split(',').map((part) => Number.parseFloat(part.trim()));
		if (!Number.isFinite(t) || !Number.isFinite(v)) {
			return undefined;
		}
		pairs.push([t, v]);
	}
	pairs.sort((a, b) => a[0] - b[0]);
	return pairs.length >= 2 ? pairs : undefined;
}

function applyFilter(
	filter: ReadonlyArray<readonly [number, number]> | undefined,
	t: number,
): number {
	if (!filter) {
		return t;
	}
	if (t <= filter[0][0]) {
		return filter[0][1];
	}
	for (let i = 1; i < filter.length; i++) {
		const [t1, v1] = filter[i];
		if (t <= t1) {
			const [t0, v0] = filter[i - 1];
			const span = t1 - t0;
			return span <= 0 ? v1 : v0 + ((t - t0) / span) * (v1 - v0);
		}
	}
	return filter[filter.length - 1][1];
}

/**
 * Resolve a behaviour's clock. A behaviour with no `dur` spans the effect
 * (`effectMs`); a 1 ms toggle keeps its 1 ms. `inherited` is the effect's
 * own accel/decel, used when the behaviour sets neither.
 */
export function behaviorClock(
	timing: PptxAnimationBehaviorTiming,
	effectMs: number,
	inherited?: { accel?: number; decel?: number },
): BehaviorClock {
	// PowerPoint applies the EFFECT's accel/decel to each behaviour's own
	// clock, not to the effect as a whole: Swish (effect accel 50%) drops in
	// on its first 0.455-of-the-effect leg with the half-cosine ramp spread
	// over that leg alone (CreateVideo: bottom edge at 40 px 0.448 s in, 43 px
	// predicted per-leg, off-slide under a whole-effect warp).
	const own = timing.accel !== undefined || timing.decel !== undefined;
	const accel = own ? timing.accel : inherited?.accel;
	const decel = own ? timing.decel : inherited?.decel;
	const simpleMs = Math.max(1, timing.durationMs ?? effectMs);
	const autoReverse = timing.autoReverse === true;
	const repeat =
		timing.repeatCount !== undefined && timing.repeatCount > 0 ? timing.repeatCount : 1;
	return {
		startMs: Math.max(0, timing.delayMs ?? 0),
		simpleMs,
		activeMs: simpleMs * (autoReverse ? 2 : 1) * repeat,
		accel,
		decel,
		autoReverse,
		filter: parseTmFilter(timing.tmFilter),
	};
}

/**
 * The behaviour's eased progress (0..1) at `timeMs` after the effect start.
 * Before its start it has no effect; after its active time it holds the
 * final value (`fill="hold"`, what PowerPoint writes on every preset).
 */
export function behaviorPhaseAt(clock: BehaviorClock, timeMs: number): BehaviorPhase {
	const elapsed = timeMs - clock.startMs;
	if (elapsed < 0) {
		return { state: 'before' };
	}
	const iterationMs = clock.simpleMs * (clock.autoReverse ? 2 : 1);
	let local: number;
	if (elapsed >= clock.activeMs) {
		// Frozen at the end of the last iteration: a reversed pass ends at 0.
		local = clock.autoReverse ? 0 : 1;
	} else {
		const within = elapsed % iterationMs;
		const forward = Math.min(within, clock.simpleMs) / clock.simpleMs;
		local =
			clock.autoReverse && within > clock.simpleMs
				? 1 - (within - clock.simpleMs) / clock.simpleMs
				: forward;
	}
	const eased =
		clock.accel !== undefined || clock.decel !== undefined
			? powerPointAccelDecelProgress(local, clock.accel, clock.decel)
			: local;
	return { state: 'active', progress: applyFilter(clock.filter, eased) };
}
