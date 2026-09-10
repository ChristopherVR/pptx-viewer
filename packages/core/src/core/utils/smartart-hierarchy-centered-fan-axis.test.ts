import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode } from '../types';
import { hierarchyDeclaresCenteredFanAxisSwap } from './smartart-hierarchy-centered-fan-axis';

/**
 * `horizontal-labeled-hierarchy--hier5.pptx`'s own real shape: an outer
 * `hierChild` (mirror only), a nested `hierRoot` declaring `hierAlign`, and
 * THAT node's own nested `hierChild` (the "children of root" generation)
 * declaring `linDir` - mirrors `smartart-hierarchy-dispatch-lindir.test.ts`'s
 * own `cornerTree` helper, parameterised on the two values this gate reads.
 */
function centeredFanTree(hierAlign: string, linDir: string): PptxSmartArtLayoutNode {
	return {
		name: 'hierChild1',
		algorithm: { type: 'hierChild', parameters: [{ type: 'linDir', value: 'fromT' }] },
		children: [
			{
				name: 'Name17',
				algorithm: { type: 'hierRoot', parameters: [{ type: 'hierAlign', value: hierAlign }] },
				children: [
					{
						name: 'hierChild2',
						algorithm: { type: 'hierChild', parameters: [{ type: 'linDir', value: linDir }] },
						children: [],
					},
				],
			},
		],
	};
}

/** The plain "Hierarchy" family's own shape: `hierRoot1` nests NO `hierChild` at all. */
function plainFanningTree(): PptxSmartArtLayoutNode {
	return {
		name: 'hierChild1',
		algorithm: { type: 'hierChild', parameters: [{ type: 'linDir', value: 'fromL' }] },
		children: [
			{
				name: 'hierRoot1',
				algorithm: { type: 'hierRoot' },
				children: [{ name: 'composite', algorithm: { type: 'composite' }, children: [] }],
			},
		],
	};
}

describe('hierarchyDeclaresCenteredFanAxisSwap', () => {
	it('fires for hierAlign="lCtrCh" paired with a vertical nested linDir ("fromT") - horizontal-labeled-hierarchy--hier5.pptx', () => {
		expect(
			hierarchyDeclaresCenteredFanAxisSwap(centeredFanTree('lCtrCh', 'fromT'), 5, undefined),
		).toBeTruthy();
	});

	it('fires for the mirrored hierAlign="rCtrCh" paired with "fromB"', () => {
		expect(
			hierarchyDeclaresCenteredFanAxisSwap(centeredFanTree('rCtrCh', 'fromB'), 5, undefined),
		).toBeTruthy();
	});

	it('does not fire for hierAlign="tL"/"tR" (the corner-anchored construct, a different mode)', () => {
		expect(
			hierarchyDeclaresCenteredFanAxisSwap(centeredFanTree('tL', 'fromT'), 5, undefined),
		).toBeFalsy();
	});

	it('does not fire when the nested hierChild\'s own linDir is horizontal ("fromL") - hierAlign alone is not the gate', () => {
		expect(
			hierarchyDeclaresCenteredFanAxisSwap(centeredFanTree('lCtrCh', 'fromL'), 5, undefined),
		).toBeFalsy();
	});

	it('does not fire for the plain fanning family (no hierAlign declared at all)', () => {
		expect(hierarchyDeclaresCenteredFanAxisSwap(plainFanningTree(), 5, undefined)).toBeFalsy();
	});

	it('does not fire when algorithmNode is undefined', () => {
		expect(hierarchyDeclaresCenteredFanAxisSwap(undefined, 5, undefined)).toBeFalsy();
	});
});
