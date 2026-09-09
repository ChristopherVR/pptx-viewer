import { describe, expect, it } from 'vitest';

import type {
	PptxSmartArtForEach,
	PptxSmartArtLayoutNode,
	PptxSmartArtNode,
	PptxSmartArtWhen,
} from '../types';
import { chooseAlgType, selectArrangedNodes } from './smartart-layout-interpreter-flow';

function whenNode(
	fn: string,
	operator: string,
	value: string,
	argument?: string,
): PptxSmartArtWhen {
	return { function: fn, operator, value, ...(argument ? { argument } : {}) };
}

describe('chooseAlgType', () => {
	it('stays undecidable on func="cnt" without a matching branch (pre-existing behaviour)', () => {
		const node: PptxSmartArtLayoutNode = {
			choose: [
				{
					when: [whenNode('cnt', 'equ', '99')],
					otherwise: { rawXml: { 'dgm:alg': { '@_type': 'lin' } } },
				},
			],
			rawXml: {},
		};
		// otherwise branch selects lin, not cycle.
		expect(chooseAlgType(node, 3)).toBe('lin');
	});

	// G8: func="var" is now decidable when the caller supplies presLayoutVars.
	it('func="var" decides its branch from presLayoutVars when context is supplied', () => {
		const node: PptxSmartArtLayoutNode = {
			choose: [
				{
					when: [whenNode('var', 'equ', 'rev', 'dir')],
					otherwise: { rawXml: { 'dgm:alg': { '@_type': 'lin' } } },
				},
			],
			rawXml: {},
		};
		// Need the `when` branch's own rawXml too, not just otherwise's.
		node.choose![0].when[0].rawXml = { 'dgm:alg': { '@_type': 'cycle' } };

		const decided = chooseAlgType(node, 3, { presLayoutVars: { direction: 'rev' } });
		expect(decided).toBe('cycle');

		const otherDirection = chooseAlgType(node, 3, { presLayoutVars: { direction: 'norm' } });
		expect(otherDirection).toBe('lin');
	});

	it('func="var" without presLayoutVars context stays undecidable (no regression)', () => {
		const node: PptxSmartArtLayoutNode = {
			choose: [
				{
					when: [
						{
							function: 'var',
							operator: 'equ',
							value: 'rev',
							argument: 'dir',
							rawXml: { 'dgm:alg': { '@_type': 'cycle' } },
						},
					],
					otherwise: null,
				},
			],
			rawXml: {},
		};
		expect(chooseAlgType(node, 3)).toBeUndefined();
	});
});

describe('selectArrangedNodes', () => {
	function plainNode(id: string): PptxSmartArtNode {
		return { id, text: id };
	}

	// A real built-in layoutDef's driving arranger, e.g. "Basic Process":
	// `<dgm:forEach name="nodesForEach" axis="ch" ptType="node">`.
	const chOnlyArranger: PptxSmartArtLayoutNode = {
		forEach: [{ name: 'nodesForEach', axis: ['ch'], pointTypes: ['node'] }],
	};

	it('an axis="ch"-only iterator selects the top-level `roots`, not the flattened `flat`', () => {
		// Node Two is a child of Node One (added a level deeper via Demote/"Add
		// Bullet"); Node Five a child of Node Four. `flat` (pre-order) has all 5;
		// `roots` (what a real `axis="ch"` forEach actually iterates) has only 3.
		const one = plainNode('one');
		const two = plainNode('two');
		const three = plainNode('three');
		const four = plainNode('four');
		const five = plainNode('five');
		const flat = [one, two, three, four, five];
		const roots = [one, three, four];

		expect(selectArrangedNodes(chOnlyArranger, flat, roots)).toStrictEqual(roots);
	});

	it('falls back to `flat` when no `roots` are supplied (no regression for existing callers)', () => {
		const flat = [plainNode('a'), plainNode('b')];
		expect(selectArrangedNodes(chOnlyArranger, flat)).toStrictEqual(flat);
	});

	it('a combined axis (e.g. "ch des") is left on `flat`: it deliberately wants the full descendant set', () => {
		const combinedArranger: PptxSmartArtLayoutNode = {
			forEach: [{ name: 'nodesForEach', axis: ['ch', 'des'], pointTypes: ['node'] }],
		};
		const flat = [plainNode('a'), plainNode('b'), plainNode('c')];
		const roots = [plainNode('a')];
		expect(selectArrangedNodes(combinedArranger, flat, roots)).toStrictEqual(flat);
	});

	it('st/cnt/step still apply on top of the `roots` base when axis="ch"', () => {
		const arranger: PptxSmartArtLayoutNode = {
			forEach: [{ name: 'n', axis: ['ch'], pointTypes: ['node'], start: [2], count: [1] }],
		};
		const flat = [plainNode('a'), plainNode('b'), plainNode('c'), plainNode('d')];
		const roots = [plainNode('a'), plainNode('c')];
		// 1-based start=2 on `roots` (length 2) -> index 1 -> "c", count=1.
		expect(selectArrangedNodes(arranger, flat, roots)).toStrictEqual([roots[1]]);
	});

	it('with NO driving iterator at all, still prefers roots over flat when there are multiple roots', () => {
		// `basic-chevron-process--hier8`'s `Name0`: no forEach of its own (its
		// per-item structure lives entirely inside a nested `dgm:choose`/
		// `composite`) - `flat` (every node, including grandchildren) used to
		// be treated as the arranged set, producing a box per DESCENDANT too.
		const noIterator: PptxSmartArtLayoutNode = { name: 'Name0' };
		const flat = [plainNode('a'), plainNode('a-child'), plainNode('b'), plainNode('b-child')];
		const roots = [plainNode('a'), plainNode('b')];
		expect(selectArrangedNodes(noIterator, flat, roots)).toStrictEqual(roots);
	});

	it('with NO driving iterator and exactly ONE root, still uses `flat` (ambiguous with hub/single-root-flat shapes)', () => {
		// A single root with no forEach is ambiguous between the "hub +
		// satellites" shape (`smartart-layout-interpreter-hub.ts` decides
		// that separately, from `flat`) and a genuinely single-root-but-flat
		// dataset (`table-hierarchy`) that still needs every node.
		const noIterator: PptxSmartArtLayoutNode = { name: 'Name0' };
		const flat = [plainNode('a'), plainNode('b'), plainNode('c')];
		const roots = [plainNode('a')];
		expect(selectArrangedNodes(noIterator, flat, roots)).toStrictEqual(flat);
	});

	it('unions a primary `step` iterator with a nested `followSib` "next point" pair (Alternating Flow)', () => {
		// `alternating-flow--hier5.pptx`'s `process` arranger: ONE direct
		// `dgm:forEach axis="ch" step="2"` (every OTHER root, via `composite1`),
		// but `composite1`'s own body nests a `followSib`/`ptType="node"
		// cnt="1"` iterator reaching `composite2` - "the point immediately
		// following the current one". Before this fix, only `step="2"`'s
		// selection (2 of 3 roots) was returned (measured: interpreted 2
		// shapes where the cached drawing has 5, once every point renders its
		// own self+child pair). With `step="2"` on 3 roots selecting indices
		// [0, 2] and each paired with its own next sibling (indices [1, 3] -
		// 3 out of range), the union is indices [0, 1, 2] - all 3 roots.
		const composite2: PptxSmartArtLayoutNode = {
			name: 'composite2',
			forEachOrigin: { axis: ['followSib'], pointTypes: ['node'], count: [1] },
		};
		const arranger: PptxSmartArtLayoutNode = {
			name: 'process',
			forEach: [{ name: 'Name4', axis: ['ch'], pointTypes: ['node'], step: [2] }],
			children: [{ name: 'composite1' }, composite2],
		};
		const roots = [plainNode('one'), plainNode('three'), plainNode('four')];
		const flat = roots;
		expect(selectArrangedNodes(arranger, flat, roots)).toStrictEqual(roots);
	});

	it('unions SEVEN independent single-point `st="N" cnt="1"` iterators on the same node (Target List)', () => {
		// `target-list--hier5.pptx`'s `Name0` composite declares 7 independent
		// `dgm:forEach axis="ch" ptType="node" st="N" cnt="1"` entries (one per
		// named "ring" slot) instead of one shared driving iterator. Only the
		// first 3 resolve against 3 roots (`st="4".."7"` fall outside `roots`),
		// but ALL 3 fire independently - the union recovers every root, not
		// just the FIRST iterator `qualifyingIterators` used to return alone.
		const ring = (start: number): PptxSmartArtForEach => ({
			name: `ring${start}`,
			axis: ['ch'],
			pointTypes: ['node'],
			start: [start],
			count: [1],
		});
		const arranger: PptxSmartArtLayoutNode = {
			name: 'Name0',
			forEach: [1, 2, 3, 4, 5, 6, 7].map(ring),
		};
		const roots = [plainNode('one'), plainNode('three'), plainNode('four')];
		expect(selectArrangedNodes(arranger, roots, roots)).toStrictEqual(roots);
	});

	it('a lone iterator is unaffected by the union machinery (no regression)', () => {
		// The overwhelmingly common case (one qualifying iterator, no nested
		// followSib pairing): the union of one iterator's own indices is
		// exactly its own selection, same as before this generalisation.
		const arranger: PptxSmartArtLayoutNode = {
			forEach: [{ name: 'n', axis: ['ch'], pointTypes: ['node'], start: [2], count: [1] }],
		};
		const flat = [plainNode('a'), plainNode('b'), plainNode('c'), plainNode('d')];
		const roots = [plainNode('a'), plainNode('c')];
		expect(selectArrangedNodes(arranger, flat, roots)).toStrictEqual([roots[1]]);
	});
});
