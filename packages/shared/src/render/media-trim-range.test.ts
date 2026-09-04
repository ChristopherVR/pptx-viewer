import { describe, expect, it } from 'vitest';

import {
	mediaTrimEndAbsoluteMs,
	mediaTrimEndMsFromAbsoluteMs,
	trimmedMediaDurationMs,
	validateMediaTrimRange,
} from './media-trim-range';

// `trimEndMs` is p14:trim/@end's distance from the clip's tail (COM-verified:
// EndPoint 29596 on a 30034ms clip is written as end="438").
describe('media trim range', () => {
	it('converts between the distance-from-tail value and an absolute end position', () => {
		expect(mediaTrimEndAbsoluteMs(30034, 438)).toBe(29596);
		expect(mediaTrimEndAbsoluteMs(10000, 0)).toBe(10000);
		expect(mediaTrimEndAbsoluteMs(0, 438)).toBe(438);
		expect(mediaTrimEndMsFromAbsoluteMs(30034, 29596)).toBe(438);
		expect(mediaTrimEndMsFromAbsoluteMs(10000, 10000)).toBe(0);
		expect(mediaTrimEndMsFromAbsoluteMs(10000, 12000)).toBe(0);
		expect(mediaTrimEndMsFromAbsoluteMs(0, 5000)).toBe(0);
	});

	it('validates a range against the tail-relative end', () => {
		expect(validateMediaTrimRange(0, 0, 10000)).toBeNull();
		expect(validateMediaTrimRange(-1, 0, 10000)).toBe('negative');
		// 3000 off the tail of a 10s clip ends at 7s: a 5s start is fine.
		expect(validateMediaTrimRange(5000, 3000, 10000)).toBeNull();
		// 6000 off the tail ends at 4s, before the 5s start.
		expect(validateMediaTrimRange(5000, 6000, 10000)).toBe('startAfterEnd');
		expect(validateMediaTrimRange(0, 20000, 10000)).toBe('beyondDuration');
		// Unknown duration: only the sign checks can run.
		expect(validateMediaTrimRange(5000, 6000, 0)).toBeNull();
	});

	it('computes the trimmed playback length', () => {
		expect(trimmedMediaDurationMs(0, 0, 60000)).toBe(60000);
		// 10s in, 20s off the tail of a 60s clip: 40s - 10s = 30s.
		expect(trimmedMediaDurationMs(10000, 20000, 60000)).toBe(30000);
		expect(trimmedMediaDurationMs(50000, 20000, 60000)).toBe(60000);
		expect(trimmedMediaDurationMs(0, 0, 0)).toBe(0);
	});
});
