/**
 * Unit tests for the SmartArt layout engine (smartart-layout.ts).
 *
 * These tests exercise the pure geometry functions — no Vue, no DOM.
 */

import type { PptxSmartArtNode } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildTree,
	colour,
	computeCycleLayout,
	computeFunnelLayout,
	computeHierarchyLayout,
	computeListLayout,
	computeMatrixLayout,
	computePyramidLayout,
	computeRadialLayout,
	computeSmartArtLayout,
	computeTargetLayout,
	computeVennLayout,
	computeProcessLayout,
	fitFontSize,
	flattenNodes,
	interpolateSmartArtPalette,
	nodeOpacity,
	resolveLayoutFamily,
	styleShadow,
	styleStroke,
	treeDepth,
	treeWidth,
	truncate,
} from './smartart-layout';

// ── Test helpers ──────────────────────────────────────────────────────────────

const PALETTE = ['#3b82f6', '#22c55e', '#f97316', '#eab308', '#a855f7'];
const BOX = { width: 400, height: 300 };
const STYLE = 'flat' as const;
const ID = 'el1';

function n(
	id: string,
	text: string,
	parentId?: string,
	children?: PptxSmartArtNode[],
): PptxSmartArtNode {
	return { id, text, parentId, children };
}

// ── Utility function tests ────────────────────────────────────────────────────

describe('colour', () => {
	it('returns the colour at the given index', () => {
		expect(colour(0, PALETTE)).toBe('#3b82f6');
		expect(colour(1, PALETTE)).toBe('#22c55e');
	});

	it('cycles when index >= palette length', () => {
		expect(colour(5, PALETTE)).toBe('#3b82f6'); // wraps back to 0
		expect(colour(6, PALETTE)).toBe('#22c55e');
	});
});

describe('truncate', () => {
	it('returns the original string if within limit', () => {
		expect(truncate('hello', 10)).toBe('hello');
	});

	it('appends ellipsis when over the limit', () => {
		const result = truncate('hello world', 7);
		expect(result).toHaveLength(7);
		expect(result.endsWith('…')).toBeTruthy();
	});
});

describe('fitFontSize', () => {
	it('respects baseSize cap', () => {
		// Very large box — should use baseSize
		expect(fitFontSize('Hi', 1000, 1000, 12)).toBe(12);
	});

	it('shrinks for very long text in a small box', () => {
		const size = fitFontSize('A very long piece of text that wont fit', 80, 30, 14);
		expect(size).toBeLessThan(14);
	});

	it('enforces 6 px minimum', () => {
		// Single character in a tiny box
		const size = fitFontSize('X', 1, 1, 12);
		expect(size).toBe(6);
	});
});

describe('styleShadow', () => {
	it('returns undefined for flat style', () => {
		expect(styleShadow('flat')).toBeUndefined();
	});

	it('returns a drop-shadow for intense', () => {
		const s = styleShadow('intense');
		expect(s).toContain('drop-shadow');
	});
});

describe('styleStroke', () => {
	it('returns 0 for flat', () => expect(styleStroke('flat')).toBe(0));
	it('returns 1.5 for moderate', () => expect(styleStroke('moderate')).toBe(1.5));
	it('returns 2 for intense', () => expect(styleStroke('intense')).toBe(2));
});

describe('nodeOpacity', () => {
	it('returns base opacity for single node', () => {
		expect(nodeOpacity(0, 1, 'flat')).toBe(0.85);
	});

	it('fades later nodes', () => {
		const first = nodeOpacity(0, 4, 'flat');
		const last = nodeOpacity(3, 4, 'flat');
		expect(last).toBeLessThan(first);
	});
});

// ── Tree helpers ──────────────────────────────────────────────────────────────

describe('buildTree', () => {
	it('builds a flat list (all roots) when no parentIds exist', () => {
		const nodes = [n('1', 'A'), n('2', 'B'), n('3', 'C')];
		const roots = buildTree(nodes);
		expect(roots).toHaveLength(3);
		expect(roots.every((r) => r.children.length === 0)).toBeTruthy();
	});

	it('builds a tree with parent–child relationships', () => {
		const nodes = [n('1', 'Root'), n('2', 'Child A', '1'), n('3', 'Child B', '1')];
		const roots = buildTree(nodes);
		expect(roots).toHaveLength(1);
		expect(roots[0].children).toHaveLength(2);
	});
});

describe('treeWidth', () => {
	it('returns 1 for a leaf node', () => {
		const tree = buildTree([n('1', 'A')]);
		expect(treeWidth(tree[0])).toBe(1);
	});

	it('sums child widths', () => {
		const nodes = [n('1', 'Root'), n('2', 'A', '1'), n('3', 'B', '1'), n('4', 'C', '1')];
		const tree = buildTree(nodes);
		expect(treeWidth(tree[0])).toBe(3);
	});
});

describe('treeDepth', () => {
	it('returns 1 for a leaf', () => {
		const tree = buildTree([n('1', 'A')]);
		expect(treeDepth(tree[0])).toBe(1);
	});

	it('measures depth correctly', () => {
		const nodes = [n('1', 'Root'), n('2', 'Child', '1'), n('3', 'Grandchild', '2')];
		const tree = buildTree(nodes);
		expect(treeDepth(tree[0])).toBe(3);
	});
});

describe('flattenNodes', () => {
	it('flattens a flat list as-is', () => {
		const nodes = [n('1', 'A'), n('2', 'B')];
		expect(flattenNodes(nodes)).toHaveLength(2);
	});

	it('depth-first flattens nested children', () => {
		const root: PptxSmartArtNode = {
			id: '1',
			text: 'Root',
			children: [n('2', 'Child A'), n('3', 'Child B')],
		};
		const result = flattenNodes([root]);
		expect(result).toHaveLength(3);
		expect(result[0].text).toBe('Root');
	});
});

// ── Layout family resolver ────────────────────────────────────────────────────

describe('resolveLayoutFamily', () => {
	const flatNodes = [n('1', 'A'), n('2', 'B')];

	it('resolves from named layout preset', () => {
		expect(resolveLayoutFamily(flatNodes, undefined, 'basicCycle')).toBe('cycle');
		expect(resolveLayoutFamily(flatNodes, undefined, 'basicMatrix')).toBe('matrix');
		expect(resolveLayoutFamily(flatNodes, undefined, 'hierarchy')).toBe('hierarchy');
	});

	it('resolves from resolvedLayoutType', () => {
		expect(resolveLayoutFamily(flatNodes, 'process')).toBe('process');
		expect(resolveLayoutFamily(flatNodes, 'cycle')).toBe('cycle');
		expect(resolveLayoutFamily(flatNodes, 'hierarchy')).toBe('hierarchy');
	});

	it('falls back to list for flat nodes with no layout info', () => {
		expect(resolveLayoutFamily(flatNodes)).toBe('list');
	});

	it('falls back to hierarchy when nodes have children', () => {
		const withChildren: PptxSmartArtNode[] = [
			{
				id: '1',
				text: 'Root',
				children: [n('2', 'Child')],
			},
		];
		expect(resolveLayoutFamily(withChildren)).toBe('hierarchy');
	});
});

// ── Per-family layout functions ───────────────────────────────────────────────

describe('computeListLayout', () => {
	const nodes = [n('1', 'Alpha'), n('2', 'Beta'), n('3', 'Gamma')];

	it('produces one rect node per input node', () => {
		const layout = computeListLayout(nodes, BOX, PALETTE, STYLE, ID);
		expect(layout.nodes).toHaveLength(3);
		expect(layout.nodes.every((nd) => nd.kind === 'rect')).toBeTruthy();
	});

	it('stacks nodes vertically (y increases)', () => {
		const layout = computeListLayout(nodes, BOX, PALETTE, STYLE, ID);
		const ys = layout.nodes.map((nd) => (nd.kind === 'rect' ? nd.y : 0));
		expect(ys[1]).toBeGreaterThan(ys[0]);
		expect(ys[2]).toBeGreaterThan(ys[1]);
	});

	it('sets family to list', () => {
		const layout = computeListLayout(nodes, BOX, PALETTE, STYLE, ID);
		expect(layout.family).toBe('list');
	});

	it('produces no connectors', () => {
		const layout = computeListLayout(nodes, BOX, PALETTE, STYLE, ID);
		expect(layout.connectors).toHaveLength(0);
	});
});

describe('computeProcessLayout', () => {
	const nodes = [n('1', 'Plan'), n('2', 'Build'), n('3', 'Ship')];

	it('produces one polygon node per input node', () => {
		const layout = computeProcessLayout(nodes, BOX, PALETTE, STYLE, ID);
		expect(layout.nodes).toHaveLength(3);
		expect(layout.nodes.every((nd) => nd.kind === 'polygon')).toBeTruthy();
	});

	it('lays out nodes left-to-right (textX increases)', () => {
		const layout = computeProcessLayout(nodes, BOX, PALETTE, STYLE, ID);
		const xs = layout.nodes.map((nd) => (nd.kind === 'polygon' ? nd.textX : 0));
		expect(xs[1]).toBeGreaterThan(xs[0]);
		expect(xs[2]).toBeGreaterThan(xs[1]);
	});

	it('sets family to process', () => {
		expect(computeProcessLayout(nodes, BOX, PALETTE, STYLE, ID).family).toBe('process');
	});
});

describe('computeCycleLayout', () => {
	const nodes = [n('1', 'A'), n('2', 'B'), n('3', 'C'), n('4', 'D')];

	it('produces one circle node per input node', () => {
		const layout = computeCycleLayout(nodes, BOX, PALETTE, STYLE, ID);
		expect(layout.nodes).toHaveLength(4);
		expect(layout.nodes.every((nd) => nd.kind === 'circle')).toBeTruthy();
	});

	it('produces one connector per node (forming a ring)', () => {
		const layout = computeCycleLayout(nodes, BOX, PALETTE, STYLE, ID);
		expect(layout.connectors).toHaveLength(4);
	});

	it('places nodes on a circle (varied cx/cy)', () => {
		const layout = computeCycleLayout(nodes, BOX, PALETTE, STYLE, ID);
		const cxs = layout.nodes.map((nd) => (nd.kind === 'circle' ? nd.cx : 0));
		// Not all cx values should be identical (circle spread)
		const unique = new Set(cxs.map((v) => Math.round(v)));
		expect(unique.size).toBeGreaterThan(1);
	});

	it('sets family to cycle', () => {
		expect(computeCycleLayout(nodes, BOX, PALETTE, STYLE, ID).family).toBe('cycle');
	});
});

describe('computeHierarchyLayout', () => {
	it('produces rect nodes for each node in a tree', () => {
		const nodes: PptxSmartArtNode[] = [
			n('1', 'Root'),
			n('2', 'Child A', '1'),
			n('3', 'Child B', '1'),
		];
		const layout = computeHierarchyLayout(nodes, BOX, PALETTE, STYLE, ID);
		expect(layout.nodes).toHaveLength(3);
		expect(layout.nodes.every((nd) => nd.kind === 'rect')).toBeTruthy();
	});

	it('produces L-shaped connectors between parent and children', () => {
		const nodes: PptxSmartArtNode[] = [
			n('1', 'Root'),
			n('2', 'Child A', '1'),
			n('3', 'Child B', '1'),
		];
		const layout = computeHierarchyLayout(nodes, BOX, PALETTE, STYLE, ID);
		// 2 children → 2 connectors
		expect(layout.connectors).toHaveLength(2);
	});

	it('parent node is above child nodes (y is smaller)', () => {
		const nodes: PptxSmartArtNode[] = [n('1', 'Root'), n('2', 'Child', '1')];
		const layout = computeHierarchyLayout(nodes, BOX, PALETTE, STYLE, ID);
		const rects = layout.nodes.filter((nd) => nd.kind === 'rect') as Array<{
			y: number;
			key: string;
		}>;
		const rootRect = rects.find((r) => r.key.includes('hier-1'));
		const childRect = rects.find((r) => r.key.includes('hier-2'));
		expect(rootRect).toBeDefined();
		expect(childRect).toBeDefined();
		expect(rootRect!.y).toBeLessThan(childRect!.y);
	});

	it('falls back to list when all nodes are flat', () => {
		// Flat nodes with no parentId → buildTree returns all as roots → list fallback
		const nodes = [n('1', 'A'), n('2', 'B'), n('3', 'C')];
		const layout = computeHierarchyLayout(nodes, BOX, PALETTE, STYLE, ID);
		// With all roots (no parent-child), hierarchy still renders all three
		expect(layout.nodes).toHaveLength(3);
	});

	it('sets family to hierarchy', () => {
		const nodes: PptxSmartArtNode[] = [n('1', 'Root'), n('2', 'Child', '1')];
		expect(computeHierarchyLayout(nodes, BOX, PALETTE, STYLE, ID).family).toBe('hierarchy');
	});
});

describe('computeMatrixLayout', () => {
	const nodes = [n('1', 'Q1'), n('2', 'Q2'), n('3', 'Q3'), n('4', 'Q4')];

	it('produces one rect per node', () => {
		const layout = computeMatrixLayout(nodes, BOX, PALETTE, STYLE, ID);
		expect(layout.nodes).toHaveLength(4);
	});

	it('arranges in a grid (different x and y positions)', () => {
		const layout = computeMatrixLayout(nodes, BOX, PALETTE, STYLE, ID);
		const rects = layout.nodes.filter((nd) => nd.kind === 'rect') as Array<{
			x: number;
			y: number;
		}>;
		const xs = new Set(rects.map((r) => Math.round(r.x)));
		const ys = new Set(rects.map((r) => Math.round(r.y)));
		// 4 nodes in a 2x2 grid → 2 unique x values, 2 unique y values
		expect(xs.size).toBe(2);
		expect(ys.size).toBe(2);
	});

	it('sets family to matrix', () => {
		expect(computeMatrixLayout(nodes, BOX, PALETTE, STYLE, ID).family).toBe('matrix');
	});
});

describe('computeRadialLayout', () => {
	const nodes = [n('1', 'Centre'), n('2', 'Sat A'), n('3', 'Sat B'), n('4', 'Sat C')];

	it('produces one circle per node', () => {
		const layout = computeRadialLayout(nodes, BOX, PALETTE, STYLE, ID);
		expect(layout.nodes).toHaveLength(4);
		expect(layout.nodes.every((nd) => nd.kind === 'circle')).toBeTruthy();
	});

	it('produces connectors from centre to each satellite', () => {
		const layout = computeRadialLayout(nodes, BOX, PALETTE, STYLE, ID);
		// 3 satellites → 3 connectors
		expect(layout.connectors).toHaveLength(3);
	});

	it('sets family to radial', () => {
		expect(computeRadialLayout(nodes, BOX, PALETTE, STYLE, ID).family).toBe('radial');
	});

	it('handles empty node array gracefully', () => {
		const layout = computeRadialLayout([], BOX, PALETTE, STYLE, ID);
		expect(layout.nodes).toHaveLength(0);
	});
});

describe('computePyramidLayout', () => {
	const nodes = [n('1', 'Top'), n('2', 'Middle'), n('3', 'Bottom')];

	it('produces one polygon per node', () => {
		const layout = computePyramidLayout(nodes, BOX, PALETTE, STYLE, ID);
		expect(layout.nodes).toHaveLength(3);
		expect(layout.nodes.every((nd) => nd.kind === 'polygon')).toBeTruthy();
	});

	it('sets family to pyramid', () => {
		expect(computePyramidLayout(nodes, BOX, PALETTE, STYLE, ID).family).toBe('pyramid');
	});
});

describe('computeVennLayout', () => {
	it('renders up to 4 nodes as radially-placed circles', () => {
		const nodes = [n('1', 'A'), n('2', 'B'), n('3', 'C')];
		const layout = computeVennLayout(nodes, BOX, PALETTE, STYLE, ID);
		expect(layout.nodes).toHaveLength(3);
		expect(layout.nodes.every((nd) => nd.kind === 'circle')).toBeTruthy();
	});

	it('handles 5+ nodes in horizontal layout', () => {
		const nodes = Array.from({ length: 6 }, (_, i) => n(String(i), `Item ${i}`));
		const layout = computeVennLayout(nodes, BOX, PALETTE, STYLE, ID);
		expect(layout.nodes).toHaveLength(6);
	});

	it('sets family to venn', () => {
		expect(computeVennLayout([n('1', 'A')], BOX, PALETTE, STYLE, ID).family).toBe('venn');
	});
});

describe('computeFunnelLayout', () => {
	const nodes = [n('1', 'Awareness'), n('2', 'Consideration'), n('3', 'Conversion')];

	it('produces one polygon per node', () => {
		const layout = computeFunnelLayout(nodes, BOX, PALETTE, STYLE, ID);
		expect(layout.nodes).toHaveLength(3);
		expect(layout.nodes.every((nd) => nd.kind === 'polygon')).toBeTruthy();
	});

	it('sets family to funnel', () => {
		expect(computeFunnelLayout(nodes, BOX, PALETTE, STYLE, ID).family).toBe('funnel');
	});
});

describe('computeTargetLayout', () => {
	const nodes = [n('1', 'Outer'), n('2', 'Middle'), n('3', 'Inner')];

	it('produces one circle per node', () => {
		const layout = computeTargetLayout(nodes, BOX, PALETTE, STYLE, ID);
		expect(layout.nodes).toHaveLength(3);
		expect(layout.nodes.every((nd) => nd.kind === 'circle')).toBeTruthy();
	});

	it('sets family to target', () => {
		expect(computeTargetLayout(nodes, BOX, PALETTE, STYLE, ID).family).toBe('target');
	});
});

// ── Main dispatcher ───────────────────────────────────────────────────────────

describe('computeSmartArtLayout (dispatcher)', () => {
	it('dispatches to list layout by default for flat nodes', () => {
		const layout = computeSmartArtLayout([n('1', 'A'), n('2', 'B')], BOX, PALETTE, STYLE, ID);
		expect(layout.family).toBe('list');
	});

	it('dispatches to cycle via resolvedLayoutType', () => {
		const layout = computeSmartArtLayout(
			[n('1', 'A'), n('2', 'B'), n('3', 'C')],
			BOX,
			PALETTE,
			STYLE,
			ID,
			'cycle',
		);
		expect(layout.family).toBe('cycle');
	});

	it('dispatches to process via named layout', () => {
		const layout = computeSmartArtLayout(
			[n('1', 'A'), n('2', 'B')],
			BOX,
			PALETTE,
			STYLE,
			ID,
			undefined,
			'basicChevronProcess',
		);
		expect(layout.family).toBe('process');
	});

	it('dispatches to hierarchy via named layout', () => {
		const layout = computeSmartArtLayout(
			[n('1', 'Root'), n('2', 'Child', '1')],
			BOX,
			PALETTE,
			STYLE,
			ID,
			undefined,
			'hierarchy',
		);
		expect(layout.family).toBe('hierarchy');
	});

	it('dispatches to matrix via resolvedLayoutType', () => {
		const nodes = [n('1', 'Q1'), n('2', 'Q2'), n('3', 'Q3'), n('4', 'Q4')];
		const layout = computeSmartArtLayout(nodes, BOX, PALETTE, STYLE, ID, 'matrix');
		expect(layout.family).toBe('matrix');
	});

	it('returns viewBox matching box dimensions', () => {
		const layout = computeSmartArtLayout([n('1', 'A')], BOX, PALETTE, STYLE, ID);
		expect(layout.viewBox).toBe(`0 0 ${BOX.width} ${BOX.height}`);
	});

	it('flattens nested nodes for non-hierarchy families', () => {
		const root: PptxSmartArtNode = {
			id: '1',
			text: 'Root',
			children: [n('2', 'Child A'), n('3', 'Child B')],
		};
		const layout = computeSmartArtLayout([root], BOX, PALETTE, STYLE, ID, 'list');
		// Should get 3 rendered nodes (root + 2 children flattened)
		expect(layout.nodes).toHaveLength(3);
	});
});

// ── Colour interpolation ──────────────────────────────────────────────────────

describe('interpolateSmartArtPalette', () => {
	it('returns [] for a zero count or empty palette', () => {
		expect(interpolateSmartArtPalette(['#fff'], 0)).toStrictEqual([]);
		expect(interpolateSmartArtPalette([], 3)).toStrictEqual([]);
	});

	it('cycles the palette by index when method is not span', () => {
		expect(interpolateSmartArtPalette(['#a', '#b'], 4, 'cycle')).toStrictEqual([
			'#a',
			'#b',
			'#a',
			'#b',
		]);
	});

	it('spans a two-colour palette into a per-node gradient', () => {
		const out = interpolateSmartArtPalette(['#000000', '#ffffff'], 5, 'span');
		expect(out).toHaveLength(5);
		// Endpoints preserved, interior interpolated and monotonic.
		expect(out[0]).toBe('#000000');
		expect(out[4]).toBe('#ffffff');
		expect(out[2]).not.toBe(out[0]);
		expect(out[2]).not.toBe(out[4]);
		expect(new Set(out).size).toBe(5);
	});

	it('does not interpolate when nodes fit within the palette (span, count<=len)', () => {
		expect(interpolateSmartArtPalette(['#a', '#b', '#c'], 3, 'span')).toStrictEqual([
			'#a',
			'#b',
			'#c',
		]);
	});
});

describe('computeSmartArtLayout — colour spread', () => {
	it('spreads a 3-colour palette across 3 list nodes', () => {
		const palette = ['#ff0000', '#00ff00', '#0000ff'];
		const layout = computeSmartArtLayout(
			[n('1', 'A'), n('2', 'B'), n('3', 'C')],
			BOX,
			palette,
			STYLE,
			ID,
			'list',
		);
		const fills = layout.nodes.map((node) => node.fill);
		expect(fills).toStrictEqual(palette);
		expect(new Set(fills).size).toBe(3);
	});

	it('expands the palette into a span gradient when interpolation is span', () => {
		const layout = computeSmartArtLayout(
			[n('1', 'A'), n('2', 'B'), n('3', 'C'), n('4', 'D'), n('5', 'E')],
			BOX,
			['#000000', '#ffffff'],
			STYLE,
			ID,
			'list',
			undefined,
			{ method: 'span' },
		);
		const fills = layout.nodes.map((node) => node.fill);
		expect(fills[0]).toBe('#000000');
		expect(fills[4]).toBe('#ffffff');
		expect(new Set(fills).size).toBe(5);
	});
});
