import { describe, expect, it } from 'vitest';

import {
	clampSlideIndex,
	fitScale,
	resolveNavigationKey,
	ZOOM_MAX_PERCENT,
	ZOOM_MIN_PERCENT,
	zoomInPercent,
	zoomOutPercent,
} from './navigation';

describe('clampSlideIndex', () => {
	it('clamps into range', () => {
		expect(clampSlideIndex(-3, 5)).toBe(0);
		expect(clampSlideIndex(2, 5)).toBe(2);
		expect(clampSlideIndex(99, 5)).toBe(4);
	});

	it('returns 0 for empty decks and truncates fractions', () => {
		expect(clampSlideIndex(3, 0)).toBe(0);
		expect(clampSlideIndex(2.9, 5)).toBe(2);
	});
});

describe('resolveNavigationKey', () => {
	it('maps forward keys', () => {
		for (const key of ['ArrowRight', 'ArrowDown', 'PageDown', ' ']) {
			expect(resolveNavigationKey(key)).toBe('next');
		}
	});

	it('maps backward keys', () => {
		for (const key of ['ArrowLeft', 'ArrowUp', 'PageUp']) {
			expect(resolveNavigationKey(key)).toBe('prev');
		}
	});

	it('maps Home/End and ignores others', () => {
		expect(resolveNavigationKey('Home')).toBe('first');
		expect(resolveNavigationKey('End')).toBe('last');
		expect(resolveNavigationKey('a')).toBeUndefined();
		expect(resolveNavigationKey('Escape')).toBeUndefined();
	});
});

describe('zoom steps', () => {
	it('steps up and down multiplicatively with clamping', () => {
		expect(zoomInPercent(100)).toBe(125);
		expect(zoomOutPercent(125)).toBe(100);
		expect(zoomInPercent(ZOOM_MAX_PERCENT)).toBe(ZOOM_MAX_PERCENT);
		expect(zoomOutPercent(ZOOM_MIN_PERCENT)).toBe(ZOOM_MIN_PERCENT);
	});
});

describe('fitScale', () => {
	it('fits the canvas inside the viewport with padding', () => {
		// 1280x720 canvas into a 1328x768 viewport with 24px padding -> exact fit.
		expect(fitScale(1328, 768, 1280, 720)).toBe(1);
		expect(fitScale(688, 768, 1280, 720)).toBeCloseTo(0.5);
	});

	it('falls back to 1 while unmeasured', () => {
		expect(fitScale(0, 0, 1280, 720)).toBe(1);
	});
});
