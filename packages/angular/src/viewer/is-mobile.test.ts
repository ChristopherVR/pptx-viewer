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
	it('returns true when width is below MOBILE_BREAKPOINT and pointer is fine', () => {
		expect(computeIsMobile(MOBILE_BREAKPOINT - 1, false)).toBeTruthy();
	});

	it('returns true exactly at zero width', () => {
		expect(computeIsMobile(0, false)).toBeTruthy();
	});

	it('returns true when pointer is coarse regardless of width', () => {
		expect(computeIsMobile(MOBILE_BREAKPOINT + 200, true)).toBeTruthy();
		expect(computeIsMobile(TABLET_BREAKPOINT + 100, true)).toBeTruthy();
	});

	it('returns false when width is at MOBILE_BREAKPOINT and pointer is fine', () => {
		expect(computeIsMobile(MOBILE_BREAKPOINT, false)).toBeFalsy();
	});

	it('returns false when width is above MOBILE_BREAKPOINT and pointer is fine', () => {
		expect(computeIsMobile(TABLET_BREAKPOINT, false)).toBeFalsy();
		expect(computeIsMobile(1920, false)).toBeFalsy();
	});

	it('returns true when both width is narrow AND pointer is coarse', () => {
		expect(computeIsMobile(320, true)).toBeTruthy();
	});
});

// ---------------------------------------------------------------------------
// computeIsTablet
// ---------------------------------------------------------------------------

describe('computeIsTablet', () => {
	it('returns true for widths in the tablet range with a fine pointer', () => {
		expect(computeIsTablet(MOBILE_BREAKPOINT, false)).toBeTruthy();
		expect(computeIsTablet(900, false)).toBeTruthy();
		expect(computeIsTablet(TABLET_BREAKPOINT - 1, false)).toBeTruthy();
	});

	it('returns false when width is below MOBILE_BREAKPOINT', () => {
		expect(computeIsTablet(MOBILE_BREAKPOINT - 1, false)).toBeFalsy();
	});

	it('returns false when width is at or above TABLET_BREAKPOINT', () => {
		expect(computeIsTablet(TABLET_BREAKPOINT, false)).toBeFalsy();
		expect(computeIsTablet(1440, false)).toBeFalsy();
	});

	it('returns false when pointer is coarse (touch devices are always mobile)', () => {
		expect(computeIsTablet(900, true)).toBeFalsy();
		expect(computeIsTablet(TABLET_BREAKPOINT - 1, true)).toBeFalsy();
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
