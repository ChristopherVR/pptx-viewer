import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode, PptxSmartArtNode } from '../types';
import { arrangeCycle, computeCycleRingLayout } from './smartart-layout-interpreter-cycle';
import type { ArrangementPlan } from './smartart-layout-interpreter-model';

function planFor(node: PptxSmartArtLayoutNode): ArrangementPlan {
	return { kind: 'cycle', node };
}

function nodes(n: number): PptxSmartArtNode[] {
	return Array.from({ length: n }, (_, i) => ({ id: `n${i}`, text: `${i}` }));
}

// G6: `ctrShpMap="fNode"` (`dgm:param`) places a hub node at the ring's centre
// for "Radial Cycle"-family layouts, instead of on the ring like every other point.
describe('arrangeCycle ctrShpMap', () => {
	it('places every point on the ring when ctrShpMap is absent (no regression)', () => {
		const plan = planFor({ algorithm: { type: 'cycle' } });
		const result = arrangeCycle(plan, nodes(4), { width: 200, height: 200 }, ['#fff'], 'flat', 'e');
		expect(result.nodes).toHaveLength(4);
		const centre = { x: 100, y: 100 };
		for (const rendered of result.nodes) {
			if (rendered.kind !== 'circle') {
				throw new Error('expected circle nodes');
			}
			const dist = Math.hypot(rendered.cx - centre.x, rendered.cy - centre.y);
			expect(dist).toBeGreaterThan(10);
		}
	});

	it("ctrShpMap=fNode pulls the first data point to the ring's own centre", () => {
		const plan = planFor({
			algorithm: { type: 'cycle', parameters: [{ type: 'ctrShpMap', value: 'fNode' }] },
		});
		const result = arrangeCycle(plan, nodes(4), { width: 200, height: 200 }, ['#fff'], 'flat', 'e');
		expect(result.nodes).toHaveLength(4);
		const hub = result.nodes.find((rendered) => rendered.nodeId === 'n0');
		if (!hub || hub.kind !== 'circle') {
			throw new Error('expected hub circle for n0');
		}
		// A 3-node ring (`ctrShpMap` pulls one of the 4 points off the ring into
		// the hub) is NOT symmetric top-to-bottom at the default `stAng=0` (see
		// `computeCycleRingLayout`'s doc comment: real "Basic Cycle" itself
		// renders this exact asymmetry for a 3-point ring), so the hub's centre
		// is not necessarily the box's own geometric centre - only reasonably
		// central, well clear of the box edges.
		expect(hub.cx).toBeGreaterThan(50);
		expect(hub.cx).toBeLessThan(150);
		expect(hub.cy).toBeGreaterThan(50);
		expect(hub.cy).toBeLessThan(150);
		// The remaining 3 points are still arranged on the ring, away from centre.
		const ringNodes = result.nodes.filter((rendered) => rendered.nodeId !== 'n0');
		expect(ringNodes).toHaveLength(3);
		for (const rendered of ringNodes) {
			if (rendered.kind !== 'circle') {
				throw new Error('expected circle nodes');
			}
			const dist = Math.hypot(rendered.cx - hub.cx, rendered.cy - hub.cy);
			expect(dist).toBeGreaterThan(hub.r);
		}
	});

	// REGRESSION: `smartart-layout-interpreter.ts`'s `runArrangement` already
	// strips the hub point upstream (`detectHubExpansion`) for every real
	// gallery hub layout, but `ctrShpMap` stays `'fNode'` on `plan.node.algorithm`
	// regardless - without `hubAlreadyStripped`, `arrangeCycle` re-detects a
	// SECOND, PHANTOM hub from the first entry of its own already-hub-free
	// `nodes` array. COM-verified against `radial-cycle--flat3.pptx`: this
	// corrupted every hub-bearing fixture (a bogus box-sized "hub" plus a
	// degenerate single leftover ring node instead of a real ring).
	it('hubAlreadyStripped=true treats every node as a ring node, even with ctrShpMap=fNode set', () => {
		const plan = planFor({
			algorithm: { type: 'cycle', parameters: [{ type: 'ctrShpMap', value: 'fNode' }] },
		});
		const alreadyStrippedSatellites = nodes(3); // the hub is NOT in this list
		const result = arrangeCycle(
			plan,
			alreadyStrippedSatellites,
			{ width: 200, height: 200 },
			['#fff'],
			'flat',
			'e',
			undefined,
			true,
		);
		// All 3 remain ring nodes - none pulled out as a phantom second hub.
		expect(result.nodes).toHaveLength(3);
		expect(result.nodes.map((n) => n.nodeId).sort()).toStrictEqual(['n0', 'n1', 'n2']);
	});

	// REGRESSION: `radial-list--hier5.pptx`'s own shape - THREE top-level
	// "node" data points (no separate top-level hub point `detectHubExpansion`
	// could strip, so `hubAlreadyStripped` is `false`), plus a SEPARATE,
	// always-present `centerShape` layoutNode named by the composite's own
	// `w for=ch forName=node ... refForName="centerShape"` constraint
	// (`resolveHubToNodeRatio`'s `hubRatio`). PowerPoint's cached drawing
	// renders all 3 "node" points as EQUAL-SIZED satellites with no
	// distinguishable 4th hub shape - `ctrShpMap="fNode"`'s runtime effect on
	// THIS forEach must be suppressed when the composite already names its own
	// hub this way, or `arrangeCycle` wrongly strips a real satellite into a
	// degenerate ring (COM-verified: `n` collapsed 3 -> 2 before this fix).
	it('a composite with its own named hub sibling (hubRatio resolved) never ALSO strips ctrShpMap="fNode" from its ring items', () => {
		const plan = planFor({
			name: 'cycle',
			algorithm: { type: 'cycle', parameters: [{ type: 'ctrShpMap', value: 'fNode' }] },
			constraints: [
				{
					type: 'w',
					for: 'ch',
					forName: 'node',
					referenceType: 'w',
					referenceFor: 'ch',
					referenceForName: 'centerShape',
					factor: 1.5,
				},
			],
			children: [
				{ name: 'centerShape' },
				{ name: 'node', forEachOrigin: { axis: ['self'], pointTypes: ['node'] } },
			],
		});
		const threeSatellites = nodes(3);
		const result = arrangeCycle(
			plan,
			threeSatellites,
			{ width: 200, height: 200 },
			['#fff'],
			'flat',
			'e',
		);
		// All 3 stay on the ring - none pulled out as a hub.
		expect(result.nodes).toHaveLength(3);
		expect(result.nodes.map((n) => n.nodeId).sort()).toStrictEqual(['n0', 'n1', 'n2']);
	});
});

// COM-verified against genuine PowerPoint output (real cached `dsp:sp`
// geometry, not a guess - see the module doc comment for the full
// derivation): `computeCycleRingLayout` must reproduce these two
// INDEPENDENTLY-different real layouts' node sizing exactly, not just one
// (ruling out a formula fit to a single sample).
describe('computeCycleRingLayout (COM-verified)', () => {
	const GALLERY_BOX = { width: 867, height: 533 };

	it('matches "basic-cycle--flat3.pptx" (sibSp fact=0.5, item h fact absent -> 1): w=347 h=232', () => {
		const ring = computeCycleRingLayout(3, 0, 360, 0.5, 1, GALLERY_BOX);
		expect(ring.nodeWidth).toBeCloseTo(347, 0);
		expect(ring.nodeHeight).toBeCloseTo(232, 0);
		// Alpha (index 0, "top" of the ring): cached box-local x=313-53=260,
		// y=120-120=0 (touches the box's own top edge exactly - real "Basic
		// Cycle" renders this "flower" of large overlapping ellipses, not small
		// dots on a thin ring). `computeCycleRingLayout`'s `BoundingBox` carries
		// no `x`/`y` offset (the caller adds the diagram's own origin), so these
		// are box-LOCAL, unlike the fixture's absolute slide coordinates.
		expect(ring.centers[0].x - ring.nodeWidth / 2).toBeCloseTo(260, 0);
		expect(ring.centers[0].y - ring.nodeHeight / 2).toBeCloseTo(0, 0);
	});

	it('matches "multidirectional-cycle--hier5.pptx" (sibSp fact=0.65, item h fact=0.5): w=327 h=138', () => {
		const ring = computeCycleRingLayout(3, 0, 360, 0.65, 0.5, GALLERY_BOX);
		expect(ring.nodeWidth).toBeCloseTo(327, 0);
		expect(ring.nodeHeight).toBeCloseTo(138, 0);
	});

	it("floors a smaller declared sibSp at the real engine minimum (nondirectional-cycle/block-cycle declare 0.15, but measure the SAME w=347 as basic-cycle's 0.5)", () => {
		// The caller (`resolveCycleRingParams`) is what applies the
		// `DEFAULT_MIN_GAP_RATIO` floor to a smaller declared `sibSp`; this
		// pins the OTHER half - that once floored to 0.5, cycle6-style layouts'
		// own declared 0.15 would have produced the wrong (403px) width.
		const floored = computeCycleRingLayout(3, 0, 360, 0.5, 1, GALLERY_BOX);
		const unfloored = computeCycleRingLayout(3, 0, 360, 0.15, 1, GALLERY_BOX);
		expect(floored.nodeWidth).toBeCloseTo(347, 0);
		expect(unfloored.nodeWidth).not.toBeCloseTo(347, 0);
	});

	it('degenerate 2-node ring: nodes touch the box top/bottom, not a wildly stretched ellipse', () => {
		// Documented approximation (see the module doc comment's `radial-cycle`
		// note): the natural pre-scale footprint is a single vertical line for
		// n=2, so there is no genuine horizontal spread to fit against. This
		// pins the DEFENSIVE fallback (isotropic on the degenerate axis)
		// against ever regressing to the old bug (naive box-width fill turning
		// a 2-node ring into an absurdly wide ellipse, `nodeWidth` far
		// exceeding the box itself).
		const ring = computeCycleRingLayout(2, 0, 360, 0.5, 1, GALLERY_BOX);
		expect(ring.nodeWidth).toBeLessThanOrEqual(GALLERY_BOX.width);
		expect(ring.centers[0].x).toBeCloseTo(ring.centers[1].x, 5);
	});

	it('a hub+ring composite\'s own r0 is governed by hubGeometry (hub-to-satellite gap), not the adjacent-satellite chord ("basic-radial--hier5.pptx": hubRatio factor=1, sp fact=0.3 refFor "node" -> hubGapRatio=0.3 -> r0=0.5+0.3+0.5=1.3, vs the chord-only r0=0.866 from sibSp=0.5 floored)', () => {
		// COM-verified: `basic-radial--hier5.pptx`'s 3 satellites measured
		// w=266 h=180 (0.19% delta from cached) with this hub-aware r0; the
		// OLD chord-only r0 (sibSp-only) gave w=347 h=232, a uniform ~30%
		// oversize on every ring node (see `smartart-layout-interpreter-
		// cycle-hub-ratio.ts`'s `resolveHubGapRatio` doc comment for the full
		// distance-based derivation).
		const withoutHub = computeCycleRingLayout(3, 0, 360, 0.5, 1, GALLERY_BOX);
		const withHub = computeCycleRingLayout(3, 0, 360, 0.5, 1, GALLERY_BOX, undefined, {
			factor: 1,
			gapRatio: 0.3,
		});
		expect(withoutHub.nodeWidth).toBeCloseTo(347, 0);
		expect(withHub.nodeWidth).toBeCloseTo(266, -1);
		expect(withHub.nodeHeight).toBeCloseTo(180, -1);
	});

	it('hubGeometry never shrinks r0 BELOW the adjacent-satellite chord minimum (sibSp is a genuine floor, not overridden by a smaller hub gap)', () => {
		// A hub geometry implying a SMALLER r0 than the chord-based minimum
		// (e.g. a tiny hub with almost no gap) must not violate the
		// already-established minimum spacing between adjacent satellites.
		const chordOnly = computeCycleRingLayout(3, 0, 360, 0.5, 1, GALLERY_BOX);
		const tinyHub = computeCycleRingLayout(3, 0, 360, 0.5, 1, GALLERY_BOX, undefined, {
			factor: 10,
			gapRatio: 0.01,
		});
		expect(tinyHub.nodeWidth).toBeCloseTo(chordOnly.nodeWidth, 0);
	});
});
