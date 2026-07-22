/**
 * Fidelity verification corpus for the SmartArt DiagramML layout interpreter
 * (sign-off evidence for issue #94).
 *
 * For each algorithm family the interpreter targets, a representative layout
 * definition (parsed through the production `parseSmartArtLayoutDefinition`) plus
 * a set of data nodes is run through `interpretSmartArtLayout`, and STRUCTURAL
 * fidelity is asserted - node count, ordering/direction, in-bounds geometry,
 * sibling non-overlap, and connector topology. Not pixel-parity with PowerPoint.
 *
 * This file covers the families live in the current interpreter (lin, snake,
 * cycle, pyra, hierarchy) - every assertion here passes now. Composite and conn
 * fidelity lives in `smartart-layout-interpreter-fidelity-integration.test.ts`,
 * gated until the sibling arrangers are wired into the dispatcher.
 */

import type { PptxSmartArtLayoutDefinition, PptxSmartArtNode } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { interpretSmartArtLayout } from './smartart-layout-interpreter';
import {
	BOX,
	circlesOf,
	contentNodes,
	cycleDef,
	halfCycleDef,
	hierarchyDef,
	ID,
	linearDef,
	oneLevelTree,
	PALETTE,
	polygonsOf,
	pyramidDef,
	rectsOf,
	snakeDef,
	STYLE,
	verticalListDef,
} from './smartart-layout-interpreter-fidelity-fixtures';
import {
	circlesSeparated,
	connectorEndpointsWithin,
	maxRectOverlapFraction,
	nodesWithinViewBox,
	parseViewBox,
} from './smartart-layout-interpreter-fidelity-geometry';

function run(
	def: PptxSmartArtLayoutDefinition,
	nodes: PptxSmartArtNode[],
	flat: PptxSmartArtNode[] = nodes,
) {
	const layout = interpretSmartArtLayout({
		layoutDefinition: def,
		nodes,
		flat,
		box: BOX,
		palette: PALETTE,
		style: STYLE,
		elementId: ID,
	});
	expect(layout).toBeDefined();
	return layout!;
}

// ── Linear (lin) ──────────────────────────────────────────────────────────────

describe('fidelity: linear (lin)', () => {
	it('places one rect per content node, left-to-right, sharing a row', () => {
		const nodes = contentNodes(4);
		const layout = run(linearDef(), nodes);
		const boxes = rectsOf(layout.nodes);
		expect(boxes).toHaveLength(4);
		for (let i = 1; i < boxes.length; i++) {
			expect(boxes[i].x).toBeGreaterThan(boxes[i - 1].x);
			expect(boxes[i].y).toBeCloseTo(boxes[0].y, 5);
		}
		expect(layout.family).toBe('list');
	});

	it('reverses direction for a top-to-bottom vertical list', () => {
		const nodes = contentNodes(3);
		const layout = run(verticalListDef(), nodes);
		const boxes = rectsOf(layout.nodes);
		expect(boxes[1].y).toBeGreaterThan(boxes[0].y);
		expect(boxes[0].x).toBeCloseTo(boxes[1].x, 5);
	});

	it('keeps every rect inside the viewBox and non-overlapping', () => {
		const layout = run(linearDef(), contentNodes(5));
		const { w, h } = parseViewBox(layout.viewBox);
		expect(nodesWithinViewBox(layout.nodes, w, h)).toBeTruthy();
		expect(maxRectOverlapFraction(rectsOf(layout.nodes))).toBeLessThan(0.02);
	});
});

// ── Snake ───────────────────────────────────────────────────────────────────

describe('fidelity: snake', () => {
	it('wraps points into a non-overlapping grid inside bounds', () => {
		const layout = run(snakeDef(), contentNodes(6));
		const boxes = rectsOf(layout.nodes);
		expect(boxes).toHaveLength(6);
		expect(layout.family).toBe('matrix');
		const { w, h } = parseViewBox(layout.viewBox);
		expect(nodesWithinViewBox(layout.nodes, w, h)).toBeTruthy();
		expect(maxRectOverlapFraction(boxes)).toBeLessThan(0.02);
	});

	it('advances to a second row once the first row fills', () => {
		const boxes = rectsOf(run(snakeDef(), contentNodes(6)).nodes);
		const ys = new Set(boxes.map((b) => Math.round(b.y)));
		expect(ys.size).toBeGreaterThan(1);
	});
});

// ── Cycle ───────────────────────────────────────────────────────────────────

describe('fidelity: cycle', () => {
	it('spaces points equidistant on a ring around the centre', () => {
		const layout = run(cycleDef(), contentNodes(5));
		const pts = circlesOf(layout.nodes);
		expect(pts).toHaveLength(5);
		const cx = BOX.width / 2;
		const cy = BOX.height / 2;
		const radii = pts.map((p) => Math.hypot(p.cx - cx, p.cy - cy));
		for (const r of radii) {
			expect(r).toBeCloseTo(radii[0], 3);
		}
		expect(layout.family).toBe('cycle');
	});

	it('starts the first point above centre for stAng 0', () => {
		const first = circlesOf(run(cycleDef(), contentNodes(4)).nodes)[0];
		expect(first.cy).toBeLessThan(BOX.height / 2);
		expect(first.cx).toBeCloseTo(BOX.width / 2, 3);
	});

	it('links a full ring with one connector per node, endpoints in bounds', () => {
		const layout = run(cycleDef(), contentNodes(4));
		expect(layout.connectors).toHaveLength(4);
		const { w, h } = parseViewBox(layout.viewBox);
		expect(connectorEndpointsWithin(layout.connectors, w, h)).toBeTruthy();
		expect(circlesSeparated(circlesOf(layout.nodes))).toBeTruthy();
	});

	it('opens the ring (n-1 connectors) for a partial 180 span', () => {
		const layout = run(halfCycleDef(), contentNodes(4));
		expect(layout.connectors).toHaveLength(3);
	});
});

// ── Pyramid (pyra) ─────────────────────────────────────────────────────────────

describe('fidelity: pyramid (pyra)', () => {
	it('stacks one trapezoid band per node, top-to-bottom, within bounds', () => {
		const layout = run(pyramidDef(), contentNodes(4));
		const polys = polygonsOf(layout.nodes);
		expect(polys).toHaveLength(4);
		for (let i = 1; i < polys.length; i++) {
			expect(polys[i].textY).toBeGreaterThan(polys[i - 1].textY);
		}
		expect(layout.family).toBe('pyramid');
		const { w, h } = parseViewBox(layout.viewBox);
		expect(nodesWithinViewBox(layout.nodes, w, h)).toBeTruthy();
	});

	it('widens each successive band toward the base', () => {
		const polys = polygonsOf(run(pyramidDef(), contentNodes(4)).nodes);
		const widthAt = (idx: number): number => {
			const xs = polys[idx].points.split(/\s+/u).map((p) => Number(p.split(',')[0]));
			return Math.max(...xs) - Math.min(...xs);
		};
		expect(widthAt(polys.length - 1)).toBeGreaterThan(widthAt(0));
	});
});

// ── Hierarchy (hierRoot / hierChild) ────────────────────────────────────────────

describe('fidelity: hierarchy', () => {
	const nested = oneLevelTree(3);
	const flat = [
		{ id: '1', text: 'Root' },
		{ id: '2', text: 'Child 1' },
		{ id: '3', text: 'Child 2' },
	];

	it('places the root above its children with one edge per child', () => {
		const layout = run(hierarchyDef(), nested, flat);
		const boxes = rectsOf(layout.nodes);
		expect(boxes).toHaveLength(3);
		const root = boxes.find((b) => b.key.includes('-hier-1-'))!;
		const childA = boxes.find((b) => b.key.includes('-hier-2-'))!;
		expect(root.y).toBeLessThan(childA.y);
		expect(layout.connectors).toHaveLength(2);
		expect(layout.family).toBe('hierarchy');
	});

	it('keeps nodes in bounds and non-overlapping, connectors in bounds', () => {
		const layout = run(hierarchyDef(), nested, flat);
		const { w, h } = parseViewBox(layout.viewBox);
		expect(nodesWithinViewBox(layout.nodes, w, h)).toBeTruthy();
		expect(maxRectOverlapFraction(rectsOf(layout.nodes))).toBeLessThan(0.02);
		expect(connectorEndpointsWithin(layout.connectors, w, h)).toBeTruthy();
	});
});

// ── Degenerate / overflow node-count sweep ──────────────────────────────────────

describe('fidelity: node-count sweep', () => {
	const COUNTS = [1, 2, 5, 12] as const;
	const flatFamilies: Array<{ name: string; def: () => PptxSmartArtLayoutDefinition }> = [
		{ name: 'linear', def: linearDef },
		{ name: 'vertical', def: verticalListDef },
		{ name: 'snake', def: snakeDef },
		{ name: 'pyramid', def: pyramidDef },
	];

	for (const family of flatFamilies) {
		for (const count of COUNTS) {
			it(`${family.name} places ${count} nodes in bounds`, () => {
				const layout = run(family.def(), contentNodes(count));
				expect(layout.nodes).toHaveLength(count);
				const { w, h } = parseViewBox(layout.viewBox);
				expect(nodesWithinViewBox(layout.nodes, w, h)).toBeTruthy();
				expect(maxRectOverlapFraction(rectsOf(layout.nodes))).toBeLessThan(0.05);
			});
		}
	}

	for (const count of COUNTS) {
		it(`cycle places ${count} nodes on a separated ring`, () => {
			const layout = run(cycleDef(), contentNodes(count));
			expect(layout.nodes).toHaveLength(count);
			const { w, h } = parseViewBox(layout.viewBox);
			expect(nodesWithinViewBox(layout.nodes, w, h)).toBeTruthy();
			expect(connectorEndpointsWithin(layout.connectors, w, h)).toBeTruthy();
			if (count > 1) {
				expect(circlesSeparated(circlesOf(layout.nodes))).toBeTruthy();
			}
		});

		it(`hierarchy places a ${count}-node tree in bounds`, () => {
			const layout = run(hierarchyDef(), oneLevelTree(count), contentNodes(count));
			expect(rectsOf(layout.nodes)).toHaveLength(count);
			const { w, h } = parseViewBox(layout.viewBox);
			expect(nodesWithinViewBox(layout.nodes, w, h)).toBeTruthy();
			expect(connectorEndpointsWithin(layout.connectors, w, h)).toBeTruthy();
		});
	}
});
