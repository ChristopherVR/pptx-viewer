import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode, PptxSmartArtNode } from '../types';
import { selectArrangedPoints } from './smartart-layout-interpreter-arranged-selection';

/** A raw `dgm:forEach` xml body nesting another `axis="ch"` forEach - the
 * exact "hub + satellites" shape `detectHubExpansion` recognises (see
 * `smartart-layout-interpreter-hub.test.ts`'s own `arranger` helper). */
function hubArranger(): PptxSmartArtLayoutNode {
	return {
		name: 'Name0',
		children: [
			{ name: 'centerShape', algorithm: { type: 'tx' }, shape: { presetGeometry: 'ellipse' } },
		],
		forEach: [
			{
				axis: ['ch'],
				pointTypes: ['node'],
				rawXml: {
					'@_axis': 'ch',
					'dgm:layoutNode': { '@_name': 'centerShape' },
					'dgm:forEach': { '@_axis': 'ch', '@_ptType': 'node' },
				},
			},
		],
	};
}

function hubNodes(): PptxSmartArtNode[] {
	return [
		{ id: 'hub', text: 'Center' },
		{ id: 's1', text: 'Sat 1', parentId: 'hub' },
		{ id: 's2', text: 'Sat 2', parentId: 'hub' },
	];
}

describe('selectArrangedPoints (round 42: hub detection skipped for composite plans)', () => {
	it('detects the hub pattern for a NON-composite plan (the pre-existing behaviour)', () => {
		const nodes = hubNodes();
		const selection = selectArrangedPoints(
			{ kind: 'cycle', node: hubArranger() },
			nodes,
			nodes,
			undefined,
		);
		expect(selection.hub).toBeDefined();
		expect(selection.arranged.map((n) => n.id)).toStrictEqual(['s1', 's2']);
	});

	it("does NOT run hub detection for a 'composite' plan, even with the SAME arranger shape that would otherwise match", () => {
		const nodes = hubNodes();
		const selection = selectArrangedPoints(
			{ kind: 'composite', node: hubArranger() },
			nodes,
			nodes,
			undefined,
		);
		expect(selection.hub).toBeUndefined();
		expect(selection.arranged.map((n) => n.id)).toStrictEqual(['hub']);
	});
});
