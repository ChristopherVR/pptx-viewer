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

	it('session 21: a sibTrans curve-connector bulge shrinks the scale to match cached geometry (radial-cycle--hier5.pptx: n=3, hub factor=0.7, hubGapRatio=0.3, sibTransBulgeRatio=0.24 - cached item 141px, hub 202px; without the bulge this over-scales to 163px/233px, a measured 9% regression this test pins against)', () => {
		const withoutBulge = computeCycleRingLayout(
			3,
			0,
			360,
			0.5,
			1,
			BOX,
			undefined,
			{ factor: 0.7, gapRatio: 0.3 },
			undefined,
			undefined,
		);
		expect(withoutBulge.nodeWidth).toBeCloseTo(163, 0);
		const withBulge = computeCycleRingLayout(
			3,
			0,
			360,
			0.5,
			1,
			BOX,
			undefined,
			{ factor: 0.7, gapRatio: 0.3 },
			undefined,
			0.24,
		);
		expect(withBulge.nodeWidth).toBeCloseTo(142, 0); // cached 141px, 0.7% off.
	});

	it('session 21: the sibTrans bulge shrinks scale WITHOUT shifting the flush-axis satellite off the box edge (radial-cycle--hier5.pptx: the lone top satellite sits flush at y=0 either way)', () => {
		const ring = computeCycleRingLayout(
			3,
			0,
			360,
			0.5,
			1,
			BOX,
			undefined,
			{ factor: 0.7, gapRatio: 0.3 },
			undefined,
			0.24,
		);
		const topSatelliteY = Math.min(...ring.centers.map((p) => p.y)) - ring.nodeHeight / 2;
		expect(topSatelliteY).toBeCloseTo(0, 0);
	});

	describe('round 46: n===1 with a hub + a known absolute node width', () => {
		it("sizes BOTH the hub and its one satellite at the known width, not stretched to fill the box (radial-cluster--hier5.pptx's nested cycle_3: hub 'Four'/satellite 'Five', both cached at a uniform 75x75)", () => {
			const ring = computeCycleRingLayout(
				1,
				240,
				360,
				0.5,
				1,
				BOX,
				undefined,
				{ factor: 1, gapRatio: 0.1 },
				undefined,
				undefined,
				75,
			);
			expect(ring.nodeWidth).toBeCloseTo(75, 6);
			expect(ring.nodeHeight).toBeCloseTo(75, 6);
			expect(ring.hubHalfWidth * 2).toBeCloseTo(75, 6);
			expect(ring.hubHalfHeight * 2).toBeCloseTo(75, 6);
		});

		it('places the hub at the box centre and the satellite at r0 = (hub half + gap + item half) node-widths along stAng, not stretched to the box edge', () => {
			const ring = computeCycleRingLayout(
				1,
				240,
				360,
				0.5,
				1,
				BOX,
				undefined,
				{ factor: 1, gapRatio: 0.1 },
				undefined,
				undefined,
				75,
			);
			expect(ring.hubCenter).toStrictEqual({ x: BOX.width / 2, y: BOX.height / 2 });
			const [satellite] = ring.centers;
			const dx = satellite.x - ring.hubCenter.x;
			const dy = satellite.y - ring.hubCenter.y;
			const r0 = Math.sqrt(dx * dx + dy * dy);
			// r0Nat = hubHalfWidthNat(0.5/1) + gapRatio(0.1) + itemHalfWidthNat(0.5) = 1.1
			expect(r0).toBeCloseTo(1.1 * 75, 4);
		});

		it('falls back to the plain stretch-to-box degenerate case when no known node width is given (no regression for a hub-less or non-userS n===1 ring)', () => {
			const ring = computeCycleRingLayout(1, 240, 360, 0.5, 1, BOX, undefined, {
				factor: 1,
				gapRatio: 0.1,
			});
			expect(ring.nodeWidth).toBeCloseTo(BOX.width, 6);
			expect(ring.hubHalfWidth).toBe(0);
		});
	});
});
