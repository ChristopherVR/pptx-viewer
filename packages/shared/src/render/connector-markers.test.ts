import { describe, expect, it } from 'vitest';

import { markerPath, normalizeArrow } from './connector-markers';

describe('markerPath', () => {
	it('returns a closed, solid-fill triangle path for "triangle"', () => {
		const marker = markerPath('triangle');
		expect(marker.shape).toBe('path');
		expect(marker.d).toBe('M0 0 L10 5 L0 10 Z');
		expect(marker.strokeOnly).toBeFalsy();
	});

	it('returns a distinct, stroke-only open chevron for "arrow"', () => {
		const marker = markerPath('arrow');
		expect(marker.shape).toBe('path');
		expect(marker.strokeOnly).toBeTruthy();
		// Must differ from the solid triangle path, and must not close back to
		// its start point (no trailing "Z"), which is what makes it renderable
		// as an open, unfilled chevron instead of a filled wedge.
		expect(marker.d).not.toBe(markerPath('triangle').d);
		expect(marker.d).not.toMatch(/Z$/);
	});

	it('returns a circle for "oval"', () => {
		expect(markerPath('oval').shape).toBe('circle');
	});

	it('falls back to the solid triangle path for an unknown type', () => {
		// @ts-expect-error exercising the default branch with a bogus value
		const marker = markerPath('bogus');
		expect(marker.d).toBe('M0 0 L10 5 L0 10 Z');
		expect(marker.strokeOnly).toBeFalsy();
	});

	it('scales markerWidth/markerHeight by the size tokens', () => {
		const med = markerPath('triangle', 'med', 'med');
		const lg = markerPath('triangle', 'lg', 'lg');
		const sm = markerPath('triangle', 'sm', 'sm');
		expect(lg.markerWidth).toBeGreaterThan(med.markerWidth);
		expect(sm.markerWidth).toBeLessThan(med.markerWidth);
	});
});

describe('normalizeArrow', () => {
	it('passes through a real arrow type', () => {
		expect(normalizeArrow('triangle')).toBe('triangle');
	});

	it('coerces "none" to undefined', () => {
		expect(normalizeArrow('none')).toBeUndefined();
	});

	it('coerces undefined to undefined', () => {
		expect(normalizeArrow(undefined)).toBeUndefined();
	});
});
