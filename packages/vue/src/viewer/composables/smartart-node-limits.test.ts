import { describe, expect, it } from 'vitest';

import {
	canAddTopLevelNode,
	canRemoveTopLevelNode,
	describeSmartArtBounds,
	getSmartArtNodeBounds,
} from './smartart-node-limits';

describe('smartart-node-limits', () => {
	it('returns the default bound for an unmapped / undefined layout', () => {
		expect(getSmartArtNodeBounds(undefined)).toStrictEqual({ min: 1 });
		expect(getSmartArtNodeBounds('list')).toStrictEqual({ min: 1 });
	});

	it('returns the specific bound for a constrained layout', () => {
		expect(getSmartArtNodeBounds('matrix')).toStrictEqual({ min: 4, max: 4 });
		expect(getSmartArtNodeBounds('venn')).toStrictEqual({ min: 2, max: 3 });
		expect(getSmartArtNodeBounds('cycle')).toStrictEqual({ min: 3 });
	});

	it('canAddTopLevelNode honours the layout max', () => {
		expect(canAddTopLevelNode('matrix', 4)).toBeFalsy();
		expect(canAddTopLevelNode('matrix', 3)).toBeTruthy();
		// Unbounded layout always allows adding.
		expect(canAddTopLevelNode('list', 99)).toBeTruthy();
	});

	it('canRemoveTopLevelNode honours the layout min', () => {
		expect(canRemoveTopLevelNode('matrix', 4)).toBeFalsy();
		expect(canRemoveTopLevelNode('cycle', 3)).toBeFalsy();
		expect(canRemoveTopLevelNode('cycle', 4)).toBeTruthy();
		expect(canRemoveTopLevelNode('list', 1)).toBeFalsy();
		expect(canRemoveTopLevelNode('list', 2)).toBeTruthy();
	});

	it('describeSmartArtBounds produces a readable hint, or undefined when unbounded', () => {
		expect(describeSmartArtBounds('list')).toBeUndefined();
		expect(describeSmartArtBounds('matrix')).toBe('This layout uses exactly 4 items.');
		expect(describeSmartArtBounds('venn')).toBe('Works best with 2 to 3 items.');
		expect(describeSmartArtBounds('cycle')).toBe('Works best with at least 3 items.');
	});
});
