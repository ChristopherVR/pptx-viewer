import { describe, expect, it } from 'vitest';

import {
	formatMediaTime,
	mediaTimelineGeometry,
	mediaTimeFromPointer,
	mediaTrimRangeForDrag,
} from './media-trim-timeline';

describe('media trim timeline', () => {
	it('formats finite media time with tenths', () => {
		expect(formatMediaTime(65.24)).toBe('1:05.2');
		expect(formatMediaTime(59.99)).toBe('1:00.0');
		expect(formatMediaTime(Number.NaN)).toBe('0:00.0');
	});

	it('maps and clamps a pointer to clip time', () => {
		expect(mediaTimeFromPointer(150, 100, 200, 20)).toBe(5);
		expect(mediaTimeFromPointer(350, 100, 200, 20)).toBe(20);
	});

	it('builds bounded percentages for trim and playhead state', () => {
		expect(mediaTimelineGeometry(20, 5000, 15000, 25)).toStrictEqual({
			startPercent: 25,
			endPercent: 75,
			playheadPercent: 100,
		});
	});

	it('keeps a minimum gap while dragging either handle', () => {
		expect(mediaTrimRangeForDrag('start', 9, 10, 0, 5000)).toStrictEqual({
			trimStartMs: 4900,
			trimEndMs: 5000,
		});
		expect(mediaTrimRangeForDrag('end', 1, 10, 5000, 0)).toStrictEqual({
			trimStartMs: 5000,
			trimEndMs: 5100,
		});
	});
});
