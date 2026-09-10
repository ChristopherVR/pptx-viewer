import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode, PptxSmartArtNode } from '../types';
import { collectRawCandidates } from './smartart-layout-interpreter-composite-candidates';

function node(id: string, text: string, parentId?: string): PptxSmartArtNode {
	return parentId ? { id, text, parentId } : { id, text };
}

/**
 * `continuous-arrow-process--hier5.pptx`'s exact shape: `linH` (a bare
 * wrapper carrying its own `dgm:forEach axis="ch" ptType="node"`) wraps
 * `linV` (`alg="lin"`, reached through that forEach as `linV.forEachOrigin`),
 * which in turn wraps `parTx` (`presOf axis="self"`) and `desTx` (`presOf
 * axis="des"`) - NEITHER of which carries a `forEachOrigin` of its own.
 * Before round 32, both resolved root-relatively (collapsing the whole slot
 * to one arbitrary point); `collectRawCandidates` now threads `linV`'s own
 * origin down to them.
 */
describe('collectRawCandidates inherited-origin threading (round 32)', () => {
	function buildTree(): PptxSmartArtLayoutNode {
		const parTx: PptxSmartArtLayoutNode = {
			name: 'parTx',
			presentationOf: { axis: ['self'], pointTypes: ['node'] },
		};
		const desTx: PptxSmartArtLayoutNode = {
			name: 'desTx',
			presentationOf: { axis: ['des'], pointTypes: ['node'] },
		};
		const linV: PptxSmartArtLayoutNode = {
			name: 'linV',
			algorithm: { type: 'lin' },
			forEachOrigin: { axis: ['ch'], pointTypes: ['node'] },
			children: [parTx, desTx],
		};
		const linH: PptxSmartArtLayoutNode = {
			name: 'linH',
			forEach: [{ axis: ['ch'], pointTypes: ['node'] }],
			children: [linV],
		};
		return { name: 'Name0', algorithm: { type: 'composite' }, children: [linH] };
	}

	function flatOf(): PptxSmartArtNode[] {
		const one = node('one', 'Node One');
		const two = node('two', 'Node Two', 'one');
		const three = node('three', 'Node Three');
		const four = node('four', 'Node Four');
		const five = node('five', 'Node Five', 'four');
		return [one, two, three, four, five];
	}

	it('produces one parTx candidate per top-level point, each carrying a declaringRoleChain back to linH', () => {
		const flat = flatOf();
		const candidates = collectRawCandidates(buildTree(), flat, 'Name0');
		const parTxCandidates = candidates.filter((c) => c.node.name === 'parTx');
		expect(parTxCandidates.map((c) => c.content.map((n) => n.id))).toStrictEqual([
			['one'],
			['three'],
			['four'],
		]);
		expect(parTxCandidates.map((c) => c.iteration)).toStrictEqual([0, 1, 2]);
		expect(parTxCandidates.every((c) => c.iterationCount === 3)).toBeTruthy();
		expect(parTxCandidates.every((c) => c.declaringRole === 'linV')).toBeTruthy();
		expect(parTxCandidates.every((c) => c.declaringRoleChain?.includes('linH'))).toBeTruthy();
	});

	it("drops desTx's candidate for a childless anchor (Node Three) but keeps its surviving siblings at their TRUE anchor index", () => {
		const flat = flatOf();
		const candidates = collectRawCandidates(buildTree(), flat, 'Name0');
		const desTxCandidates = candidates.filter((c) => c.node.name === 'desTx');
		expect(desTxCandidates.map((c) => c.content.map((n) => n.id))).toStrictEqual([
			['two'],
			['five'],
		]);
		// "Node Three" (anchorIndex 1 of 3) has no children, so its own group
		// is dropped - "Node Four"'s surviving group stays at iteration 2 (NOT
		// renumbered to 1), matching parTx's own 3-anchor numbering so a
		// shared container slices into the SAME 3 columns for both roles.
		expect(desTxCandidates.map((c) => c.iteration)).toStrictEqual([0, 2]);
		expect(desTxCandidates.every((c) => c.iterationCount === 3)).toBeTruthy();
	});

	it('a plain content leaf reached the same way, but with NO structural algorithm on its own ancestor, is unaffected (root-relative fallback, one group)', () => {
		// Same shape, but the wrapper's algorithm is "composite" (excluded from
		// STRUCTURAL_ALG_TYPES) instead of "lin" - NumberedDotsVertical's own
		// `item` shape - so no inherited origin is ever established.
		const titleText: PptxSmartArtLayoutNode = {
			name: 'titleText',
			presentationOf: { axis: ['self'], pointTypes: ['node'] },
		};
		const item: PptxSmartArtLayoutNode = {
			name: 'item',
			algorithm: { type: 'composite' },
			forEachOrigin: { axis: ['ch'], pointTypes: ['node'] },
			children: [titleText],
		};
		const itemsFlow: PptxSmartArtLayoutNode = {
			name: 'itemsFlow',
			algorithm: { type: 'lin' },
			forEach: [{ axis: ['ch'], pointTypes: ['node'] }],
			children: [item],
		};
		const root: PptxSmartArtLayoutNode = {
			name: 'root',
			algorithm: { type: 'composite' },
			children: [itemsFlow],
		};
		const flat = [node('one', 'Node One'), node('two', 'Node Two')];
		const candidates = collectRawCandidates(root, flat, 'root');
		const titleCandidates = candidates.filter((c) => c.node.name === 'titleText');
		// Root-relative fallback resolves "self" against nothing decidable -
		// exactly the pre-existing (unchanged) behaviour for this shape; the
		// important assertion is that this is NOT the round-32 multi-anchor
		// split (it stays a single, un-chained candidate).
		expect(titleCandidates.every((c) => c.declaringRoleChain === undefined)).toBeTruthy();
	});
});

/**
 * `funnel--flat3.pptx`'s exact shape (ROUND 42): `item`'s own `chooseGuard`
 * (`axis="ch" func="cnt" op="gte" val="1"`) was declared directly under the
 * composite root, BEFORE `item`'s own per-item `dgm:forEach` - so it must
 * stay anchored root-relatively (`chooseGuardOrigins[0] === undefined`),
 * never to `item`'s own, deeper `forEachOrigin` (a single, childless data
 * point in a flat dataset), which would wrongly resolve the guard's `axis=
 * "ch"` child count to 0 and drop the item entirely.
 */
describe('guardAllows anchor provenance (round 42)', () => {
	function onePointNoChildren(): PptxSmartArtNode[] {
		return [node('p1', 'P1')];
	}

	function buildItem(chooseGuardOrigins: PptxSmartArtLayoutNode['chooseGuardOrigins']) {
		const item: PptxSmartArtLayoutNode = {
			name: 'item',
			presentationOf: { axis: ['self'], pointTypes: ['node'] },
			// item's OWN forEach binding: p1 itself, which has no children -
			// deeper than (and different from) where the guard below was
			// actually declared.
			forEachOrigin: { axis: ['ch'], start: [1], count: [1] },
			chooseGuard: [{ function: 'cnt', operator: 'gte', value: '1', axis: ['ch'] }],
			chooseGuardOrigins,
		};
		return {
			name: 'Name0',
			algorithm: { type: 'composite' },
			children: [item],
		} as PptxSmartArtLayoutNode;
	}

	it('a guard declared ABOVE any forEach (chooseGuardOrigins[0] undefined) resolves root-relatively, not anchored to a deeper forEachOrigin', () => {
		const flat = onePointNoChildren();
		const candidates = collectRawCandidates(buildItem([undefined]), flat, 'Name0');
		// Root-relative "ch" is the roots shortcut ([p1], count 1): "gte 1" holds.
		expect(candidates.map((c) => c.node.name)).toStrictEqual(['item']);
	});

	it('falls back to forEachOrigin when chooseGuardOrigins is absent entirely (a node built without round-42 provenance, e.g. a hand-built fixture)', () => {
		const flat = onePointNoChildren();
		const item: PptxSmartArtLayoutNode = {
			name: 'item',
			presentationOf: { axis: ['self'], pointTypes: ['node'] },
			forEachOrigin: { axis: ['ch'], start: [1], count: [1] },
			chooseGuard: [{ function: 'cnt', operator: 'gte', value: '1', axis: ['ch'] }],
			// no chooseGuardOrigins at all
		};
		const root: PptxSmartArtLayoutNode = {
			name: 'Name0',
			algorithm: { type: 'composite' },
			children: [item],
		};
		const candidates = collectRawCandidates(root, flat, 'Name0');
		// Anchored to item's own forEachOrigin (p1, childless): "gte 1" is
		// false, so item is dropped - the pre-round-42 behaviour, preserved for
		// a caller with no provenance to offer.
		expect(candidates.map((c) => c.node.name)).not.toContain('item');
	});
});
