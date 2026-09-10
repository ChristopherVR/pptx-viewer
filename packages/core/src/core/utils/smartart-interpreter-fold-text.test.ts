import { describe, expect, it } from 'vitest';

import type { PptxSmartArtNode } from '../types';
import { collectFoldedDescendants, foldedItemText } from './smartart-interpreter-fold-text';
import { smartArtChildrenOf } from './smartart-node-tree-axis';

describe('collectFoldedDescendants', () => {
	it('collects every text-bearing, not-separately-rendered descendant, in pre-order', () => {
		const nodes: PptxSmartArtNode[] = [
			{ id: 'root', text: 'Root' },
			{ id: 'a', text: 'A', parentId: 'root' },
			{ id: 'b', text: 'B', parentId: 'a' },
		];
		const childrenOf = smartArtChildrenOf(nodes);
		expect(
			collectFoldedDescendants(nodes[0], new Set(), childrenOf).map((n) => n.id),
		).toStrictEqual(['a', 'b']);
	});

	it('stops descending into an already-rendered descendant (its own box handles its own folding)', () => {
		const nodes: PptxSmartArtNode[] = [
			{ id: 'root', text: 'Root' },
			{ id: 'a', text: 'A', parentId: 'root' },
			{ id: 'b', text: 'B', parentId: 'a' },
		];
		const childrenOf = smartArtChildrenOf(nodes);
		expect(
			collectFoldedDescendants(nodes[0], new Set(['a']), childrenOf).map((n) => n.id),
		).toStrictEqual([]);
	});

	it('drops a LEADING and TRAILING empty-text (unrendered) descendant', () => {
		const nodes: PptxSmartArtNode[] = [
			{ id: 'root', text: 'Root' },
			{ id: 'lead', text: '', parentId: 'root' },
			{ id: 'real', text: 'Real', parentId: 'root' },
			{ id: 'trail', text: '', parentId: 'root' },
		];
		const childrenOf = smartArtChildrenOf(nodes);
		expect(
			collectFoldedDescendants(nodes[0], new Set(), childrenOf).map((n) => n.id),
		).toStrictEqual(['real']);
	});

	it(
		'keeps an INTERIOR empty-text descendant as a blank-paragraph placeholder ' +
			"(unified with smartArtDescendantsWithText's own rule - see that " +
			'function for the corpus-wide "5/5 fixtures want the blank" evidence ' +
			'behind unifying the two)',
		() => {
			const nodes: PptxSmartArtNode[] = [
				{ id: 'root', text: 'Root' },
				{ id: 'child', text: 'Child', parentId: 'root' },
				{ id: 'wrapper', text: '', parentId: 'root' },
				{ id: 'grandchild', text: 'Grandchild', parentId: 'root' },
			];
			const childrenOf = smartArtChildrenOf(nodes);
			expect(
				collectFoldedDescendants(nodes[0], new Set(), childrenOf).map((n) => n.id),
			).toStrictEqual(['child', 'wrapper', 'grandchild']);
		},
	);

	it("foldedItemText: the blank descendant contributes an empty line via the '\\n' join", () => {
		const nodes: PptxSmartArtNode[] = [
			{ id: 'root', text: 'Root' },
			{ id: 'child', text: 'Child', parentId: 'root' },
			{ id: 'wrapper', text: '', parentId: 'root' },
			{ id: 'grandchild', text: 'Grandchild', parentId: 'root' },
		];
		const childrenOf = smartArtChildrenOf(nodes);
		expect(foldedItemText(nodes[0], new Set(), childrenOf)).toBe('Root\nChild\n\nGrandchild');
	});

	it('empty array when every descendant is empty-text', () => {
		const nodes: PptxSmartArtNode[] = [
			{ id: 'root', text: 'Root' },
			{ id: 'a', text: '', parentId: 'root' },
			{ id: 'b', text: '', parentId: 'root' },
		];
		const childrenOf = smartArtChildrenOf(nodes);
		expect(collectFoldedDescendants(nodes[0], new Set(), childrenOf)).toStrictEqual([]);
	});
});
