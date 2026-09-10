import { describe, expect, it } from 'vitest';

import type {
	PptxSmartArtLayoutDefinition,
	PptxSmartArtLayoutNode,
	PptxSmartArtNode,
} from '../types';
import { buildConstraintIndex, EMPTY_CONSTRAINT_INDEX } from './smartart-constraint-solver';
import {
	arrangeByChooseAwareSlots,
	collectChooseAwareSlots,
} from './smartart-layout-interpreter-composite-choose';
import type { FontFitContext } from './smartart-layout-interpreter-composite-fontfit';
import type { SlotStyleContext } from './smartart-layout-interpreter-composite-render';
import type { ArrangementPlan } from './smartart-layout-interpreter-model';
import type { RenderedRectNode } from './smartart-layout-types';

const box = { width: 800, height: 400 };

/** `dgm:constr for="ch" forName="<name>"`-shaped positioning, as `readSlots` reads it. */
function positioned(dims: { l?: number; t?: number; w?: number; h?: number }) {
	return Object.entries(dims).map(([type, value]) => ({ type, factor: value }));
}

function node(id: string, text: string): PptxSmartArtNode {
	return { id, text };
}

// cycle-matrix--fallback-n2.pptx's exact shape (cached count 2): a SINGLE
// top-level point ("Alpha") whose only child ("Beta") is folded in via a
// choose-guarded named group, gated on "does the diagram's first top-level
// point have >= 1 child" - the guard the round-6 handoff root-caused.
describe('collectChooseAwareSlots (cycle-matrix pattern)', () => {
	const alpha = node('alpha', 'Alpha');
	const beta = node('beta', 'Beta');
	// `flat` mirrors the real loader's shape: parentId-linked, no invisible
	// root entry.
	const flat: PptxSmartArtNode[] = [alpha, { ...beta, parentId: 'alpha' }];

	function childGroup(
		name: string,
		guardStart: number,
		childAxis: string[],
		childStart: number[],
	): PptxSmartArtLayoutNode {
		return {
			name,
			chooseGuard: [
				{
					axis: ['ch', 'ch'],
					pointTypes: ['node', 'node'],
					start: [guardStart, 1],
					count: [1, 0],
					function: 'cnt',
					operator: 'gte',
					value: '1',
				},
			],
			children: [
				{
					name: `${name}Text`,
					presentationOf: {
						axis: childAxis,
						pointTypes: ['node', 'node'],
						start: childStart,
						count: [1, 0],
					},
					constraints: positioned({ l: 0, t: 0, w: 0.5, h: 0.5 }),
				},
			],
		};
	}

	it("resolves a LIVE group's content relative to the diagram root, folding via the second axis token", () => {
		const children: PptxSmartArtLayoutNode = {
			name: 'children',
			children: [childGroup('child1group', 1, ['ch', 'des'], [1, 1])],
		};
		const slots = collectChooseAwareSlots(children, flat, box, EMPTY_CONSTRAINT_INDEX, 'children');
		expect(slots).toHaveLength(1);
		expect(slots[0].content.map((n) => n.id)).toStrictEqual(['beta']);
	});

	it('drops a group whose OWN guard evaluates false (no second top-level point to have a child)', () => {
		const children: PptxSmartArtLayoutNode = {
			name: 'children',
			children: [childGroup('child2group', 2, ['ch', 'des'], [2, 1])],
		};
		const slots = collectChooseAwareSlots(children, flat, box, EMPTY_CONSTRAINT_INDEX, 'children');
		expect(slots).toHaveLength(0);
	});

	it('resolves a single-token "ch" slot (no compound) directly against the top-level point list (quadrant1 pattern)', () => {
		const circle: PptxSmartArtLayoutNode = {
			name: 'circle',
			children: [
				{
					name: 'quadrant1',
					presentationOf: { axis: ['ch'], pointTypes: ['node'], count: [1] },
					constraints: positioned({ l: 0, t: 0, w: 0.5, h: 0.5 }),
				},
			],
		};
		const slots = collectChooseAwareSlots(circle, flat, box, EMPTY_CONSTRAINT_INDEX, 'circle');
		expect(slots).toHaveLength(1);
		expect(slots[0].content.map((n) => n.id)).toStrictEqual(['alpha']);
	});

	it('an undecidable guard (unsupported axis) defaults to allowing the branch, not suppressing it', () => {
		const wrapper: PptxSmartArtLayoutNode = {
			name: 'wrapper',
			chooseGuard: [{ function: 'var', argument: 'unsupported', operator: 'equ', value: 'x' }],
			children: [
				{
					name: 'leaf',
					presentationOf: { axis: ['ch'], pointTypes: ['node'], count: [1] },
					constraints: positioned({ l: 0, t: 0, w: 0.5, h: 0.5 }),
				},
			],
		};
		const slots = collectChooseAwareSlots(wrapper, flat, box, EMPTY_CONSTRAINT_INDEX, 'wrapper');
		expect(slots).toHaveLength(1);
	});
});

// basic-venn--hier5.pptx / Phased Process's real shape: a decorative
// `dgm:alg type="sp"` sibling (`circ1`) and a text-carrying `alg="tx"`
// sibling (`circ1Tx`) share the EXACT same resolved content (same
// `forEachOrigin` anchor) - both are content leaves under a bare `circles`
// wrapper. Staggered Process's `ThreeNodes_3_text` additionally has NO
// `readSlots`-resolvable geometry of its own at all (`hideGeom`); only its
// decorative `ThreeNodes_3` sibling does.
describe('collectChooseAwareSlots (decorative sp + text tx pairing)', () => {
	const one = node('one', 'Node One');
	const two = node('two', 'Node Two');
	const flat: PptxSmartArtNode[] = [one, { ...two, parentId: 'one' }];

	function circPair(spPositioned: boolean, txPositioned: boolean): PptxSmartArtLayoutNode {
		const shared = {
			presentationOf: { axis: ['desOrSelf'], pointTypes: ['node'] },
			forEachOrigin: { axis: ['ch'], pointTypes: ['node'], count: [1] },
		};
		return {
			name: 'circles',
			children: [
				{
					...shared,
					name: 'circ1',
					algorithm: { type: 'sp' },
					constraints: spPositioned ? positioned({ l: 0, t: 0, w: 1, h: 1 }) : [],
				},
				{
					...shared,
					name: 'circ1Tx',
					algorithm: { type: 'tx' },
					constraints: txPositioned ? positioned({ l: 0.2, t: 0.1, w: 0.6, h: 0.8 }) : [],
				},
			],
		};
	}

	it('merges a decorative sp sibling and its tx text carrier into ONE slot, not two', () => {
		const slots = collectChooseAwareSlots(
			circPair(true, true),
			flat,
			box,
			EMPTY_CONSTRAINT_INDEX,
			'circles',
		);
		expect(slots).toHaveLength(1);
		expect(slots[0].content.map((n) => n.id)).toStrictEqual(['one', 'two']);
	});

	it("prefers the tx sibling's own geometry when both are positioned", () => {
		const slots = collectChooseAwareSlots(
			circPair(true, true),
			flat,
			box,
			EMPTY_CONSTRAINT_INDEX,
			'circles',
		);
		// tx: l=0.2*800=160, t=0.1*400=40 ; sp: l=0, t=0 - confirms the tx
		// candidate's own slot won, not the sp sibling's.
		expect(slots[0].rect.x).toBe(160);
		expect(slots[0].rect.y).toBe(40);
	});

	it("falls back to the sp sibling's geometry when the tx (hideGeom) sibling has none of its own (Staggered Process's ThreeNodes_3_text)", () => {
		const slots = collectChooseAwareSlots(
			circPair(true, false),
			flat,
			box,
			EMPTY_CONSTRAINT_INDEX,
			'circles',
		);
		expect(slots).toHaveLength(1);
		expect(slots[0].content.map((n) => n.id)).toStrictEqual(['one', 'two']);
		expect(slots[0].rect.x).toBe(0);
		expect(slots[0].rect.y).toBe(0);
	});

	it('drops the group entirely when NEITHER sibling has resolvable geometry', () => {
		const slots = collectChooseAwareSlots(
			circPair(false, false),
			flat,
			box,
			EMPTY_CONSTRAINT_INDEX,
			'circles',
		);
		expect(slots).toHaveLength(0);
	});
});

// nested-target--hier5.pptx's oChild shape: a bare wrapper (no presOf) whose
// ONE child template has a MULTI-anchor forEachOrigin (a genuine forEach with
// an unbounded second hop - "every child of point 1"), reached from a
// composite root with no self-axis slot anywhere (arrangeByChooseAwareSlots's
// own territory). Cached wants ONE box per anchor - "Node Two" alone, "Node
// Three" alone - not one box with both folded together.
describe('collectChooseAwareSlots (multi-anchor forEachOrigin per-iteration split)', () => {
	const one = node('one', 'Node One');
	const two = node('two', 'Node Two');
	const three = node('three', 'Node Three');
	const flat: PptxSmartArtNode[] = [
		one,
		{ ...two, parentId: 'one' },
		{ ...three, parentId: 'one' },
	];

	function outerBoxChildren(): PptxSmartArtLayoutNode {
		return {
			name: 'outerBoxChildren',
			children: [
				{
					name: 'oChild',
					presentationOf: { axis: ['desOrSelf'], pointTypes: ['node'] },
					forEachOrigin: {
						axis: ['ch', 'ch'],
						pointTypes: ['node', 'node'],
						start: [1, 1],
						count: [1, 0],
					},
					constraints: positioned({ w: 1, h: 1 }),
				},
			],
		};
	}

	it('produces ONE slot per anchor, not one slot with every anchor folded together', () => {
		const slots = collectChooseAwareSlots(
			outerBoxChildren(),
			flat,
			box,
			EMPTY_CONSTRAINT_INDEX,
			'outerBoxChildren',
		);
		expect(slots).toHaveLength(2);
		expect(slots.map((s) => s.content.map((n) => n.id))).toStrictEqual([['two'], ['three']]);
	});

	it('slices the shared container rect between the per-anchor slots instead of stacking them identically', () => {
		const slots = collectChooseAwareSlots(
			outerBoxChildren(),
			flat,
			box,
			EMPTY_CONSTRAINT_INDEX,
			'outerBoxChildren',
		);
		expect(slots[0].rect).not.toStrictEqual(slots[1].rect);
		// Both slots' widths sum to the shared (full-box) container's own width.
		expect(slots[0].rect.width + slots[1].rect.width).toBe(box.width);
	});

	/**
	 * A `func="pos"` condition in the per-anchor template's OWN `chooseGuard`
	 * chain decides against the CURRENT forEach iteration's own 1-based
	 * position, not `discoverArrangement`'s unrelated static tree-location
	 * `pos` - `sub-step-process--hier5.pptx`'s `chLin1..7` each carry
	 * exactly this shape (`pos==N` chained with a nearly-vacuous `cnt>=1`),
	 * though `chLinN` itself is a STRUCTURAL arranger, not a presOf-bearing
	 * content leaf, so this mechanism alone does not yet reach that fixture.
	 */
	it('a pos==N chooseGuard on the per-anchor template keeps only the matching iteration', () => {
		const template = outerBoxChildren();
		template.children![0].chooseGuard = [{ function: 'pos', operator: 'equ', value: '2' }];
		const slots = collectChooseAwareSlots(
			template,
			flat,
			box,
			EMPTY_CONSTRAINT_INDEX,
			'outerBoxChildren',
		);
		expect(slots).toHaveLength(1);
		expect(slots[0].content.map((n) => n.id)).toStrictEqual(['three']);
	});

	it('a chooseGuard chain requiring BOTH an outer pos==N and an inner cnt condition still discriminates correctly', () => {
		const template = outerBoxChildren();
		template.children![0].chooseGuard = [
			{ function: 'pos', operator: 'equ', value: '1' },
			{ function: 'cnt', operator: 'gte', value: '1' },
		];
		const slots = collectChooseAwareSlots(
			template,
			flat,
			box,
			EMPTY_CONSTRAINT_INDEX,
			'outerBoxChildren',
		);
		expect(slots).toHaveLength(1);
		expect(slots[0].content.map((n) => n.id)).toStrictEqual(['two']);
	});
});

/**
 * `balance--hier5.pptx`'s own shape, at small scale: a `dgm:choose` with 2+
 * `dgm:if` alternatives, EACH independently `chooseGuard`-decidable-true
 * (unlike the real fixture, whose guards mostly need anchor context this
 * module does not yet resolve - see `smartart-layout-interpreter-
 * composite-choose-groups.ts`'s own doc comment) - `collectChooseAwareSlots`
 * must keep only the FIRST (lowest-ordinal) live member, not both.
 */
describe('collectChooseAwareSlots first-match-wins (chooseGroups)', () => {
	const flat: PptxSmartArtNode[] = [
		{ id: 'one', text: 'One' },
		{ id: 'two', text: 'Two' },
	];

	// `axis: ['ch'], start: [N]` picks the Nth top-level point specifically
	// (the `quadrant1..4` pattern used elsewhere in this file) - unlike a
	// bare `axis: ['self']` with no anchor (which resolves to the WHOLE
	// point list, not one specific point), this lets each group member
	// resolve to a DIFFERENT, individually verifiable node, so a test can
	// tell "the loser's content leaked through" apart from "both groups
	// happen to resolve identically anyway".
	function group(
		id: string,
		ordinal: number,
		value: string,
		name: string,
		pointPosition: number,
	): PptxSmartArtLayoutNode {
		return {
			name,
			chooseGuard: [{ function: 'cnt', operator: 'equ', value }],
			chooseGroups: [{ id, ordinal, guard: { function: 'cnt', operator: 'equ', value } }],
			presentationOf: { axis: ['ch'], pointTypes: ['node'], start: [pointPosition], count: [1] },
			constraints: positioned({ l: 0, t: 0, w: 0.5, h: 0.5 }),
		};
	}

	it('keeps only the lowest-ordinal live sibling when BOTH independently pass their own chooseGuard', () => {
		// Both guards are individually decidable-true against a 2-node diagram
		// (cnt==2), which the OLD "every guard-true node independently"
		// reading would have kept BOTH as separate slots ("one" AND "two").
		// `first` resolves to point 1 ("one"), `second` to point 2 ("two") -
		// only `first` (ordinal 0) should survive.
		const root: PptxSmartArtLayoutNode = {
			name: 'root',
			children: [group('g0', 0, '2', 'first', 1), group('g0', 1, '2', 'second', 2)],
		};
		const slots = collectChooseAwareSlots(root, flat, box, EMPTY_CONSTRAINT_INDEX, 'root');
		expect(slots).toHaveLength(1);
		expect(slots[0].content.map((n) => n.id)).toStrictEqual(['one']);
	});

	it('falls through to the next ordinal when the lowest one is decidably false', () => {
		const root: PptxSmartArtLayoutNode = {
			name: 'root',
			children: [group('g0', 0, '99', 'first', 1), group('g0', 1, '2', 'second', 2)],
		};
		const slots = collectChooseAwareSlots(root, flat, box, EMPTY_CONSTRAINT_INDEX, 'root');
		expect(slots).toHaveLength(1);
		expect(slots[0].content.map((n) => n.id)).toStrictEqual(['two']);
	});
});

describe("arrangeByChooseAwareSlots resolves each slot's own declared shape (round 28)", () => {
	// `upward-arrow--hier5.pptx`'s exact shape: a `dgm:choose`-per-count
	// composite with no `self`-axis slot anywhere, one candidate group whose
	// own layoutNode declares a real, non-default preset (`round2DiagRect`
	// there; `homePlate` here, any non-default preset exercises the same
	// code path). Before round 28, `arrangeByChooseAwareSlots` called
	// `rectNode` directly (no shape param), so every choose-aware slot fell
	// through to the generic `roundRect` default regardless of what the
	// winning candidate's own layoutNode declared.
	const alpha = node('alpha', 'Alpha');
	const flat: PptxSmartArtNode[] = [alpha];
	const ctx: SlotStyleContext = {
		ctx: { strokeWidth: 1, stroke: '#000', shadow: undefined },
		palette: ['#fff'],
		style: 'flat',
		elementId: 'e',
	};

	it("uses the winning candidate's own declared shape, not the generic roundRect default", () => {
		const group: PptxSmartArtLayoutNode = {
			name: 'textBox1',
			shape: { presetGeometry: 'homePlate' },
			presentationOf: { axis: ['ch'], pointTypes: ['node'], start: [1], count: [1] },
			constraints: positioned({ l: 0, t: 0, w: 1, h: 1 }),
		};
		const root: PptxSmartArtLayoutNode = { name: 'root', children: [group] };
		const rendered = arrangeByChooseAwareSlots(root, flat, box, EMPTY_CONSTRAINT_INDEX, ctx);
		expect(rendered).toHaveLength(1);
		expect(rendered![0].presetOverride).toBe('homePlate');
	});

	it('falls back to the generic default when the winning candidate declares no shape at all', () => {
		const group: PptxSmartArtLayoutNode = {
			name: 'textBox1',
			presentationOf: { axis: ['ch'], pointTypes: ['node'], start: [1], count: [1] },
			constraints: positioned({ l: 0, t: 0, w: 1, h: 1 }),
		};
		const root: PptxSmartArtLayoutNode = { name: 'root', children: [group] };
		const rendered = arrangeByChooseAwareSlots(root, flat, box, EMPTY_CONSTRAINT_INDEX, ctx);
		expect(rendered).toHaveLength(1);
		expect(rendered![0].presetOverride).toBe('roundRect');
	});
});

// Round 29: `upward-arrow--hier5.pptx`'s own count-branch shape has every
// live slot under ONE wrapper (one declaringRole), so a single shared
// font-fit across them is correct; `cycle-matrix`/`grid-matrix`/
// `segmented-pyramid`'s shape has SEVERAL live slots under DIFFERENT named
// wrapper groups, each with its OWN declared `primFontSz` ceiling. Round 28
// measured and reverted a font-fit wiring attempt that computed ONE shared
// fit across every slot regardless of group, which correctly closed the
// first shape but badly overshot the second (a small group's own small
// ceiling got replaced by an unrelated big group's). This pins the per-group
// isolation `resolveFitByDeclaringRole` now provides: two groups with
// different declared ceilings must not influence each other.
describe('arrangeByChooseAwareSlots per-group font-fit isolation (round 29)', () => {
	const alpha = node('alpha', 'Alpha');
	const beta = node('beta', 'Beta has a noticeably longer label than Alpha');
	const flat: PptxSmartArtNode[] = [alpha, beta];
	const ctx: SlotStyleContext = {
		ctx: { strokeWidth: 1, stroke: '#000', shadow: undefined },
		palette: ['#fff'],
		style: 'flat',
		elementId: 'e',
	};

	/** One choose-guarded wrapper group with its own presOf leaf, its own declared `primFontSz` ceiling, and its own box. */
	function group(
		groupName: string,
		leafName: string,
		start: number,
		primFontSzPt: number,
		dims: { l: number; t: number; w: number; h: number },
	): PptxSmartArtLayoutNode {
		return {
			name: groupName,
			children: [
				{
					name: leafName,
					presentationOf: { axis: ['ch'], pointTypes: ['node'], start: [start], count: [1] },
					constraints: [...positioned(dims), { type: 'primFontSz', value: primFontSzPt }],
				},
			],
		};
	}

	function planAndIndex(children: PptxSmartArtLayoutNode[]): {
		plan: ArrangementPlan;
		index: ReturnType<typeof buildConstraintIndex>;
	} {
		const rootNode: PptxSmartArtLayoutNode = { name: 'root', children };
		const definition: PptxSmartArtLayoutDefinition = { rootNode };
		return { plan: { kind: 'composite', node: rootNode }, index: buildConstraintIndex(definition) };
	}

	it("a small group's own small declared ceiling survives next to an unrelated big group's big one", () => {
		const smallGroup = group('smallGroup', 'smallLeaf', 1, 21, { l: 0, t: 0, w: 0.5, h: 1 });
		const bigGroup = group('bigGroup', 'bigLeaf', 2, 80, { l: 0.5, t: 0, w: 0.5, h: 1 });
		const { plan, index } = planAndIndex([smallGroup, bigGroup]);
		const fontCtx: FontFitContext = { plan, index, fontName: undefined };
		const rendered = arrangeByChooseAwareSlots(
			plan.node,
			flat,
			box,
			index,
			ctx,
			fontCtx,
		) as RenderedRectNode[];
		expect(rendered).toHaveLength(2);
		const small = rendered.find((r) => r.nodeId === 'alpha')!;
		const big = rendered.find((r) => r.nodeId === 'beta')!;
		// Each group's own fit is capped by its OWN declared ceiling, not
		// clobbered by the other group's - the exact regression round 28
		// measured (a shared global fit reused `slots[0]`'s ceiling for
		// every slot, so the small group inherited the big group's 80pt cap
		// or vice versa depending on discovery order).
		expect(small.fontSize).toBeLessThanOrEqual(21 * (96 / 72) + 0.01);
		expect(big.fontSize).toBeGreaterThan(small.fontSize);
	});

	it('a single-group composite (upward-arrow shape) still gets a real, non-fallback font size', () => {
		const singleGroup = group('countBranch', 'textBox1', 1, 40, { l: 0, t: 0, w: 1, h: 1 });
		const { plan, index } = planAndIndex([singleGroup]);
		const fontCtx: FontFitContext = { plan, index, fontName: undefined };
		const rendered = arrangeByChooseAwareSlots(
			plan.node,
			[alpha],
			box,
			index,
			ctx,
			fontCtx,
		) as RenderedRectNode[];
		expect(rendered).toHaveLength(1);
		// Not the crude 12px un-derived fallback (`fitFontSize`'s literal
		// cap) that every choose-aware slot rendered before font-fit was
		// wired at all.
		expect(rendered[0].fontSize).not.toBe(12);
		expect(rendered[0].fontSize).toBeGreaterThan(12);
	});
});
