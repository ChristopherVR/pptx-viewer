/**
 * Tests for the Angular SmartArt inspector logic.
 *
 * The Angular package's vitest setup has no Angular compiler,
 * so component/TestBed rendering is not exercised here. Instead these tests
 * target the pure helper layer in `smart-art-properties-helpers.ts` plus the
 * `editor-insert.ts` re-exports of the core editing ops, which together carry
 * 100% of the inspector's editing behaviour (the component is a thin shell that
 * only forwards events to these helpers and emits their result).
 */
import type { PptxSmartArtData, PptxSmartArtNode } from 'pptx-viewer-core';
import { resetSmartArtEditCounter } from 'pptx-viewer-core';
import { beforeEach, describe, expect, it } from 'vitest';

import {
	addSmartArtNode,
	addSmartArtNodeAsChild,
	demoteSmartArtNode,
	promoteSmartArtNode,
	removeSmartArtNode,
	reorderSmartArtNode,
	switchSmartArtLayout,
	SWITCHABLE_LAYOUT_TYPES,
	updateSmartArtNodeText,
} from './editor-insert';
import {
	addItem,
	addSubItem,
	currentColorScheme,
	currentLayout,
	currentStyle,
	demoteNode,
	DEFAULT_COLOR_SCHEME,
	DEFAULT_LAYOUT,
	DEFAULT_STYLE,
	isChildNode,
	moveNodeDown,
	moveNodeUp,
	promoteNode,
	removeNode,
	setColorScheme,
	setLayout,
	setNodeText,
	setStyle,
	SMART_ART_COLOR_SCHEMES,
	SMART_ART_STYLE_OPTIONS,
	smartArtNodes,
} from './smart-art-properties-helpers';

// ── Fixtures ─────────────────────────────────────────────────────────────────

function node(id: string, text: string, parentId?: string): PptxSmartArtNode {
	return { id, text, parentId };
}

/** A flat 3-node list diagram. */
function flatData(): PptxSmartArtData {
	return {
		resolvedLayoutType: 'list',
		nodes: [node('a', 'Alpha'), node('b', 'Bravo'), node('c', 'Charlie')],
	};
}

/** A diagram with one parent and two children. */
function nestedData(): PptxSmartArtData {
	return {
		resolvedLayoutType: 'hierarchy',
		nodes: [
			node('root', 'Root'),
			node('child1', 'Child 1', 'root'),
			node('child2', 'Child 2', 'root'),
		],
	};
}

beforeEach(() => {
	resetSmartArtEditCounter();
});

// ── Re-export surface ─────────────────────────────────────────────────────────

describe('editor-insert SmartArt re-exports', () => {
	it('re-exports every editing op from pptx-viewer-core', () => {
		expect(addSmartArtNode).toBeTypeOf('function');
		expect(addSmartArtNodeAsChild).toBeTypeOf('function');
		expect(removeSmartArtNode).toBeTypeOf('function');
		expect(updateSmartArtNodeText).toBeTypeOf('function');
		expect(reorderSmartArtNode).toBeTypeOf('function');
		expect(promoteSmartArtNode).toBeTypeOf('function');
		expect(demoteSmartArtNode).toBeTypeOf('function');
		expect(switchSmartArtLayout).toBeTypeOf('function');
	});

	it('re-exports the switchable layout list', () => {
		expect(SWITCHABLE_LAYOUT_TYPES.length).toBeGreaterThan(0);
		expect(SWITCHABLE_LAYOUT_TYPES).toContain('process');
		expect(SWITCHABLE_LAYOUT_TYPES).toContain('list');
	});
});

// ── Option constants ──────────────────────────────────────────────────────────

describe('option constants', () => {
	it('exposes five colour schemes including colorful1', () => {
		expect(SMART_ART_COLOR_SCHEMES).toContain('colorful1');
		expect(SMART_ART_COLOR_SCHEMES).toHaveLength(5);
	});

	it('exposes the three style intensities', () => {
		expect([...SMART_ART_STYLE_OPTIONS]).toStrictEqual(['flat', 'moderate', 'intense']);
	});
});

// ── Read helpers ──────────────────────────────────────────────────────────────

describe('read helpers', () => {
	it('smartArtNodes returns the node list', () => {
		expect(smartArtNodes(flatData())).toHaveLength(3);
	});

	it('smartArtNodes tolerates a missing node list', () => {
		const empty = { nodes: undefined } as unknown as PptxSmartArtData;
		expect(smartArtNodes(empty)).toStrictEqual([]);
	});

	it('isChildNode reflects the presence of a parentId', () => {
		expect(isChildNode(node('x', 'X'))).toBeFalsy();
		expect(isChildNode(node('x', 'X', 'p'))).toBeTruthy();
	});

	it('falls back to defaults when scheme/style/layout are unset', () => {
		const bare: PptxSmartArtData = { nodes: [] };
		expect(currentColorScheme(bare)).toBe(DEFAULT_COLOR_SCHEME);
		expect(currentStyle(bare)).toBe(DEFAULT_STYLE);
		expect(currentLayout(bare)).toBe(DEFAULT_LAYOUT);
	});

	it('reads explicit scheme/style/layout when present', () => {
		const data: PptxSmartArtData = {
			nodes: [],
			colorScheme: 'colorful3',
			style: 'intense',
			resolvedLayoutType: 'cycle',
		};
		expect(currentColorScheme(data)).toBe('colorful3');
		expect(currentStyle(data)).toBe('intense');
		expect(currentLayout(data)).toBe('cycle');
	});
});

// ── Node add ──────────────────────────────────────────────────────────────────

describe('addItem / addSubItem', () => {
	it('addItem appends a top-level node', () => {
		const next = addItem(flatData());
		expect(next.nodes).toHaveLength(4);
		expect(next.nodes[3].parentId).toBeUndefined();
	});

	it('addItem returns a new immutable object', () => {
		const data = flatData();
		const next = addItem(data);
		expect(next).not.toBe(data);
		expect(data.nodes).toHaveLength(3);
	});

	it('addSubItem adds a child under the given parent with the Sub-item label', () => {
		const next = addSubItem(flatData(), 'a');
		const added = next.nodes.find((n) => n.parentId === 'a');
		expect(added).toBeDefined();
		expect(added?.text).toBe('Sub-item');
	});

	it('addItem clears drawingShapes to force reflow', () => {
		const data: PptxSmartArtData = { ...flatData(), drawingShapes: [] };
		expect(addItem(data).drawingShapes).toBeUndefined();
	});
});

// ── Node text ─────────────────────────────────────────────────────────────────

describe('setNodeText', () => {
	it('updates the targeted node only', () => {
		const next = setNodeText(flatData(), 'b', 'Renamed');
		expect(next.nodes.find((n) => n.id === 'b')?.text).toBe('Renamed');
		expect(next.nodes.find((n) => n.id === 'a')?.text).toBe('Alpha');
	});

	it('leaves the input data untouched (immutability)', () => {
		const data = flatData();
		setNodeText(data, 'a', 'Changed');
		expect(data.nodes.find((n) => n.id === 'a')?.text).toBe('Alpha');
	});
});

// ── Node remove ───────────────────────────────────────────────────────────────

describe('removeNode', () => {
	it('removes a node by id', () => {
		const next = removeNode(flatData(), 'b');
		expect(next.nodes.map((n) => n.id)).toStrictEqual(['a', 'c']);
	});

	it('refuses to remove the last remaining node', () => {
		const single: PptxSmartArtData = { nodes: [node('only', 'Only')] };
		const next = removeNode(single, 'only');
		expect(next).toBe(single);
		expect(next.nodes).toHaveLength(1);
	});

	it('re-parents children of a removed parent to the root', () => {
		const next = removeNode(nestedData(), 'root');
		expect(next.nodes.find((n) => n.id === 'child1')?.parentId).toBeUndefined();
		expect(next.nodes.find((n) => n.id === 'child2')?.parentId).toBeUndefined();
	});
});

// ── Promote / demote ──────────────────────────────────────────────────────────

describe('promoteNode / demoteNode', () => {
	it('promote lifts a child to its parent level', () => {
		const next = promoteNode(nestedData(), 'child1');
		expect(next.nodes.find((n) => n.id === 'child1')?.parentId).toBeUndefined();
	});

	it('promote on a root node is a no-op', () => {
		const data = nestedData();
		expect(promoteNode(data, 'root')).toBe(data);
	});

	it('demote nests a node under its preceding sibling', () => {
		const next = demoteNode(flatData(), 'b');
		expect(next.nodes.find((n) => n.id === 'b')?.parentId).toBe('a');
	});

	it('demote on the first sibling is a no-op', () => {
		const data = flatData();
		expect(demoteNode(data, 'a')).toBe(data);
	});

	it('promote then demote round-trips the parentId', () => {
		const promoted = promoteNode(nestedData(), 'child2');
		expect(promoted.nodes.find((n) => n.id === 'child2')?.parentId).toBeUndefined();
		const demoted = demoteNode(promoted, 'child2');
		expect(demoted.nodes.find((n) => n.id === 'child2')?.parentId).toBe('root');
	});
});

// ── Reorder ───────────────────────────────────────────────────────────────────

describe('moveNodeUp / moveNodeDown', () => {
	it('moveNodeDown swaps a node with the next sibling', () => {
		const next = moveNodeDown(flatData(), 'a');
		expect(next.nodes.map((n) => n.id)).toStrictEqual(['b', 'a', 'c']);
	});

	it('moveNodeUp swaps a node with the previous sibling', () => {
		const next = moveNodeUp(flatData(), 'c');
		expect(next.nodes.map((n) => n.id)).toStrictEqual(['a', 'c', 'b']);
	});

	it('moveNodeUp on the first sibling is a no-op', () => {
		const data = flatData();
		expect(moveNodeUp(data, 'a')).toBe(data);
	});

	it('moveNodeDown on the last sibling is a no-op', () => {
		const data = flatData();
		expect(moveNodeDown(data, 'c')).toBe(data);
	});
});

// ── Colour scheme / style ─────────────────────────────────────────────────────

describe('setColorScheme / setStyle', () => {
	it('setColorScheme applies the chosen scheme', () => {
		expect(setColorScheme(flatData(), 'monochromatic1').colorScheme).toBe('monochromatic1');
	});

	it('setStyle applies the chosen intensity', () => {
		expect(setStyle(flatData(), 'intense').style).toBe('intense');
	});

	it('setColorScheme and setStyle clear drawingShapes', () => {
		const data: PptxSmartArtData = { ...flatData(), drawingShapes: [] };
		expect(setColorScheme(data, 'colorful2').drawingShapes).toBeUndefined();
		expect(setStyle(data, 'moderate').drawingShapes).toBeUndefined();
	});
});

// ── Layout switch ─────────────────────────────────────────────────────────────

describe('setLayout', () => {
	it('switches to a new layout while preserving nodes', () => {
		const next = setLayout(flatData(), 'cycle');
		expect(next.resolvedLayoutType).toBe('cycle');
		expect(next.nodes.map((n) => n.id)).toStrictEqual(['a', 'b', 'c']);
	});

	it('returns the same object when the layout is unchanged', () => {
		const data = flatData(); // resolvedLayoutType: 'list'
		expect(setLayout(data, 'list')).toBe(data);
	});

	it('can switch through every switchable layout type', () => {
		for (const layout of SWITCHABLE_LAYOUT_TYPES) {
			const next = setLayout(flatData(), layout);
			expect(next.resolvedLayoutType).toBe(layout);
			expect(next.nodes).toHaveLength(3);
		}
	});
});
