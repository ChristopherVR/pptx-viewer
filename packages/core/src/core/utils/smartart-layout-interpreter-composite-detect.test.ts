import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode } from '../types';
import {
	hasStructuralDescendant,
	isContinuationForEach,
	isLayoutNodeOrDescendantOf,
} from './smartart-layout-interpreter-composite-detect';

describe('isContinuationForEach', () => {
	it('is true for a `dgm:forEach axis="ch" st="2"` (a CONTINUATION iterator)', () => {
		const node: PptxSmartArtLayoutNode = {
			name: 'vertFlow',
			forEach: [{ axis: ['ch'], pointTypes: ['node'], start: [2] }],
		};
		expect(isContinuationForEach(node)).toBeTruthy();
	});

	it("is false when `st` is absent (the diagram's own top-level iterator)", () => {
		const node: PptxSmartArtLayoutNode = {
			name: 'itemsFlow',
			forEach: [{ axis: ['ch'], pointTypes: ['node'] }],
		};
		expect(isContinuationForEach(node)).toBeFalsy();
	});

	it('is false when `st` is exactly 1 (starts from the first point)', () => {
		const node: PptxSmartArtLayoutNode = {
			name: 'itemsFlow',
			forEach: [{ axis: ['ch'], pointTypes: ['node'], start: [1] }],
		};
		expect(isContinuationForEach(node)).toBeFalsy();
	});

	it('is false for a non-`ch` axis (a self/transition iterator, not a point continuation)', () => {
		const node: PptxSmartArtLayoutNode = {
			name: 'sibTransHolder',
			forEach: [{ axis: ['self'], pointTypes: ['parTrans'], start: [2] }],
		};
		expect(isContinuationForEach(node)).toBeFalsy();
	});

	it('is false when there is no forEach at all', () => {
		expect(isContinuationForEach({ name: 'leaf' })).toBeFalsy();
	});

	/**
	 * `basic-venn--hier5.pptx`'s root `compositeShape` carries SEVEN
	 * independent single-point `axis="ch"` `forEach` entries (`st="1"`
	 * through `st="7"`, one per possible circle count) - a `.some` match
	 * wrongly branded it a "continuation" because six of the seven start
	 * beyond point 1, excluding the composite root from `discoverArrangement`
	 * entirely (measured: fell through to the last-resort single-leaf `tx`
	 * plan). The FIRST entry (`st` absent, i.e. `1`) covers point 1, so the
	 * node as a whole is not a pure continuation.
	 */
	it("is false for MULTIPLE forEach entries where one covers point 1 (`Basic Venn`'s `compositeShape`)", () => {
		const node: PptxSmartArtLayoutNode = {
			name: 'compositeShape',
			forEach: [
				{ axis: ['ch'], pointTypes: ['node'], count: [1] },
				{ axis: ['ch'], pointTypes: ['node'], start: [2], count: [1] },
				{ axis: ['ch'], pointTypes: ['node'], start: [3], count: [1] },
			],
		};
		expect(isContinuationForEach(node)).toBeFalsy();
	});

	it('is true when EVERY forEach entry skips point 1 (a genuine multi-entry continuation)', () => {
		const node: PptxSmartArtLayoutNode = {
			name: 'multiContinuation',
			forEach: [
				{ axis: ['ch'], pointTypes: ['node'], start: [2] },
				{ axis: ['ch'], pointTypes: ['node'], start: [3] },
			],
		};
		expect(isContinuationForEach(node)).toBeTruthy();
	});
});

/**
 * `Table List` (`table-list--hier5.pptx`): the top-level `composite`'s ONLY
 * mapped slot is `pillars`, a DIRECT `dgm:alg type="lin"` reached through a
 * `dgm:forEach axis="ch" st="2"` (a continuation - the composite's OTHER
 * slot, `roof`, separately consumes point 1). Before this fix,
 * `hasStructuralDescendant` disqualified the outer composite from its own
 * candidacy (deferring to `pillars` as if it were a genuine per-item nested
 * arranger like `NumberedDotsVertical`'s `itemsFlow`), so `discoverArrangement`
 * never even considered the composite - see `smartart-layout-interpreter-
 * model.test.ts`'s own `discoverArrangement excludes a continuation forEach`
 * suite for the end-to-end assertion.
 */
describe('hasStructuralDescendant excludes a continuation-only descendant', () => {
	it('returns false when the only structural descendant is a continuation forEach', () => {
		const pillars: PptxSmartArtLayoutNode = {
			name: 'pillars',
			algorithm: { type: 'lin' },
			forEach: [{ axis: ['ch'], pointTypes: ['node'], start: [2] }],
		};
		const composite: PptxSmartArtLayoutNode = {
			name: 'composite',
			algorithm: { type: 'composite' },
			children: [pillars],
		};
		expect(hasStructuralDescendant(composite)).toBeFalsy();
	});

	it('still returns true for a genuine per-item nested arranger (no `st` restriction)', () => {
		const itemsFlow: PptxSmartArtLayoutNode = {
			name: 'itemsFlow',
			algorithm: { type: 'lin' },
			forEach: [{ axis: ['ch'], pointTypes: ['node'] }],
		};
		const root: PptxSmartArtLayoutNode = {
			name: 'root',
			algorithm: { type: 'composite' },
			children: [itemsFlow],
		};
		expect(hasStructuralDescendant(root)).toBeTruthy();
	});
});

/**
 * `nested-target--hier5.pptx`'s own shape (`Name0` -> `outerBox` ->
 * `outerBoxChildren`): `discoverArrangement` uses this to keep a SIBLING
 * alternative slot (`middleBox`/`centerBox`, flattened onto `Name0.children`
 * the same way `outerBox` is) from independently re-asserting a whole-
 * diagram algorithm pick once `Name0` has already been found to have its
 * OWN choose wrongly tunnelling into one such slot.
 */
describe('isLayoutNodeOrDescendantOf', () => {
	const outerBoxChildren: PptxSmartArtLayoutNode = { name: 'outerBoxChildren' };
	const outerBox: PptxSmartArtLayoutNode = { name: 'outerBox', children: [outerBoxChildren] };
	const middleBox: PptxSmartArtLayoutNode = { name: 'middleBox' };
	const name0: PptxSmartArtLayoutNode = { name: 'Name0', children: [outerBox, middleBox] };

	it('is true for the ancestor itself', () => {
		expect(isLayoutNodeOrDescendantOf(name0, name0)).toBeTruthy();
	});

	it('is true for a direct child', () => {
		expect(isLayoutNodeOrDescendantOf(name0, outerBox)).toBeTruthy();
	});

	it('is true for a deeper descendant', () => {
		expect(isLayoutNodeOrDescendantOf(name0, outerBoxChildren)).toBeTruthy();
	});

	it('is false for a SIBLING outside the ancestor subtree', () => {
		expect(isLayoutNodeOrDescendantOf(outerBox, middleBox)).toBeFalsy();
	});

	it('is false for an unrelated node', () => {
		expect(isLayoutNodeOrDescendantOf(outerBox, { name: 'unrelated' })).toBeFalsy();
	});
});
