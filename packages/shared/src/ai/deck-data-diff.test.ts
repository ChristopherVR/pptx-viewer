import { describe, expect, it } from 'vitest';

import { deckDataFieldChanged } from './deck-data-diff';

describe('deckDataFieldChanged', () => {
	it('is false for structurally equal values', () => {
		expect(deckDataFieldChanged({ a: 1, b: [1, 2] }, { a: 1, b: [1, 2] })).toBeFalsy();
	});

	it('is false for two undefineds', () => {
		expect(deckDataFieldChanged(undefined, undefined)).toBeFalsy();
	});

	it('is true when a value changed', () => {
		expect(deckDataFieldChanged({ a: 1 }, { a: 2 })).toBeTruthy();
	});

	it('is true when one side is undefined and the other is not', () => {
		expect(deckDataFieldChanged(undefined, { a: 1 })).toBeTruthy();
		expect(deckDataFieldChanged({ a: 1 }, undefined)).toBeTruthy();
	});
});
