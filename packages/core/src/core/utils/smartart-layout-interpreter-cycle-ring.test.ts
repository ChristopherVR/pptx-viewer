import { describe, expect, it } from 'vitest';

import { computeCycleRingLayout } from './smartart-layout-interpreter-cycle-ring';

const BOX = { x: 0, y: 0, width: 867, height: 533 };

describe('computeCycleRingLayout', () => {
	it('produces a TRUE CIRCLE for a full-circle, hub-less ring with heightOverWidth=1 (basic-cycle--flat3.pptx "Alpha": live-COM-verified 231.90x231.90, three independent measurement methods - see smartart-layout-interpreter-cycle.ts module doc comment)', () => {
		// n=3, full circle (spanDeg=360), sibSp fact=0.5 -> minGapRatio=0.5.
		const ring = computeCycleRingLayout(3, 0, 360, 0.5, 1, BOX);
		expect(ring.nodeWidth).toBeCloseTo(231.9, 0);
		expect(ring.nodeHeight).toBeCloseTo(231.9, 0);
		expect(ring.nodeWidth).toBeCloseTo(ring.nodeHeight, 6); // exact circle, not just close in px.
	});

	it("centres the ring's own slack axis in the box instead of stretching to fill it or pinning flush to one edge (basic-cycle--flat3.pptx: cached content width 579.86px inside an 866.67px-wide frame, ~143.4px margin on BOTH sides)", () => {
		const ring = computeCycleRingLayout(3, 0, 360, 0.5, 1, BOX);
		const xs = ring.centers.map((p) => p.x);
		const leftMargin = Math.min(...xs) - ring.nodeWidth / 2;
		const rightMargin = BOX.width - (Math.max(...xs) + ring.nodeWidth / 2);
		expect(leftMargin).toBeGreaterThan(0);
		expect(rightMargin).toBeGreaterThan(0);
		expect(leftMargin).toBeCloseTo(rightMargin, 3);
		expect(leftMargin).toBeCloseTo(143.4, 0);
	});

	it('keeps producing a true square on a narrow (non-full-circle) arc, where an independent-per-axis fit could never reproduce one for any ring radius (radial-list--hier5.pptx: n=3, stAng=60, spanAng=60, self-square composite ring item)', () => {
		const ring = computeCycleRingLayout(3, 60, 60, 0.5, 1, BOX);
		expect(ring.nodeWidth).toBeCloseTo(ring.nodeHeight, 6);
	});

	it('scales a non-square heightOverWidth proportionally (the single isotropic scale is not conflated with a square-only assumption)', () => {
		const ring = computeCycleRingLayout(3, 0, 360, 0.5, 0.677, BOX);
		expect(ring.nodeHeight).toBeCloseTo(ring.nodeWidth * 0.677, 6);
	});

	it('never exceeds the box on either axis (the isotropic scale is always the TIGHTER of the two per-axis candidates)', () => {
		const ring = computeCycleRingLayout(3, 0, 360, 0.5, 1, BOX);
		const xs = ring.centers.map((p) => p.x);
		const ys = ring.centers.map((p) => p.y);
		expect(Math.min(...xs) - ring.nodeWidth / 2).toBeGreaterThanOrEqual(-1e-6);
		expect(Math.max(...xs) + ring.nodeWidth / 2).toBeLessThanOrEqual(BOX.width + 1e-6);
		expect(Math.min(...ys) - ring.nodeHeight / 2).toBeGreaterThanOrEqual(-1e-6);
		expect(Math.max(...ys) + ring.nodeHeight / 2).toBeLessThanOrEqual(BOX.height + 1e-6);
	});
});
