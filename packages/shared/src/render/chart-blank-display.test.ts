import { describe, it, expect } from 'vitest';

import { resolveBlankDisplay, visibleRuns } from './chart-blank-display';

describe('resolveBlankDisplay', () => {
	it('preserves values and visibility when there are no blanks', () => {
		const res = resolveBlankDisplay([1, 2, 3], undefined, 'gap');
		expect(res.values).toStrictEqual([1, 2, 3]);
		expect(res.visible).toStrictEqual([true, true, true]);
	});

	it('keeps existing behaviour when the mode is unset (blanks stay visible zeros)', () => {
		const res = resolveBlankDisplay([1, 0, 3], [false, true, false], undefined);
		expect(res.values).toStrictEqual([1, 0, 3]);
		expect(res.visible).toStrictEqual([true, true, true]);
	});

	it('zero mode leaves the placeholder value in place and visible', () => {
		const res = resolveBlankDisplay([1, 0, 3], [false, true, false], 'zero');
		expect(res.values).toStrictEqual([1, 0, 3]);
		expect(res.visible).toStrictEqual([true, true, true]);
	});

	it('gap mode hides blank points', () => {
		const res = resolveBlankDisplay([1, 0, 3], [false, true, false], 'gap');
		expect(res.visible).toStrictEqual([true, false, true]);
	});

	it('span mode interpolates a blank between two real neighbours', () => {
		const res = resolveBlankDisplay([10, 0, 30], [false, true, false], 'span');
		expect(res.values).toStrictEqual([10, 20, 30]);
		expect(res.visible).toStrictEqual([true, true, true]);
	});

	it('span mode extends from the nearest neighbour at the edges', () => {
		const res = resolveBlankDisplay([0, 5, 0], [true, false, true], 'span');
		expect(res.values).toStrictEqual([5, 5, 5]);
	});
});

describe('visibleRuns', () => {
	it('splits into contiguous runs of visible indices', () => {
		expect(visibleRuns([true, true, false, true, false, false, true])).toStrictEqual([
			[0, 1],
			[3],
			[6],
		]);
	});

	it('returns a single run when everything is visible', () => {
		expect(visibleRuns([true, true, true])).toStrictEqual([[0, 1, 2]]);
	});

	it('returns no runs when everything is hidden', () => {
		expect(visibleRuns([false, false])).toStrictEqual([]);
	});
});
