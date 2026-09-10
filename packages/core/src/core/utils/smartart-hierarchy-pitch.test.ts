import { describe, expect, it } from 'vitest';

import { centeredAxisPitch, compositeFanPitch, computeAxisPitch } from './smartart-hierarchy-pitch';

describe('computeAxisPitch', () => {
	it('keeps a single fanned item (count=1) inside the box, never past its far edge (regression: packages/shared fidelity "hierarchy places a 1-node/2-node tree in bounds" - both trees have totalLeaves===1, the SAME degenerate fan-axis case)', () => {
		// This regression predates the round-11/SESSION-8 fan-axis model
		// correction below and pins `computeAxisPitch` itself (now used for the
		// GENERATION axis, and `tailed` mode's own fan axis) with a margin
		// ratio matching `fitItemBox`'s own `OUTER_MARGIN_X_RATIO=0.0491`
		// sizing a 400px-wide box down to itemSize=400*(1-2*0.0491)=360.72, and
		// an (arbitrary, pre-correction) 0.1115 leading-margin ratio deriving
		// margin=360.72*0.1115=40.22028 - the SAME numbers `smartart-layout-
		// interpreter-fidelity.test.ts`'s synthetic 400x300 box reproduces.
		// Pre-fix, `shift`(=margin)+itemSize=400.94028, 0.94px past the box's
		// own 400px width.
		const dimension = 400;
		const itemSize = 360.72;
		const margin = itemSize * 0.1115;
		const { pitch, shift } = computeAxisPitch(dimension, margin, itemSize, 1);
		expect(pitch).toBeCloseTo(itemSize, 6); // n=1 has no gap term.
		expect(shift + itemSize).toBeLessThanOrEqual(dimension + 1e-6);
		expect(shift).toBeCloseTo(dimension - itemSize, 6); // trailing edge flush, not past it.
	});

	it('n=1: falls back to the plain (possibly-negative) shift when the item alone already exceeds the box - never worse than the un-clamped formula', () => {
		// A pathological box smaller than the item itself: nothing can make
		// this fit, but the clamp should still choose the LEAST-overflowing
		// shift (flush at the trailing edge), not silently ignore the excess.
		const { shift } = computeAxisPitch(100, 20, 150, 1);
		expect(shift).toBeCloseTo(100 - 150, 6); // -50: trailing edge exactly at dimension.
	});

	it('count>1 with a genuine (unfloored) gap stays BYTE-IDENTICAL to the pre-clamp formula (regression safety for every currently-passing multi-column hierarchy/organization-chart fixture)', () => {
		// `hierarchy--flat3.pptx`/`--hier5.pptx`'s own COM-verified fan-axis
		// numbers (see the module doc comment): boxW=372, margin=41.5.
		const dimension = 867;
		const itemSize = 372;
		const margin = 41.5;
		const { pitch, shift } = computeAxisPitch(dimension, margin, itemSize, 2);
		// gap = (867-41.5-2*372)/1 = 81.5; pitch = 372+81.5 = 453.5;
		// rawShift = 41.5-81.5/2 = 0.75 - the clamp must not move this at all.
		expect(pitch).toBeCloseTo(453.5, 6);
		expect(shift).toBeCloseTo(0.75, 6);
		// The trailing edge (last item's own right edge, from
		// `placeStandardTree`'s own `cx=(offset+0.5)*pitch` placement:
		// `shift + n*itemSize + gap*(n-0.5)`) lands exactly on the box's own
		// far edge, per the module's own COM-verified "flush, never past it"
		// invariant - proving the clamp is a genuine no-op here, not
		// coincidentally close.
		const gap = pitch - itemSize;
		const trailingEdge = shift + 2 * itemSize + gap * 1.5;
		expect(trailingEdge).toBeCloseTo(dimension, 6);
	});

	it('count>1 with an already-overflowing (floored) gap also gets clamped flush - the SAME latent defect class as count===1, closed for free by the same general fix', () => {
		// margin + n*itemSize (10 + 2*60 = 130) already exceeds dimension (100)
		// before any gap is even considered - `gap` floors to 0, and pre-fix
		// `shift` (=margin=10) would overflow the box by 30px, the exact same
		// failure mode as the count===1 case just with count=2.
		const { shift } = computeAxisPitch(100, 10, 60, 2);
		expect(shift).toBeCloseTo(100 - 2 * 60, 6); // -20: trailing edge exactly at dimension.
	});

	it("session 10: `fixedGapRatio`, when given, uses `itemSize * fixedGapRatio` directly instead of solving to fill `dimension` - `hierarchy--hier8.pptx`'s own 4-generation, unevenly-fanned tree (a lone descendant past the main fan) needs this: the solved gap (49.86px) overshoots the fixture's own real, measured row-to-row gap (41.98px, `itemSize * 0.4580`)", () => {
		const dimension = 533;
		const margin = 15.36;
		const itemSize = 91.66;
		const { pitch, shift } = computeAxisPitch(dimension, margin, itemSize, 4, 0.458);
		expect(pitch).toBeCloseTo(itemSize * 1.458, 4);
		// SESSION 16: `shift` is the CENTRED formula now (`(dimension - n*pitch
		// + margin) / 2`, see the module's own doc comment), not `margin -
		// gap/2` - this test's own real numbers (this IS `hierarchy--
		// hier8.pptx`'s own generation axis) are exactly what a 4-tree live-COM
		// resize experiment used to prove the OLD leading-margin/trailing-flush
		// model under-placed row 1 by ~13px (2.4% of `dimension`) for this
		// construct: cached top margin measured 28px against the old formula's
		// own 15.4px prediction. The corrected value below reproduces the
		// fixture's own cached geometry to within 1px (`hierarchy--
		// hier8.pptx`'s own gate comparison moved from ~2.4% to <=0.2% deltaY
		// after this fix landed).
		const gap = itemSize * 0.458;
		const n = 4;
		const pitchValue = itemSize + gap;
		expect(shift).toBeCloseTo((dimension - n * pitchValue + margin) / 2, 6);
		expect(shift).toBeCloseTo(6.89944, 4);
	});

	it('session 10: omitting `fixedGapRatio` (every existing caller) is BYTE-IDENTICAL to the pre-existing solve-to-fill behaviour - regression guard for the new optional parameter', () => {
		const dimension = 867;
		const itemSize = 372;
		const margin = 41.5;
		const withoutFixed = computeAxisPitch(dimension, margin, itemSize, 2);
		const withUndefinedFixed = computeAxisPitch(dimension, margin, itemSize, 2, undefined);
		expect(withUndefinedFixed).toStrictEqual(withoutFixed);
	});

	it("session 10: a negative `fixedGapRatio` is clamped to 0, matching `centeredAxisPitch`'s own convention", () => {
		const { pitch } = computeAxisPitch(1000, 10, 150, 3, -0.5);
		expect(pitch).toBeCloseTo(150, 6); // gap floored to 0, not negative.
	});

	it("session 10: `fixedGapRatio` is ignored for count===1 (no sibling to gap against), matching the solve-to-fill path's own n===1 convention", () => {
		const { pitch } = computeAxisPitch(400, 40, 200, 1, 0.5);
		expect(pitch).toBeCloseTo(200, 6); // no gap term for a lone item.
	});

	it('session 16: the generation axis is CENTRED with `margin` split as a +/-margin/2 bias, not a leading-only margin against a trailing-flush pack - pins the 4-tree live-COM measurement (0/1/2/3 leading singleton generations before a 5-wide fan, same box, same fixedGapRatio) that overturned the old model: top margin minus bottom margin is CONSTANT (=`margin`) at every depth, not the whole margin sitting on top alone', () => {
		const dimension = 500;
		const itemSize = 60; // small enough that n up to 5 never overflows dimension.
		const margin = itemSize * 0.1675; // GENERATION_MARGIN_RATIO
		const fixedGapRatio = 0.458;
		for (const n of [2, 3, 4, 5]) {
			const { pitch, shift } = computeAxisPitch(dimension, margin, itemSize, n, fixedGapRatio);
			const gap = itemSize * fixedGapRatio;
			const span = n * itemSize + (n - 1) * gap;
			const topMargin = shift + gap / 2; // row 0's own top edge, pre-shift it sits at gap/2 (see placeStandardTree's cy=level*pitch+pitch/2).
			const bottomMargin = dimension - span - topMargin;
			// Centred: slack (dimension-span) splits evenly, biased by margin/2
			// toward the top - never the whole `margin` sitting on the leading
			// edge alone (the pre-SESSION-16 model), and never the naive
			// half-slack-only "space-around" `centeredAxisPitch` uses for the fan
			// axis either (this axis keeps its own small, measured top bias).
			expect(topMargin - bottomMargin).toBeCloseTo(margin, 6);
			expect(topMargin).toBeCloseTo((dimension - span) / 2 + margin / 2, 6);
			expect(pitch).toBeCloseTo(itemSize + gap, 6);
		}
	});
});

describe('centeredAxisPitch (round 11/SESSION 8: the FAN axis is centred, not a leading-margin/trailing-flush pack - see the module doc comment)', () => {
	it('pure formula check: a 2-item, 0.1-gapRatio, 196px-item pack centres with equal margins (this is a math regression test on the raw formula only - see the `compositeFanPitch` describe block below for the REAL, round-11/SESSION-9-corrected `hierarchy--hier5.pptx` numbers, which additionally need the composite-cell-vs-rendered-item correction this bare function does not apply)', () => {
		const { pitch, shift } = centeredAxisPitch(866.67, 196, 0.1, 2);
		expect(pitch).toBeCloseTo(215.6, 1); // itemSize*(1+gapRatio) = 196*1.1.
		expect(shift).toBeCloseTo(227.5, 1); // span=411.6; shift=(866.67-411.6)/2.
	});

	it('centres symmetrically: leading and trailing margins are exactly equal', () => {
		const { pitch, shift } = centeredAxisPitch(1000, 150, 0.2, 3);
		const span = 3 * 150 + 2 * 0.2 * 150;
		const trailingMargin = 1000 - (shift + span);
		expect(trailingMargin).toBeCloseTo(shift, 6);
		expect(pitch).toBeCloseTo(180, 6); // 150*(1+0.2).
	});

	it('a single item (count=1) is centred with no phantom gap contribution', () => {
		const { pitch, shift } = centeredAxisPitch(400, 150, 0.2, 1);
		expect(pitch).toBeCloseTo(150, 6); // no gap term for a lone item.
		expect(shift).toBeCloseTo((400 - 150) / 2, 6);
	});

	it('never introduces a negative gap for a negative gapRatio input (clamped at 0)', () => {
		const { pitch } = centeredAxisPitch(1000, 150, -0.5, 3);
		expect(pitch).toBeCloseTo(150, 6); // gap floored to 0, not negative.
	});
});

describe('compositeFanPitch (round 11/SESSION 9: the composite-wrapper cell-vs-rendered-item correction)', () => {
	it('matches "hierarchy--hier5.pptx" (n=2, boxW=206, compositeWidthFactor=0.9, cardOffsetXRatio=0.1, sibSpRatio=0.1): the RENDERED item lands at the live-COM cached fan-axis left edge (216.24px, frame-relative) essentially exactly', () => {
		const { shift } = compositeFanPitch(866.67, 206, 0.9, 0.1, 0.1, 2);
		// shift is cx(item 0)'s own left-edge contribution once combined with
		// placeStandardTree's own cx=(offset+0.5)*pitch formula: leftEdge(0) =
		// 0.5*pitch + shift - boxW/2. Verified end-to-end via the interpreter
		// itself (0.00% x-delta against `hierarchy--hier5.pptx`'s own cached
		// geometry) - this pins the same invariant directly against the pitch
		// function's own output.
		const compositeW = 206 / 0.9;
		const pitch = compositeW * 1.1;
		const leftEdge0 = 0.5 * pitch + shift - 206 / 2;
		expect(leftEdge0).toBeCloseTo(216.24, 0);
	});

	it('reduces to plain centeredAxisPitch-shaped behaviour when compositeWidthFactor is undefined (no composite wrapper, e.g. "Horizontal Hierarchy") - the correction term still applies (it corrects for cx using pitch, not itemSize, to centre), not a no-op', () => {
		const { pitch, shift } = compositeFanPitch(1000, 150, undefined, 0, 0.2, 3);
		// compositeW falls back to boxW(150) itself; cardOffsetX=0.
		expect(pitch).toBeCloseTo(180, 6); // 150*(1+0.2), unchanged.
		// leftEdge(0) = 0.5*pitch+shift-boxW/2 should land at the true centred
		// margin (span=3*150+2*0.2*150=510; margin=(1000-510)/2=245).
		const leftEdge0 = 0.5 * pitch + shift - 150 / 2;
		expect(leftEdge0).toBeCloseTo(245, 6);
	});
});
