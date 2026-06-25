import type { PptxSmartArtConnection, PptxSmartArtData, PptxSmartArtNode } from 'pptx-viewer-core';
import { resetSmartArtEditCounter } from 'pptx-viewer-core';
import { beforeEach, describe, expect, it } from 'vitest';

import {
	addSiblingAfter,
	countTopLevel,
	demoteNode,
	extraConnectionCount,
	promoteNode,
	removeEmptyNode,
	reorderNode,
	siblingCount,
	siblingIndex,
} from './smartart-node-pane-handlers';

function node(id: string, text: string, parentId?: string): PptxSmartArtNode {
	return { id, text, parentId };
}

function data(nodes: PptxSmartArtNode[], connections?: PptxSmartArtConnection[]): PptxSmartArtData {
	return { nodes, connections, resolvedLayoutType: 'list' } as PptxSmartArtData;
}

describe('smartart-node-pane-handlers', () => {
	beforeEach(() => {
		resetSmartArtEditCounter();
	});

	it('countTopLevel ignores child nodes', () => {
		expect(countTopLevel(data([node('a', 'A'), node('b', 'B', 'a'), node('c', 'C')]))).toBe(2);
	});

	it('addSiblingAfter inserts directly after the node and reports its id', () => {
		const result = addSiblingAfter(data([node('a', 'A'), node('b', 'B')]), 'a');
		expect(result).toBeDefined();
		const ids = result?.data.nodes.map((n) => n.id) ?? [];
		expect(ids[0]).toBe('a');
		// The focus target is the inserted node, sitting at index 1.
		expect(result?.focusNodeId).toBe(ids[1]);
		expect(ids[2]).toBe('b');
	});

	it('removeEmptyNode removes and focuses the previous node, no-op for a single node', () => {
		const result = removeEmptyNode(data([node('a', 'A'), node('b', ''), node('c', 'C')]), 'b');
		expect(result?.data.nodes.map((n) => n.id)).toStrictEqual(['a', 'c']);
		expect(result?.focusNodeId).toBe('a');
		expect(removeEmptyNode(data([node('a', '')]), 'a')).toBeUndefined();
	});

	it('demoteNode / promoteNode return undefined on a no-op and new data otherwise', () => {
		const base = data([node('a', 'A'), node('b', 'B')]);
		// First node cannot be demoted (no preceding sibling).
		expect(demoteNode(base, 'a')).toBeUndefined();
		const demoted = demoteNode(base, 'b');
		expect(demoted?.nodes.find((n) => n.id === 'b')?.parentId).toBe('a');
		const promoted = promoteNode(data([node('a', 'A'), node('b', 'B', 'a')]), 'b');
		expect(promoted?.nodes.find((n) => n.id === 'b')?.parentId).toBeUndefined();
	});

	it('reorderNode swaps siblings and is a no-op at the boundary', () => {
		const base = data([node('a', 'A'), node('b', 'B')]);
		expect(reorderNode(base, 'a', -1)).toBeUndefined();
		expect(reorderNode(base, 'a', 1)?.nodes.map((n) => n.id)).toStrictEqual(['b', 'a']);
	});

	it('siblingIndex / siblingCount account for parentId grouping', () => {
		const base = data([node('a', 'A'), node('b', 'B'), node('c', 'C', 'a')]);
		expect(siblingIndex(base, 'b')).toBe(1);
		expect(siblingCount(base, 'a')).toBe(2);
		expect(siblingCount(base, 'c')).toBe(1);
		expect(siblingIndex(base, 'missing')).toBe(-1);
	});

	it('extraConnectionCount counts only non-tree connection types', () => {
		const conns: PptxSmartArtConnection[] = [
			{ sourceId: 'a', destId: 'b', type: 'parOf' },
			{ sourceId: 'a', destId: 'c', type: 'sibTrans' },
			{ sourceId: 'a', destId: 'd' },
		];
		expect(extraConnectionCount(data([node('a', 'A')], conns))).toBe(1);
		expect(extraConnectionCount(data([node('a', 'A')]))).toBe(0);
	});
});
