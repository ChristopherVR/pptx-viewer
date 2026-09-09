import { describe, expect, it } from 'vitest';

import type { PptxSmartArtNode } from '../types';
import { navigateAxisHop } from './smartart-layout-interpreter-axis-hop';

/** One + parent maps built the same way `resolveAxisNodes` builds them. */
function buildMaps(nodes: PptxSmartArtNode[]) {
	const byId = new Map(nodes.map((n) => [n.id, n] as const));
	const childrenOf = new Map<string, PptxSmartArtNode[]>();
	const parentOf = new Map<string, PptxSmartArtNode>();
	for (const node of nodes) {
		const parent = node.parentId ? byId.get(node.parentId) : undefined;
		if (parent) {
			parentOf.set(node.id, parent);
			const list = childrenOf.get(parent.id);
			if (list) {
				list.push(node);
			} else {
				childrenOf.set(parent.id, [node]);
			}
		}
	}
	const roots = nodes.filter((n) => !n.parentId || !byId.has(n.parentId));
	return { childrenOf, parentOf, roots };
}

describe('navigateAxisHop', () => {
	/**
	 * `basic-venn--hier5.pptx`'s `circ1Tx` (`presOf axis="desOrSelf"`, anchored
	 * one hop up by its own `forEachOrigin`): cached ground truth folds the
	 * anchor's OWN text together with its child's ("Node One\nNode Two has a
	 * longer label") into ONE shape - `desOrSelf` must include self AND every
	 * descendant, not descendants-only-with-a-self-fallback (an earlier,
	 * reverted reading of this axis dropped "Node One" whenever it had a
	 * child).
	 */
	it('desOrSelf on a point WITH a child is self plus that child (basic-venn: "Node One\\nNode Two")', () => {
		const one: PptxSmartArtNode = { id: 'one', text: 'Node One' };
		const two: PptxSmartArtNode = {
			id: 'two',
			text: 'Node Two has a longer label',
			parentId: 'one',
		};
		const { childrenOf, parentOf, roots } = buildMaps([one, two]);
		const result = navigateAxisHop([one], 'desOrSelf', [one, two], childrenOf, parentOf, roots);
		expect(result.map((n) => n.id)).toStrictEqual(['one', 'two']);
	});

	it('desOrSelf on a childless point degenerates to just that point (basic-venn: "Node Three")', () => {
		const three: PptxSmartArtNode = { id: 'three', text: 'Node Three' };
		const { childrenOf, parentOf, roots } = buildMaps([three]);
		const result = navigateAxisHop([three], 'desOrSelf', [three], childrenOf, parentOf, roots);
		expect(result.map((n) => n.id)).toStrictEqual(['three']);
	});

	it('desOrSelf on a point with a DEEPER descendant tree includes every level', () => {
		const a: PptxSmartArtNode = { id: 'a', text: 'A' };
		const b: PptxSmartArtNode = { id: 'b', text: 'B', parentId: 'a' };
		const c: PptxSmartArtNode = { id: 'c', text: 'C', parentId: 'b' };
		const { childrenOf, parentOf, roots } = buildMaps([a, b, c]);
		const result = navigateAxisHop([a], 'desOrSelf', [a, b, c], childrenOf, parentOf, roots);
		expect(result.map((n) => n.id)).toStrictEqual(['a', 'b', 'c']);
	});

	it('ancstOrSelf is self plus every ancestor (nearest first, self before them)', () => {
		const a: PptxSmartArtNode = { id: 'a', text: 'A' };
		const b: PptxSmartArtNode = { id: 'b', text: 'B', parentId: 'a' };
		const c: PptxSmartArtNode = { id: 'c', text: 'C', parentId: 'b' };
		const { childrenOf, parentOf, roots } = buildMaps([a, b, c]);
		const result = navigateAxisHop([c], 'ancstOrSelf', [a, b, c], childrenOf, parentOf, roots);
		expect(result.map((n) => n.id)).toStrictEqual(['c', 'b', 'a']);
	});

	it('ancstOrSelf on a point with no ancestor is just that point', () => {
		const a: PptxSmartArtNode = { id: 'a', text: 'A' };
		const { childrenOf, parentOf, roots } = buildMaps([a]);
		const result = navigateAxisHop([a], 'ancstOrSelf', [a], childrenOf, parentOf, roots);
		expect(result.map((n) => n.id)).toStrictEqual(['a']);
	});

	it('des excludes self (unlike desOrSelf)', () => {
		const one: PptxSmartArtNode = { id: 'one', text: 'One' };
		const two: PptxSmartArtNode = { id: 'two', text: 'Two', parentId: 'one' };
		const { childrenOf, parentOf, roots } = buildMaps([one, two]);
		const result = navigateAxisHop([one], 'des', [one, two], childrenOf, parentOf, roots);
		expect(result.map((n) => n.id)).toStrictEqual(['two']);
	});

	it('followSib/precedSib split siblings around the current point, in document order', () => {
		const p: PptxSmartArtNode = { id: 'p', text: 'P' };
		const a: PptxSmartArtNode = { id: 'a', text: 'A', parentId: 'p' };
		const b: PptxSmartArtNode = { id: 'b', text: 'B', parentId: 'p' };
		const c: PptxSmartArtNode = { id: 'c', text: 'C', parentId: 'p' };
		const { childrenOf, parentOf, roots } = buildMaps([p, a, b, c]);
		const nodes = [p, a, b, c];
		expect(
			navigateAxisHop([b], 'followSib', nodes, childrenOf, parentOf, roots).map((n) => n.id),
		).toStrictEqual(['c']);
		expect(
			navigateAxisHop([b], 'precedSib', nodes, childrenOf, parentOf, roots).map((n) => n.id),
		).toStrictEqual(['a']);
	});

	it('root resolves to the topmost ancestor of the current point', () => {
		const a: PptxSmartArtNode = { id: 'a', text: 'A' };
		const b: PptxSmartArtNode = { id: 'b', text: 'B', parentId: 'a' };
		const c: PptxSmartArtNode = { id: 'c', text: 'C', parentId: 'b' };
		const { childrenOf, parentOf, roots } = buildMaps([a, b, c]);
		const result = navigateAxisHop([c], 'root', [a, b, c], childrenOf, parentOf, roots);
		expect(result.map((n) => n.id)).toStrictEqual(['a']);
	});

	it('none is always empty regardless of current', () => {
		const a: PptxSmartArtNode = { id: 'a', text: 'A' };
		const { childrenOf, parentOf, roots } = buildMaps([a]);
		expect(navigateAxisHop([a], 'none', [a], childrenOf, parentOf, roots)).toStrictEqual([]);
	});
});
