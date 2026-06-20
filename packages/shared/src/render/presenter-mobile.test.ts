import { describe, expect, it } from 'vitest';

import {
	formatMobileElapsed,
	isFirstSlide,
	isLastSlide,
	MOBILE_NEXT_THUMB_WIDTH,
	mobileElapsedSince,
	mobileNextThumbSize,
	mobileSlideCounter,
} from './presenter-mobile';

describe('mobileNextThumbSize', () => {
	it('scales a 16:9 canvas down to the target width preserving aspect', () => {
		const box = mobileNextThumbSize(1280, 720);
		expect(box.width).toBe(MOBILE_NEXT_THUMB_WIDTH);
		expect(box.scale).toBeCloseTo(MOBILE_NEXT_THUMB_WIDTH / 1280);
		expect(box.height).toBeCloseTo(720 * (MOBILE_NEXT_THUMB_WIDTH / 1280));
	});

	it('honours a custom target width', () => {
		const box = mobileNextThumbSize(1000, 500, 200);
		expect(box.width).toBe(200);
		expect(box.height).toBeCloseTo(100);
		expect(box.scale).toBeCloseTo(0.2);
	});

	it('falls back to a square box of the target width for a zero canvas', () => {
		const box = mobileNextThumbSize(0, 0);
		expect(box.width).toBe(MOBILE_NEXT_THUMB_WIDTH);
		expect(box.height).toBe(MOBILE_NEXT_THUMB_WIDTH);
		expect(box.scale).toBe(1);
	});

	it('falls back for a negative height', () => {
		const box = mobileNextThumbSize(1280, -1);
		expect(box.scale).toBe(1);
	});
});

describe('mobileSlideCounter', () => {
	it('renders a one-based "current / total" label', () => {
		expect(mobileSlideCounter(0, 12)).toBe('1 / 12');
		expect(mobileSlideCounter(11, 12)).toBe('12 / 12');
	});

	it('renders "0 / 0" for an empty deck', () => {
		expect(mobileSlideCounter(0, 0)).toBe('0 / 0');
		expect(mobileSlideCounter(0, -1)).toBe('0 / 0');
	});
});

describe('isFirstSlide / isLastSlide', () => {
	it('detects the first slide (and negative indices)', () => {
		expect(isFirstSlide(0)).toBeTruthy();
		expect(isFirstSlide(-1)).toBeTruthy();
		expect(isFirstSlide(1)).toBeFalsy();
	});

	it('detects the last slide (and out-of-range indices)', () => {
		expect(isLastSlide(11, 12)).toBeTruthy();
		expect(isLastSlide(12, 12)).toBeTruthy();
		expect(isLastSlide(5, 12)).toBeFalsy();
	});
});

describe('mobileElapsedSince', () => {
	it('returns 0 when no start time is set', () => {
		expect(mobileElapsedSince(null, 1000)).toBe(0);
	});

	it('returns 0 before the clock advances past the start', () => {
		expect(mobileElapsedSince(2000, 1000)).toBe(0);
	});

	it('returns the positive delta once running', () => {
		expect(mobileElapsedSince(1000, 4000)).toBe(3000);
	});
});

describe('formatMobileElapsed', () => {
	it('formats sub-hour durations as MM:SS', () => {
		expect(formatMobileElapsed(0)).toBe('00:00');
		expect(formatMobileElapsed(65 * 1000)).toBe('01:05');
		expect(formatMobileElapsed(59 * 60 * 1000 + 59 * 1000)).toBe('59:59');
	});

	it('formats hour-plus durations as HH:MM:SS', () => {
		expect(formatMobileElapsed(60 * 60 * 1000)).toBe('01:00:00');
		expect(formatMobileElapsed(3 * 60 * 60 * 1000 + 25 * 60 * 1000 + 9 * 1000)).toBe('03:25:09');
	});

	it('treats negative input as zero', () => {
		expect(formatMobileElapsed(-5000)).toBe('00:00');
	});
});
