/**
 * password-protection-helpers.test.ts: Unit tests for the password strength
 * scoring and submit validation split out of the password-protection dialog.
 */

import { describe, expect, it } from 'vitest';

import {
	getPasswordStrength,
	STRENGTH_COLORS,
	STRENGTH_LABELS,
	validatePassword,
} from './password-protection-helpers';

describe('getPasswordStrength', () => {
	it('scores an empty password as 0', () => {
		expect(getPasswordStrength('')).toBe(0);
	});

	it('scores a short lower-case password low', () => {
		expect(getPasswordStrength('abc')).toBe(0);
	});

	it('rewards length, mixed case, digits and symbols, capped at 4', () => {
		expect(getPasswordStrength('Abcd1234!xyz')).toBe(4);
	});

	it('has a colour and a label for every score', () => {
		for (let score = 0; score <= 4; score++) {
			expect(STRENGTH_COLORS[score]).toMatch(/^#/u);
			expect(STRENGTH_LABELS[score]).toBeTruthy();
		}
	});
});

describe('validatePassword', () => {
	it('rejects an empty password', () => {
		expect(validatePassword('', '')).toBe('Please enter a password.');
	});

	it('rejects a mismatch', () => {
		expect(validatePassword('secret', 'other')).toBe('Passwords do not match.');
	});

	it('rejects a too-short password', () => {
		expect(validatePassword('ab', 'ab')).toBe('Password must be at least 4 characters.');
	});

	it('accepts a valid matching password', () => {
		expect(validatePassword('hunter2', 'hunter2')).toBe('');
	});
});
