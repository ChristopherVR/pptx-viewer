import { describe, expect, it } from 'vitest';

import { getPasswordStrength, validatePasswordPair } from './password-protection';

describe('password protection helpers', () => {
	it('scores password complexity on the React scale', () => {
		expect(getPasswordStrength('')).toBe(0);
		expect(getPasswordStrength('abc')).toBe(0);
		expect(getPasswordStrength('Abcd1234!xyz')).toBe(4);
	});

	it('validates required, matching, and minimum-length rules', () => {
		expect(validatePasswordPair('', '')).toBe('required');
		expect(validatePasswordPair('secret', 'different')).toBe('mismatch');
		expect(validatePasswordPair('abc', 'abc')).toBe('tooShort');
		expect(validatePasswordPair('safe', 'safe')).toBeNull();
	});
});
