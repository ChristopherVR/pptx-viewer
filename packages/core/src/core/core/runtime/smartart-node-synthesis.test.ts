import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../../types';
import type { PptxSmartArtConnection, PptxSmartArtNode } from '../../types/smart-art';
import { synthesizeNewSmartArtStructuralPoints } from './smartart-node-synthesis';

const DOC_ID = '{doc}';
const ROOT_PRES_ID = '{root-pres}';
const NODE_A_ID = '{node-a}';
const PRES_A_ID = '{pres-a}';
const PRES_URN = 'urn:microsoft.com/office/officeart/2005/8/layout/default';

/** A minimal but realistic existing ptLst / cxnLst: doc -> node-a, one content node. */
function existingFixture(): { pts: XmlObject[]; cxns: XmlObject[] } {
	const pts: XmlObject[] = [
		{ '@_modelId': DOC_ID, '@_type': 'doc' },
		{ '@_modelId': NODE_A_ID, 'dgm:prSet': {}, 'dgm:t': {} },
		{
			'@_modelId': ROOT_PRES_ID,
			'@_type': 'pres',
			'dgm:prSet': { '@_presAssocID': DOC_ID, '@_presName': 'diagram' },
		},
		{
			'@_modelId': PRES_A_ID,
			'@_type': 'pres',
			'dgm:prSet': {
				'@_presAssocID': NODE_A_ID,
				'@_presName': 'node',
				'@_presStyleLbl': 'node1',
				'@_presStyleIdx': '0',
				'@_presStyleCnt': '1',
			},
		},
	];
	const cxns: XmlObject[] = [
		{ '@_modelId': '{cxn-parof}', '@_srcId': DOC_ID, '@_destId': NODE_A_ID, '@_srcOrd': '0' },
		{
			'@_modelId': '{cxn-presof}',
			'@_type': 'presOf',
			'@_srcId': NODE_A_ID,
			'@_destId': PRES_A_ID,
			'@_presId': PRES_URN,
		},
		{
			'@_modelId': '{cxn-presparof}',
			'@_type': 'presParOf',
			'@_srcId': ROOT_PRES_ID,
			'@_destId': PRES_A_ID,
			'@_srcOrd': '0',
			'@_presId': PRES_URN,
		},
	];
	return { pts, cxns };
}

const existingNodes: PptxSmartArtNode[] = [{ id: NODE_A_ID, text: 'A', parentId: DOC_ID }];
const existingConnections: PptxSmartArtConnection[] = [
	{ sourceId: DOC_ID, destId: NODE_A_ID, srcOrd: 0 },
];

describe('synthesizeNewSmartArtStructuralPoints', () => {
	it('is a no-op when every node already has a content point', () => {
		const { pts, cxns } = existingFixture();
		const result = synthesizeNewSmartArtStructuralPoints(
			pts,
			cxns,
			existingNodes,
			existingConnections,
		);
		expect(result.pts).toBe(pts);
		expect(result.cxns).toBe(cxns);
		expect(result.extraConnections).toStrictEqual([]);
	});

	it('grafts a full point/connection family for a brand-new top-level node', () => {
		const { pts, cxns } = existingFixture();
		const nodes: PptxSmartArtNode[] = [
			...existingNodes,
			{ id: '{node-b}', text: 'B', parentId: DOC_ID },
		];
		const connections: PptxSmartArtConnection[] = [
			...existingConnections,
			{ sourceId: DOC_ID, destId: '{node-b}', type: 'parOf', srcOrd: 1, destOrd: 0 },
		];

		const result = synthesizeNewSmartArtStructuralPoints(pts, cxns, nodes, connections);

		// 5 new points: content + parTrans + sibTrans + pres-node + pres-sibTrans.
		expect(result.pts).toHaveLength(pts.length + 5);
		const newContentPt = result.pts.find((pt) => pt['@_modelId'] === '{node-b}');
		expect(newContentPt).toBeDefined();
		expect(newContentPt?.['@_type']).toBeUndefined();

		const newParTrans = result.pts.find((pt) => pt['@_type'] === 'parTrans');
		const newSibTrans = result.pts.find((pt) => pt['@_type'] === 'sibTrans');
		expect(newParTrans).toBeDefined();
		expect(newSibTrans).toBeDefined();

		const nodePresPoints = result.pts.filter(
			(pt) => pt['@_type'] === 'pres' && (pt['dgm:prSet'] as XmlObject)?.['@_presName'] === 'node',
		);
		expect(nodePresPoints).toHaveLength(2);
		// Every "node" pres point must agree on the total count after the graft.
		for (const pt of nodePresPoints) {
			expect((pt['dgm:prSet'] as XmlObject)['@_presStyleCnt']).toBe('2');
		}

		// 4 new connections: parOf, presOf, 2x presParOf.
		expect(result.cxns).toHaveLength(cxns.length + 4);
		const parOfCxn = result.cxns.find(
			(c) => c['@_srcId'] === DOC_ID && c['@_destId'] === '{node-b}',
		);
		expect(parOfCxn?.['@_modelId']).toBeTruthy();
		expect(parOfCxn?.['@_parTransId']).toBe(newParTrans?.['@_modelId']);
		expect(parOfCxn?.['@_sibTransId']).toBe(newSibTrans?.['@_modelId']);

		const presOfCxn = result.cxns.find(
			(c) => c['@_type'] === 'presOf' && c['@_srcId'] === '{node-b}',
		);
		expect(presOfCxn?.['@_presId']).toBe(PRES_URN);

		const presParOfCxns = result.cxns.filter(
			(c) => c['@_type'] === 'presParOf' && c['@_srcId'] === ROOT_PRES_ID,
		);
		// The original one to pres-a, plus 2 new ones (node + sibTrans pres points).
		expect(presParOfCxns).toHaveLength(3);

		// The grafted presOf / presParOf connections have no counterpart in the
		// in-memory `connections` model, so they're reported back separately.
		expect(result.extraConnections).toHaveLength(3);
		expect(
			result.extraConnections.every((c) => c.type === 'presOf' || c.type === 'presParOf'),
		).toBeTruthy();
	});

	it('skips a node whose parent has no resolvable pres point rather than grafting incompletely', () => {
		const { pts, cxns } = existingFixture();
		const nodes: PptxSmartArtNode[] = [
			...existingNodes,
			{ id: '{node-c}', text: 'C', parentId: '{unknown-parent}' },
		];
		const result = synthesizeNewSmartArtStructuralPoints(pts, cxns, nodes, existingConnections);
		expect(result.pts).toStrictEqual(pts);
		expect(result.cxns).toStrictEqual(cxns);
		expect(result.extraConnections).toStrictEqual([]);
	});

	it('skips a node with no parentId at all', () => {
		const { pts, cxns } = existingFixture();
		const nodes: PptxSmartArtNode[] = [...existingNodes, { id: '{node-d}', text: 'D' }];
		const result = synthesizeNewSmartArtStructuralPoints(pts, cxns, nodes, existingConnections);
		expect(result.pts).toStrictEqual(pts);
		expect(result.cxns).toStrictEqual(cxns);
	});
});
