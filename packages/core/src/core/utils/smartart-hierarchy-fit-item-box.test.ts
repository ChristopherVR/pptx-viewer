import { describe, expect, it } from 'vitest';

import { fitItemBox } from './smartart-hierarchy-fit-item-box';

describe('fitItemBox', () => {
	it('std-mode: clamps boxW to boxH/aspectRatio when the GENERATION axis binds (hierarchy--hier5.pptx shape) - round 11/SESSION 8 fix: boxW used to stay at the WIDER widthFit unconditionally, silently violating the declared aspectRatio (372x131, aspect 0.352 vs declared 0.667); it now shrinks with boxH to keep the aspect exact', () => {
		// totalLeaves=2, depth=3, sibSp=0.1, aspect=0.667, genGap=0.25,
		// OUTER_MARGIN constants (unchanged inputs - only the boxW ASSIGNMENT
		// is fixed here; the ratio VALUES themselves are a separately-flagged,
		// not-yet-closed residual - see this repo's smartart-track-r-
		// successor.md SESSION 8 for the precise, COM-measured discrepancy).
		const { boxW, boxH } = fitItemBox(
			{ width: 867, height: 533 },
			2,
			3,
			0.1,
			0.667,
			0.25,
			0.0491,
			0.0707,
		);
		expect(boxH).toBeCloseTo(130.74, 1); // heightFit binds - unchanged by this fix.
		expect(boxW).toBeCloseTo(boxH / 0.667, 6); // boxW now tracks boxH/aspectRatio exactly.
		expect(boxW).toBeCloseTo(196.0, 0); // down from the old (aspect-violating) 372.3.
	});

	// organization-chart--flat3.pptx's own shape: totalLeaves=2,
	// fannedGenerations=2, sibSp=0.21, aspect=0.5, genGap=0.42 (the
	// axis-converted `sp`), zero margin, maxHangDepth=0 (no hanging tail at
	// all). SESSION 10: the item is ALWAYS aspect-clamped now (see the
	// module's own doc comment history) - re-measured directly against this
	// fixture's own raw `dsp:sp` offsets: real cached is `392x196`, an EXACT
	// `0.5` aspect match, NOT the `392x220` a prior session's own measurement
	// (made against a since-fixed cached-reader bug) mistook for ground
	// truth.
	it('tailed mode with no hanging tail, aspect-clamped (organization-chart--flat3.pptx shape)', () => {
		const { boxW, boxH } = fitItemBox({ width: 867, height: 533 }, 2, 2, 0.21, 0.5, 0.42, 0, 0, 0);
		expect(boxW).toBeCloseTo(392.3, 0);
		expect(boxH).toBeCloseTo(196.15, 0);
		expect(boxH / boxW).toBeCloseTo(0.5, 6); // aspect-locked, matching the real cached shape exactly.
	});

	// organization-chart--hier5.pptx's own shape: same ratios, but
	// fannedGenerations=2 with maxHangDepth=1 (one hanging generation below
	// the fanned row). SESSION 10: real cached is `278x139` (0.5 aspect
	// again), not the `353x139` a prior session's own measurement recorded.
	it('tailed mode reserves EXTRA room on both axes for a hanging tail, aspect-clamped (organization-chart--hier5.pptx shape)', () => {
		const { boxW, boxH } = fitItemBox({ width: 867, height: 533 }, 2, 2, 0.21, 0.5, 0.42, 0, 0, 1);
		expect(boxW).toBeCloseTo(268.5, 0);
		expect(boxH).toBeCloseTo(134.3, 0);
		expect(boxH / boxW).toBeCloseTo(0.5, 6);
	});

	it('session 10: clamps to the smaller of natural aspect and heightFit even when heightFit has far more room (a tall, narrow box) - the `clampToNaturalAspect` parameter this replaced is gone, every caller needs this behaviour now', () => {
		const { boxH, boxW } = fitItemBox({ width: 100, height: 800 }, 2, 2, 0, 1, 0, 0, 0, 0);
		const naturalHeight = boxW; // aspectRatio=1 here, so naturalHeight===boxW.
		expect(boxH).toBeLessThan(800); // never the un-clamped heightFit.
		expect(boxH).toBeCloseTo(naturalHeight, 6); // width axis binds, aspect exact.
	});

	// horizontal-organization-chart--hier5.pptx's own shape (SESSION 25): a
	// TRANSPOSED `tailed` hierarchy (n=2, both children hang 1 leaf each -
	// the SAME tree shape as `organization-chart--hier5.pptx` above, which
	// keeps the DEFAULT `hangHeightRatio`). With the default `HANG_HEIGHT_
	// RATIO=0.55` the denominator (`2+1+1*0.2+1*0.55=3.75`) under-sizes the
	// item by the SAME ~10% on both axes (cached is 255x78, NOT 231x71).
	// Passing `generationGapRatio` (0.2) as `hangHeightRatio` instead gives
	// `2+1+1*0.2+1*0.2=3.4`, matching cached within 0.4%.
	it('a transposed tailed hang uses the passed hangHeightRatio instead of the default HANG_HEIGHT_RATIO (horizontal-organization-chart--hier5.pptx shape)', () => {
		const defaultRatio = fitItemBox(
			{ width: 533, height: 867 },
			2,
			2,
			0.125,
			3.278688524590164,
			0.2,
			0,
			0,
			1,
			undefined,
			1,
			true,
		);
		expect(defaultRatio.boxH).toBeCloseTo(231.2, 0); // the un-fixed, too-small value.
		const withOverride = fitItemBox(
			{ width: 533, height: 867 },
			2,
			2,
			0.125,
			3.278688524590164,
			0.2,
			0,
			0,
			1,
			undefined,
			1,
			true,
			0.2,
		);
		expect(withOverride.boxH).toBeCloseTo(255.0, 0); // matches cached exactly.
		expect(withOverride.boxW).toBeCloseTo(77.8, 0); // matches cached (78) within 0.3%.
	});
});
