import { describe, expect, it } from 'vitest';

import {
	buildInkReplayTimeline,
	DEFAULT_STROKE_DELAY_MS,
	DEFAULT_STROKE_DURATION_MS,
	MIN_REAL_STROKE_DURATION_MS,
} from './ink-replay-timeline';

describe('buildInkReplayTimeline - fixed cascade fallback (no real timing data)', () => {
	it('returns an empty array for no strokes', () => {
		expect(buildInkReplayTimeline([])).toStrictEqual([]);
	});

	it('stages every stroke on the fixed cascade when none carry timestamps', () => {
		const steps = buildInkReplayTimeline([undefined, undefined, undefined]);
		expect(steps).toStrictEqual([
			{ strokeIndex: 0, startOffsetMs: 0, durationMs: DEFAULT_STROKE_DURATION_MS },
			{
				strokeIndex: 1,
				startOffsetMs: DEFAULT_STROKE_DURATION_MS + DEFAULT_STROKE_DELAY_MS,
				durationMs: DEFAULT_STROKE_DURATION_MS,
			},
			{
				strokeIndex: 2,
				startOffsetMs: 2 * (DEFAULT_STROKE_DURATION_MS + DEFAULT_STROKE_DELAY_MS),
				durationMs: DEFAULT_STROKE_DURATION_MS,
			},
		]);
	});

	it('honours a custom duration/delay config for the fixed cascade', () => {
		const steps = buildInkReplayTimeline([undefined, undefined], {
			strokeDurationMs: 400,
			strokeDelayMs: 100,
		});
		expect(steps).toStrictEqual([
			{ strokeIndex: 0, startOffsetMs: 0, durationMs: 400 },
			{ strokeIndex: 1, startOffsetMs: 500, durationMs: 400 },
		]);
	});

	it('falls back to the fixed cascade when even one stroke lacks a timestamp', () => {
		// No shared clock exists to place the untimed stroke on, so the whole
		// element must not collapse it to a bogus offset of 0.
		const steps = buildInkReplayTimeline([[1000, 1200], undefined, [1500, 1800]]);
		expect(steps).toStrictEqual([
			{ strokeIndex: 0, startOffsetMs: 0, durationMs: DEFAULT_STROKE_DURATION_MS },
			{
				strokeIndex: 1,
				startOffsetMs: DEFAULT_STROKE_DURATION_MS + DEFAULT_STROKE_DELAY_MS,
				durationMs: DEFAULT_STROKE_DURATION_MS,
			},
			{
				strokeIndex: 2,
				startOffsetMs: 2 * (DEFAULT_STROKE_DURATION_MS + DEFAULT_STROKE_DELAY_MS),
				durationMs: DEFAULT_STROKE_DURATION_MS,
			},
		]);
	});

	it('falls back to the fixed cascade when a stroke has an empty timestamp array', () => {
		const steps = buildInkReplayTimeline([[1000, 1200], []]);
		expect(steps[0].startOffsetMs).toBe(0);
		expect(steps[1].startOffsetMs).toBe(DEFAULT_STROKE_DURATION_MS + DEFAULT_STROKE_DELAY_MS);
	});
});

describe('buildInkReplayTimeline - real per-stroke timing', () => {
	it("derives offset and duration from each stroke's own first/last timestamp", () => {
		const steps = buildInkReplayTimeline([
			[1000, 1050, 1120], // duration 120
			[1500, 1650], // starts 500ms after the first stroke's start, duration 150
		]);
		expect(steps).toStrictEqual([
			{ strokeIndex: 0, startOffsetMs: 0, durationMs: 120 },
			{ strokeIndex: 1, startOffsetMs: 500, durationMs: 150 },
		]);
	});

	it('normalises so the earliest stroke starts at offset 0, regardless of array order', () => {
		const steps = buildInkReplayTimeline([
			[5000, 5100],
			[4000, 4200],
		]);
		expect(steps[0].startOffsetMs).toBe(1000);
		expect(steps[1].startOffsetMs).toBe(0);
	});

	it('floors a near-instantaneous real-timestamp duration to MIN_REAL_STROKE_DURATION_MS', () => {
		const steps = buildInkReplayTimeline([[1000, 1002]]);
		expect(steps[0].durationMs).toBe(MIN_REAL_STROKE_DURATION_MS);
	});

	it('does not floor a genuinely slower real-timestamp duration', () => {
		const steps = buildInkReplayTimeline([[1000, 2000]]);
		expect(steps[0].durationMs).toBe(1000);
	});

	it('ignores strokeDurationMs/strokeDelayMs config when real timing data drives every stroke', () => {
		const steps = buildInkReplayTimeline(
			[
				[1000, 1100],
				[1300, 1450],
			],
			{
				strokeDurationMs: 999,
				strokeDelayMs: 999,
			},
		);
		expect(steps).toStrictEqual([
			{ strokeIndex: 0, startOffsetMs: 0, durationMs: 100 },
			{ strokeIndex: 1, startOffsetMs: 300, durationMs: 150 },
		]);
	});

	it('handles out-of-order per-point timestamps within a stroke via min/max', () => {
		const steps = buildInkReplayTimeline([[1200, 1000, 1100]]);
		expect(steps[0].durationMs).toBe(200);
	});
});
