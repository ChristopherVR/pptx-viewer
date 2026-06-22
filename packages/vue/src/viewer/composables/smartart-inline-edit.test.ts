import type { PptxSmartArtNode } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	inlineEditorRect,
	nodeIdsInRenderOrder,
	textNodeIdsInRenderOrder,
	useSmartArtInlineEditState,
} from './smartart-inline-edit';

function node(id: string, text: string, children?: PptxSmartArtNode[]): PptxSmartArtNode {
	return { id, text, children };
}

describe('nodeIdsInRenderOrder', () => {
	it('flattens the node tree depth-first (parent before children)', () => {
		const roots = [
			node('1', 'Root', [node('2', 'Child A'), node('3', 'Child B')]),
			node('4', 'Sibling'),
		];
		expect(nodeIdsInRenderOrder(roots)).toStrictEqual(['1', '2', '3', '4']);
	});

	it('returns an empty list for no nodes', () => {
		expect(nodeIdsInRenderOrder([])).toStrictEqual([]);
	});
});

describe('textNodeIdsInRenderOrder', () => {
	it('keeps only nodes that carry text, in render order', () => {
		const roots = [node('1', 'Has text'), node('2', ''), node('3', 'Also text')];
		expect(textNodeIdsInRenderOrder(roots)).toStrictEqual(['1', '3']);
	});
});

describe('inlineEditorRect', () => {
	it('projects a node rect into container-relative pixels', () => {
		const rect = inlineEditorRect(
			{ left: 130, top: 220, width: 80, height: 40 },
			{ left: 100, top: 200, width: 400, height: 300 },
		);
		expect(rect).toStrictEqual({ left: 30, top: 20, width: 80, height: 40 });
	});
});

describe('useSmartArtInlineEditState', () => {
	it('begins and cancels an edit, tracking the draft + rect', () => {
		const s = useSmartArtInlineEditState();
		expect(s.isEditing.value).toBeFalsy();

		s.begin('n1', 'Hello', { left: 1, top: 2, width: 3, height: 4 });
		expect(s.isEditing.value).toBeTruthy();
		expect(s.editingNodeId.value).toBe('n1');
		expect(s.draft.value).toBe('Hello');
		expect(s.rect.value).toStrictEqual({ left: 1, top: 2, width: 3, height: 4 });

		s.cancel();
		expect(s.isEditing.value).toBeFalsy();
		expect(s.editingNodeId.value).toBeNull();
		expect(s.draft.value).toBe('');
		expect(s.rect.value).toBeNull();
	});
});
