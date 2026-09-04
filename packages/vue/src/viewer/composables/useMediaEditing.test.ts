import type { MediaBookmark } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	clamp,
	formatTime,
	mmSsToMs,
	msToMmSs,
	sortBookmarks,
	trimmedDurationLabel,
	validateTrimRange,
} from './useMediaEditing';

describe('useMediaEditing helpers', () => {
	it('formats seconds as m:ss.d', () => {
		expect(formatTime(0)).toBe('0:00.0');
		expect(formatTime(65.4)).toBe('1:05.4');
		expect(formatTime(-1)).toBe('0:00.0');
	});

	it('round-trips mm:ss <-> ms', () => {
		expect(msToMmSs(65000)).toBe('01:05');
		expect(mmSsToMs('01:05')).toBe(65000);
		expect(mmSsToMs('90')).toBe(90000);
		expect(mmSsToMs('1:99')).toBeUndefined();
		expect(mmSsToMs('')).toBeUndefined();
	});

	it('clamps into range', () => {
		expect(clamp(5, 0, 10)).toBe(5);
		expect(clamp(-1, 0, 10)).toBe(0);
		expect(clamp(11, 0, 10)).toBe(10);
	});

	it('validates trim ranges', () => {
		expect(validateTrimRange(0, 0, 10000)).toBeNull();
		expect(validateTrimRange(-1, 0, 10000)).not.toBeNull();
		// trimEndMs is a distance from the tail: 3000 on a 10s clip ends at 7s,
		// which is after a 5s start (valid); 6000 ends at 4s (invalid).
		expect(validateTrimRange(5000, 3000, 10000)).toBeNull();
		expect(validateTrimRange(5000, 6000, 10000)).not.toBeNull();
		expect(validateTrimRange(0, 20000, 10000)).not.toBeNull();
	});

	it('computes trimmed-duration label', () => {
		expect(trimmedDurationLabel(0, 0, 60000)).toBe('01:00');
		// 10s in, 20s off the tail of a 60s clip: 40s - 10s = 30s.
		expect(trimmedDurationLabel(10000, 20000, 60000)).toBe('00:30');
		expect(trimmedDurationLabel(0, 0, 0)).toBe('00:00');
	});

	it('sorts bookmarks by time without mutating input', () => {
		const input: MediaBookmark[] = [
			{ id: 'b', time: 5, label: 'b' },
			{ id: 'a', time: 1, label: 'a' },
		];
		const sorted = sortBookmarks(input);
		expect(sorted.map((b) => b.id)).toStrictEqual(['a', 'b']);
		expect(input[0].id).toBe('b');
	});
});
