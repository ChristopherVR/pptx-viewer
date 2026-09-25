import { describe, expect, it } from 'vitest';

import {
	DEFAULT_ANIMATION_TIMING_CURVE,
	cssEasingForAccelDecel,
	cssEasingForTimingCurve,
	effectiveTimingCurve,
	normalizeAccelDecel,
	powerPointAccelDecelProgress,
} from './animation-easing';

/**
 * PowerPoint ground truth: a 200px Fly In (from left, 2 s) exported with
 * `Presentation.CreateVideo` at 62.5 fps; progress = leading edge / 580px,
 * sampled at t = 0.1, 0.25, 0.5, 0.75, 0.9 of the duration.
 */
const MEASURED: ReadonlyArray<{ accel: number; decel: number; progress: readonly number[] }> = [
	{ accel: 0, decel: 0, progress: [0.1, 0.25, 0.5, 0.75, 0.9] },
	{ accel: 0.5, decel: 0, progress: [0.003, 0.061, 0.333, 0.666, 0.867] },
	{ accel: 0, decel: 0.5, progress: [0.133, 0.334, 0.667, 0.939, 0.997] },
	{ accel: 0.25, decel: 0.25, progress: [0.016, 0.166, 0.5, 0.834, 0.984] },
	{ accel: 1, decel: 0, progress: [0.002, 0.025, 0.181, 0.524, 0.802] },
];
const SAMPLE_TIMES = [0.1, 0.25, 0.5, 0.75, 0.9];

/** Evaluate a CSS `linear(...)` easing string at input progress `t`. */
function evaluateLinearEasing(easing: string, t: number): number {
	const body = /^linear\((.*)\)$/u.exec(easing)?.[1];
	if (!body) {
		throw new Error(`not a linear() easing: ${easing}`);
	}
	const raw = body.split(',').map((stop) => stop.trim().split(/\s+/u));
	const stops = raw.map(([value, pct], index) => ({
		value: Number(value),
		at: pct === undefined ? (index === 0 ? 0 : 1) : Number(pct.replace('%', '')) / 100,
	}));
	for (let i = 1; i < stops.length; i++) {
		const a = stops[i - 1];
		const b = stops[i];
		if (t <= b.at) {
			return a.value + ((b.value - a.value) * (t - a.at)) / (b.at - a.at);
		}
	}
	return stops[stops.length - 1].value;
}

describe('cssEasingForAccelDecel', () => {
	it('plays an effect without accel/decel linearly (PowerPoint constant speed)', () => {
		expect(cssEasingForAccelDecel(undefined, undefined)).toBe('linear');
		expect(cssEasingForAccelDecel(0, 0)).toBe('linear');
		expect(cssEasingForAccelDecel(-0.2, Number.NaN)).toBe('linear');
	});

	it('emits a linear() curve that tracks the exact profile within 0.3%', () => {
		for (const [accel, decel] of [
			[0.5, 0],
			[0, 0.5],
			[0.25, 0.25],
			[1, 0],
			[0.1, 0.1],
			[0.05, 0],
		]) {
			const easing = cssEasingForAccelDecel(accel, decel, true);
			for (let t = 0; t <= 1; t += 0.01) {
				expect(
					Math.abs(evaluateLinearEasing(easing, t) - powerPointAccelDecelProgress(t, accel, decel)),
				).toBeLessThan(0.003);
			}
		}
	});

	it('keeps the linear() stops free of duplicate positions', () => {
		const easing = cssEasingForAccelDecel(0.5, 0.5, true);
		const positions = easing.match(/[\d.]+%/gu) ?? [];
		expect(new Set(positions).size).toBe(positions.length);
		expect(easing.startsWith('linear(0, ')).toBeTruthy();
		expect(easing.endsWith(', 1)')).toBeTruthy();
	});

	it('falls back to a cubic-bezier where linear() is unsupported', () => {
		expect(cssEasingForAccelDecel(0.5, 0, false)).toBe('cubic-bezier(0.500, 0, 1.000, 1)');
		expect(cssEasingForAccelDecel(0.3, 0.3, false)).toBe('cubic-bezier(0.300, 0, 0.700, 1)');
		expect(cssEasingForAccelDecel(0, 0, false)).toBe('linear');
	});
});

describe('powerPointAccelDecelProgress', () => {
	it('matches the CreateVideo measurements within 0.6% of the travel', () => {
		for (const { accel, decel, progress } of MEASURED) {
			SAMPLE_TIMES.forEach((t, i) => {
				expect(Math.abs(powerPointAccelDecelProgress(t, accel, decel) - progress[i])).toBeLessThan(
					0.006,
				);
			});
		}
	});

	it('cruises at 1 / (1 - (accel + decel) / 2) between the ramps', () => {
		const slope =
			(powerPointAccelDecelProgress(0.6, 0.25, 0.25) -
				powerPointAccelDecelProgress(0.4, 0.25, 0.25)) /
			0.2;
		expect(slope).toBeCloseTo(1 / 0.75, 6);
	});

	it('is 0 at the start, 1 at the end and monotonic', () => {
		let previous = 0;
		for (let t = 0; t <= 1.0001; t += 0.02) {
			const p = powerPointAccelDecelProgress(t, 0.4, 0.3);
			expect(p).toBeGreaterThanOrEqual(previous - 1e-12);
			previous = p;
		}
		expect(powerPointAccelDecelProgress(0, 0.4, 0.3)).toBe(0);
		expect(powerPointAccelDecelProgress(1, 0.4, 0.3)).toBeCloseTo(1, 12);
	});
});

describe('normalizeAccelDecel', () => {
	it('clamps each fraction and scales an over-full sum down to 1', () => {
		expect(normalizeAccelDecel(2, undefined)).toStrictEqual({ accel: 1, decel: 0 });
		expect(normalizeAccelDecel(0.8, 0.8)).toStrictEqual({ accel: 0.5, decel: 0.5 });
		expect(normalizeAccelDecel(0.2, 0.3)).toStrictEqual({ accel: 0.2, decel: 0.3 });
	});
});

describe('editor timing curves', () => {
	it('shows and plays an unset curve as linear (what the writer saves)', () => {
		expect(DEFAULT_ANIMATION_TIMING_CURVE).toBe('linear');
		expect(effectiveTimingCurve(undefined)).toBe('linear');
		expect(effectiveTimingCurve('ease-in')).toBe('ease-in');
		expect(cssEasingForTimingCurve(undefined)).toBe('linear');
	});

	it('keeps the explicit curves', () => {
		expect(cssEasingForTimingCurve('ease')).toBe('ease');
		expect(cssEasingForTimingCurve('ease-in')).toBe('ease-in');
		expect(cssEasingForTimingCurve('ease-out')).toBe('ease-out');
		expect(cssEasingForTimingCurve('linear')).toBe('linear');
	});
});
