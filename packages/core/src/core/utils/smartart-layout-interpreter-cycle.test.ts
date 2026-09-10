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

// Live-COM-verified against genuine PowerPoint output (round 11/SESSION 8
// correction: PowerPoint does NOT scale cached SmartArt to the frame - it
// places constraint-sized content, centred when smaller than the frame; a
// PRIOR "anisotropic fill-to-box" model here was measured against a reader
// bug and reproduced no real output - see `smartart-decompose.test.ts`'s own
// "matches live PowerPoint COM geometry" describe block and this file's
// module doc comment for the full correction history and the three
// independent measurement methods). `computeCycleRingLayout` must reproduce
// these real layouts' node sizing, not a guess.
describe('computeCycleRingLayout (live-COM-verified)', () => {
	const GALLERY_BOX = { width: 867, height: 533 };

	it('matches "basic-cycle--flat3.pptx" (sibSp fact=0.5, item h fact absent -> 1): a TRUE CIRCLE, cached 231.90x231.90 (three independent COM methods agree)', () => {
		const ring = computeCycleRingLayout(3, 0, 360, 0.5, 1, GALLERY_BOX);
		expect(ring.nodeWidth).toBeCloseTo(231.9, 0);
		expect(ring.nodeHeight).toBeCloseTo(231.9, 0);
		expect(ring.nodeWidth).toBeCloseTo(ring.nodeHeight, 6);
	});

	it('matches "multidirectional-cycle--hier5.pptx" (sibSp fact=0.65, item h fact=0.5): w=276 h=138, cached delta 0.00% (gate-verified)', () => {
		const ring = computeCycleRingLayout(3, 0, 360, 0.65, 0.5, GALLERY_BOX);
		expect(ring.nodeWidth).toBeCloseTo(276, 0);
		expect(ring.nodeHeight).toBeCloseTo(138, 0);
	});

	it('a smaller declared sibSp still resolves to a genuinely DIFFERENT (larger) size once floored at the real engine minimum by the caller (`resolveCycleRingParams`, not this function) - this pins that the UNFLOORED 0.15 itself produces a different footprint than the floored 0.5, so the caller-side floor is load-bearing', () => {
		const floored = computeCycleRingLayout(3, 0, 360, 0.5, 1, GALLERY_BOX);
		const unfloored = computeCycleRingLayout(3, 0, 360, 0.15, 1, GALLERY_BOX);
		expect(unfloored.nodeWidth).not.toBeCloseTo(floored.nodeWidth, 0);
	});

	it('degenerate 2-node ring: a bounded circle, not a wildly stretched ellipse', () => {
		// The natural pre-scale footprint is a single vertical line for n=2 (no
		// horizontal spread at all); the isotropic contain fit handles this
		// gracefully by construction (the degenerate axis's own candidate scale
		// is effectively infinite, so the OTHER axis's finite scale always
		// wins) - no special-casing needed, unlike the old anisotropic model.
		const ring = computeCycleRingLayout(2, 0, 360, 0.5, 1, GALLERY_BOX);
		expect(ring.nodeWidth).toBeLessThanOrEqual(GALLERY_BOX.width);
		expect(ring.nodeWidth).toBeCloseTo(ring.nodeHeight, 6);
		expect(ring.centers[0].x).toBeCloseTo(ring.centers[1].x, 5);
	});

	it('a hub+ring composite\'s own r0 is governed by hubGeometry (hub-to-satellite gap), not the adjacent-satellite chord ("basic-radial--hier5.pptx": hubRatio factor=1, sp fact=0.3 -> hubGapRatio=0.3 -> r0=0.5+0.3+0.5=1.3, vs the chord-only r0=0.866 from sibSp=0.5 floored) - a SMALLER r0 shrinks the resulting node size', () => {
		// COM-verified: `basic-radial--hier5.pptx`'s 4 satellites are cached as
		// perfect circles at 179.28x179.28 (0.38% delta from this hub-aware r0's
		// own 180.68px, via the full `arrangeCycle` pipeline including its own
		// `hubGapRatio` resolution - not reproduced digit-for-digit by this
		// isolated call, which uses a simplified hand-picked `hubGeometry`, but
		// the SHAPE (a true circle, meaningfully smaller than the hub-less
		// chord-only r0) is the load-bearing fact this test pins).
		const withoutHub = computeCycleRingLayout(3, 0, 360, 0.5, 1, GALLERY_BOX);
		const withHub = computeCycleRingLayout(3, 0, 360, 0.5, 1, GALLERY_BOX, undefined, {
			factor: 1,
			gapRatio: 0.3,
		});
		expect(withHub.nodeWidth).toBeLessThan(withoutHub.nodeWidth);
		expect(withHub.nodeWidth).toBeCloseTo(180.7, 0);
		expect(withHub.nodeWidth).toBeCloseTo(withHub.nodeHeight, 6);
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

// G20: `radial-cluster--hier5.pptx`'s own construct - a ring point whose data
// node has children continues outward as further ring points (recursively) -
// see `smartart-layout-interpreter-cycle-extension.ts`'s module doc comment
// (`hasMaxDepthGuard`) for the two-condition gate this describe block pins.
describe('arrangeCycle ring point extension', () => {
	// `radial-cluster`'s own resolved arranger (`singleCycle`) is reached
	// through exactly one enclosing `dgm:if func="maxDepth"` - see
	// `hasMaxDepthGuard`'s own doc comment for the corpus-wide derivation.
	function maxDepthGuardedPlan(): ArrangementPlan {
		return planFor({
			algorithm: { type: 'cycle' },
			chooseGuard: [{ function: 'maxDepth', operator: 'lte', value: '1' }],
		});
	}

	it("renders a ring point's own children as further points, continuing outward from the ring centre, when the arranger is BOTH hub-stripped AND maxDepth-guarded (radial-cluster's own shape)", () => {
		const childrenOf = new Map<string, PptxSmartArtNode[]>([['n1', [{ id: 'gc', text: 'GC' }]]]);
		const result = arrangeCycle(
			maxDepthGuardedPlan(),
			nodes(3),
			{ width: 200, height: 200 },
			['#fff'],
			'flat',
			'e',
			undefined,
			true,
			childrenOf,
		);
		expect(result.nodes.map((n) => n.nodeId)).toContain('gc');
		expect(result.nodes).toHaveLength(4);
	});

	it("does NOT extend a PLAIN (non-hub) ring even when maxDepth-guarded and a ring point's data node happens to have children - COM-verified regression: several hier5/hier8 corpus fixtures (basic-cycle, continuous-cycle, ...) give a plain ring point unrelated extra children the cached drawing folds/drops, not renders as new points", () => {
		const childrenOf = new Map<string, PptxSmartArtNode[]>([['n1', [{ id: 'gc', text: 'GC' }]]]);
		const result = arrangeCycle(
			maxDepthGuardedPlan(),
			nodes(3),
			{ width: 200, height: 200 },
			['#fff'],
			'flat',
			'e',
			undefined,
			false,
			childrenOf,
		);
		expect(result.nodes.map((n) => n.nodeId)).not.toContain('gc');
		expect(result.nodes).toHaveLength(3);
	});

	it("does NOT extend a hub-stripped ring that is NOT maxDepth-guarded, even when a satellite's data node has children - COM-verified regression: radial-cycle--hier5.pptx is ALSO hub-stripped with the IDENTICAL 'one satellite has one child' data shape radial-cluster--hier5.pptx uses, but its cached drawing FOLDS the child's text into the satellite's own box instead of rendering it separately (its layoutDef declares zero func=\"maxDepth\" conditions anywhere)", () => {
		const plan = planFor({ algorithm: { type: 'cycle' } }); // no chooseGuard at all
		const childrenOf = new Map<string, PptxSmartArtNode[]>([['n1', [{ id: 'gc', text: 'GC' }]]]);
		const result = arrangeCycle(
			plan,
			nodes(3),
			{ width: 200, height: 200 },
			['#fff'],
			'flat',
			'e',
			undefined,
			true,
			childrenOf,
		);
		expect(result.nodes.map((n) => n.nodeId)).not.toContain('gc');
		expect(result.nodes).toHaveLength(3);
	});

	it('is a no-op when no ring point has children, even when hub-stripped and maxDepth-guarded', () => {
		const result = arrangeCycle(
			maxDepthGuardedPlan(),
			nodes(3),
			{ width: 200, height: 200 },
			['#fff'],
			'flat',
			'e',
			undefined,
			true,
			new Map(),
		);
		expect(result.nodes).toHaveLength(3);
	});
});
