import { describe, expect, it } from 'vitest';

import { extractMajor } from './semver';

describe('extractMajor', () => {
	it('reads the major from a caret range', () => {
		expect(extractMajor('^19.2.7')).toBe(19);
	});

	it('reads the major from a tilde range', () => {
		expect(extractMajor('~3.5.0')).toBe(3);
	});

	it('reads the major from a bare version', () => {
		expect(extractMajor('22.0.4')).toBe(22);
	});

	it('reads the first major out of a compound range', () => {
		expect(extractMajor('>=18.0.0 <19.0.0')).toBe(18);
	});

	it('returns null for a non-semver string', () => {
		expect(extractMajor('workspace:*')).toBeNull();
		expect(extractMajor('latest')).toBeNull();
	});
});
