/**
 * `animation-easing` - the single source of truth for how an animation's
 * speed profile becomes a CSS `animation-timing-function`.
 *
 * PowerPoint ground truth (measured with `Presentation.CreateVideo` on a Fly
 * In, 62.5 fps, sub-pixel RMS against the model below):
 *
 * - An effect with no `accel`/`decel` plays at constant speed (`linear`), not
 *   with CSS's default `ease`.
 * - `accel` is the fraction of the duration spent speeding up, `decel` the
 *   fraction spent slowing down, with constant speed in between. Each ramp's
 *   velocity follows a half-cosine (`(1 - cos(pi * s)) / 2`), not a straight
 *   line: a constant-acceleration (parabolic) ramp fit 5-17 px worse.
 *
 * The exact curve is emitted as a CSS `linear()` easing sampled densely inside
 * the ramps (the cruise segment is exactly linear, so it needs no stops). Where
 * the engine cannot parse `linear()`, a `cubic-bezier()` approximation is
 * used instead, because an unparseable timing function would invalidate the
 * whole `animation` shorthand and the step would not play at all.
 *
 * @module render/animation-easing
 */

import type { PptxAnimationTimingCurve } from 'pptx-viewer-core';

/**
 * The timing curve an editor animation without an explicit `timingCurve`
 * plays with. The core writer saves an unset curve as `accel=0 decel=0`
 * (`timingCurveToAccelDecel(undefined)`), which PowerPoint plays linearly, so
 * the inspector must show, and preview must play, `linear` for it too.
 */
export const DEFAULT_ANIMATION_TIMING_CURVE: PptxAnimationTimingCurve = 'linear';

/** Resolve an editor animation's effective timing curve (unset -> linear). */
export function effectiveTimingCurve(
	curve: PptxAnimationTimingCurve | undefined,
): PptxAnimationTimingCurve {
	return curve ?? DEFAULT_ANIMATION_TIMING_CURVE;
}

function unit(value: number | undefined): number {
	if (value === undefined || !Number.isFinite(value) || value <= 0) {
		return 0;
	}
	return Math.min(1, value);
}

/**
 * Normalise raw `accel`/`decel` fractions: clamp each into 0..1 and, when they
 * sum past 1 (invalid per ECMA-376, which caps the sum at 100%), scale both
 * down proportionally so the ramps meet instead of overlapping.
 */
export function normalizeAccelDecel(
	accel: number | undefined,
	decel: number | undefined,
): { accel: number; decel: number } {
	const a = unit(accel);
	const d = unit(decel);
	const sum = a + d;
	return sum > 1 ? { accel: a / sum, decel: d / sum } : { accel: a, decel: d };
}

/** Distance covered by a unit-length half-cosine velocity ramp at `s` (0..1). */
function rampDistance(s: number): number {
	return s / 2 - Math.sin(Math.PI * s) / (2 * Math.PI);
}

/**
 * PowerPoint's animation progress (0..1) at normalised time `t` (0..1) for the
 * given `accel`/`decel` fractions: half-cosine speed-up over the first
 * `accel`, constant speed, half-cosine slow-down over the last `decel`.
 */
export function powerPointAccelDecelProgress(
	t: number,
	accel: number | undefined,
	decel: number | undefined,
): number {
	const { accel: a, decel: d } = normalizeAccelDecel(accel, decel);
	const time = Math.max(0, Math.min(1, t));
	// Cruise speed that makes the whole profile cover exactly 1.
	const speed = 1 / (1 - a / 2 - d / 2);
	if (a > 0 && time < a) {
		return speed * a * rampDistance(time / a);
	}
	if (d > 0 && time > 1 - d) {
		return 1 - speed * d * rampDistance((1 - time) / d);
	}
	return speed * (time - a / 2);
}

/**
 * Stops per ramp: interpolation error scales with `accel / n^2`, so
 * `n = 12 * sqrt(fraction)` keeps every ramp under ~0.3% of the travel.
 */
function rampStopCount(fraction: number): number {
	return Math.max(3, Math.ceil(12 * Math.sqrt(fraction)));
}

function fmt(value: number, digits: number): string {
	return String(Number(value.toFixed(digits)));
}

/** Build the exact `linear()` easing for normalised, non-zero accel/decel. */
function linearEasing(a: number, d: number): string {
	const times = new Set<number>([0, 1]);
	const addRamp = (start: number, length: number): void => {
		const n = rampStopCount(length);
		for (let i = 0; i <= n; i++) {
			// Round so the ramps' shared endpoints (and 1 itself) dedupe exactly.
			times.add(Number((start + (length * i) / n).toFixed(6)));
		}
	};
	if (a > 0) {
		addRamp(0, a);
	}
	if (d > 0) {
		addRamp(1 - d, d);
	}
	const stops = [...times]
		.sort((x, y) => x - y)
		.map((t) => {
			const value = fmt(powerPointAccelDecelProgress(t, a, d), 4);
			if (t === 0 || t === 1) {
				return value;
			}
			return `${value} ${fmt(t * 100, 2)}%`;
		});
	return `linear(${stops.join(', ')})`;
}

let linearSupportCache: boolean | undefined;

/**
 * Whether the CSS engine understands `linear()` easing (Chrome 113, Firefox
 * 112, Safari 17.2). Outside a browser (tests, SSR) there is no engine to
 * reject it, so the exact form is assumed.
 */
export function supportsCssLinearEasing(): boolean {
	if (linearSupportCache === undefined) {
		const css = (globalThis as { CSS?: { supports?: (p: string, v: string) => boolean } }).CSS;
		linearSupportCache =
			typeof css?.supports === 'function'
				? css.supports('animation-timing-function', 'linear(0, 0.5 25%, 1)')
				: true;
	}
	return linearSupportCache;
}

/**
 * Map an effect's parsed `accel`/`decel` fractions to a CSS timing function.
 * Neither set (or both zero) is constant speed: `linear`.
 *
 * @param useLinearFunction - override the `linear()` support probe (tests).
 */
export function cssEasingForAccelDecel(
	accel: number | undefined,
	decel: number | undefined,
	useLinearFunction: boolean = supportsCssLinearEasing(),
): string {
	const { accel: a, decel: d } = normalizeAccelDecel(accel, decel);
	if (a === 0 && d === 0) {
		return 'linear';
	}
	if (useLinearFunction) {
		return linearEasing(a, d);
	}
	return `cubic-bezier(${a.toFixed(3)}, 0, ${(1 - d).toFixed(3)}, 1)`;
}

/**
 * Map an editor {@link PptxAnimationTimingCurve} to a CSS timing function. An
 * unset (or unknown) curve is `linear`, matching what the core writer saves
 * for it and what PowerPoint then plays.
 */
export function cssEasingForTimingCurve(curve: PptxAnimationTimingCurve | undefined): string {
	switch (curve) {
		case 'ease':
			return 'ease';
		case 'ease-in':
			return 'ease-in';
		case 'ease-out':
			return 'ease-out';
		default:
			return 'linear';
	}
}
