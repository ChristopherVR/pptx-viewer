import { describe, expect, it } from 'vitest';

import type { PptxSmartArtChoose, PptxSmartArtLayoutNode } from '../types';
import { resolveItemTxAnchor } from './smartart-layout-item-tx-anchor';

describe('resolveItemTxAnchor', () => {
	it('returns spec defaults (mid/t) for a bare `dgm:alg type="tx"` with no params - basic-process--hier5.pptx\'s real layout1.xml', () => {
		const item: PptxSmartArtLayoutNode = { algorithm: { type: 'tx' } };
		const result = resolveItemTxAnchor(item, 3, true);
		expect(result?.anchorVert).toBe('mid');
		expect(result?.anchorVertCh).toBe('t');
	});

	it("reads explicit txAnchorVert/txAnchorVertCh params when declared directly (no choose) - picture-grid--hier5.pptx's real params", () => {
		const item: PptxSmartArtLayoutNode = {
			algorithm: {
				type: 'tx',
				parameters: [
					{ type: 'stBulletLvl', value: '3' },
					{ type: 'txAnchorVert', value: 'b' },
					{ type: 'txAnchorVertCh', value: 'b' },
				],
			},
		};
		const result = resolveItemTxAnchor(item, 3, true);
		expect(result?.anchorVert).toBe('b');
		expect(result?.anchorVertCh).toBe('b');
	});

	it('resolves a choose-wrapped tx alg via the diagram\'s own data-tree fold status - vertical-process--hier5.pptx\'s real `func="maxDepth" op="gt" val="1"` override', () => {
		const choose: PptxSmartArtChoose = {
			when: [
				{
					function: 'maxDepth',
					axis: ['root', 'des'],
					pointTypes: ['all', 'node'],
					operator: 'gt',
					value: '1',
					rawXml: {
						'dgm:alg': {
							'@_type': 'tx',
							'dgm:param': [{ '@_type': 'txAnchorVertCh', '@_val': 'mid' }],
						},
					},
				},
			],
			otherwise: { rawXml: { 'dgm:alg': { '@_type': 'tx' } } },
		};
		const item: PptxSmartArtLayoutNode = { choose: [choose] };

		// Folded somewhere in the diagram: the if-branch wins, txAnchorVertCh overridden to mid.
		const folded = resolveItemTxAnchor(item, 3, true);
		expect(folded?.anchorVertCh).toBe('mid');
		expect(folded?.anchorVert).toBe('mid'); // still the spec default (unset by the if-branch)

		// No fold anywhere: the else-branch wins (bare tx alg, spec defaults).
		const unfolded = resolveItemTxAnchor(item, 3, false);
		expect(unfolded?.anchorVertCh).toBe('t');
		expect(unfolded?.anchorVert).toBe('mid');
	});

	it('is undefined for an item template with neither a direct tx algorithm nor a choose (a composite wrapper - see the module doc comment)', () => {
		const item: PptxSmartArtLayoutNode = { algorithm: { type: 'composite' } };
		expect(resolveItemTxAnchor(item, 3, true)).toBeUndefined();
	});

	it('is undefined when no item template is supplied at all', () => {
		expect(resolveItemTxAnchor(undefined, 3, true)).toBeUndefined();
	});
});
