import { describe, expect, it } from 'vitest';

import {
	canAddTopLevelNode,
	canRemoveTopLevelNode,
	describeSmartArtBounds,
	getSmartArtNodeBounds,
} from './smartart-node-limits';

// Full coverage of the bounds table lives in
// `packages/shared/src/render/smartart-node-limits.test.ts`. This is a
// regression smoke test confirming the Vue binding's shim re-exports the
// shared implementation correctly.
describe('smartart-node-limits (Vue re-export shim)', () => {
	it('re-exports the shared bounds table', () => {
		expect(getSmartArtNodeBounds(undefined)).toStrictEqual({ min: 1 });
		expect(getSmartArtNodeBounds('venn')).toStrictEqual({ min: 2, max: 3 });
	});

	it('re-exports canAddTopLevelNode / canRemoveTopLevelNode', () => {
		expect(canAddTopLevelNode('matrix', 4)).toBeFalsy();
		expect(canRemoveTopLevelNode('list', 1)).toBeFalsy();
	});

	it('re-exports describeSmartArtBounds', () => {
		expect(describeSmartArtBounds('matrix')).toBe('This layout uses exactly 4 items.');
	});
});
