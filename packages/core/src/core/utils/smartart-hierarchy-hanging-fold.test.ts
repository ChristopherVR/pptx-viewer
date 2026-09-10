import { describe, expect, it } from 'vitest';

import type { PptxSmartArtNode } from '../types';
import { buildTree } from './smartart-helpers';
import { countHangingRows } from './smartart-hierarchy-hanging-fold';

/** Root + 3 direct children, one of which has its own child (hierarchy-list--hier5.pptx's real shape). */
const TREE: PptxSmartArtNode[] = [
	{ id: 'n1', text: 'Node One' },
	{ id: 'n2', text: 'Node Two', parentId: 'n1' },
	{ id: 'n3', text: 'Node Three', parentId: 'n1' },
	{ id: 'n4', text: 'Node Four', parentId: 'n1' },
	{ id: 'n5', text: 'Node Five', parentId: 'n4' },
];

describe('countHangingRows', () => {
	it('counts every data node when nothing folds (matches placeHangingForest with foldDeeperGenerations unset)', () => {
		expect(countHangingRows(buildTree(TREE), false, false)).toBe(5);
	});

	it("drops a level>=1 node's own children when fold is set (root + 3 direct children only, matching the cached hierarchy-list--hier5.pptx count)", () => {
		expect(countHangingRows(buildTree(TREE), false, true)).toBe(4);
	});

	it('still counts every generation for a chain with no branching past level 1 (fold has nothing to drop at level 0)', () => {
		const chain: PptxSmartArtNode[] = [
			{ id: 'a', text: 'A' },
			{ id: 'b', text: 'B', parentId: 'a' },
		];
		// b is at level 1 - its own (nonexistent) children would fold, but b
		// itself still gets a row either way.
		expect(countHangingRows(buildTree(chain), false, true)).toBe(2);
	});

	it("counts assistants at every level regardless of fold (placeAssistants never recurses into an assistant's own children either way)", () => {
		const withAssistant: PptxSmartArtNode[] = [
			{ id: 'm', text: 'Manager' },
			{ id: 'c', text: 'Child', parentId: 'm' },
			{ id: 'asst', text: 'Assistant', parentId: 'c', nodeType: 'asst' },
		];
		expect(countHangingRows(buildTree(withAssistant), true, true)).toBe(3);
	});

	it('sums across a multi-root forest', () => {
		const forest: PptxSmartArtNode[] = [
			{ id: 'r1', text: 'Root 1' },
			{ id: 'r2', text: 'Root 2' },
			{ id: 'c1', text: 'Child of r1', parentId: 'r1' },
		];
		expect(countHangingRows(buildTree(forest), false, false)).toBe(3);
	});
});
