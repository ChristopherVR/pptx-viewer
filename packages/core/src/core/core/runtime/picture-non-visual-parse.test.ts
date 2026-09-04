import { describe, it, expect } from 'vitest';

import { parsePreferRelativeResize } from './picture-non-visual-parse';

describe('parsePreferRelativeResize (issue G13)', () => {
	it('returns undefined when the attribute is absent (spec default is true)', () => {
		expect(parsePreferRelativeResize(undefined)).toBeUndefined();
	});

	it('returns true for an explicit "1"', () => {
		expect(parsePreferRelativeResize('1')).toBeTruthy();
	});

	it('returns true for an explicit "true"', () => {
		expect(parsePreferRelativeResize('true')).toBeTruthy();
	});

	it('returns false for "0"', () => {
		expect(parsePreferRelativeResize('0')).toBeFalsy();
	});

	it('returns false for "false"', () => {
		expect(parsePreferRelativeResize('false')).toBeFalsy();
	});

	it('is case-insensitive and trims whitespace', () => {
		expect(parsePreferRelativeResize(' FALSE ')).toBeFalsy();
		expect(parsePreferRelativeResize(' TRUE ')).toBeTruthy();
	});
});
