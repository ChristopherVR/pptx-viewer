import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode } from '../types';
import { resolveSibTransBulgeRatio } from './smartart-layout-interpreter-cycle-sibtrans';

/** A `dgm:layoutNode` whose own `dgm:alg type="conn"` declares the given params directly (not choose-wrapped - matches how `sibTrans` is parsed in every real fixture checked). */
function connNode(name: string, params: Record<string, string>): PptxSmartArtLayoutNode {
	return {
		name,
		algorithm: {
			type: 'conn',
			parameters: Object.entries(params).map(([type, value]) => ({ type, value })),
		},
	};
}

describe('resolveSibTransBulgeRatio', () => {
	it('is undefined when the composite declares no connector children at all (basic-radial--hier5.pptx own shape)', () => {
		const constraintNode: PptxSmartArtLayoutNode = { children: [{ name: 'node' }] };
		expect(resolveSibTransBulgeRatio(constraintNode, [])).toBeUndefined();
	});

	it('is undefined for a straight-routed sibTrans (basic-cycle own shape: connRout is not "curve")', () => {
		const constraintNode: PptxSmartArtLayoutNode = {
			children: [connNode('sibTrans', { connRout: 'line', begPts: 'ctr', endPts: 'ctr' })],
		};
		expect(resolveSibTransBulgeRatio(constraintNode, [])).toBeUndefined();
	});

	it('is undefined for a curve connector that is not centre-to-centre (diverging-radial own parTrans: begPts/endPts are not both "ctr")', () => {
		const constraintNode: PptxSmartArtLayoutNode = {
			children: [connNode('parTrans', { connRout: 'curve', begPts: 'bCtr', endPts: 'tCtr' })],
		};
		expect(resolveSibTransBulgeRatio(constraintNode, [])).toBeUndefined();
	});

	it('resolves the declared "h" fact for a real curve-routed, centre-to-centre sibTrans, found STRUCTURALLY (not by item name - SESSION 20 found resolveRingItemNode itself picks up the wrong "oneComp" item name for this exact fixture, so this function must not depend on it) (radial-cycle--hier5.pptx own shape: fact=0.24)', () => {
		const constraintNode: PptxSmartArtLayoutNode = {
			children: [connNode('sibTrans', { connRout: 'curve', begPts: 'ctr', endPts: 'ctr' })],
		};
		const arrangerConstraints: PptxSmartArtLayoutNode['constraints'] = [
			{
				type: 'h',
				for: 'ch',
				forName: 'sibTrans',
				referenceType: 'w',
				referenceFor: 'ch',
				referenceForName: 'node',
				factor: 0.24,
			},
		];
		expect(resolveSibTransBulgeRatio(constraintNode, arrangerConstraints)).toBe(0.24);
	});
});
