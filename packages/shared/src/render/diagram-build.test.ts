import type { PptxSmartArtNode } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { DiagramRevealDescriptor } from './animation-timeline-types';
import {
	applyDiagramRevealDescriptor,
	resolveRevealedSmartArtNodes,
	revealedSmartArtNodeCount,
} from './diagram-build';

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

	// G4: `dgm:presLayoutVars.animOne`/`.animLvl` disambiguate a generic
	// `byOne`/`byLvl` p:bldDgm token per the module doc comment.
	describe('animOne/animLvl presLayoutVars hint', () => {
		it('animOne=branch reveals one whole top-level branch per stage', () => {
			// Two branches under separate roots so branch grouping is observable
			// (makeNodes()'s single-root tree wouldn't distinguish this from byOne).
			const twoBranches: PptxSmartArtNode[] = [
				{ id: 'r1', text: 'r1' },
				{ id: 'r1a', text: 'r1a', parentId: 'r1' },
				{ id: 'r2', text: 'r2' },
				{ id: 'r2a', text: 'r2a', parentId: 'r2' },
			];
			expect(
				revealedSmartArtNodeCount(
					twoBranches,
					{ mode: 'byOne', progress: 0.1 },
					{ animateOne: 'branch' },
				),
			).toBe(2);
			expect(
				revealedSmartArtNodeCount(
					twoBranches,
					{ mode: 'byOne', progress: 1 },
					{ animateOne: 'branch' },
				),
			).toBe(4);
			// Sanity: without the hint, byOne reveals one node (not one branch).
			expect(revealedSmartArtNodeCount(twoBranches, { mode: 'byOne', progress: 0.1 })).toBe(1);
		});

		it('animOne=one/chOne builds the whole diagram as a single object', () => {
			const nodes = makeNodes();
			expect(
				revealedSmartArtNodeCount(nodes, { mode: 'byOne', progress: 0 }, { animateOne: 'one' }),
			).toBe(nodes.length);
			expect(
				revealedSmartArtNodeCount(nodes, { mode: 'byOne', progress: 0 }, { animateOne: 'chOne' }),
			).toBe(nodes.length);
		});

		it('animLvl=lvl reveals a whole level per stage under the generic byOne mode', () => {
			const nodes = makeNodes(); // 3 levels: {r}, {a,b}, {a1,a2}
			expect(
				revealedSmartArtNodeCount(
					nodes,
					{ mode: 'byOne', progress: 0.1 },
					{ animationLevel: 'lvl' },
				),
			).toBe(1);
			expect(
				revealedSmartArtNodeCount(
					nodes,
					{ mode: 'byOne', progress: 0.6 },
					{ animationLevel: 'lvl' },
				),
			).toBe(3);
		});

		it('an explicit lvlAtOnce token is never second-guessed by the hint', () => {
			const nodes = makeNodes();
			expect(
				revealedSmartArtNodeCount(
					nodes,
					{ mode: 'byLvlAtOnce', progress: 0.1 },
					{ animateOne: 'branch' },
				),
			).toBe(revealedSmartArtNodeCount(nodes, { mode: 'byLvlAtOnce', progress: 0.1 }));
		});
	});
});

describe('applyDiagramRevealDescriptor', () => {
	it('keeps only nodes named in the descriptor, in document order', () => {
		const nodes = makeNodes(); // r, a, b, a1, a2
		const descriptor: DiagramRevealDescriptor = { background: true, nodeIds: new Set(['a2', 'r']) };
		expect(applyDiagramRevealDescriptor(nodes, descriptor).map((n) => n.id)).toStrictEqual([
			'r',
			'a2',
		]);
	});

	it('reveals nothing when the descriptor names no nodes', () => {
		expect(
			applyDiagramRevealDescriptor(makeNodes(), { background: false, nodeIds: new Set() }),
		).toStrictEqual([]);
	});
});

describe('resolveRevealedSmartArtNodes', () => {
	it('prefers the diagramReveal descriptor over the count-based build state', () => {
		const nodes = makeNodes();
		const result = resolveRevealedSmartArtNodes(nodes, {
			build: { kind: 'diagram', mode: 'byOne', progress: 1 },
			diagramReveal: { mode: 'byOne', descriptor: { background: true, nodeIds: new Set(['b']) } },
		});
		expect(result.nodes.map((n) => n.id)).toStrictEqual(['b']);
		expect(result.shownCount).toBe(1);
	});

	it('falls back to the count-based build state when no descriptor is present', () => {
		const nodes = makeNodes();
		const result = resolveRevealedSmartArtNodes(nodes, {
			build: { kind: 'diagram', mode: 'byOne', progress: 0.5 },
		});
		expect(result.shownCount).toBe(3);
		expect(result.nodes).toStrictEqual(nodes.slice(0, 3));
	});

	it('reveals every node when neither build nor diagramReveal is present', () => {
		const nodes = makeNodes();
		const result = resolveRevealedSmartArtNodes(nodes, undefined);
		expect(result.nodes).toStrictEqual(nodes);
		expect(result.shownCount).toBe(nodes.length);
	});
});
