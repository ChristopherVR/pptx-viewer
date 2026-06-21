import type { PptxSmartArtData } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import {
	addSiblingAfter,
	countTopLevel,
	demote,
	promote,
	removeEmptyNode,
	reorder,
	siblingCount,
	siblingIndex,
} from './smartart-node-pane-handlers';

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

describe('countTopLevel', () => {
	it('counts only nodes without a parent', () => {
		const data = makeData();
		data.nodes.push({ id: 'd', text: 'D', parentId: 'a' });
		expect(countTopLevel(data)).toBe(3);
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
});

describe('siblingIndex / siblingCount', () => {
	it('reports index and count among siblings', () => {
		const data = makeData();
		expect(siblingIndex(data, 'b')).toBe(1);
		expect(siblingCount(data, 'b')).toBe(3);
	});

	it('handles child nodes within their own group', () => {
		const data = makeData();
		data.nodes.push({ id: 'd', text: 'D', parentId: 'a' });
		data.nodes.push({ id: 'e', text: 'E', parentId: 'a' });
		expect(siblingIndex(data, 'e')).toBe(1);
		expect(siblingCount(data, 'd')).toBe(2);
	});

	it('returns -1 / 0 for unknown ids', () => {
		expect(siblingIndex(makeData(), 'zzz')).toBe(-1);
		expect(siblingCount(makeData(), 'zzz')).toBe(0);
	});
});
