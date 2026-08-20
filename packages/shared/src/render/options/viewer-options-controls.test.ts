import { describe, expect, it } from 'vitest';

import { clampOptionNumber } from './viewer-options-controls';

describe('clampOptionNumber', () => {
	it('clamps a value above the max down to the max', () => {
		expect(clampOptionNumber('999', 1, 100)).toBe(100);
	});

	it('clamps a value below the min up to the min', () => {
		expect(clampOptionNumber('-5', 1, 100)).toBe(1);
	});

	it('passes an in-range value through unchanged', () => {
		expect(clampOptionNumber('42', 1, 100)).toBe(42);
	});

	it('returns undefined for non-numeric input so the caller skips the commit', () => {
		expect(clampOptionNumber('abc', 1, 100)).toBeUndefined();
	});

	it('treats an empty string as 0, clamped into range like any other number', () => {
		// `Number('')` is `0`, not `NaN`; an emptied field clamps to `min`
		// rather than being treated as "invalid".
		expect(clampOptionNumber('', 1, 100)).toBe(1);
	});

	it('returns undefined for non-finite input (Infinity, NaN)', () => {
		expect(clampOptionNumber('Infinity', 1, 100)).toBeUndefined();
		expect(clampOptionNumber('NaN', 1, 100)).toBeUndefined();
	});
});
