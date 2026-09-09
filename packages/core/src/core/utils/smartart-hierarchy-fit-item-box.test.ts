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
	// all), clampToNaturalAspect=false. Cached: 392x220.
	it('tailed mode with no hanging tail and no natural-aspect clamp (organization-chart--flat3.pptx shape)', () => {
		const { boxW, boxH } = fitItemBox(
			{ width: 867, height: 533 },
			2,
			2,
			0.21,
			0.5,
			0.42,
			0,
			0,
			0,
			false,
		);
		expect(boxW).toBeCloseTo(392.3, 0);
		expect(boxH).toBeCloseTo(220.2, 0);
	});

	// organization-chart--hier5.pptx's own shape: same ratios, but
	// fannedGenerations=2 with maxHangDepth=1 (one hanging generation below
	// the fanned row). Cached: 353x139.
	it('tailed mode reserves EXTRA room on both axes for a hanging tail (organization-chart--hier5.pptx shape)', () => {
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
			false,
		);
		expect(boxW).toBeCloseTo(352.4, 0);
		expect(boxH).toBeCloseTo(134.3, 0);
	});

	it('clampToNaturalAspect=true still clamps to the smaller of natural aspect and heightFit (default, unchanged)', () => {
		// A tall, narrow box where heightFit has far more room than the
		// natural (width-derived) aspect needs.
		const clamped = fitItemBox({ width: 100, height: 800 }, 2, 2, 0, 1, 0, 0, 0, 0, true);
		const unclamped = fitItemBox({ width: 100, height: 800 }, 2, 2, 0, 1, 0, 0, 0, 0, false);
		expect(clamped.boxH).toBeLessThan(unclamped.boxH);
	});
});
