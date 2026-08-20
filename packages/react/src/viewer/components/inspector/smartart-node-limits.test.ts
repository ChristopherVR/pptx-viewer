import { describe, expect, it } from 'vitest';

import {
	canAddTopLevelNode,
	canRemoveTopLevelNode,
	describeSmartArtBounds,
	getSmartArtNodeBounds,
} from './smartart-node-limits';

// Full coverage of the bounds table lives in
// `packages/shared/src/render/smartart-node-limits.test.ts`. This is a
// regression smoke test confirming the React binding's shim re-exports the
// shared implementation correctly.
describe('smartart-node-limits (React re-export shim)', () => {
	it('re-exports the shared bounds table', () => {
		expect(getSmartArtNodeBounds('matrix')).toStrictEqual({ min: 4, max: 4 });
	});

	it('re-exports canAddTopLevelNode / canRemoveTopLevelNode', () => {
		expect(canAddTopLevelNode('venn', 3)).toBeFalsy();
		expect(canRemoveTopLevelNode('venn', 2)).toBeFalsy();
	});

	it('re-exports describeSmartArtBounds', () => {
		expect(describeSmartArtBounds('cycle')).toMatch(/at least 3/u);
	});
});
