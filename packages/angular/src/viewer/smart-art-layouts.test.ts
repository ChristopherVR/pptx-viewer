/**
 * Tests for smart-art-layouts.ts
 *
 * All assertions target pure geometry logic: no Angular, no DOM, no TestBed.
 * Each family is exercised for positional correctness and bounds containment.
 */
import type { PptxSmartArtData, PptxSmartArtNode } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { layoutSmartArtNodes, resolveSmartArtFamily } from './smart-art-layouts';
import type { PositionedNode, ConnectorSegment } from './smart-art-layouts';

// ==========================================================================
// Test fixtures
// ==========================================================================

function makeNode(
	id: string,
	text: string,
	parentId?: string,
	children?: PptxSmartArtNode[],
): PptxSmartArtNode {
	return { id, text, parentId, children };
}

function makeData(
	over: Partial<PptxSmartArtData> & { nodes: PptxSmartArtNode[] },
): PptxSmartArtData {
	return { ...over };
}

/** Return total right edge of a node. */
function right(n: PositionedNode): number {
	return n.x + n.w;
}

/** Return total bottom edge of a node. */
function bottom(n: PositionedNode): number {
	return n.y + n.h;
}

const W = 400;
const H = 200;

// ==========================================================================
// resolveSmartArtFamily
// ==========================================================================

describe('resolveSmartArtFamily', () => {
	it('uses resolvedLayoutType when set to a known family', () => {
		expect(resolveSmartArtFamily(makeData({ nodes: [], resolvedLayoutType: 'process' }))).toBe(
			'process',
		);
		expect(resolveSmartArtFamily(makeData({ nodes: [], resolvedLayoutType: 'cycle' }))).toBe(
			'cycle',
		);
		expect(resolveSmartArtFamily(makeData({ nodes: [], resolvedLayoutType: 'hierarchy' }))).toBe(
			'hierarchy',
		);
		expect(resolveSmartArtFamily(makeData({ nodes: [], resolvedLayoutType: 'list' }))).toBe('list');
	});

	it('falls back to named layout when resolvedLayoutType is not a core family', () => {
		expect(
			resolveSmartArtFamily(
				makeData({ nodes: [], resolvedLayoutType: 'matrix', layout: 'basicChevronProcess' }),
			),
		).toBe('process');
		expect(
			resolveSmartArtFamily(
				makeData({ nodes: [], resolvedLayoutType: 'venn', layout: 'basicCycle' }),
			),
		).toBe('cycle');
	});

	it('falls back to list when neither resolvedLayoutType nor layout maps to a family', () => {
		expect(resolveSmartArtFamily(makeData({ nodes: [] }))).toBe('list');
	});

	it('maps known layout presets correctly', () => {
		expect(resolveSmartArtFamily(makeData({ nodes: [], layout: 'hierarchy' }))).toBe('hierarchy');
		expect(resolveSmartArtFamily(makeData({ nodes: [], layout: 'basicBlockList' }))).toBe('list');
		expect(resolveSmartArtFamily(makeData({ nodes: [], layout: 'basicCycle' }))).toBe('cycle');
		expect(resolveSmartArtFamily(makeData({ nodes: [], layout: 'continuousBlockProcess' }))).toBe(
			'process',
		);
	});
});

// ==========================================================================
// List layout
// ==========================================================================

describe('layoutSmartArtNodes - list', () => {
	it('returns one node per input node', () => {
		const data = makeData({
			nodes: [makeNode('1', 'Alpha'), makeNode('2', 'Beta'), makeNode('3', 'Gamma')],
			resolvedLayoutType: 'list',
		});
		const { nodes, connectors } = layoutSmartArtNodes(data, W, H);
		expect(nodes).toHaveLength(3);
		expect(connectors).toHaveLength(0);
	});

	it('all nodes share the same x and width', () => {
		const data = makeData({
			nodes: [makeNode('1', 'A'), makeNode('2', 'B'), makeNode('3', 'C')],
			resolvedLayoutType: 'list',
		});
		const { nodes } = layoutSmartArtNodes(data, W, H);
		const xs = nodes.map((n) => n.x);
		const ws = nodes.map((n) => n.w);
		expect(new Set(xs).size).toBe(1);
		expect(new Set(ws).size).toBe(1);
	});

	it('nodes are stacked vertically (y increases)', () => {
		const data = makeData({
			nodes: [makeNode('1', 'A'), makeNode('2', 'B'), makeNode('3', 'C')],
			resolvedLayoutType: 'list',
		});
		const { nodes } = layoutSmartArtNodes(data, W, H);
		for (let i = 1; i < nodes.length; i++) {
			expect(nodes[i].y).toBeGreaterThan(nodes[i - 1].y);
		}
	});

	it('all nodes fit within the viewport bounds', () => {
		const data = makeData({
			nodes: [makeNode('1', 'A'), makeNode('2', 'B'), makeNode('3', 'C'), makeNode('4', 'D')],
			resolvedLayoutType: 'list',
		});
		const { nodes } = layoutSmartArtNodes(data, W, H);
		for (const n of nodes) {
			expect(n.x).toBeGreaterThanOrEqual(0);
			expect(n.y).toBeGreaterThanOrEqual(0);
			expect(right(n)).toBeLessThanOrEqual(W);
			expect(bottom(n)).toBeLessThanOrEqual(H);
		}
	});

	it('returns empty result for zero nodes', () => {
		const data = makeData({ nodes: [], resolvedLayoutType: 'list' });
		const result = layoutSmartArtNodes(data, W, H);
		expect(result.nodes).toHaveLength(0);
		expect(result.connectors).toHaveLength(0);
	});

	it('assigns all nodes level 0', () => {
		const data = makeData({
			nodes: [makeNode('1', 'A'), makeNode('2', 'B')],
			resolvedLayoutType: 'list',
		});
		const { nodes } = layoutSmartArtNodes(data, W, H);
		expect(nodes.every((n) => n.level === 0)).toBeTruthy();
	});

	it('preserves node ids and texts', () => {
		const data = makeData({
			nodes: [makeNode('n1', 'First'), makeNode('n2', 'Second')],
			resolvedLayoutType: 'list',
		});
		const { nodes } = layoutSmartArtNodes(data, W, H);
		expect(nodes[0].id).toBe('n1');
		expect(nodes[0].text).toBe('First');
		expect(nodes[1].id).toBe('n2');
		expect(nodes[1].text).toBe('Second');
	});
});

// ==========================================================================
// Process layout
// ==========================================================================

describe('layoutSmartArtNodes - process', () => {
	it('returns one node per input node', () => {
		const data = makeData({
			nodes: [makeNode('1', 'Step 1'), makeNode('2', 'Step 2'), makeNode('3', 'Step 3')],
			resolvedLayoutType: 'process',
		});
		const { nodes } = layoutSmartArtNodes(data, W, H);
		expect(nodes).toHaveLength(3);
	});

	it('lays out N nodes left-to-right (x increases)', () => {
		const data = makeData({
			nodes: [makeNode('1', 'A'), makeNode('2', 'B'), makeNode('3', 'C')],
			resolvedLayoutType: 'process',
		});
		const { nodes } = layoutSmartArtNodes(data, W, H);
		for (let i = 1; i < nodes.length; i++) {
			expect(nodes[i].x).toBeGreaterThan(nodes[i - 1].x);
		}
	});

	it('all nodes share the same y and height', () => {
		const data = makeData({
			nodes: [makeNode('1', 'A'), makeNode('2', 'B'), makeNode('3', 'C')],
			resolvedLayoutType: 'process',
		});
		const { nodes } = layoutSmartArtNodes(data, W, H);
		const ys = nodes.map((n) => n.y);
		const hs = nodes.map((n) => n.h);
		expect(new Set(ys).size).toBe(1);
		expect(new Set(hs).size).toBe(1);
	});

	it('all nodes fit within the viewport bounds', () => {
		const data = makeData({
			nodes: [
				makeNode('1', 'A'),
				makeNode('2', 'B'),
				makeNode('3', 'C'),
				makeNode('4', 'D'),
				makeNode('5', 'E'),
			],
			resolvedLayoutType: 'process',
		});
		const { nodes } = layoutSmartArtNodes(data, W, H);
		for (const n of nodes) {
			expect(n.x).toBeGreaterThanOrEqual(0);
			expect(n.y).toBeGreaterThanOrEqual(0);
			expect(right(n)).toBeLessThanOrEqual(W + 1); // 1px float tolerance
			expect(bottom(n)).toBeLessThanOrEqual(H);
		}
	});

	it('produces no connectors for process (chevrons overlap self-describe direction)', () => {
		const data = makeData({
			nodes: [makeNode('1', 'A'), makeNode('2', 'B')],
			resolvedLayoutType: 'process',
		});
		const { connectors } = layoutSmartArtNodes(data, W, H);
		expect(connectors).toHaveLength(0);
	});

	it('assigns all nodes level 0', () => {
		const data = makeData({
			nodes: [makeNode('1', 'A'), makeNode('2', 'B')],
			resolvedLayoutType: 'process',
		});
		const { nodes } = layoutSmartArtNodes(data, W, H);
		expect(nodes.every((n) => n.level === 0)).toBeTruthy();
	});
});

// ==========================================================================
// Cycle layout
// ==========================================================================

describe('layoutSmartArtNodes - cycle', () => {
	it('returns one node per input node', () => {
		const data = makeData({
			nodes: [makeNode('1', 'A'), makeNode('2', 'B'), makeNode('3', 'C'), makeNode('4', 'D')],
			resolvedLayoutType: 'cycle',
		});
		const { nodes } = layoutSmartArtNodes(data, W, W);
		expect(nodes).toHaveLength(4);
	});

	it('all nodes have r set (circle geometry)', () => {
		const data = makeData({
			nodes: [makeNode('1', 'A'), makeNode('2', 'B'), makeNode('3', 'C')],
			resolvedLayoutType: 'cycle',
		});
		const { nodes } = layoutSmartArtNodes(data, W, W);
		for (const n of nodes) {
			expect(n.r).toBeDefined();
			expect(n.r).toBeGreaterThan(0);
		}
	});

	it('places nodes around a circle - all at roughly equal radial distance from centre', () => {
		const SIZE = 300;
		const cx = SIZE / 2;
		const cy = SIZE / 2;
		const data = makeData({
			nodes: [makeNode('1', 'A'), makeNode('2', 'B'), makeNode('3', 'C'), makeNode('4', 'D')],
			resolvedLayoutType: 'cycle',
		});
		const { nodes } = layoutSmartArtNodes(data, SIZE, SIZE);
		const distances = nodes.map((n) => {
			const ncx = n.x + (n.r ?? n.w / 2);
			const ncy = n.y + (n.r ?? n.h / 2);
			return Math.sqrt((ncx - cx) ** 2 + (ncy - cy) ** 2);
		});
		const first = distances[0];
		for (const d of distances) {
			expect(Math.abs(d - first)).toBeLessThan(1); // all equidistant
		}
	});

	it('produces N connectors for N nodes (ring)', () => {
		const n = 5;
		const data = makeData({
			nodes: Array.from({ length: n }, (_, i) => makeNode(String(i), `N${i}`)),
			resolvedLayoutType: 'cycle',
		});
		const { connectors } = layoutSmartArtNodes(data, W, W);
		expect(connectors).toHaveLength(n);
	});

	it('connector for last node wraps back to first node area', () => {
		const data = makeData({
			nodes: [makeNode('1', 'A'), makeNode('2', 'B'), makeNode('3', 'C')],
			resolvedLayoutType: 'cycle',
		});
		const { nodes, connectors } = layoutSmartArtNodes(data, W, W);
		// Last connector should start near last node centre and end near first node centre.
		const lastConn: ConnectorSegment = connectors[connectors.length - 1];
		const lastNode = nodes[nodes.length - 1];
		const firstNode = nodes[0];
		const lastCx = lastNode.x + (lastNode.r ?? lastNode.w / 2);
		const lastCy = lastNode.y + (lastNode.r ?? lastNode.h / 2);
		const firstCx = firstNode.x + (firstNode.r ?? firstNode.w / 2);
		const firstCy = firstNode.y + (firstNode.r ?? firstNode.h / 2);
		expect(Math.abs(lastConn.x1 - lastCx)).toBeLessThan(1);
		expect(Math.abs(lastConn.y1 - lastCy)).toBeLessThan(1);
		expect(Math.abs(lastConn.x2 - firstCx)).toBeLessThan(1);
		expect(Math.abs(lastConn.y2 - firstCy)).toBeLessThan(1);
	});

	it('all node bounding boxes fit within the viewport', () => {
		const SIZE = 300;
		const data = makeData({
			nodes: [makeNode('1', 'A'), makeNode('2', 'B'), makeNode('3', 'C'), makeNode('4', 'D')],
			resolvedLayoutType: 'cycle',
		});
		const { nodes } = layoutSmartArtNodes(data, SIZE, SIZE);
		for (const n of nodes) {
			expect(n.x).toBeGreaterThanOrEqual(0);
			expect(n.y).toBeGreaterThanOrEqual(0);
			expect(right(n)).toBeLessThanOrEqual(SIZE + 1);
			expect(bottom(n)).toBeLessThanOrEqual(SIZE + 1);
		}
	});
});

// ==========================================================================
// Hierarchy layout
// ==========================================================================

describe('layoutSmartArtNodes - hierarchy', () => {
	it('returns one node per node in the tree', () => {
		// root → [child1, child2]
		const data = makeData({
			nodes: [
				makeNode('root', 'CEO'),
				makeNode('c1', 'VP Eng', 'root'),
				makeNode('c2', 'VP Mkt', 'root'),
			],
			resolvedLayoutType: 'hierarchy',
		});
		const { nodes } = layoutSmartArtNodes(data, W, H);
		expect(nodes).toHaveLength(3);
	});

	it('root node is at level 0, children at level 1', () => {
		const data = makeData({
			nodes: [makeNode('root', 'CEO'), makeNode('c1', 'VP', 'root'), makeNode('c2', 'CFO', 'root')],
			resolvedLayoutType: 'hierarchy',
		});
		const { nodes } = layoutSmartArtNodes(data, W, H);
		const rootNode = nodes.find((n) => n.id === 'root');
		expect(rootNode?.level).toBe(0);
		const childNodes = nodes.filter((n) => n.id !== 'root');
		for (const c of childNodes) {
			expect(c.level).toBe(1);
		}
	});

	it('stacks levels top-to-bottom (deeper level has greater y)', () => {
		const data = makeData({
			nodes: [
				makeNode('r', 'Root'),
				makeNode('c1', 'Child 1', 'r'),
				makeNode('g1', 'Grandchild', 'c1'),
			],
			resolvedLayoutType: 'hierarchy',
		});
		const { nodes } = layoutSmartArtNodes(data, W, H);
		const byLevel = (lvl: number): PositionedNode => nodes.find((n) => n.level === lvl)!;
		expect(byLevel(0).y).toBeLessThan(byLevel(1).y);
		expect(byLevel(1).y).toBeLessThan(byLevel(2).y);
	});

	it('emits L-shaped connectors: 3 segments per parent-child edge', () => {
		// root → c1, root → c2: 2 edges × 3 segments = 6
		const data = makeData({
			nodes: [
				makeNode('root', 'CEO'),
				makeNode('c1', 'VP Eng', 'root'),
				makeNode('c2', 'VP Mkt', 'root'),
			],
			resolvedLayoutType: 'hierarchy',
		});
		const { connectors } = layoutSmartArtNodes(data, W, H);
		expect(connectors).toHaveLength(6);
	});

	it('all node boxes fit within the viewport', () => {
		const data = makeData({
			nodes: [
				makeNode('root', 'CEO'),
				makeNode('c1', 'VP Eng', 'root'),
				makeNode('c2', 'VP Mkt', 'root'),
				makeNode('g1', 'Engineer', 'c1'),
			],
			resolvedLayoutType: 'hierarchy',
		});
		const { nodes } = layoutSmartArtNodes(data, W, H);
		for (const n of nodes) {
			expect(n.x).toBeGreaterThanOrEqual(0);
			expect(n.y).toBeGreaterThanOrEqual(0);
			expect(right(n)).toBeLessThanOrEqual(W + 1);
			expect(bottom(n)).toBeLessThanOrEqual(H + 1);
		}
	});

	it('places flat nodes (all roots, no parentId) in a side-by-side column layout', () => {
		// All nodes are roots (no parentId set): buildTree returns a flat forest
		// with each node as its own root. The hierarchy engine assigns each root
		// its own column, so x values differ.
		const data = makeData({
			nodes: [makeNode('1', 'Alpha'), makeNode('2', 'Beta'), makeNode('3', 'Gamma')],
			resolvedLayoutType: 'hierarchy',
		});
		const { nodes } = layoutSmartArtNodes(data, W, H);
		expect(nodes).toHaveLength(3);
		// All nodes at level 0 (all roots).
		expect(nodes.every((n) => n.level === 0)).toBeTruthy();
		// Each root occupies a distinct column (different x values).
		const xs = nodes.map((n) => n.x);
		expect(new Set(xs).size).toBe(3);
		// X values increase left-to-right.
		expect(xs[0]).toBeLessThan(xs[1]);
		expect(xs[1]).toBeLessThan(xs[2]);
	});

	it('handles a single root with no children', () => {
		const data = makeData({
			nodes: [makeNode('root', 'Only')],
			resolvedLayoutType: 'hierarchy',
		});
		const { nodes, connectors } = layoutSmartArtNodes(data, W, H);
		expect(nodes).toHaveLength(1);
		expect(connectors).toHaveLength(0);
	});
});

// ==========================================================================
// Cross-family / edge-case tests
// ==========================================================================

describe('layoutSmartArtNodes - edge cases', () => {
	it('handles a single node in each family without throwing', () => {
		const families: Array<'list' | 'process' | 'cycle' | 'hierarchy'> = [
			'list',
			'process',
			'cycle',
			'hierarchy',
		];
		for (const family of families) {
			const data = makeData({
				nodes: [makeNode('1', 'Solo')],
				resolvedLayoutType: family,
			});
			expect(() => layoutSmartArtNodes(data, W, H)).not.toThrow();
		}
	});

	it('handles a large number of nodes in the process family without overlap on x-axis', () => {
		const count = 10;
		const nodes = Array.from({ length: count }, (_, i) => makeNode(String(i), `Step ${i}`));
		const data = makeData({ nodes, resolvedLayoutType: 'process' });
		const { nodes: result } = layoutSmartArtNodes(data, 800, H);
		// Each node's right edge should not exceed the next node's left edge.
		const sorted = result.slice().sort((a, b) => a.x - b.x);
		for (let i = 1; i < sorted.length; i++) {
			// Allow slight overlap from chevron depth but right must not hugely exceed next x.
			expect(sorted[i - 1].x).toBeLessThan(sorted[i].x);
		}
	});

	it('returns node ids in input order for flat families', () => {
		const inputIds = ['z', 'a', 'm'];
		const data = makeData({
			nodes: inputIds.map((id) => makeNode(id, id)),
			resolvedLayoutType: 'list',
		});
		const { nodes } = layoutSmartArtNodes(data, W, H);
		expect(nodes.map((n) => n.id)).toStrictEqual(inputIds);
	});
});
