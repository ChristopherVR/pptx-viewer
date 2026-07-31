import { describe, expect, it } from 'vitest';

import { clampTransitionNumber, mergeSlideTransition } from './slide-transition-edits';

describe('slide-transition-edits', () => {
	it('merges a change without dropping the authored sound or direction', () => {
		expect(
			mergeSlideTransition(
				{ type: 'push', direction: 'l', soundFileName: 'chime.wav' },
				{ durationMs: 600 },
			),
		).toStrictEqual({
			type: 'push',
			direction: 'l',
			soundFileName: 'chime.wav',
			durationMs: 600,
		});
	});

	it('defaults the required type when the slide had no transition at all', () => {
		expect(mergeSlideTransition(undefined, { durationMs: 200 })).toStrictEqual({
			type: 'none',
			durationMs: 200,
		});
	});

	it('clamps and rounds an edited numeric field', () => {
		expect(clampTransitionNumber(50000, 0, 10000)).toBe(10000);
		expect(clampTransitionNumber(-1, 1, 8)).toBe(1);
		expect(clampTransitionNumber(3.6, 1, 8)).toBe(4);
	});

	it('rejects a non-numeric field so the model is left untouched', () => {
		expect(clampTransitionNumber(Number.NaN, 0, 10000)).toBeNull();
	});
});
