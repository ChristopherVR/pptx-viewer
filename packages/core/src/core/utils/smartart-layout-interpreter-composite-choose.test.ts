import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode, PptxSmartArtNode } from '../types';
import { EMPTY_CONSTRAINT_INDEX } from './smartart-constraint-solver';
import { collectChooseAwareSlots } from './smartart-layout-interpreter-composite-choose';

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
