/**
 * Regression coverage for `buildDataModel`'s `parTrans`/`sibTrans` transition
 * points: both must carry the connection's own `label` (`DataPoint.label`,
 * populated from `PptxSmartArtConnection.label` - see
 * `PptxHandlerRuntimeSmartArtParsing.ts`'s own doc comment for why that
 * single field can hold either a `parTrans` or a `sibTrans` point's text).
 * `sibTrans` previously fell through this assignment entirely (only
 * `parTrans` set it), so a layout whose ordinal badge/connector label is
 * carried by the SIBLING transition point (real "Numbered Title List"'s
 * "1"/"2"/"3" badges, `dgm:presOf axis="self" ptType="sibTrans"`) rendered
 * blank in `engine-to-result.ts` even though the text was parsed correctly.
 */

import { describe, expect, it } from 'vitest';

import type { PptxSmartArtConnection, PptxSmartArtNode } from '../../types';
import { buildDataModel } from './data-points';

function node(id: string, text: string, parentId?: string): PptxSmartArtNode {
	return { id, text, parentId, nodeType: 'node' };
}

describe('buildDataModel transition-point labels', () => {
	it('attaches the connection label to BOTH the parTrans and sibTrans points, not just parTrans', () => {
		const nodes = [node('n1', 'Node One')];
		const connections: PptxSmartArtConnection[] = [
			{
				sourceId: '__doc__',
				destId: 'n1',
				type: 'parOf',
				parentTransitionId: 'pt1',
				siblingTransitionId: 'st1',
				label: '1',
			},
		];
		const model = buildDataModel(nodes, connections);
		const n1 = model.byId.get('n1');
		expect(n1?.parent?.children.find((c) => c.type === 'parTrans')?.label).toBe('1');
		expect(n1?.parent?.children.find((c) => c.type === 'sibTrans')?.label).toBe('1');
	});

	it('leaves both transition points unlabelled when the connection has no label', () => {
		const nodes = [node('n1', 'Node One')];
		const connections: PptxSmartArtConnection[] = [
			{
				sourceId: '__doc__',
				destId: 'n1',
				type: 'parOf',
				parentTransitionId: 'pt1',
				siblingTransitionId: 'st1',
			},
		];
		const model = buildDataModel(nodes, connections);
		const n1 = model.byId.get('n1');
		expect(n1?.parent?.children.find((c) => c.type === 'parTrans')?.label).toBeUndefined();
		expect(n1?.parent?.children.find((c) => c.type === 'sibTrans')?.label).toBeUndefined();
	});

	it('synthesises a parTrans/sibTrans pair (unlabelled) when a child has no matching connection', () => {
		const nodes = [node('n1', 'Node One')];
		const model = buildDataModel(nodes, undefined);
		const n1 = model.byId.get('n1');
		const types = n1?.parent?.children.map((c) => c.type);
		expect(types).toStrictEqual(['parTrans', 'node', 'sibTrans']);
	});
});
