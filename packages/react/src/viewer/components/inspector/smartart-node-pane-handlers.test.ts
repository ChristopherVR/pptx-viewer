import type { PptxSmartArtData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

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

function makeData(): PptxSmartArtData {
	return {
		resolvedLayoutType: 'list',
		nodes: [
			{ id: 'a', text: 'A' },
			{ id: 'b', text: 'B' },
			{ id: 'c', text: 'C' },
		],
		connections: [{ sourceId: 'a', destId: 'c', type: 'presOf' }],
	};
}

// Full coverage of this behaviour lives in
// `packages/shared/src/render/smartart-node-pane-handlers.test.ts`. This is a
// regression smoke test confirming the React binding's shim re-exports the
// shared implementation correctly.
describe('smartart-node-pane-handlers (React re-export shim)', () => {
	it('re-exports countTopLevel', () => {
		expect(countTopLevel(makeData())).toBe(3);
	});

	it('re-exports addSiblingAfter', () => {
		const result = addSiblingAfter(makeData(), 'b');
		expect(result?.data.nodes).toHaveLength(4);
	});

	it('re-exports removeEmptyNode', () => {
		const result = removeEmptyNode(makeData(), 'b');
		expect(result?.data.nodes.map((n) => n.id)).toStrictEqual(['a', 'c']);
	});

	it('re-exports demote / promote', () => {
		const demoted = demote(makeData(), 'b');
		expect(demoted?.nodes.find((n) => n.id === 'b')?.parentId).toBe('a');
		// oxlint-disable-next-line eslint/one-var -- depends on `demoted` past the assertion above; can't merge.
		const promoted = promote(demoted!, 'b');
		expect(promoted?.nodes.find((n) => n.id === 'b')?.parentId).toBeUndefined();
	});

	it('re-exports reorder', () => {
		const next = reorder(makeData(), 'a', 1);
		expect(next?.nodes.map((n) => n.id)).toStrictEqual(['b', 'a', 'c']);
	});

	it('re-exports siblingIndex / siblingCount', () => {
		expect(siblingIndex(makeData(), 'b')).toBe(1);
		expect(siblingCount(makeData(), 'b')).toBe(3);
	});

	it('re-exports classifyExtraConnections / extraConnectionCount', () => {
		expect(classifyExtraConnections(makeData())).toStrictEqual([
			{ sourceId: 'a', destId: 'c', type: 'presOf' },
		]);
		expect(extraConnectionCount(makeData())).toBe(1);
	});
});
