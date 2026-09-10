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

	// SESSION 32: the SAME organization-chart--hier5.pptx shape as the test
	// above, but passing `hangHeightRatio=generationGapRatio=0.42` (what
	// `resolveHierarchyOrientation` now actually supplies for this fixture -
	// see `HierarchyOrientation.hangHeightRatio`'s own doc comment) instead of
	// letting it default to the fixed `HANG_HEIGHT_RATIO=0.55`. COM-verified:
	// the DEFAULT (0.55, the test above) under-sizes this fixture by 3.4%
	// (`134.3` vs cached `139`); `0.42` reproduces cached `278x139` to within
	// rounding - full gate regen confirms `maxDeltaFraction` goes to exactly
	// `0` for this fixture with this change (was `0.0127`).
	it('a supplied hangHeightRatio reserves LESS room than the default 0.55, landing the exact cached size (organization-chart--hier5.pptx shape, SESSION 32)', () => {
		const { boxW, boxH } = fitItemBox(
			{ width: 867, height: 533 },
			2,
			2,
			0.21,
			0.5,
			0.42,
			0,
			0,
			1,
			undefined,
			1,
			true,
			0.42,
		);
		expect(boxH).toBeCloseTo(138.8, 1);
		expect(boxW).toBeCloseTo(277.6, 1);
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

	// SESSION 32: circle-picture-hierarchy--hier5.pptx's own shape - the SAME
	// box/totalLeaves/depth/sibSp/margins as the FIRST test above
	// (`hierarchy--hier5.pptx`), but a "parent-relative" composite child
	// (`compositeHeightFactor=0.8`, `compositeAspect=0.5` - see
	// `smartart-hierarchy-composite-child.ts`'s own SESSION 21 doc comment)
	// instead of the self-referential shape: without `compositeChainHeightRatio`
	// (`compositeAspect*heightFactor=0.4`), `heightFit` (130.75, identical to
	// `hierarchy--hier5.pptx`'s own value - the raw formula cannot distinguish
	// the two shapes at all) wins the `Math.min` clamp and under-sizes the item
	// by 9.5% (cached is 216x144). Passing `compositeChainHeightRatio` bypasses
	// that clamp entirely and reconstructs the item from the composite chain
	// (`widthFit` IS `compositeW`, un-shrunk - `renderedItem.h = compositeW *
	// compositeAspect * compositeHeightFactor`), landing within 0.9% of cached
	// instead of 9.5%.
	it('a parent-relative composite child bypasses the heightFit clamp via compositeChainHeightRatio (circle-picture-hierarchy--hier5.pptx shape)', () => {
		const withoutChain = fitItemBox(
			{ width: 867, height: 533 },
			2,
			3,
			0.1,
			0.6666666666666666,
			0.25,
			0.0491,
			0.0707,
		);
		expect(withoutChain.boxH).toBeCloseTo(130.74, 1); // same heightFit as hierarchy--hier5.pptx - structurally blind to the composite chain.
		const { boxW, boxH } = fitItemBox(
			{ width: 867, height: 533 },
			2,
			3,
			0.1,
			0.6666666666666666,
			0.25,
			0.0491,
			0.0707,
			0,
			undefined,
			0,
			false,
			undefined,
			0.4,
		);
		expect(boxH).toBeCloseTo(148.93, 1); // widthFit(372.32) * compositeChainHeightRatio(0.4) - within 0.9% of cached 144.
		expect(boxW).toBeCloseTo(223.4, 0); // boxH/aspectRatio - within 3.4% of cached 216 (the pre-existing widthFit overshoot, not this fix's own residual).
	});

	// SESSION 34: organization-chart--hier8.pptx's own shape - totalLeaves=5
	// (a solo-chain root fans a SECOND generation into a 5-wide row), but only
	// ONE of those 5 columns actually passes through a hang (`hangingColumns=1`,
	// see `smartart-hierarchy-hang-depth.ts`'s own SESSION 34 test case). The
	// pre-SESSION-34 formula applied `maxHangDepth*HIER_TAIL_OFFSET_RATIO`
	// (calibrated against `organization-chart--hier5.pptx`, where ALL n=2
	// columns hang) to the WHOLE n=5 row, under-sizing every item by ~4%
	// (cached is 148x74). Passing the true `hangingColumns=1` scales the
	// reservation to 1/5 and lands within 0.6% of cached.
	it('scales the WIDTH-axis hang reservation by hangingColumns/columns instead of applying it to every column (organization-chart--hier8.pptx shape)', () => {
		const unscoped = fitItemBox(
			{ width: 867, height: 533 },
			5,
			3,
			0.21,
			0.5,
			0.42,
			0,
			0,
			1,
			undefined,
			1,
			false,
			0.42,
		);
		expect(unscoped.boxW).toBeCloseTo(142.36, 1); // the pre-SESSION-34 under-sized value.
		const { boxW, boxH } = fitItemBox(
			{ width: 867, height: 533 },
			5,
			3,
			0.21,
			0.5,
			0.42,
			0,
			0,
			1,
			undefined,
			1,
			false,
			0.42,
			undefined,
			1,
		);
		expect(boxW).toBeCloseTo(147.2, 1); // within 0.6% of cached 148.
		expect(boxH / boxW).toBeCloseTo(0.5, 6); // aspect-locked, same as every other tailed-mode item.
	});

	// SESSION 34: `hangingColumns === columns` (the default, and every fixture
	// measured before this session) must stay byte-identical to the unscoped
	// formula - re-confirms the hier5 case above is unaffected by the new param.
	it('hangingColumns === columns leaves the result unchanged (organization-chart--hier5.pptx shape, no regression)', () => {
		const { boxW, boxH } = fitItemBox(
			{ width: 867, height: 533 },
			2,
			2,
			0.21,
			0.5,
			0.42,
			0,
			0,
			1,
			undefined,
			1,
			true,
			0.42,
			undefined,
			2,
		);
		expect(boxH).toBeCloseTo(138.8, 1);
		expect(boxW).toBeCloseTo(277.6, 1);
	});
});
