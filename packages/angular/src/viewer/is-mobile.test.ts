/**
 * is-mobile.test.ts — Unit tests for the pure helpers in is-mobile.ts.
 *
 * Tests are Vitest-only (no Angular TestBed) because `computeIsMobile` and
 * `computeIsTablet` are pure functions with no DOM or DI dependencies.
 *
 * Source: packages/angular/src/viewer/is-mobile.ts
 */

import { describe, expect, it } from 'vitest';

import {
	computeIsMobile,
	computeIsTablet,
	MOBILE_BREAKPOINT,
	TABLET_BREAKPOINT,
} from './is-mobile';

// ---------------------------------------------------------------------------
// computeIsMobile
// ---------------------------------------------------------------------------

describe('computeIsMobile', () => {
	// A "tall" height keeps a touch device out of the landscape-phone rule.
	const TALL = 1000;

	it('returns true when width is below MOBILE_BREAKPOINT (fine pointer)', () => {
		expect(computeIsMobile(MOBILE_BREAKPOINT - 1, TALL, false)).toBeTruthy();
	});

	it('returns true exactly at zero width', () => {
		expect(computeIsMobile(0, TALL, false)).toBeTruthy();
	});

	it('returns false for a tall touch tablet (820×1180)', () => {
		expect(computeIsMobile(820, 1180, true)).toBeFalsy();
	});

	it('returns true for a short touch landscape phone (915×412)', () => {
		expect(computeIsMobile(915, 412, true)).toBeTruthy();
	});

	it('returns false for a wide touch tablet at/above TABLET_BREAKPOINT', () => {
		// Short, but width >= tablet breakpoint → desktop chrome.
		expect(computeIsMobile(TABLET_BREAKPOINT, 412, true)).toBeFalsy();
	});

	it('returns false when width is at MOBILE_BREAKPOINT and pointer is fine', () => {
		expect(computeIsMobile(MOBILE_BREAKPOINT, TALL, false)).toBeFalsy();
	});

	it('returns false when width is above MOBILE_BREAKPOINT and pointer is fine', () => {
		expect(computeIsMobile(TABLET_BREAKPOINT, TALL, false)).toBeFalsy();
		expect(computeIsMobile(1920, TALL, false)).toBeFalsy();
	});

	it('returns true when width is narrow regardless of touch/height', () => {
		expect(computeIsMobile(320, 412, true)).toBeTruthy();
	});
});

// ---------------------------------------------------------------------------
// computeIsTablet
// ---------------------------------------------------------------------------

describe('computeIsTablet', () => {
	const TALL = 1000;

	it('returns true for widths in the tablet range with a fine pointer', () => {
		expect(computeIsTablet(MOBILE_BREAKPOINT, TALL, false)).toBeTruthy();
		expect(computeIsTablet(900, TALL, false)).toBeTruthy();
		expect(computeIsTablet(TABLET_BREAKPOINT - 1, TALL, false)).toBeTruthy();
	});

	it('returns true for a tall touch tablet (desktop chrome)', () => {
		expect(computeIsTablet(820, 1180, true)).toBeTruthy();
	});

	it('returns false when width is below MOBILE_BREAKPOINT', () => {
		expect(computeIsTablet(MOBILE_BREAKPOINT - 1, TALL, false)).toBeFalsy();
	});

	it('returns false when width is at or above TABLET_BREAKPOINT', () => {
		expect(computeIsTablet(TABLET_BREAKPOINT, TALL, false)).toBeFalsy();
		expect(computeIsTablet(1440, TALL, false)).toBeFalsy();
	});

	it('returns false for a short touch landscape phone (it is mobile)', () => {
		expect(computeIsTablet(915, 412, true)).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// MOBILE_BREAKPOINT / TABLET_BREAKPOINT sanity
// ---------------------------------------------------------------------------

describe('breakpoint constants', () => {
	it('mobile breakpoint is less than tablet breakpoint', () => {
		expect(MOBILE_BREAKPOINT).toBeLessThan(TABLET_BREAKPOINT);
	});

	it('mobile breakpoint is 768', () => {
		expect(MOBILE_BREAKPOINT).toBe(768);
	});

	it('tablet breakpoint is 1024', () => {
		expect(TABLET_BREAKPOINT).toBe(1024);
	});
});
