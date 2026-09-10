import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode, PptxSmartArtNode } from '../types';
import { EMPTY_CONSTRAINT_INDEX } from './smartart-constraint-solver';
import { resolveHierarchyItemFontSizePx } from './smartart-layout-interpreter-hierarchy-fontfit';

const nodes: PptxSmartArtNode[] = [
	{ id: 'm', text: 'Manager' },
	{ id: 'c1', text: 'Child One', parentId: 'm' },
];

const algorithmNode: PptxSmartArtLayoutNode = {
	name: 'diagram',
	algorithm: { type: 'hierChild' },
	children: [{ name: 'node', presentationOf: { axis: ['self'] } }],
};

describe('resolveHierarchyItemFontSizePx', () => {
	it('returns undefined with no algorithmNode (a plan this interpreter cannot resolve constraints against)', () => {
		expect(
			resolveHierarchyItemFontSizePx(nodes, undefined, EMPTY_CONSTRAINT_INDEX, 100, 50, undefined),
		).toBeUndefined();
	});

	it('returns undefined when there is no text-bearing node at all', () => {
		expect(
			resolveHierarchyItemFontSizePx([], algorithmNode, EMPTY_CONSTRAINT_INDEX, 100, 50, undefined),
		).toBeUndefined();
	});

	it('resolves a real, generously-sized font (well above the old 9pt DEFAULT_CEILING_PX floor) when an algorithmNode IS given', () => {
		const size = resolveHierarchyItemFontSizePx(
			nodes,
			algorithmNode,
			EMPTY_CONSTRAINT_INDEX,
			100,
			50,
			undefined,
		);
		expect(size).toBeGreaterThan(12);
	});
});
