import { describe, expect, it } from 'vitest';

import {
	formatMediaTime,
	mediaTimelineGeometry,
	mediaTimeFromPointer,
	mediaTrimEndMsFromSeconds,
	mediaTrimEndSeconds,
	mediaTrimRangeForDrag,
} from './media-trim-timeline';

describe('media trim timeline', () => {
	it('converts the distance-from-tail trimEndMs to an absolute end position and back', () => {
		expect(mediaTrimEndSeconds(30.034, 438)).toBeCloseTo(29.596, 6);
		expect(mediaTrimEndSeconds(20, 0)).toBe(20);
		expect(mediaTrimEndSeconds(20, 50000)).toBe(0);
		expect(mediaTrimEndMsFromSeconds(30.034, 29.596)).toBeCloseTo(438, 6);
		expect(mediaTrimEndMsFromSeconds(20, 20)).toBe(0);
		expect(mediaTrimEndMsFromSeconds(20, 25)).toBe(0);
	});

	it('formats finite media time with tenths', () => {
		expect(formatMediaTime(65.24)).toBe('1:05.2');
		expect(formatMediaTime(59.99)).toBe('1:00.0');
		expect(formatMediaTime(Number.NaN)).toBe('0:00.0');
	});

	it('maps and clamps a pointer to clip time', () => {
		expect(mediaTimeFromPointer(150, 100, 200, 20)).toBe(5);
		expect(mediaTimeFromPointer(350, 100, 200, 20)).toBe(20);
	});

	// G19: `trimEndMs` is a distance from the clip's END (COM-verified; see
	// `PptxHandlerRuntimeMediaParsingUtils.ts`), not an absolute position - a
	// 20s clip with `trimEndMs: 5000` ends at 15s (20 - 5), not at 5s.
	it('builds bounded percentages for trim and playhead state', () => {
		expect(mediaTimelineGeometry(20, 5000, 5000, 25)).toStrictEqual({
			startPercent: 25,
			endPercent: 75,
			playheadPercent: 100,
		});
	});

	it('treats a zero/absent trimEndMs as "no trim", ending at the clip duration', () => {
		expect(mediaTimelineGeometry(20, 5000, 0, 10)).toStrictEqual({
			startPercent: 25,
			endPercent: 100,
			playheadPercent: 50,
		});
	});

	it('keeps a minimum gap while dragging either handle', () => {
		// Dragging the start handle never touches trimEndMs (still ms-from-tail).
		expect(mediaTrimRangeForDrag('start', 9, 10, 0, 5000)).toStrictEqual({
			trimStartMs: 4900,
			trimEndMs: 5000,
		});
		// Dragging the end handle to an absolute pointer time of 1s is clamped
		// up to the minimum gap past trimStartMs (5s + 0.1s = 5.1s), then
		// stored as the DISTANCE from the tail: 10 - 5.1 = 4.9s = 4900ms.
		expect(mediaTrimRangeForDrag('end', 1, 10, 5000, 0)).toStrictEqual({
			trimStartMs: 5000,
			trimEndMs: 4900,
		});
		// Dragging the end handle to the very end of a 10s clip stores 0
		// (the earliestEnd floor is startSeconds + minimumGapSeconds = 5.1s,
		// well below the 10s pointer, so the drag is unclamped here).
		expect(mediaTrimRangeForDrag('end', 10, 10, 5000, 0)).toStrictEqual({
			trimStartMs: 5000,
			trimEndMs: 0,
		});
	});
});
