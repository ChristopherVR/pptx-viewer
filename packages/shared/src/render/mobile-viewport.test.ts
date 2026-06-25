import { describe, expect, it } from 'vitest';

import {
	detectOrientation,
	detectTouchDevice,
	isMobileViewport,
	isTabletViewport,
	MOBILE_BREAKPOINT,
	MOBILE_LANDSCAPE_MAX_HEIGHT,
	TABLET_BREAKPOINT,
} from './mobile-viewport';

describe('mobile-viewport', () => {
	describe('isMobileViewport', () => {
		it('treats a narrow viewport as mobile regardless of touch', () => {
			expect(isMobileViewport(MOBILE_BREAKPOINT - 1, 800, false)).toBeTruthy();
			expect(isMobileViewport(320, 640, true)).toBeTruthy();
		});

		it('treats a wide viewport as not mobile', () => {
			expect(isMobileViewport(TABLET_BREAKPOINT, 800, true)).toBeFalsy();
			expect(isMobileViewport(MOBILE_BREAKPOINT, 800, false)).toBeFalsy();
		});

		it('treats a short touch landscape phone below tablet width as mobile', () => {
			expect(isMobileViewport(900, MOBILE_LANDSCAPE_MAX_HEIGHT - 1, true)).toBeTruthy();
		});

		it('does not treat a short non-touch viewport as mobile', () => {
			expect(isMobileViewport(900, 400, false)).toBeFalsy();
		});

		it('does not treat a tall touch tablet as mobile', () => {
			expect(isMobileViewport(820, 1180, true)).toBeFalsy();
		});
	});

	describe('isTabletViewport', () => {
		it('is true in the 768..1023 band', () => {
			expect(isTabletViewport(MOBILE_BREAKPOINT)).toBeTruthy();
			expect(isTabletViewport(TABLET_BREAKPOINT - 1)).toBeTruthy();
		});

		it('is false below mobile or at/above tablet width', () => {
			expect(isTabletViewport(MOBILE_BREAKPOINT - 1)).toBeFalsy();
			expect(isTabletViewport(TABLET_BREAKPOINT)).toBeFalsy();
		});
	});

	describe('detectTouchDevice', () => {
		it('returns a boolean without throwing (no DOM in node env)', () => {
			expect(detectTouchDevice()).toBeTypeOf('boolean');
		});
	});

	describe('detectOrientation', () => {
		it('returns landscape when no window is present', () => {
			expect(detectOrientation()).toBe('landscape');
		});
	});
});
