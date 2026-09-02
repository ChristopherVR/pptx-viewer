import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	ABSENT_EDGE_COST,
	NAMED_EDGE_PENALTY,
	hungarianAssignment,
	mediaEdgeCost,
	minCostMediaAssignment,
} from './morph-media-assignment';
import type { MediaCandidate } from './morph-media-assignment';

function picture(id: string): PptxElement {
	return { id, type: 'image', x: 0, y: 0, width: 100, height: 100 } as PptxElement;
}

function candidate(
	to: PptxElement,
	dist: number,
	overrides: Partial<Omit<MediaCandidate, 'to' | 'dist'>> = {},
): MediaCandidate {
	return { to, named: true, dist, sizeDelta: 0, toIndex: 0, ...overrides };
}

describe('hungarianAssignment', () => {
	it('returns nothing for an empty matrix', () => {
		expect(hungarianAssignment([])).toStrictEqual([]);
	});

	it('assigns the single cell of a 1x1 matrix', () => {
		expect(hungarianAssignment([[5]])).toStrictEqual([0]);
	});

	it('finds the minimum-total assignment, not the greedy one', () => {
		// Greedy takes row 0 -> col 0 (cost 1) and is then forced to row 1 ->
		// col 1 (cost 10), total 11; the optimum crosses over for a total of 4.
		const columns = hungarianAssignment([
			[1, 2],
			[2, 10],
		]);
		expect(columns).toStrictEqual([1, 0]);
	});

	it('is a bijection on a larger matrix', () => {
		const columns = hungarianAssignment([
			[4, 1, 3, 9],
			[2, 0, 5, 8],
			[3, 2, 2, 7],
			[9, 8, 7, 1],
		]);
		expect([...columns].sort((a, b) => a - b)).toStrictEqual([0, 1, 2, 3]);
		const total = columns.reduce(
			(sum, col, row) =>
				sum +
				[
					[4, 1, 3, 9],
					[2, 0, 5, 8],
					[3, 2, 2, 7],
					[9, 8, 7, 1],
				][row][col],
			0,
		);
		expect(total).toBe(1 + 2 + 2 + 1);
	});
});

describe('mediaEdgeCost', () => {
	it('ranks a same-name edge above any unnamed one however far it travels', () => {
		const named = mediaEdgeCost(candidate(picture('a'), 5000));
		const unnamed = mediaEdgeCost(candidate(picture('b'), 1, { named: false }));
		expect(named).toBeLessThan(unnamed);
		expect(unnamed - named).toBeGreaterThan(NAMED_EDGE_PENALTY / 2);
	});

	it('adds travel and box mismatch on one px scale', () => {
		const base = mediaEdgeCost(candidate(picture('a'), 10));
		expect(mediaEdgeCost(candidate(picture('a'), 10, { sizeDelta: 7 }))).toBe(base + 7);
		expect(mediaEdgeCost(candidate(picture('a'), 17))).toBe(base + 7);
	});

	it('uses the incoming index only as a sub-px tie-break', () => {
		const first = mediaEdgeCost(candidate(picture('a'), 10, { toIndex: 0 }));
		const later = mediaEdgeCost(candidate(picture('a'), 10, { toIndex: 3 }));
		expect(later).toBeGreaterThan(first);
		expect(later - first).toBeLessThan(0.01);
	});
});

describe('minCostMediaAssignment', () => {
	it('returns an empty map when no picture has a candidate', () => {
		expect(minCostMediaAssignment(new Map()).size).toBe(0);
	});

	it('pairs a lone picture with its only counterpart', () => {
		const to = picture('to');
		const result = minCostMediaAssignment(new Map([['from', [candidate(to, 40)]]]));
		expect(result.get('from')).toBe(0);
	});

	it('picks the bijection with the least total travel under a uniform shift', () => {
		// Two copies of one photo, both shifted right by 100: nearest-first
		// would steal `to-2` for `from-1` (dist 0) and leave `from-2` a 300px
		// hop; the min-cost bijection keeps each with its own copy (100 + 100).
		const to1 = picture('to-1');
		const to2 = picture('to-2');
		const result = minCostMediaAssignment(
			new Map([
				['from-1', [candidate(to1, 100, { toIndex: 0 }), candidate(to2, 0, { toIndex: 1 })]],
				['from-2', [candidate(to1, 300, { toIndex: 0 }), candidate(to2, 100, { toIndex: 1 })]],
			]),
		);
		expect(result.get('from-1')).toBe(0);
		expect(result.get('from-2')).toBe(1);
	});

	it('returns indices into each picture’s OWN candidate list', () => {
		// from-2 lists the shared counterpart first, so its answer is 0 even
		// though that column is the second one the solver knows about.
		const to1 = picture('to-1');
		const to2 = picture('to-2');
		const result = minCostMediaAssignment(
			new Map([
				['from-1', [candidate(to1, 0, { toIndex: 0 }), candidate(to2, 500, { toIndex: 1 })]],
				['from-2', [candidate(to2, 0, { toIndex: 1 })]],
			]),
		);
		expect(result.get('from-1')).toBe(0);
		expect(result.get('from-2')).toBe(0);
	});

	it('leaves the surplus picture unmatched when there are more outgoing than incoming', () => {
		// Three outgoing copies, one incoming: the two the solver parks on
		// padding columns get no entry rather than a bogus partner.
		const to = picture('to');
		const result = minCostMediaAssignment(
			new Map([
				['near', [candidate(to, 10)]],
				['mid', [candidate(to, 50)]],
				['far', [candidate(to, 90)]],
			]),
		);
		expect(result.get('near')).toBe(0);
		expect(result.has('mid')).toBeFalsy();
		expect(result.has('far')).toBeFalsy();
	});

	it('never crosses an absent edge to spare a real one', () => {
		// from-2 can only reach to-2; from-1 reaches both but prefers to-2.
		// Taking to-2 for from-1 would push from-2 onto an absent edge (cost
		// ABSENT_EDGE_COST), so the solver routes from-1 to its second choice.
		const to1 = picture('to-1');
		const to2 = picture('to-2');
		const result = minCostMediaAssignment(
			new Map([
				['from-1', [candidate(to1, 200, { toIndex: 0 }), candidate(to2, 20, { toIndex: 1 })]],
				['from-2', [candidate(to2, 30, { toIndex: 1 })]],
			]),
		);
		expect(result.get('from-1')).toBe(0);
		expect(result.get('from-2')).toBe(0);
		expect(ABSENT_EDGE_COST).toBeGreaterThan(NAMED_EDGE_PENALTY * 100);
	});
});
