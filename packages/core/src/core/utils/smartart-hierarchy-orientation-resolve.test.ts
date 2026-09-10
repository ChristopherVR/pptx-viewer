import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode } from '../types';
import { EMPTY_CONSTRAINT_INDEX } from './smartart-constraint-solver';
import { resolveHierarchyEffectiveOrientation } from './smartart-hierarchy-orientation-resolve';

const BOX = { width: 867, height: 533 };

/** `horizontal-labeled-hierarchy--hier5.pptx`'s own real shape - see `smartart-hierarchy-centered-fan-axis.test.ts`'s own `centeredFanTree`. */
function centeredFanTree(): PptxSmartArtLayoutNode {
	return {
		name: 'hierChild1',
		algorithm: { type: 'hierChild', parameters: [{ type: 'linDir', value: 'fromT' }] },
		children: [
			{
				name: 'Name17',
				algorithm: { type: 'hierRoot', parameters: [{ type: 'hierAlign', value: 'lCtrCh' }] },
				children: [
					{
						name: 'hierChild2',
						algorithm: { type: 'hierChild', parameters: [{ type: 'linDir', value: 'fromT' }] },
						children: [
							{ name: 'level1Shape', algorithm: { type: 'tx' }, shape: { presetGeometry: 'rect' } },
						],
					},
				],
			},
		],
	};
}

/** The plain "Hierarchy" family's own shape: no `hierAlign`, no transposition signal. */
function plainFanningTree(): PptxSmartArtLayoutNode {
	return {
		name: 'hierChild1',
		algorithm: { type: 'hierChild' },
		children: [
			{
				name: 'hierRoot1',
				algorithm: { type: 'hierRoot' },
				children: [{ name: 'text', algorithm: { type: 'tx' }, shape: { presetGeometry: 'rect' } }],
			},
		],
	};
}

describe('resolveHierarchyEffectiveOrientation', () => {
	it('swaps effectiveBox and sets swapAxes for the axis-swapped construct (hierAlign="lCtrCh" + vertical nested linDir)', () => {
		const result = resolveHierarchyEffectiveOrientation(
			centeredFanTree(),
			EMPTY_CONSTRAINT_INDEX,
			'std',
			5,
			undefined,
			BOX,
		);
		expect(result.swapAxes).toBeTruthy();
		expect(result.effectiveBox).toStrictEqual({ width: BOX.height, height: BOX.width });
		// The construct's own gate never sets `orientation.transposed` - only
		// `swapAxes` (computed from `transposed || axisSwapped`) reflects it.
		expect(result.orientation.transposed).toBeFalsy();
	});

	it('keeps effectiveBox unswapped for the plain fanning family (no hierAlign, no transposition signal)', () => {
		const result = resolveHierarchyEffectiveOrientation(
			plainFanningTree(),
			EMPTY_CONSTRAINT_INDEX,
			'std',
			5,
			undefined,
			BOX,
		);
		expect(result.swapAxes).toBeFalsy();
		expect(result.effectiveBox).toStrictEqual(BOX);
	});
});
