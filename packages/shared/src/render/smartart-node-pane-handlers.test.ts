/* oxlint-disable eslint/one-var -- each `it` block below declares its own
   independent fixture locals; merging unrelated declarations across these
   test cases would hurt readability, not help it. */
import type { PptxSmartArtConnection, PptxSmartArtData, PptxSmartArtNode } from 'pptx-viewer-core';
import { resetSmartArtEditCounter } from 'pptx-viewer-core';
import { beforeEach, describe, expect, it } from 'vitest';

import {
	addSiblingAfter,
	classifyExtraConnections,
	countTopLevel,
	demote,
	extraConnectionCount,
	promote,
	removeEmptyNode,
	reorder,
	siblingCount,
	siblingIndex,
} from './smartart-node-pane-handlers';

function node(id: string, text: string, parentId?: string): PptxSmartArtNode {
	return { id, text, parentId };
}

function data(nodes: PptxSmartArtNode[], connections?: PptxSmartArtConnection[]): PptxSmartArtData {
	return { nodes, connections, resolvedLayoutType: 'list' } as PptxSmartArtData;
}

function makeData(): PptxSmartArtData {
	return {
		resolvedLayoutType: 'list',
		nodes: [
			{ id: 'a', text: 'A' },
			{ id: 'b', text: 'B' },
			{ id: 'c', text: 'C' },
		],
		connections: [
			// A non-tree connection that must survive all edits.
			{ sourceId: 'a', destId: 'c', type: 'presOf' },
		],
	};
}

describe('smartart-node-pane-handlers', () => {
	beforeEach(() => {
		resetSmartArtEditCounter();
	});

	describe('countTopLevel', () => {
		it('counts only nodes without a parent', () => {
			const d = makeData();
			d.nodes.push({ id: 'd', text: 'D', parentId: 'a' });
			expect(countTopLevel(d)).toBe(3);
		});

		it('ignores child nodes', () => {
			expect(countTopLevel(data([node('a', 'A'), node('b', 'B', 'a'), node('c', 'C')]))).toBe(2);
		});
	});

	describe('addSiblingAfter', () => {
		it('inserts a sibling immediately after the target', () => {
			const result = addSiblingAfter(makeData(), 'b');
			expect(result).toBeDefined();
			const ids = result!.data.nodes.map((n) => n.id);
			const bIdx = ids.indexOf('b');
			// The inserted node sits right after b and is reported for focus.
			expect(result!.focusNodeId).toBe(ids[bIdx + 1]);
			expect(result!.data.nodes).toHaveLength(4);
		});

		it('preserves non-tree connections', () => {
			const result = addSiblingAfter(makeData(), 'b');
			expect(result!.data.connections).toContainEqual({
				sourceId: 'a',
				destId: 'c',
				type: 'presOf',
			});
		});

		it('inserts directly after the node and reports its id', () => {
			const result = addSiblingAfter(data([node('a', 'A'), node('b', 'B')]), 'a');
			expect(result).toBeDefined();
			const ids = result?.data.nodes.map((n) => n.id) ?? [];
			expect(ids[0]).toBe('a');
			// The focus target is the inserted node, sitting at index 1.
			expect(result?.focusNodeId).toBe(ids[1]);
			expect(ids[2]).toBe('b');
		});
	});

	describe('removeEmptyNode', () => {
		it('removes the node and reports a focus target', () => {
			const result = removeEmptyNode(makeData(), 'b');
			expect(result).toBeDefined();
			expect(result!.data.nodes.map((n) => n.id)).toStrictEqual(['a', 'c']);
			expect(result!.focusNodeId).toBe('a');
		});

		it('refuses to remove the only remaining node', () => {
			const single: PptxSmartArtData = {
				resolvedLayoutType: 'list',
				nodes: [{ id: 'a', text: '' }],
			};
			expect(removeEmptyNode(single, 'a')).toBeUndefined();
		});

		it('preserves unrelated connections when removing a node', () => {
			// Remove 'b' (not part of the presOf connection); it must survive.
			const result = removeEmptyNode(makeData(), 'b');
			expect(result!.data.connections).toContainEqual({
				sourceId: 'a',
				destId: 'c',
				type: 'presOf',
			});
		});

		it('removes and focuses the previous node, no-op for a single node', () => {
			const result = removeEmptyNode(data([node('a', 'A'), node('b', ''), node('c', 'C')]), 'b');
			expect(result?.data.nodes.map((n) => n.id)).toStrictEqual(['a', 'c']);
			expect(result?.focusNodeId).toBe('a');
			expect(removeEmptyNode(data([node('a', '')]), 'a')).toBeUndefined();
		});
	});

	describe('demote / promote (connection-aware)', () => {
		it('demote re-parents under the preceding sibling and adds a parOf link', () => {
			const next = demote(makeData(), 'b');
			expect(next).toBeDefined();
			expect(next!.nodes.find((n) => n.id === 'b')?.parentId).toBe('a');
			expect(next!.connections).toContainEqual(
				expect.objectContaining({ sourceId: 'a', destId: 'b', type: 'parOf' }),
			);
			// The pre-existing presOf connection is untouched.
			expect(next!.connections).toContainEqual({ sourceId: 'a', destId: 'c', type: 'presOf' });
		});

		it('promote removes the parent link rather than bypassing rewiring', () => {
			const demoted = demote(makeData(), 'b')!;
			const promoted = promote(demoted, 'b');
			expect(promoted).toBeDefined();
			expect(promoted!.nodes.find((n) => n.id === 'b')?.parentId).toBeUndefined();
			// The parOf a->b link added by demote is gone after promote.
			const hasParOf = (promoted!.connections ?? []).some(
				(c) => c.sourceId === 'a' && c.destId === 'b' && c.type === 'parOf',
			);
			expect(hasParOf).toBeFalsy();
		});

		it('demote of the first sibling is a no-op', () => {
			expect(demote(makeData(), 'a')).toBeUndefined();
		});

		it('promote of a top-level node is a no-op', () => {
			expect(promote(makeData(), 'a')).toBeUndefined();
		});

		it('return undefined on a no-op and new data otherwise', () => {
			const base = data([node('a', 'A'), node('b', 'B')]);
			// First node cannot be demoted (no preceding sibling).
			expect(demote(base, 'a')).toBeUndefined();
			const demoted = demote(base, 'b');
			expect(demoted?.nodes.find((n) => n.id === 'b')?.parentId).toBe('a');
			const promoted = promote(data([node('a', 'A'), node('b', 'B', 'a')]), 'b');
			expect(promoted?.nodes.find((n) => n.id === 'b')?.parentId).toBeUndefined();
		});
	});

	describe('reorder', () => {
		it('moves a node down among its siblings', () => {
			const next = reorder(makeData(), 'a', 1);
			expect(next!.nodes.map((n) => n.id)).toStrictEqual(['b', 'a', 'c']);
		});

		it('moves a node up among its siblings', () => {
			const next = reorder(makeData(), 'c', -1);
			expect(next!.nodes.map((n) => n.id)).toStrictEqual(['a', 'c', 'b']);
		});

		it('is a no-op past the bounds', () => {
			expect(reorder(makeData(), 'a', -1)).toBeUndefined();
			expect(reorder(makeData(), 'c', 1)).toBeUndefined();
		});

		it('preserves connections through reordering', () => {
			const next = reorder(makeData(), 'a', 1);
			expect(next!.connections).toContainEqual({ sourceId: 'a', destId: 'c', type: 'presOf' });
		});

		it('swaps siblings and is a no-op at the boundary', () => {
			const base = data([node('a', 'A'), node('b', 'B')]);
			expect(reorder(base, 'a', -1)).toBeUndefined();
			expect(reorder(base, 'a', 1)?.nodes.map((n) => n.id)).toStrictEqual(['b', 'a']);
		});
	});

	describe('siblingIndex / siblingCount', () => {
		it('reports index and count among siblings', () => {
			const d = makeData();
			expect(siblingIndex(d, 'b')).toBe(1);
			expect(siblingCount(d, 'b')).toBe(3);
		});

		it('handles child nodes within their own group', () => {
			const d = makeData();
			d.nodes.push({ id: 'd', text: 'D', parentId: 'a' });
			d.nodes.push({ id: 'e', text: 'E', parentId: 'a' });
			expect(siblingIndex(d, 'e')).toBe(1);
			expect(siblingCount(d, 'd')).toBe(2);
		});

		it('returns -1 / 0 for unknown ids', () => {
			expect(siblingIndex(makeData(), 'zzz')).toBe(-1);
			expect(siblingCount(makeData(), 'zzz')).toBe(0);
		});

		it('accounts for parentId grouping', () => {
			const base = data([node('a', 'A'), node('b', 'B'), node('c', 'C', 'a')]);
			expect(siblingIndex(base, 'b')).toBe(1);
			expect(siblingCount(base, 'a')).toBe(2);
			expect(siblingCount(base, 'c')).toBe(1);
			expect(siblingIndex(base, 'missing')).toBe(-1);
		});
	});

	describe('classifyExtraConnections / extraConnectionCount', () => {
		it('filters to only non-tree connection types', () => {
			const conns: PptxSmartArtConnection[] = [
				{ sourceId: 'a', destId: 'b', type: 'parOf' },
				{ sourceId: 'a', destId: 'c', type: 'sibTrans' },
				{ sourceId: 'a', destId: 'd' },
			];
			expect(classifyExtraConnections(data([node('a', 'A')], conns))).toStrictEqual([
				{ sourceId: 'a', destId: 'c', type: 'sibTrans' },
			]);
			expect(extraConnectionCount(data([node('a', 'A')], conns))).toBe(1);
			expect(extraConnectionCount(data([node('a', 'A')]))).toBe(0);
		});
	});
});
