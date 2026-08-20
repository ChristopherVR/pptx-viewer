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

// Full coverage of this behaviour lives in
// `packages/shared/src/render/smartart-node-pane-handlers.test.ts`. This is a
// regression smoke test confirming the Vue binding's shim re-exports the
// shared implementation correctly (under the `*Node`-suffixed names this
// composable has always used for demote/promote/reorder).
describe('smartart-node-pane-handlers (Vue re-export shim)', () => {
	beforeEach(() => {
		resetSmartArtEditCounter();
	});

	it('re-exports countTopLevel', () => {
		expect(countTopLevel(data([node('a', 'A'), node('b', 'B', 'a'), node('c', 'C')]))).toBe(2);
	});

	it('re-exports addSiblingAfter', () => {
		const result = addSiblingAfter(data([node('a', 'A'), node('b', 'B')]), 'a');
		expect(result?.data.nodes).toHaveLength(3);
	});

	it('re-exports removeEmptyNode', () => {
		const result = removeEmptyNode(data([node('a', 'A'), node('b', ''), node('c', 'C')]), 'b');
		expect(result?.data.nodes.map((n) => n.id)).toStrictEqual(['a', 'c']);
	});

	it('re-exports demoteNode / promoteNode', () => {
		const demoted = demoteNode(data([node('a', 'A'), node('b', 'B')]), 'b');
		expect(demoted?.nodes.find((n) => n.id === 'b')?.parentId).toBe('a');
		// oxlint-disable-next-line eslint/one-var -- kept separate from `demoted` above for the demote-then-promote narrative.
		const promoted = promoteNode(data([node('a', 'A'), node('b', 'B', 'a')]), 'b');
		expect(promoted?.nodes.find((n) => n.id === 'b')?.parentId).toBeUndefined();
	});

	it('re-exports reorderNode', () => {
		const base = data([node('a', 'A'), node('b', 'B')]);
		expect(reorderNode(base, 'a', 1)?.nodes.map((n) => n.id)).toStrictEqual(['b', 'a']);
	});

	it('re-exports siblingIndex / siblingCount', () => {
		const base = data([node('a', 'A'), node('b', 'B'), node('c', 'C', 'a')]);
		expect(siblingIndex(base, 'b')).toBe(1);
		expect(siblingCount(base, 'a')).toBe(2);
	});

	it('re-exports extraConnectionCount', () => {
		const conns: PptxSmartArtConnection[] = [
			{ sourceId: 'a', destId: 'b', type: 'parOf' },
			{ sourceId: 'a', destId: 'c', type: 'sibTrans' },
		];
		expect(extraConnectionCount(data([node('a', 'A')], conns))).toBe(1);
	});
});
