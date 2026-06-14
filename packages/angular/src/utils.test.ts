import { describe, expect, it } from 'vitest';

import { cn } from './utils';

describe('cn', () => {
	it('joins truthy class values with spaces', () => {
		expect(cn('a', 'b', 'c')).toBe('a b c');
	});

	it('skips falsy values', () => {
		expect(cn('a', false, null, undefined, '', 'b')).toBe('a b');
	});

	it('keeps numeric values', () => {
		expect(cn('a', 0, 1)).toBe('a 1');
	});

	it('returns an empty string when nothing is truthy', () => {
		expect(cn(false, null, undefined)).toBe('');
	});
});
