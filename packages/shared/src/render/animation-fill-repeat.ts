/**
 * `animation-fill-repeat`: pure decisions for `p:cTn/@fill`, `@repeatDur`
 * and `@spd`, the three timing attributes the parse layer now surfaces on
 * {@link PptxNativeAnimation} (see `animation-timing-attrs` in
 * `pptx-viewer-core`) but that the timeline builder previously ignored.
 *
 * Kept separate from `animation-timeline-helpers` (already near the 300 LOC
 * guideline) so each binding's playback layer can pull in exactly this
 * decision without growing that module further.
 *
 * @module render/animation-fill-repeat
 */

import type { PptxNativeAnimation } from 'pptx-viewer-core';

/** The subset of a native animation this module's functions need. */
export type EffectTimingInput = Pick<
	PptxNativeAnimation,
	'presetClass' | 'fill' | 'speedPct' | 'repeatCount' | 'repeatDurMs' | 'autoReverse'
>;

/** Adjusted duration + iteration count + end-state hold decision for a step. */
export interface EffectTimingResolution {
	/** Duration in ms after applying `@spd` (unchanged when `speedPct` is absent). */
	durationMs: number;
	/** CSS `animation-iteration-count` value: a finite count, or `Infinity`. */
	iterationCount: number;
	/** Total finite active window, including repeat and auto-reverse passes. */
	activeDurationMs: number;
	/** See {@link import('./animation-timeline-types').TimelineStep.holdEndState}. */
	holdEndState: boolean;
}

/**
 * Apply `@spd` (ST_Percentage, already normalized to a plain percentage by
 * the parse layer) to a base duration. `150` plays at 1.5x speed (shorter
 * duration); absent or non-positive leaves the duration unchanged.
 */
export function applySpeedToDuration(speedPct: number | undefined, baseDurationMs: number): number {
	if (speedPct === undefined || !Number.isFinite(speedPct) || speedPct <= 0) {
		return baseDurationMs;
	}
	return Math.max(1, Math.round(baseDurationMs / (speedPct / 100)));
}

/**
 * Resolve the CSS iteration count from `@repeatCount` (already parsed to a
 * finite multiplier or `Infinity`) or, when absent, from `@repeatDur`
 * (a duration the effect should keep repeating for). `@repeatDur="indefinite"`
 * parses to `Infinity` and wins outright; a finite `repeatDurMs` is divided by
 * the (already speed-adjusted) per-iteration duration.
 */
export function resolveIterationCount(
	repeatCount: number | undefined,
	repeatDurMs: number | undefined,
	adjustedDurationMs: number,
): number {
	if (repeatCount !== undefined) {
		return repeatCount;
	}
	if (repeatDurMs === undefined) {
		return 1;
	}
	if (repeatDurMs === Infinity) {
		return Infinity;
	}
	if (adjustedDurationMs <= 0) {
		return 1;
	}
	return Math.max(1, Math.round(repeatDurMs / adjustedDurationMs));
}

/**
 * Whether the playback layer should keep a step's CSS animation attached once
 * it finishes, per `p:cTn/@fill`.
 *
 * Scoped to `emph` and `path` steps: an entrance's held frame is already its
 * natural resting style (clearing the animation is a no-op), and exit
 * visibility is driven by `presetClass`, not by the CSS animation staying
 * attached. `hold`, `freeze` and `transition` all persist the final frame;
 * `remove` (explicit, or the OOXML default when `@fill` is absent) reverts.
 */
export function shouldHoldEndState(
	anim: Pick<PptxNativeAnimation, 'presetClass' | 'fill'>,
): boolean {
	if (anim.presetClass !== 'emph' && anim.presetClass !== 'path') {
		return false;
	}
	return anim.fill === 'hold' || anim.fill === 'freeze' || anim.fill === 'transition';
}

/** Resolve all three timing decisions for one animation in a single call. */
export function resolveEffectTiming(
	anim: EffectTimingInput,
	baseDurationMs: number,
): EffectTimingResolution {
	const durationMs = applySpeedToDuration(anim.speedPct, baseDurationMs);
	const authoredIterations = resolveIterationCount(anim.repeatCount, anim.repeatDurMs, durationMs);
	const iterationCount =
		anim.autoReverse && anim.repeatDurMs === undefined
			? authoredIterations * 2
			: authoredIterations;
	const activeDurationMs = Number.isFinite(iterationCount)
		? durationMs * iterationCount
		: durationMs;
	return {
		durationMs,
		iterationCount,
		activeDurationMs,
		holdEndState: shouldHoldEndState(anim),
	};
}
