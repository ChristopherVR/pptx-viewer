import { describe, expect, it } from 'vitest';

import { cycleSelectableElement } from './selection-cycle';

describe('cycleSelectableElement', () => {
	it('returns null when the slide has no elements', () => {
		expect(cycleSelectableElement([], null, 'next')).toBeNull();
		expect(cycleSelectableElement([], 'a', 'prev')).toBeNull();
	});

	it('selects the first element with nothing selected and direction next', () => {
		expect(cycleSelectableElement(['a', 'b', 'c'], null, 'next')).toBe('a');
	});

	it('selects the last element with nothing selected and direction prev', () => {
		expect(cycleSelectableElement(['a', 'b', 'c'], null, 'prev')).toBe('c');
	});

	it('advances to the next element in order', () => {
		expect(cycleSelectableElement(['a', 'b', 'c'], 'a', 'next')).toBe('b');
		expect(cycleSelectableElement(['a', 'b', 'c'], 'b', 'next')).toBe('c');
	});

	it('wraps from the last element back to the first', () => {
		expect(cycleSelectableElement(['a', 'b', 'c'], 'c', 'next')).toBe('a');
	});

	it('moves to the previous element in order', () => {
		expect(cycleSelectableElement(['a', 'b', 'c'], 'c', 'prev')).toBe('b');
		expect(cycleSelectableElement(['a', 'b', 'c'], 'b', 'prev')).toBe('a');
	});

	it('wraps from the first element back to the last', () => {
		expect(cycleSelectableElement(['a', 'b', 'c'], 'a', 'prev')).toBe('c');
	});

	it('restarts the cycle when the current id is no longer in the list', () => {
		expect(cycleSelectableElement(['a', 'b', 'c'], 'deleted', 'next')).toBe('a');
		expect(cycleSelectableElement(['a', 'b', 'c'], 'deleted', 'prev')).toBe('c');
	});

	it('cycles a single-element slide back to itself', () => {
		expect(cycleSelectableElement(['a'], 'a', 'next')).toBe('a');
		expect(cycleSelectableElement(['a'], 'a', 'prev')).toBe('a');
	});
});
