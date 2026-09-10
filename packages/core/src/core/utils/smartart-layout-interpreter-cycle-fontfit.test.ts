import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode, PptxSmartArtNode } from '../types';
import { EMPTY_CONSTRAINT_INDEX } from '../utils/smartart-constraint-solver';
import { resolveCycleFontFit } from './smartart-layout-interpreter-cycle-fontfit';
import type { ArrangementPlan } from './smartart-layout-interpreter-model';

function planFor(node: PptxSmartArtLayoutNode): ArrangementPlan {
	return { kind: 'cycle', node };
}

const arranger: PptxSmartArtLayoutNode = {
	name: 'cycle',
	children: [{ name: 'node', algorithm: { type: 'tx' } }],
};

const ringNodes: PptxSmartArtNode[] = [
	{ id: 'r1', text: 'Ring One' },
	{ id: 'r2', text: 'Ring Two' },
];

/**
 * Round 36: a `ctrShpMap="fNode"` hub used to be forced into the SAME joint
 * font-fit binary search as the ring items, so its font size was capped at
 * whatever the smaller ring boxes could fit - never its own, usually much
 * bigger, box. A corpus-wide scan of every hub-bearing cycle fixture's own
 * cached drawing (`l36-hub-font-scan.ts`, scratchpad) showed the hub's real
 * font size is ALWAYS independently larger than the ring items' (zero
 * counterexamples across 12 fixtures). These tests pin the fix: the hub now
 * gets its own, independent font-fit call against its own box.
 */
describe('resolveCycleFontFit', () => {
	it('returns no hub-specific fields when there is no hub (ring-only cycle, unchanged behaviour)', () => {
		const fit = resolveCycleFontFit(
			planFor(arranger),
			EMPTY_CONSTRAINT_INDEX,
			ringNodes,
			undefined,
			80,
			80,
			0,
			0,
			0,
			undefined,
			undefined,
		);
		expect(fit.hubFontSizeOverride).toBeUndefined();
		expect(fit.hubDescendantSizePx).toBeUndefined();
		expect(fit.fontSizeOverride).toBeGreaterThan(0);
	});

	it('fits a much bigger hub box to a LARGER font than the ring items, not the ring-constrained shared size', () => {
		const hubNode: PptxSmartArtNode = { id: 'hub', text: 'Hub' };
		const fit = resolveCycleFontFit(
			planFor(arranger),
			EMPTY_CONSTRAINT_INDEX,
			ringNodes,
			hubNode,
			// Ring items get a small, tightly-constrained box...
			60,
			60,
			// ...the hub gets a MUCH bigger one, matching the corpus-observed
			// "hub is always bigger and independently fit" pattern.
			400,
			400,
			0,
			undefined,
			undefined,
		);
		expect(fit.hubFontSizeOverride).toBeDefined();
		expect(fit.hubFontSizeOverride as number).toBeGreaterThan(fit.fontSizeOverride);
	});
});
