import { describe, expect, it } from 'vitest';

import { parseSelection } from './prompt';

describe('parseSelection', () => {
	it('parses a single number', () => {
		expect(parseSelection('2', 5)).toStrictEqual([1]);
	});

	it('parses comma-separated numbers, deduplicated and sorted', () => {
		expect(parseSelection('3,1,3', 5)).toStrictEqual([0, 2]);
	});

	it('parses space-separated numbers', () => {
		expect(parseSelection('1 2 3', 5)).toStrictEqual([0, 1, 2]);
	});

	it('treats "all" and "a" as every option', () => {
		expect(parseSelection('all', 3)).toStrictEqual([0, 1, 2]);
		expect(parseSelection('A', 3)).toStrictEqual([0, 1, 2]);
	});

	it('returns null for an out-of-range number', () => {
		expect(parseSelection('6', 5)).toBeNull();
	});

	it('returns null for an empty or unparseable answer', () => {
		expect(parseSelection('', 5)).toBeNull();
		expect(parseSelection('nope', 5)).toBeNull();
	});
});
