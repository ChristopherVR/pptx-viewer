import { describe, expect, it } from 'vitest';

import { positionRange } from './smartart-layout-interpreter-axis-range';

describe('positionRange', () => {
	it('resolves a single position (start=1, count=1)', () => {
		expect(positionRange(1, 1, 1, 5)).toStrictEqual([1]);
	});

	it('resolves every remaining position when count is undefined (Tab List Child: start=2, unbounded)', () => {
		expect(positionRange(2, undefined, 1, 5)).toStrictEqual([2, 3, 4, 5]);
	});

	it('resolves every remaining position when count is 0 (DiagramML unbounded default)', () => {
		expect(positionRange(2, 0, 1, 3)).toStrictEqual([2, 3]);
	});

	it('returns empty when start is past the end of the list', () => {
		expect(positionRange(5, undefined, 1, 3)).toStrictEqual([]);
	});

	it('honours a step greater than 1', () => {
		expect(positionRange(1, undefined, 2, 6)).toStrictEqual([1, 3, 5]);
	});

	it('treats a non-positive step as 1', () => {
		expect(positionRange(1, 2, 0, 5)).toStrictEqual([1, 2]);
	});
});
