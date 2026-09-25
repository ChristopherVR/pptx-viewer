import { describe, expect, it } from 'vitest';

import { behaviorClock, behaviorPhaseAt, parseTmFilter } from './animation-behavior-timing';

function progressAt(clock: ReturnType<typeof behaviorClock>, ms: number): number | undefined {
	const phase = behaviorPhaseAt(clock, ms);
	return phase.state === 'active' ? phase.progress : undefined;
}

describe('behaviorClock / behaviorPhaseAt', () => {
	it('spans the effect when the behaviour has no dur, and holds after its end', () => {
		const clock = behaviorClock({}, 800);
		expect(progressAt(clock, 400)).toBeCloseTo(0.5, 9);
		expect(progressAt(clock, 5000)).toBe(1);
	});

	it('does nothing before its start delay', () => {
		const clock = behaviorClock({ durationMs: 100, delayMs: 300 }, 1000);
		expect(behaviorPhaseAt(clock, 299).state).toBe('before');
		expect(progressAt(clock, 350)).toBeCloseTo(0.5, 9);
	});

	it('plays an autoRev behaviour forward then back over twice its dur', () => {
		const clock = behaviorClock({ durationMs: 200, autoReverse: true }, 1000);
		expect(clock.activeMs).toBe(400);
		expect(progressAt(clock, 100)).toBeCloseTo(0.5, 9);
		expect(progressAt(clock, 200)).toBeCloseTo(1, 9);
		expect(progressAt(clock, 300)).toBeCloseTo(0.5, 9);
		expect(progressAt(clock, 1000)).toBe(0);
	});

	it('inherits the effect accel/decel only when the behaviour has none', () => {
		const inherited = behaviorClock({ durationMs: 1000 }, 1000, { accel: 1 });
		expect(progressAt(inherited, 500)).toBeLessThan(0.5);
		const own = behaviorClock({ durationMs: 1000, decel: 1 }, 1000, { accel: 1 });
		expect(progressAt(own, 500)).toBeGreaterThan(0.5);
	});

	it('remaps time through tmFilter', () => {
		const clock = behaviorClock({ durationMs: 1000, tmFilter: '0,0; .5, 1; 1, 1' }, 1000);
		expect(progressAt(clock, 250)).toBeCloseTo(0.5, 9);
		expect(progressAt(clock, 750)).toBe(1);
	});
});

describe('parseTmFilter', () => {
	it('parses PowerPoint spacing and rejects junk', () => {
		expect(parseTmFilter('0, 0; 0.125,0.2665;  1,1')).toStrictEqual([
			[0, 0],
			[0.125, 0.2665],
			[1, 1],
		]);
		expect(parseTmFilter('0,0; x,1')).toBeUndefined();
		expect(parseTmFilter(undefined)).toBeUndefined();
	});
});
