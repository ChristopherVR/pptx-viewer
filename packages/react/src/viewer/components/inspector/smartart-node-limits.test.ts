import { describe, it, expect } from 'vitest';

import {
	DEFAULT_BOUNDS,
	canAddTopLevelNode,
	canRemoveTopLevelNode,
	describeSmartArtBounds,
	getSmartArtNodeBounds,
} from './smartart-node-limits';

describe('getSmartArtNodeBounds', () => {
	it('returns specific bounds for venn', () => {
		expect(getSmartArtNodeBounds('venn')).toStrictEqual({ min: 2, max: 3 });
	});

	it('returns a fixed count for matrix', () => {
		expect(getSmartArtNodeBounds('matrix')).toStrictEqual({ min: 4, max: 4 });
	});

	it('returns min-only bounds for cycle', () => {
		expect(getSmartArtNodeBounds('cycle')).toStrictEqual({ min: 3 });
	});

	it('falls back to DEFAULT_BOUNDS for unlisted layouts', () => {
		expect(getSmartArtNodeBounds('list')).toBe(DEFAULT_BOUNDS);
		expect(getSmartArtNodeBounds('process')).toBe(DEFAULT_BOUNDS);
	});

	it('falls back to DEFAULT_BOUNDS for undefined layout', () => {
		expect(getSmartArtNodeBounds(undefined)).toBe(DEFAULT_BOUNDS);
	});
});

describe('canAddTopLevelNode', () => {
	it('blocks adding past a layout max', () => {
		expect(canAddTopLevelNode('venn', 3)).toBeFalsy();
		expect(canAddTopLevelNode('matrix', 4)).toBeFalsy();
	});

	it('allows adding below a layout max', () => {
		expect(canAddTopLevelNode('venn', 2)).toBeTruthy();
		expect(canAddTopLevelNode('matrix', 3)).toBeTruthy();
	});

	it('always allows adding to an unbounded layout', () => {
		expect(canAddTopLevelNode('list', 100)).toBeTruthy();
		expect(canAddTopLevelNode('cycle', 50)).toBeTruthy();
	});
});

describe('canRemoveTopLevelNode', () => {
	it('blocks removing below a layout min', () => {
		expect(canRemoveTopLevelNode('venn', 2)).toBeFalsy();
		expect(canRemoveTopLevelNode('matrix', 4)).toBeFalsy();
		expect(canRemoveTopLevelNode('pyramid', 2)).toBeFalsy();
	});

	it('allows removing above a layout min', () => {
		expect(canRemoveTopLevelNode('venn', 3)).toBeTruthy();
		expect(canRemoveTopLevelNode('pyramid', 3)).toBeTruthy();
	});

	it('blocks removing the last node of an unbounded layout', () => {
		expect(canRemoveTopLevelNode('list', 1)).toBeFalsy();
		expect(canRemoveTopLevelNode('list', 2)).toBeTruthy();
	});
});

describe('describeSmartArtBounds', () => {
	it('describes a fixed-count layout', () => {
		expect(describeSmartArtBounds('matrix')).toMatch(/exactly 4/u);
	});

	it('describes a ranged layout', () => {
		expect(describeSmartArtBounds('venn')).toMatch(/2 to 3/u);
	});

	it('describes a min-only layout', () => {
		expect(describeSmartArtBounds('cycle')).toMatch(/at least 3/u);
	});

	it('returns undefined for unbounded layouts', () => {
		expect(describeSmartArtBounds('list')).toBeUndefined();
		expect(describeSmartArtBounds(undefined)).toBeUndefined();
	});
});
