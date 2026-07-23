import type { PptxSmartArtNode } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { revealedSmartArtNodeCount } from './diagram-build';

/** Flat list: 1 root, 2 children, 2 grandchildren (levels 0,1,1,2,2). */
function makeNodes(): PptxSmartArtNode[] {
	return [
		{ id: 'r', text: 'root' },
		{ id: 'a', text: 'a', parentId: 'r' },
		{ id: 'b', text: 'b', parentId: 'r' },
		{ id: 'a1', text: 'a1', parentId: 'a' },
		{ id: 'a2', text: 'a2', parentId: 'a' },
	];
}

describe('revealedSmartArtNodeCount', () => {
	it('reveals every node for asOne', () => {
		const nodes = makeNodes();
		expect(revealedSmartArtNodeCount(nodes, { mode: 'asOne', progress: 0 })).toBe(nodes.length);
	});

	it('reveals zero nodes at progress 0', () => {
		expect(revealedSmartArtNodeCount(makeNodes(), { mode: 'byOne', progress: 0 })).toBe(0);
	});

	it('byOne reveals one node at a time', () => {
		const nodes = makeNodes();
		// 5 nodes: progress 0.1 -> 1, 0.5 -> 3, 1 -> 5.
		expect(revealedSmartArtNodeCount(nodes, { mode: 'byOne', progress: 0.1 })).toBe(1);
		expect(revealedSmartArtNodeCount(nodes, { mode: 'byOne', progress: 0.5 })).toBe(3);
		expect(revealedSmartArtNodeCount(nodes, { mode: 'byOne', progress: 1 })).toBe(5);
	});

	it('byLvl matches byOne cadence', () => {
		const nodes = makeNodes();
		expect(revealedSmartArtNodeCount(nodes, { mode: 'byLvl', progress: 0.5 })).toBe(
			revealedSmartArtNodeCount(nodes, { mode: 'byOne', progress: 0.5 }),
		);
	});

	it('byLvlAtOnce reveals whole levels per stage', () => {
		const nodes = makeNodes(); // 3 levels: {r}, {a,b}, {a1,a2}
		// progress just above 0 -> level 0 only (1 node).
		expect(revealedSmartArtNodeCount(nodes, { mode: 'byLvlAtOnce', progress: 0.1 })).toBe(1);
		// ~2/3 -> levels 0 and 1 (r,a,b) = 3 nodes.
		expect(revealedSmartArtNodeCount(nodes, { mode: 'byLvlAtOnce', progress: 0.6 })).toBe(3);
		// full -> all 5 nodes.
		expect(revealedSmartArtNodeCount(nodes, { mode: 'byLvlAtOnce', progress: 1 })).toBe(5);
	});

	it('handles an empty node list', () => {
		expect(revealedSmartArtNodeCount([], { mode: 'byOne', progress: 0.5 })).toBe(0);
	});
});
