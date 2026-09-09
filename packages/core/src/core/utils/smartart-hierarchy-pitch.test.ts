import { describe, expect, it } from 'vitest';

import { computeAxisPitch } from './smartart-hierarchy-pitch';

describe('computeAxisPitch', () => {
	it('keeps a single fanned item (count=1) inside the box, never past its far edge (regression: packages/shared fidelity "hierarchy places a 1-node/2-node tree in bounds" - both trees have totalLeaves===1, the SAME degenerate fan-axis case)', () => {
		// `fitItemBox`'s own OUTER_MARGIN_X_RATIO=0.0491 sizes a 400px-wide box
		// down to itemSize=400*(1-2*0.0491)=360.72; FAN_MARGIN_RATIO=0.1115
		// then derives a leading margin of 360.72*0.1115=40.22028 - the SAME
		// numbers `smartart-layout-interpreter-fidelity.test.ts`'s synthetic
		// 400x300 box reproduces. Pre-fix, `shift`(=margin)+itemSize=400.94028,
		// 0.94px past the box's own 400px width.
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
});
