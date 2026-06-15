// oxlint-disable react-hooks/rules-of-hooks
import { describe, expect, it, vi } from 'vitest';

import { computeElapsed, formatRehearseMs, useRehearseTimings } from './useRehearseTimings';

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

describe('formatRehearseMs', () => {
	it('formats 0 ms as 0:00', () => {
		expect(formatRehearseMs(0)).toBe('0:00');
	});

	it('does not zero-pad minutes but zero-pads seconds', () => {
		expect(formatRehearseMs(5000)).toBe('0:05');
		expect(formatRehearseMs(65000)).toBe('1:05');
		expect(formatRehearseMs(600000)).toBe('10:00');
	});

	it('clamps negative input to 0', () => {
		expect(formatRehearseMs(-500)).toBe('0:00');
	});

	it('floors sub-second values', () => {
		expect(formatRehearseMs(1999)).toBe('0:01');
	});
});

describe('computeElapsed', () => {
	it('returns 0 when not started', () => {
		expect(computeElapsed(null, 1000)).toBe(0);
	});

	it('returns now - start with no pauses', () => {
		expect(computeElapsed(1000, 4000)).toBe(3000);
	});

	it('subtracts accumulated paused time', () => {
		expect(computeElapsed(1000, 5000, 1000)).toBe(3000);
	});

	it('subtracts the open pause segment', () => {
		// started at 1000, now 5000 → 4000 raw; open pause began at 3000 → 2000 paused.
		expect(computeElapsed(1000, 5000, 0, 3000)).toBe(2000);
	});

	it('never returns negative', () => {
		expect(computeElapsed(1000, 1500, 10000)).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

describe('useRehearseTimings', () => {
	function fixedClock(value: { t: number }): () => number {
		return () => value.t;
	}

	it('starts a session and reports elapsed via the injected clock', () => {
		const clock = { t: 1000 };
		const r = useRehearseTimings({ now: fixedClock(clock) });
		r.start();
		expect(r.rehearsing.value).toBeTruthy();
		clock.t = 4000;
		expect(r.slideElapsedMs.value).toBe(3000);
		expect(r.totalElapsedMs.value).toBe(3000);
	});

	it('records per-slide time and resets the slide timer', () => {
		const clock = { t: 0 };
		const r = useRehearseTimings({ now: fixedClock(clock) });
		r.start();
		clock.t = 2000;
		r.recordCurrentSlideTime(0);
		expect(r.recordedTimings.value[0]).toBe(2000);
		// Slide timer reset to t=2000; advance to 5000 → 3000 on slide 1.
		clock.t = 5000;
		r.recordCurrentSlideTime(1);
		expect(r.recordedTimings.value[1]).toBe(3000);
		expect(r.totalRecordedMs.value).toBe(5000);
	});

	it('pauses and resumes, excluding paused time from elapsed', () => {
		const clock = { t: 0 };
		const r = useRehearseTimings({ now: fixedClock(clock) });
		r.start();
		clock.t = 2000;
		r.togglePause(); // pause at 2000
		expect(r.paused.value).toBeTruthy();
		clock.t = 5000;
		// While paused, the open pause segment (3000) is excluded.
		expect(r.slideElapsedMs.value).toBe(2000);
		r.togglePause(); // resume at 5000 → 3000 ms accumulated
		expect(r.paused.value).toBeFalsy();
		clock.t = 6000;
		// 6000 - 0 - 3000 paused = 3000.
		expect(r.slideElapsedMs.value).toBe(3000);
	});

	it('saveTimings calls onSave and ends the session', () => {
		const clock = { t: 0 };
		const onSave = vi.fn();
		const r = useRehearseTimings({ now: fixedClock(clock), onSave });
		r.start();
		clock.t = 1000;
		r.recordCurrentSlideTime(0);
		r.saveTimings();
		expect(onSave).toHaveBeenCalledWith({ 0: 1000 });
		expect(r.rehearsing.value).toBeFalsy();
	});

	it('dismissSummary discards timings and ends the session', () => {
		const clock = { t: 0 };
		const r = useRehearseTimings({ now: fixedClock(clock) });
		r.start();
		clock.t = 1000;
		r.recordCurrentSlideTime(0);
		r.dismissSummary();
		expect(r.recordedTimings.value).toStrictEqual({});
		expect(r.rehearsing.value).toBeFalsy();
	});

	it('recordCurrentSlideTime is a no-op before start', () => {
		const r = useRehearseTimings({ now: () => 0 });
		r.recordCurrentSlideTime(0);
		expect(r.recordedTimings.value).toStrictEqual({});
	});
});
