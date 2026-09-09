import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode, PptxSmartArtNode } from '../types';
import { compoundChildIds } from './smartart-layout-interpreter-item-role-compound';

function childrenOf(entries: Record<string, PptxSmartArtNode[]>): Map<string, PptxSmartArtNode[]> {
	return new Map(Object.entries(entries));
}

describe('compoundChildIds', () => {
	const one: PptxSmartArtNode = { id: 'one', text: 'Node One' };
	const four: PptxSmartArtNode = { id: 'four', text: 'Node Four' };
	const five: PptxSmartArtNode = { id: 'five', text: 'Node Five' };
	const map = childrenOf({ one: [four, five], four: [five] });

	it('returns [] when the axis has no "ch" token at all (nothing to position)', () => {
		const role: PptxSmartArtLayoutNode = { presentationOf: { axis: ['des', 'self'] } };
		expect(compoundChildIds(role, one, childrenOf({ one: [four] }))).toStrictEqual([]);
	});

	it("folds a selected position's own descendants in alongside it (desOrSelf second token)", () => {
		// four's own child (five) folds into four's entry when four is the
		// selected position - table-list--hier5.pptx's pillarX pattern.
		const role: PptxSmartArtLayoutNode = {
			presentationOf: { axis: ['ch', 'desOrSelf'], start: [1, 1], count: [1, 0] },
		};
		expect(compoundChildIds(role, one, map)).toStrictEqual(['four', 'five']);
	});

	it('skips a resolved position whose own text is empty', () => {
		const blank: PptxSmartArtNode = { id: 'blank', text: '' };
		const role: PptxSmartArtLayoutNode = {
			presentationOf: { axis: ['ch', 'desOrSelf'], start: [1, 1], count: [1, 0] },
		};
		expect(compoundChildIds(role, one, childrenOf({ one: [blank] }))).toStrictEqual([]);
	});
});
