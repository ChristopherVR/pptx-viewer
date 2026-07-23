/**
 * Unit tests for the SmartArt DiagramML layout interpreter.
 *
 * These exercise the real (partial) layout engine that walks a parsed
 * `dgm:layoutDef` for the common `dgm:alg` families - no framework, no DOM.
 */

import type {
	PptxSmartArtLayoutDefinition,
	PptxSmartArtLayoutNode,
	PptxSmartArtNode,
} from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { computeSmartArtLayout } from './smartart-layout';
import { interpretSmartArtLayout } from './smartart-layout-interpreter';
import {
	discoverArrangement,
	findConstraint,
	numericParam,
	ratioConstraint,
	resolveFlowDirection,
} from './smartart-layout-interpreter-model';
import type { RenderedCircleNode, RenderedRectNode } from './smartart-layout-types';

const PALETTE = ['#3b82f6', '#22c55e', '#f97316', '#eab308', '#a855f7'];
const BOX = { width: 400, height: 300 };
const STYLE = 'flat' as const;
const ID = 'el1';

function n(id: string, text: string, children?: PptxSmartArtNode[]): PptxSmartArtNode {
	return { id, text, children };
}

function def(rootNode: PptxSmartArtLayoutNode): PptxSmartArtLayoutDefinition {
	return { rootNode };
}

const rects = (nodes: ReadonlyArray<{ kind: string }>): RenderedRectNode[] =>
	nodes.filter((node): node is RenderedRectNode => node.kind === 'rect');
const circles = (nodes: ReadonlyArray<{ kind: string }>): RenderedCircleNode[] =>
	nodes.filter((node): node is RenderedCircleNode => node.kind === 'circle');

// ── Model helpers ─────────────────────────────────────────────────────────────

describe('discoverArrangement', () => {
	it('returns undefined when no recognised algorithm is present', () => {
		const plan = discoverArrangement(def({ algorithm: { type: 'sp' } }));
		expect(plan).toBeUndefined();
	});

	it('picks the first recognised primary algorithm', () => {
		const plan = discoverArrangement(
			def({ algorithm: { type: 'composite' }, children: [{ algorithm: { type: 'lin' } }] }),
		);
		expect(plan?.kind).toBe('linear');
	});

	it('prefers hierarchy whenever a hierRoot/hierChild alg exists', () => {
		const plan = discoverArrangement(
			def({ algorithm: { type: 'lin' }, children: [{ algorithm: { type: 'hierChild' } }] }),
		);
		expect(plan?.kind).toBe('hierarchy');
	});

	it('does not let a passive composite wrapper clobber its inner lin', () => {
		const plan = discoverArrangement(
			def({
				algorithm: { type: 'composite' },
				children: [{ algorithm: { type: 'lin' }, children: [{ algorithm: { type: 'tx' } }] }],
			}),
		);
		expect(plan?.kind).toBe('linear');
	});

	it('chooses composite when its child slots carry positioning constraints', () => {
		const plan = discoverArrangement(
			def({
				algorithm: { type: 'composite' },
				children: [
					{
						algorithm: { type: 'sp' },
						constraints: [
							{ type: 'l', referenceType: 'w', factor: 0 },
							{ type: 'w', referenceType: 'w', factor: 0.5 },
						],
					},
					{
						algorithm: { type: 'tx' },
						constraints: [
							{ type: 'l', referenceType: 'w', factor: 0.5 },
							{ type: 'w', referenceType: 'w', factor: 0.5 },
						],
					},
				],
			}),
		);
		expect(plan?.kind).toBe('composite');
	});

	it('recognises a dominant conn algorithm as the conn family', () => {
		const plan = discoverArrangement(
			def({ algorithm: { type: 'conn' }, children: [{ algorithm: { type: 'tx' } }] }),
		);
		expect(plan?.kind).toBe('conn');
	});

	it('declines a bare spacer with no slots or children', () => {
		expect(discoverArrangement(def({ algorithm: { type: 'sp' } }))).toBeUndefined();
	});

	it('prefers a structural lin over sibling conn/tx nodes', () => {
		const plan = discoverArrangement(
			def({
				algorithm: { type: 'lin' },
				children: [{ algorithm: { type: 'tx' } }, { algorithm: { type: 'conn' } }],
			}),
		);
		expect(plan?.kind).toBe('linear');
	});
});

describe('discoverArrangement choose evaluation', () => {
	// Root drives via a dgm:choose: cnt >= 4 -> cycle, otherwise -> lin. The
	// flattened children carry both branch algs (cycle first, so the blind path
	// would always pick cycle).
	const chooseDef = (): PptxSmartArtLayoutDefinition =>
		def({
			choose: [
				{
					when: [
						{
							function: 'cnt',
							operator: 'gte',
							value: '4',
							rawXml: { 'dgm:layoutNode': { 'dgm:alg': { '@_type': 'cycle' } } },
						},
					],
					otherwise: { rawXml: { 'dgm:layoutNode': { 'dgm:alg': { '@_type': 'lin' } } } },
				},
			],
			children: [{ algorithm: { type: 'cycle' } }, { algorithm: { type: 'lin' } }],
		});

	it('picks the otherwise branch (lin) below the count threshold', () => {
		expect(discoverArrangement(chooseDef(), 3)?.kind).toBe('linear');
	});

	it('picks the if branch (cycle) at or above the count threshold', () => {
		expect(discoverArrangement(chooseDef(), 5)?.kind).toBe('cycle');
	});

	it('keeps the blind first-alg behaviour when the count is unknown', () => {
		expect(discoverArrangement(chooseDef())?.kind).toBe('cycle');
	});
});

describe('ratioConstraint', () => {
	it('reads a factor when present', () => {
		expect(ratioConstraint([{ type: 'sibSp', factor: 0.4 }], ['sibSp', 'sp'], 0.2)).toBe(0.4);
	});

	it('treats a sub-1 absolute value as a ratio', () => {
		expect(ratioConstraint([{ type: 'sibSp', value: 0.3 }], ['sibSp'], 0.2)).toBe(0.3);
	});

	it('falls back when the constraint is absent', () => {
		expect(ratioConstraint([], ['sibSp'], 0.2)).toBe(0.2);
	});

	it('prefers a for="ch" constraint over an unscoped one of the same type', () => {
		expect(
			ratioConstraint(
				[
					{ type: 'sibSp', factor: 0.9 },
					{ type: 'sibSp', for: 'ch', factor: 0.2 },
				],
				['sibSp'],
				0.5,
			),
		).toBe(0.2);
	});

	it('clamps the ratio to a matching numeric-rule max when supplied', () => {
		expect(
			ratioConstraint([{ type: 'sibSp', factor: 0.8 }], ['sibSp'], 0.2, [
				{ type: 'sibSp', max: 0.3 },
			]),
		).toBe(0.3);
	});
});

describe('forEach point selection', () => {
	const nodes = [n('1', 'A'), n('2', 'B'), n('3', 'C')];

	function linWithForEach(
		forEach: PptxSmartArtLayoutNode['forEach'],
		flat: PptxSmartArtNode[],
	): RenderedRectNode[] {
		const layout = interpretSmartArtLayout({
			layoutDefinition: def({
				algorithm: { type: 'lin', parameters: [{ type: 'linDir', value: 'fromL' }] },
				forEach,
				children: [{ algorithm: { type: 'tx' } }],
			}),
			nodes: flat,
			flat,
			box: BOX,
			palette: PALETTE,
			style: STYLE,
			elementId: ID,
		});
		return rects(layout!.nodes);
	}

	it('drops the trailing node when the driving iterator sets hideLastTrans', () => {
		const boxes = linWithForEach(
			[{ axis: ['ch'], pointTypes: ['node'], hideLastTransition: [true] }],
			nodes,
		);
		expect(boxes).toHaveLength(2);
	});

	it('keeps every node when hideLastTrans is absent', () => {
		const boxes = linWithForEach([{ axis: ['ch'], pointTypes: ['node'] }], nodes);
		expect(boxes).toHaveLength(3);
	});

	it('limits the arranged points to the iterator count (cnt)', () => {
		const many = Array.from({ length: 5 }, (_, i) => n(String(i + 1), `Item ${i + 1}`));
		const boxes = linWithForEach([{ axis: ['ch'], pointTypes: ['node'], count: [3] }], many);
		expect(boxes).toHaveLength(3);
	});

	it('skips leading points for a 1-based start offset (st)', () => {
		const boxes = linWithForEach([{ axis: ['ch'], pointTypes: ['node'], start: [2] }], nodes);
		expect(boxes).toHaveLength(2);
		// Data node '1' is skipped; the first placed rect is node '2'.
		expect(boxes.some((b) => b.key.includes('-lin-1-'))).toBeFalsy();
		expect(boxes.some((b) => b.key.includes('-lin-2-'))).toBeTruthy();
	});
});

describe('resolveFlowDirection', () => {
	it('defaults to horizontal, forward', () => {
		expect(resolveFlowDirection({ algorithm: { type: 'lin' } }, undefined)).toStrictEqual({
			orientation: 'horizontal',
			reverse: false,
		});
	});

	it('reads vertical + reverse from linDir', () => {
		const node: PptxSmartArtLayoutNode = {
			algorithm: { type: 'lin', parameters: [{ type: 'linDir', value: 'fromB' }] },
		};
		expect(resolveFlowDirection(node, undefined)).toStrictEqual({
			orientation: 'vertical',
			reverse: true,
		});
	});

	it('flips order when presLayoutVars direction is reversed', () => {
		expect(
			resolveFlowDirection({ algorithm: { type: 'lin' } }, { direction: 'rev' }).reverse,
		).toBeTruthy();
	});
});

describe('findConstraint / numericParam', () => {
	it('finds a constraint by type and relationship', () => {
		const found = findConstraint([{ type: 'w', for: 'ch' }], 'w', 'ch');
		expect(found).toBeDefined();
	});

	it('reads a numeric algorithm parameter with fallback', () => {
		const node: PptxSmartArtLayoutNode = {
			algorithm: { type: 'cycle', parameters: [{ type: 'stAng', value: '45' }] },
		};
		expect(numericParam(node, 'stAng', 0)).toBe(45);
		expect(numericParam(node, 'spanAng', 360)).toBe(360);
	});
});

// ── Linear (lin) ──────────────────────────────────────────────────────────────

describe('interpret lin', () => {
	const linDef = def({
		algorithm: { type: 'lin', parameters: [{ type: 'linDir', value: 'fromL' }] },
		constraints: [{ type: 'sibSp', factor: 0.5 }],
		children: [
			{ algorithm: { type: 'tx' }, constraints: [{ type: 'h', referenceType: 'w', factor: 0.5 }] },
		],
	});
	const nodes = [n('1', 'A'), n('2', 'B'), n('3', 'C')];

	it('produces one horizontally-spaced rect per point', () => {
		const layout = interpretSmartArtLayout({
			layoutDefinition: linDef,
			nodes,
			flat: nodes,
			box: BOX,
			palette: PALETTE,
			style: STYLE,
			elementId: ID,
		});
		expect(layout).toBeDefined();
		const boxes = rects(layout!.nodes);
		expect(boxes).toHaveLength(3);
		expect(boxes[1].x).toBeGreaterThan(boxes[0].x);
		expect(boxes[2].x).toBeGreaterThan(boxes[1].x);
		// All share the same row (equal y).
		expect(boxes[0].y).toBeCloseTo(boxes[2].y, 5);
		expect(layout!.family).toBe('list');
	});

	it('honours the sibSp gap constraint (gap ≈ 0.5 × item width)', () => {
		const layout = interpretSmartArtLayout({
			layoutDefinition: linDef,
			nodes,
			flat: nodes,
			box: BOX,
			palette: PALETTE,
			style: STYLE,
			elementId: ID,
		});
		const boxes = rects(layout!.nodes);
		const gap = boxes[1].x - (boxes[0].x + boxes[0].width);
		expect(gap).toBeCloseTo(0.5 * boxes[0].width, 3);
	});

	it('honours the item h:w aspect constraint (h ≈ 0.5 × w)', () => {
		const layout = interpretSmartArtLayout({
			layoutDefinition: linDef,
			nodes,
			flat: nodes,
			box: BOX,
			palette: PALETTE,
			style: STYLE,
			elementId: ID,
		});
		const first = rects(layout!.nodes)[0];
		expect(first.height).toBeCloseTo(0.5 * first.width, 3);
	});

	it('reverses placement order for linDir fromR', () => {
		const revDef = def({
			algorithm: { type: 'lin', parameters: [{ type: 'linDir', value: 'fromR' }] },
			children: [{ algorithm: { type: 'tx' } }],
		});
		const layout = interpretSmartArtLayout({
			layoutDefinition: revDef,
			nodes,
			flat: nodes,
			box: BOX,
			palette: PALETTE,
			style: STYLE,
			elementId: ID,
		});
		const boxes = rects(layout!.nodes);
		// Data node '1' (key ...-lin-1-) should sit to the RIGHT of node '3'.
		const first = boxes.find((b) => b.key.includes('-lin-1-'))!;
		const third = boxes.find((b) => b.key.includes('-lin-3-'))!;
		expect(first.x).toBeGreaterThan(third.x);
	});

	it('stacks vertically for linDir fromT', () => {
		const vDef = def({
			algorithm: { type: 'lin', parameters: [{ type: 'linDir', value: 'fromT' }] },
			children: [{ algorithm: { type: 'tx' } }],
		});
		const layout = interpretSmartArtLayout({
			layoutDefinition: vDef,
			nodes,
			flat: nodes,
			box: BOX,
			palette: PALETTE,
			style: STYLE,
			elementId: ID,
		});
		const boxes = rects(layout!.nodes);
		expect(boxes[1].y).toBeGreaterThan(boxes[0].y);
		expect(boxes[0].x).toBeCloseTo(boxes[1].x, 5);
	});
});

// ── Cycle ───────────────────────────────────────────────────────────────────

describe('interpret cycle', () => {
	const cycleDef = def({
		algorithm: {
			type: 'cycle',
			parameters: [
				{ type: 'stAng', value: '0' },
				{ type: 'spanAng', value: '360' },
			],
		},
		children: [{ algorithm: { type: 'tx' } }],
	});
	const nodes = [n('1', 'A'), n('2', 'B'), n('3', 'C'), n('4', 'D')];

	it('arranges points equidistant around the box centre', () => {
		const layout = interpretSmartArtLayout({
			layoutDefinition: cycleDef,
			nodes,
			flat: nodes,
			box: BOX,
			palette: PALETTE,
			style: STYLE,
			elementId: ID,
		});
		const pts = circles(layout!.nodes);
		expect(pts).toHaveLength(4);
		const cx = BOX.width / 2;
		const cy = BOX.height / 2;
		const radii = pts.map((p) => Math.hypot(p.cx - cx, p.cy - cy));
		for (const r of radii) {
			expect(r).toBeCloseTo(radii[0], 3);
		}
		expect(layout!.family).toBe('cycle');
	});

	it('places the first point near the top for stAng 0', () => {
		const layout = interpretSmartArtLayout({
			layoutDefinition: cycleDef,
			nodes,
			flat: nodes,
			box: BOX,
			palette: PALETTE,
			style: STYLE,
			elementId: ID,
		});
		const first = circles(layout!.nodes)[0];
		expect(first.cy).toBeLessThan(BOX.height / 2);
		expect(first.cx).toBeCloseTo(BOX.width / 2, 3);
	});

	it('produces a full ring of connectors for a 360 span', () => {
		const layout = interpretSmartArtLayout({
			layoutDefinition: cycleDef,
			nodes,
			flat: nodes,
			box: BOX,
			palette: PALETTE,
			style: STYLE,
			elementId: ID,
		});
		expect(layout!.connectors).toHaveLength(4);
	});

	it('produces an open arc (n-1 connectors) for a partial span', () => {
		const partial = def({
			algorithm: {
				type: 'cycle',
				parameters: [{ type: 'spanAng', value: '180' }],
			},
			children: [{ algorithm: { type: 'tx' } }],
		});
		const layout = interpretSmartArtLayout({
			layoutDefinition: partial,
			nodes,
			flat: nodes,
			box: BOX,
			palette: PALETTE,
			style: STYLE,
			elementId: ID,
		});
		expect(layout!.connectors).toHaveLength(3);
	});
});

// ── Hierarchy ─────────────────────────────────────────────────────────────────

describe('interpret hierarchy', () => {
	const hierDef = def({
		algorithm: { type: 'hierRoot' },
		children: [{ algorithm: { type: 'hierChild' } }],
	});
	const nested = [n('1', 'Root', [n('2', 'Child A'), n('3', 'Child B')])];

	it('places the root above its children', () => {
		const layout = interpretSmartArtLayout({
			layoutDefinition: hierDef,
			nodes: nested,
			flat: [n('1', 'Root'), n('2', 'Child A'), n('3', 'Child B')],
			box: BOX,
			palette: PALETTE,
			style: STYLE,
			elementId: ID,
		});
		const boxes = rects(layout!.nodes);
		expect(boxes).toHaveLength(3);
		const root = boxes.find((b) => b.key.includes('-hier-1-'))!;
		const childA = boxes.find((b) => b.key.includes('-hier-2-'))!;
		expect(root.y).toBeLessThan(childA.y);
		expect(layout!.family).toBe('hierarchy');
	});

	it('draws one connector per parent-child edge', () => {
		const layout = interpretSmartArtLayout({
			layoutDefinition: hierDef,
			nodes: nested,
			flat: [n('1', 'Root'), n('2', 'A'), n('3', 'B')],
			box: BOX,
			palette: PALETTE,
			style: STYLE,
			elementId: ID,
		});
		expect(layout!.connectors).toHaveLength(2);
	});

	it('indents and stacks children for a hanging (hierBranch=l) tree', () => {
		const layout = interpretSmartArtLayout({
			layoutDefinition: hierDef,
			nodes: nested,
			flat: [n('1', 'Root'), n('2', 'A'), n('3', 'B')],
			box: BOX,
			palette: PALETTE,
			style: STYLE,
			elementId: ID,
			presLayoutVars: { hierarchyBranch: 'l' },
		});
		const boxes = rects(layout!.nodes);
		const root = boxes.find((b) => b.key.includes('-hier-1-'))!;
		const childA = boxes.find((b) => b.key.includes('-hier-2-'))!;
		const childB = boxes.find((b) => b.key.includes('-hier-3-'))!;
		expect(childA.x).toBeGreaterThan(root.x);
		expect(childB.y).toBeGreaterThan(childA.y);
	});
});

// ── Pyramid + snake ───────────────────────────────────────────────────────────

describe('interpret pyra / snake', () => {
	const nodes = [n('1', 'A'), n('2', 'B'), n('3', 'C')];

	it('stacks pyramid bands top-to-bottom', () => {
		const pyraDef = def({ algorithm: { type: 'pyra' }, children: [{ algorithm: { type: 'tx' } }] });
		const layout = interpretSmartArtLayout({
			layoutDefinition: pyraDef,
			nodes,
			flat: nodes,
			box: BOX,
			palette: PALETTE,
			style: STYLE,
			elementId: ID,
		});
		expect(layout!.nodes.every((node) => node.kind === 'polygon')).toBeTruthy();
		expect(layout!.family).toBe('pyramid');
	});

	it('wraps snake points into a grid', () => {
		const snakeDef = def({
			algorithm: { type: 'snake' },
			children: [{ algorithm: { type: 'tx' } }],
		});
		const many = Array.from({ length: 6 }, (_, i) => n(String(i), `Item ${i}`));
		const layout = interpretSmartArtLayout({
			layoutDefinition: snakeDef,
			nodes: many,
			flat: many,
			box: BOX,
			palette: PALETTE,
			style: STYLE,
			elementId: ID,
		});
		expect(rects(layout!.nodes)).toHaveLength(6);
		expect(layout!.family).toBe('matrix');
	});
});

// ── Dispatch integration + fallback ─────────────────────────────────────────────

describe('interpretSmartArtLayout declines gracefully', () => {
	it('returns undefined without a layout definition', () => {
		expect(
			interpretSmartArtLayout({
				layoutDefinition: undefined,
				nodes: [n('1', 'A')],
				flat: [n('1', 'A')],
				box: BOX,
				palette: PALETTE,
				style: STYLE,
				elementId: ID,
			}),
		).toBeUndefined();
	});

	it('returns undefined for an unrecognised algorithm', () => {
		expect(
			interpretSmartArtLayout({
				layoutDefinition: def({ algorithm: { type: 'sp' } }),
				nodes: [n('1', 'A')],
				flat: [n('1', 'A')],
				box: BOX,
				palette: PALETTE,
				style: STYLE,
				elementId: ID,
			}),
		).toBeUndefined();
	});

	it('returns undefined when there are no points to place', () => {
		expect(
			interpretSmartArtLayout({
				layoutDefinition: def({ algorithm: { type: 'lin' } }),
				nodes: [],
				flat: [],
				box: BOX,
				palette: PALETTE,
				style: STYLE,
				elementId: ID,
			}),
		).toBeUndefined();
	});
});

describe('computeSmartArtLayout dispatch', () => {
	const nodes = [n('1', 'A'), n('2', 'B'), n('3', 'C')];

	it('uses the interpreter when a recognised layout definition is supplied', () => {
		// A snake definition yields family "matrix"; the legacy path for flat
		// nodes with no type would yield "list", so "matrix" proves interpretation.
		const snakeDef = def({
			algorithm: { type: 'snake' },
			children: [{ algorithm: { type: 'tx' } }],
		});
		const layout = computeSmartArtLayout(
			nodes,
			BOX,
			PALETTE,
			STYLE,
			ID,
			undefined,
			undefined,
			undefined,
			snakeDef,
		);
		expect(layout.family).toBe('matrix');
	});

	it('falls back to the legacy family when the definition is not understood', () => {
		const opaque = def({ algorithm: { type: 'sp' } });
		const layout = computeSmartArtLayout(
			nodes,
			BOX,
			PALETTE,
			STYLE,
			ID,
			'cycle',
			undefined,
			undefined,
			opaque,
		);
		expect(layout.family).toBe('cycle');
	});

	it('is unchanged when no definition is passed (legacy behaviour)', () => {
		const layout = computeSmartArtLayout(nodes, BOX, PALETTE, STYLE, ID, 'process');
		expect(layout.family).toBe('process');
	});
});
