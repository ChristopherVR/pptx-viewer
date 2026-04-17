import { describe, it, expect, expectTypeOf } from 'vitest';

import { MIN_ZOOM, MAX_ZOOM, DEFAULT_ZOOM, ZOOM_STEP } from './types';

describe('slide-sorter constants', () => {
	it('mIN_ZOOM is a positive number', () => {
		expectTypeOf(MIN_ZOOM).toBeNumber();
		expect(MIN_ZOOM).toBeGreaterThan(0);
	});

	it('mAX_ZOOM is a positive number', () => {
		expectTypeOf(MAX_ZOOM).toBeNumber();
		expect(MAX_ZOOM).toBeGreaterThan(0);
	});

	it('mIN_ZOOM is less than MAX_ZOOM', () => {
		expect(MIN_ZOOM).toBeLessThan(MAX_ZOOM);
	});

	it('dEFAULT_ZOOM is between MIN_ZOOM and MAX_ZOOM (inclusive)', () => {
		expect(DEFAULT_ZOOM).toBeGreaterThanOrEqual(MIN_ZOOM);
		expect(DEFAULT_ZOOM).toBeLessThanOrEqual(MAX_ZOOM);
	});

	it('zOOM_STEP is a positive number', () => {
		expectTypeOf(ZOOM_STEP).toBeNumber();
		expect(ZOOM_STEP).toBeGreaterThan(0);
	});

	it('zOOM_STEP divides the range evenly (range is a multiple of step)', () => {
		const range = MAX_ZOOM - MIN_ZOOM;
		expect(range % ZOOM_STEP).toBe(0);
	});

	it('mIN_ZOOM is 50', () => {
		expect(MIN_ZOOM).toBe(50);
	});

	it('mAX_ZOOM is 200', () => {
		expect(MAX_ZOOM).toBe(200);
	});

	it('dEFAULT_ZOOM is 100', () => {
		expect(DEFAULT_ZOOM).toBe(100);
	});

	it('zOOM_STEP is 10', () => {
		expect(ZOOM_STEP).toBe(10);
	});
});
