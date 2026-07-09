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

		it('does not treat a touch-capable desktop as mobile (wide viewport, touch present)', () => {
			// A touchscreen laptop / all-in-one reports touch capability but has a
			// full desktop viewport; touch presence alone must not force mobile chrome.
			expect(isMobileViewport(1280, 800, true)).toBeFalsy();
			expect(isMobileViewport(1920, 1080, true)).toBeFalsy();
			// Even a short-but-wide (>= tablet width) touch viewport stays desktop:
			// only viewports below the tablet width fall into the landscape-phone rule.
			expect(isMobileViewport(1280, 400, true)).toBeFalsy();
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
