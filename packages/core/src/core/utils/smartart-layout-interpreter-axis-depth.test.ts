import { describe, expect, it } from 'vitest';

import type { PptxSmartArtNode } from '../types';
import { resolveAxisMaxDepth } from './smartart-layout-interpreter-axis-depth';

describe('resolveAxisMaxDepth', () => {
	it('is undecidable (undefined) with an empty anchor', () => {
		const one: PptxSmartArtNode = { id: 'one', text: 'One' };
		expect(
			resolveAxisMaxDepth([one], ['des'], undefined, undefined, undefined, []),
		).toBeUndefined();
	});

	it('is undecidable (undefined) for an axis resolveAxisNodes itself declines', () => {
		const one: PptxSmartArtNode = { id: 'one', text: 'One' };
		expect(resolveAxisMaxDepth([one], [], undefined, undefined, undefined, [one])).toBeUndefined();
	});

	/**
	 * `radial-cluster--hier5.pptx`'s own real tree (see this module's own doc
	 * comment): "Node One" -> [Two, Three, Four], Four -> [Five]. Measured
	 * against the fixture's cached drawing, `maxDepth` from Node One via
	 * `axis="des"` is 2 (Five sits two hops below Node One via Four) - the
	 * exact number the round 13 successor doc records deriving by hand.
	 */
	it('measures the deepest descendant level from the anchor (radial-cluster--hier5.pptx shape)', () => {
		const one: PptxSmartArtNode = { id: 'one', text: 'Node One' };
		const two: PptxSmartArtNode = { id: 'two', text: 'Two', parentId: 'one' };
		const three: PptxSmartArtNode = { id: 'three', text: 'Three', parentId: 'one' };
		const four: PptxSmartArtNode = { id: 'four', text: 'Four', parentId: 'one' };
		const five: PptxSmartArtNode = { id: 'five', text: 'Five', parentId: 'four' };
		const nodes = [one, two, three, four, five];
		expect(resolveAxisMaxDepth(nodes, ['des'], undefined, undefined, undefined, [one])).toBe(2);
	});

	it('is 0 (real, decidable) for a childless anchor', () => {
		const one: PptxSmartArtNode = { id: 'one', text: 'One' };
		expect(resolveAxisMaxDepth([one], ['des'], undefined, undefined, undefined, [one])).toBe(0);
	});

	it('is 1 for a flat anchor whose children have no children of their own', () => {
		const one: PptxSmartArtNode = { id: 'one', text: 'One' };
		const two: PptxSmartArtNode = { id: 'two', text: 'Two', parentId: 'one' };
		const three: PptxSmartArtNode = { id: 'three', text: 'Three', parentId: 'one' };
		const nodes = [one, two, three];
		expect(resolveAxisMaxDepth(nodes, ['des'], undefined, undefined, undefined, [one])).toBe(1);
	});

	it('takes the MAXIMUM across a multi-point anchor', () => {
		const one: PptxSmartArtNode = { id: 'one', text: 'One' };
		const two: PptxSmartArtNode = { id: 'two', text: 'Two' };
		const deep: PptxSmartArtNode = { id: 'deep', text: 'Deep', parentId: 'two' };
		const deeper: PptxSmartArtNode = { id: 'deeper', text: 'Deeper', parentId: 'deep' };
		const nodes = [one, two, deep, deeper];
		// `one` has no children of its own (depth 0); `two`'s own descendant
		// chain goes 2 levels deep. The anchor set's own maxDepth is the max
		// across every anchor point, not just the first.
		expect(resolveAxisMaxDepth(nodes, ['des'], undefined, undefined, undefined, [one, two])).toBe(
			2,
		);
	});

	it('respects ptType/st/cnt filtering on the resolved axis set', () => {
		const one: PptxSmartArtNode = { id: 'one', text: 'One' };
		const two: PptxSmartArtNode = { id: 'two', text: 'Two', parentId: 'one' };
		const trans: PptxSmartArtNode = {
			id: 'trans',
			text: '',
			parentId: 'one',
			nodeType: 'sibTrans',
		};
		const nodes = [one, two, trans];
		// `ptType="node"` excludes the sibTrans sibling, leaving only `two` -
		// same depth answer as if `trans` were never there.
		expect(resolveAxisMaxDepth(nodes, ['des'], ['node'], undefined, undefined, [one])).toBe(1);
	});
});
