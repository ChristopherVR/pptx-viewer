import { describe, it, expect } from 'vitest';

import { normalizePlaceholderIndex, ORPHANED_PLACEHOLDER_INDEX } from './placeholder-index';

describe('normalizePlaceholderIndex', () => {
	it('passes ordinary indices through as canonical decimal strings', () => {
		expect(normalizePlaceholderIndex('0')).toBe('0');
		expect(normalizePlaceholderIndex('4')).toBe('4');
		expect(normalizePlaceholderIndex('14')).toBe('14');
		expect(normalizePlaceholderIndex(' 7 ')).toBe('7');
		expect(normalizePlaceholderIndex(7)).toBe('7');
	});

	it('erases the orphaned-placeholder sentinel so the lookup falls back to type', () => {
		// 4294967295 is 0xFFFFFFFF: PowerPoint's unsigned encoding of -1 for a
		// placeholder whose layout counterpart is gone. Treated as a real index
		// it matches nothing, which used to discard the whole shape.
		expect(ORPHANED_PLACEHOLDER_INDEX).toBe(4294967295);
		expect(normalizePlaceholderIndex('4294967295')).toBeUndefined();
		expect(normalizePlaceholderIndex(ORPHANED_PLACEHOLDER_INDEX)).toBeUndefined();
	});

	it('erases absent and unparseable values rather than inventing an index', () => {
		expect(normalizePlaceholderIndex(undefined)).toBeUndefined();
		expect(normalizePlaceholderIndex(null)).toBeUndefined();
		expect(normalizePlaceholderIndex('')).toBeUndefined();
		expect(normalizePlaceholderIndex('   ')).toBeUndefined();
		expect(normalizePlaceholderIndex('abc')).toBeUndefined();
		expect(normalizePlaceholderIndex('-1')).toBeUndefined();
		expect(normalizePlaceholderIndex('1.5')).toBeUndefined();
	});
});
