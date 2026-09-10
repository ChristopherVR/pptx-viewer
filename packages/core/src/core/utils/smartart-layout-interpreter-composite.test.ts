import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode, PptxSmartArtNode } from '../types';
import { EMPTY_CONSTRAINT_INDEX } from './smartart-constraint-solver';
import { arrangeComposite } from './smartart-layout-interpreter-composite';
import type { ArrangementPlan } from './smartart-layout-interpreter-model';
import type { RenderedRectNode } from './smartart-layout-types';

function slot(
	name: string,
	axis: string | undefined,
	dims: { l?: number; t?: number; w?: number; h?: number },
	shapeType?: string,
): PptxSmartArtLayoutNode {
	return {
		name,
		algorithm: { type: 'tx' },
		presentationOf: axis ? { axis: [axis] } : undefined,
		shape: shapeType ? { presetGeometry: shapeType } : undefined,
		constraints: Object.entries(dims).map(([type, value]) => ({ type, factor: value })),
	};
}

function planOf(children: PptxSmartArtLayoutNode[]): ArrangementPlan {
	return { kind: 'composite', node: { name: 'root', children } };
}

function node(id: string, text: string): PptxSmartArtNode {
	return { id, text };
}

const box = { width: 800, height: 400 };

describe('arrangeComposite presOf-aware mapping', () => {
	it('anchors a self slot to arranged points in order', () => {
		const plan = planOf([
			slot('gear1', 'self', { l: 0, t: 0, w: 0.5, h: 1 }, 'ellipse'),
			slot('gear2', 'self', { l: 0.5, t: 0, w: 0.5, h: 1 }, 'ellipse'),
		]);
		const result = arrangeComposite(
			plan,
			[node('a', 'Alpha'), node('b', 'Beta')],
			box,
			['#fff'],
			'flat',
			'e',
		);
		expect(result?.nodes).toHaveLength(2);
		const [first, second] = result!.nodes as RenderedRectNode[];
		expect(first.nodeId).toBe('a');
		expect(second.nodeId).toBe('b');
	});

	it('pairs a des slot with the SAME ordinal self slot descendants (gear1ch pattern)', () => {
		const plan = planOf([
			slot('gear1', 'self', { l: 0, t: 0, w: 1, h: 0.5 }),
			slot('gear1ch', 'des', { l: 0, t: 0.5, w: 1, h: 0.5 }),
		]);
		const childrenOf = new Map([['a', [node('a-child', 'Child of A')]]]);
		const result = arrangeComposite(
			plan,
			[node('a', 'Alpha')],
			box,
			['#fff'],
			'flat',
			'e',
			EMPTY_CONSTRAINT_INDEX,
			childrenOf,
		);
		expect(result?.nodes).toHaveLength(2);
		const [self, des] = result!.nodes as RenderedRectNode[];
		expect(self.nodeId).toBe('a');
		expect(des.nodeId).toBe('a-child');
	});

	it('skips a des slot when the paired point has no descendants', () => {
		const plan = planOf([
			slot('gear1', 'self', { l: 0, t: 0, w: 1, h: 0.5 }),
			slot('gear1ch', 'des', { l: 0, t: 0.5, w: 1, h: 0.5 }),
		]);
		const result = arrangeComposite(
			plan,
			[node('a', 'Alpha')],
			box,
			['#fff'],
			'flat',
			'e',
			EMPTY_CONSTRAINT_INDEX,
			new Map(),
		);
		expect(result?.nodes).toHaveLength(1);
	});

	it('falls back to blind order-based mapping when no slot carries a presOf', () => {
		const plan = planOf([
			slot('title', undefined, { l: 0, t: 0, w: 1, h: 0.3 }),
			slot('body', undefined, { l: 0, t: 0.3, w: 1, h: 0.7 }),
		]);
		const result = arrangeComposite(
			plan,
			[node('a', 'Alpha'), node('b', 'Beta')],
			box,
			['#fff'],
			'flat',
			'e',
		);
		expect(result?.nodes).toHaveLength(2);
		const [first, second] = result!.nodes as RenderedRectNode[];
		expect(first.nodeId).toBe('a');
		expect(second.nodeId).toBe('b');
	});

	it('returns undefined when no child carries a positioning constraint', () => {
		const plan = planOf([{ name: 'plain', algorithm: { type: 'tx' } }]);
		expect(
			arrangeComposite(plan, [node('a', 'Alpha')], box, ['#fff'], 'flat', 'e'),
		).toBeUndefined();
	});

	// Table List (table-list--hier5.pptx, cached shape count 4): `roof` is a
	// real `self` slot; `pillars` is a BARE wrapper (no presOf of its own)
	// whose item templates address the anchor's OWN children via a `ch`
	// token, not the top-level point stream - see
	// `smartart-layout-interpreter-composite-children.ts`.
	it("renders a bare wrapper slot child-repeater against the anchor's own children (Table List pattern, cached count 4)", () => {
		const roof = slot('roof', 'self', { l: 0, t: 0, w: 1, h: 0.3 });
		const pillar1: PptxSmartArtLayoutNode = {
			name: 'pillar1',
			algorithm: { type: 'tx' },
			presentationOf: { axis: ['ch', 'desOrSelf'], start: [1, 1], count: [1, 0] },
		};
		const pillarX: PptxSmartArtLayoutNode = {
			name: 'pillarX',
			algorithm: { type: 'tx' },
			presentationOf: { axis: ['desOrSelf'] },
			forEachOrigin: { axis: ['ch'], pointTypes: ['node'], start: [2] },
		};
		const pillars = {
			...slot('pillars', undefined, { t: 0.3, w: 1, h: 0.7 }),
			children: [pillar1, pillarX],
		};
		const plan = planOf([roof, pillars]);
		const childrenOf = new Map([
			[
				'one',
				[
					node('two', 'Node Two has a longer label'),
					node('three', 'Node Three'),
					node('four', 'Node Four'),
				],
			],
			['four', [node('five', 'Node Five')]],
		]);
		const result = arrangeComposite(
			plan,
			[node('one', 'Node One')],
			box,
			['#fff'],
			'flat',
			'e',
			EMPTY_CONSTRAINT_INDEX,
			childrenOf,
		);
		const nodes = result!.nodes as RenderedRectNode[];
		expect(nodes).toHaveLength(4);
		expect(nodes.map((n) => n.nodeId)).toStrictEqual(['one', 'two', 'three', 'four']);
		expect(nodes[3].foldedNodeIds).toStrictEqual(['five']);
	});

	// Target List (target-list--hier5.pptx): `rect1` is a real `self` slot;
	// `rect1ChTx` is an UNPOSITIONED `des`-axis sibling reached through the
	// SAME `forEach` ring (matched by axis/pointTypes/start, not by name) -
	// see `smartart-layout-interpreter-composite-ring.ts`.
	it('folds an unpositioned same-ring des sibling into the self slot (Target List rect1/rect1ChTx pattern)', () => {
		const rect1 = {
			...slot('rect1', 'self', { l: 0, t: 0, w: 1, h: 1 }),
			forEachOrigin: { axis: ['ch'], pointTypes: ['node'], count: [1] },
		};
		const rect1ChTx: PptxSmartArtLayoutNode = {
			name: 'rect1ChTx',
			algorithm: { type: 'tx' },
			presentationOf: { axis: ['des'], pointTypes: ['node'] },
			forEachOrigin: { axis: ['ch'], pointTypes: ['node'], count: [1] },
		};
		const plan = planOf([rect1, rect1ChTx]);
		const childrenOf = new Map([['a', [node('a-child', 'Child of A')]]]);
		const result = arrangeComposite(
			plan,
			[node('a', 'Alpha')],
			box,
			['#fff'],
			'flat',
			'e',
			EMPTY_CONSTRAINT_INDEX,
			childrenOf,
		);
		const nodes = result!.nodes as RenderedRectNode[];
		expect(nodes).toHaveLength(2);
		expect(nodes[0].nodeId).toBe('a');
		expect(nodes[1].nodeId).toBe('a-child');
	});

	it('does not fold a des sibling reached through a DIFFERENT ring (different forEach start)', () => {
		const rect1 = {
			...slot('rect1', 'self', { l: 0, t: 0, w: 1, h: 1 }),
			forEachOrigin: { axis: ['ch'], pointTypes: ['node'], count: [1] },
		};
		const rect2ChTx: PptxSmartArtLayoutNode = {
			name: 'rect2ChTx',
			algorithm: { type: 'tx' },
			presentationOf: { axis: ['des'], pointTypes: ['node'] },
			forEachOrigin: { axis: ['ch'], pointTypes: ['node'], start: [2], count: [1] },
		};
		const plan = planOf([rect1, rect2ChTx]);
		const childrenOf = new Map([['a', [node('a-child', 'Child of A')]]]);
		const result = arrangeComposite(
			plan,
			[node('a', 'Alpha')],
			box,
			['#fff'],
			'flat',
			'e',
			EMPTY_CONSTRAINT_INDEX,
			childrenOf,
		);
		expect(result?.nodes).toHaveLength(1);
	});
});

describe("arrangeComposite resolves each slot's own declared shape (round 28)", () => {
	it("sets presetOverride from a self slot's own declared shape, not the generic roundRect default", () => {
		// Before round 28, `arrangeByPresentationOf`/`renderAnchoredPair`
		// called `rectNode` directly (no shape param at all), so every
		// composite-rendered box fell through to `smartart-interpreter-
		// drawing-bridge.ts`'s own `presetOverride ?? 'roundRect'` default
		// regardless of what the layoutNode declared - this test's own
		// `shapeType` param (already accepted by `slot()`, unused by every
		// PRE-EXISTING assertion here) is what exposed the gap.
		const plan = planOf([
			slot('gear1', 'self', { l: 0, t: 0, w: 0.5, h: 1 }, 'ellipse'),
			slot('gear2', 'self', { l: 0.5, t: 0, w: 0.5, h: 1 }, 'ellipse'),
		]);
		const result = arrangeComposite(
			plan,
			[node('a', 'Alpha'), node('b', 'Beta')],
			box,
			['#fff'],
			'flat',
			'e',
		);
		const [first, second] = result!.nodes as RenderedRectNode[];
		expect(first.presetOverride).toBe('ellipse');
		expect(second.presetOverride).toBe('ellipse');
	});

	it("sets presetOverride from a des slot's own declared shape too", () => {
		const plan = planOf([
			slot('gear1', 'self', { l: 0, t: 0, w: 1, h: 0.5 }, 'rect'),
			slot('gear1ch', 'des', { l: 0, t: 0.5, w: 1, h: 0.5 }, 'homePlate'),
		]);
		const childrenOf = new Map([['a', [node('a-child', 'Child of A')]]]);
		const result = arrangeComposite(
			plan,
			[node('a', 'Alpha')],
			box,
			['#fff'],
			'flat',
			'e',
			EMPTY_CONSTRAINT_INDEX,
			childrenOf,
		);
		const [self, des] = result!.nodes as RenderedRectNode[];
		expect(self.presetOverride).toBe('rect');
		expect(des.presetOverride).toBe('homePlate');
	});

	it('falls back to the generic default when no slot declares a shape at all (unchanged, pre-existing behaviour)', () => {
		const plan = planOf([
			slot('gear1', 'self', { l: 0, t: 0, w: 0.5, h: 1 }),
			slot('gear2', 'self', { l: 0.5, t: 0, w: 0.5, h: 1 }),
		]);
		const result = arrangeComposite(
			plan,
			[node('a', 'Alpha'), node('b', 'Beta')],
			box,
			['#fff'],
			'flat',
			'e',
		);
		const [first] = result!.nodes as RenderedRectNode[];
		expect(first.presetOverride).toBe('roundRect');
	});

	it("resolves each slot's own declared shape on the order-based fallback path too (no presOf on any slot)", () => {
		const plan = planOf([
			slot('title', undefined, { l: 0, t: 0, w: 1, h: 0.3 }, 'chevron'),
			slot('body', undefined, { l: 0, t: 0.3, w: 1, h: 0.7 }, 'ellipse'),
		]);
		const result = arrangeComposite(
			plan,
			[node('a', 'Alpha'), node('b', 'Beta')],
			box,
			['#fff'],
			'flat',
			'e',
		);
		const [first, second] = result!.nodes as RenderedRectNode[];
		expect(first.presetOverride).toBe('chevron');
		expect(second.presetOverride).toBe('ellipse');
	});
});
