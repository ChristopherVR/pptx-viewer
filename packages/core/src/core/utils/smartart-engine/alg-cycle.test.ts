/**
 * Unit coverage for `arrangeCycle` (ECMA-376 Part 1, 21.4.2.x): pure ring
 * placement, tested directly against synthetic `EngineNode`s rather than a
 * full fixture load. `smartart-gallery-ground-truth.test.ts` (opt-in via
 * `SMARTART_GALLERY_GATE=1`) is the accuracy gate against real PowerPoint
 * output; this file locks in the ring math itself.
 */

import { describe, expect, it } from 'vitest';

import { arrangeCycle } from './alg-cycle';
import type { DataPoint } from './data-points';
import type { EngineNode } from './engine-node';
import type { LdConstraint } from './layout-def-types';

function selfConstraint(type: string, refType: string, fact: number): LdConstraint {
	return {
		type,
		for: 'self',
		ptType: 'all',
		refType,
		refFor: 'self',
		refPtType: 'all',
		op: 'none',
		val: 0,
		hasVal: false,
		fact,
	};
}

function child(point?: DataPoint, algType = 'sp'): EngineNode {
	return {
		name: 'item',
		point: point ?? { id: `p${Math.random()}`, type: 'node', children: [] },
		alg: { type: algType, params: {} },
		presOf: [],
		hasPresOf: false,
		constraints: [],
		rules: [],
		vars: {},
		children: [],
		order: 0,
		values: new Map(),
		minValues: new Map(),
		maxValues: new Map(),
		deferred: [],
		groups: [],
		rotation: 0,
	};
}

function cycleNode(n: number, params: Record<string, string> = {}): EngineNode {
	const node = child();
	node.alg = { type: 'cycle', params };
	node.box = { x: 0, y: 0, w: 400, h: 400 };
	node.children = Array.from({ length: n }, () => child());
	return node;
}

describe('arrangeCycle', () => {
	it('places every child on a circle around the box centre', () => {
		const node = cycleNode(4);
		arrangeCycle(node);
		const centre = { x: node.box!.x + node.box!.w / 2, y: node.box!.y + node.box!.h / 2 };
		const radii = node.children.map((c) => {
			const box = c.box!;
			const cx = box.x + box.w / 2;
			const cy = box.y + box.h / 2;
			return Math.hypot(cx - centre.x, cy - centre.y);
		});
		expect(radii.every((r) => r > 0)).toBeTruthy();
		expect(radii[0]).toBeCloseTo(radii[1], 5);
		expect(radii[1]).toBeCloseTo(radii[2], 5);
		expect(radii[2]).toBeCloseTo(radii[3], 5);
	});

	it("starts the first item at stAng, measured clockwise from 12 o'clock", () => {
		const node = cycleNode(4, { stAng: '90' });
		arrangeCycle(node);
		const centre = { x: node.box!.x + node.box!.w / 2, y: node.box!.y + node.box!.h / 2 };
		const first = node.children[0].box!;
		const fcx = first.x + first.w / 2;
		const fcy = first.y + first.h / 2;
		// stAng=90 (clockwise from the top) lands on the box's right edge.
		expect(fcx).toBeGreaterThan(centre.x);
		expect(fcy).toBeCloseTo(centre.y, 1);
	});

	it('keeps every ring item the same size', () => {
		const node = cycleNode(6);
		arrangeCycle(node);
		const sizes = node.children.map((c) => `${c.box!.w.toFixed(3)}x${c.box!.h.toFixed(3)}`);
		expect(new Set(sizes).size).toBe(1);
	});

	it('spans only spanAng across n-1 gaps for a partial arc', () => {
		const node = cycleNode(3, { stAng: '0', spanAng: '180' });
		arrangeCycle(node);
		// Translation cancels out of a DIFFERENCE between two centres, so the
		// turn angle between consecutive segments is exactly the ring's own
		// per-slot step (spanAng / (n - 1) = 90), regardless of where the
		// natural ring origin maps inside the box.
		const centreOf = (box: { x: number; y: number; w: number; h: number }): [number, number] => [
			box.x + box.w / 2,
			box.y + box.h / 2,
		];
		const [x0, y0] = centreOf(node.children[0].box!);
		const [x1, y1] = centreOf(node.children[1].box!);
		const [x2, y2] = centreOf(node.children[2].box!);
		const angle1 = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI;
		const angle2 = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
		const turn = ((angle2 - angle1 + 540) % 360) - 180;
		expect(turn).toBeCloseTo(90, 0);
	});

	it('collapses multiple presentation nodes for the same data point into one ring slot', () => {
		const node = child();
		node.alg = { type: 'cycle', params: {} };
		node.box = { x: 0, y: 0, w: 400, h: 400 };
		const point1: DataPoint = { id: 'a', type: 'node', children: [] };
		const point2: DataPoint = { id: 'b', type: 'node', children: [] };
		const dummy1 = child(point1);
		const real1 = child(point1);
		const dummy2 = child(point2);
		const real2 = child(point2);
		node.children = [dummy1, real1, dummy2, real2];
		arrangeCycle(node);
		expect(dummy1.box).toStrictEqual(real1.box);
		expect(dummy2.box).toStrictEqual(real2.box);
		// Two ring slots, opposite sides of the ring, not four crowded in.
		const dx = real1.box!.x - real2.box!.x;
		const dy = real1.box!.y - real2.box!.y;
		expect(Math.hypot(dx, dy)).toBeGreaterThan(1);
	});

	it('excludes sibTrans transitions (and their own connector-text label) from the ring count', () => {
		const node = child();
		node.alg = { type: 'cycle', params: {} };
		node.box = { x: 0, y: 0, w: 400, h: 400 };
		const item1 = child();
		const item2 = child();
		const transitionPoint: DataPoint = { id: 't', type: 'sibTrans', children: [] };
		const conn = child(transitionPoint, 'conn');
		// A transition's own label (`connectorText`) presents the SAME
		// sibTrans point but is not itself a `conn` node - filtering on
		// `alg.type !== 'conn'` alone would still miscount it as a ring item
		// (the bug measured against `basic-cycle--flat3.pptx`).
		const connectorText = child(transitionPoint, 'tx');
		node.children = [item1, conn, connectorText, item2];
		arrangeCycle(node);
		expect(item1.box).toBeDefined();
		expect(item2.box).toBeDefined();
		// A 2-item ring puts the items on opposite sides, not crowded 4-wide.
		const dx = item1.box!.x - item2.box!.x;
		const dy = item1.box!.y - item2.box!.y;
		expect(Math.hypot(dx, dy)).toBeGreaterThan(1);
		// Not counted as a ring slot, but still given a real (non-degenerate)
		// box: the connector-routing pass reads its box.h as a fallback
		// thickness before repositioning it from the shapes it joins.
		expect(conn.box).toBeDefined();
		expect(conn.box!.w).toBeGreaterThan(0);
		expect(conn.box!.h).toBeGreaterThan(0);
		expect(connectorText.box).toBeDefined();
	});

	it('respects the declared h:w aspect for ring item size', () => {
		const node = cycleNode(4);
		node.children[0].constraints = [selfConstraint('h', 'w', 0.5)];
		arrangeCycle(node);
		const box = node.children[0].box!;
		expect(box.h / box.w).toBeCloseTo(0.5, 3);
	});

	it('centres a ctrShpMap="fNode" hub and rings the rest', () => {
		// 5 groups: 1 hub + a symmetric 4-item ring, so the natural ring
		// centre coincides with the box's own geometric centre.
		const node = cycleNode(5, { ctrShpMap: 'fNode' });
		arrangeCycle(node);
		const [hub, ...ring] = node.children;
		const centre = { x: node.box!.x + node.box!.w / 2, y: node.box!.y + node.box!.h / 2 };
		const hubCx = hub.box!.x + hub.box!.w / 2;
		const hubCy = hub.box!.y + hub.box!.h / 2;
		expect(hubCx).toBeCloseTo(centre.x, 1);
		expect(hubCy).toBeCloseTo(centre.y, 1);
		expect(ring).toHaveLength(4);
		for (const item of ring) {
			expect(item.box).toBeDefined();
		}
	});

	it('rotates ring items to the path tangent when rotPath is alongPath', () => {
		const node = cycleNode(4, { rotPath: 'alongPath' });
		arrangeCycle(node);
		const rotations = node.children.map((c) => c.rotation);
		expect(new Set(rotations.map((r) => r.toFixed(2))).size).toBe(4);
		const noRotationNode = cycleNode(4);
		arrangeCycle(noRotationNode);
		expect(noRotationNode.children.every((c) => c.rotation === 0)).toBeTruthy();
	});

	it('fills the whole box for a single ring item', () => {
		const node = cycleNode(1);
		arrangeCycle(node);
		const box = node.children[0].box!;
		expect(box.w).toBeCloseTo(400, 5);
	});

	it('does not touch a node with no box or no ring items', () => {
		const withoutBox = child();
		withoutBox.alg = { type: 'cycle', params: {} };
		withoutBox.children = [child()];
		expect(() => arrangeCycle(withoutBox)).not.toThrow();
		expect(withoutBox.children[0].box).toBeUndefined();

		const empty = cycleNode(0);
		expect(() => arrangeCycle(empty)).not.toThrow();
	});
});
