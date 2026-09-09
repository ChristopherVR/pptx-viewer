import { describe, expect, it } from 'vitest';

import type { PptxSmartArtNode, PptxSmartArtWhen } from '../types';
import { evaluateWhen } from './smartart-layout-interpreter-when';
import type { WhenContext } from './smartart-layout-interpreter-when';

function when(fn: string, operator: string, value: string, argument?: string): PptxSmartArtWhen {
	return { function: fn, operator, value, ...(argument ? { argument } : {}) };
}

// G8: `dgm:if/@func` beyond the pre-existing `cnt` support.
describe('evaluateWhen', () => {
	it('cnt: unaffected by the new context param (regression check)', () => {
		expect(evaluateWhen(when('cnt', 'equ', '3'), 3, {})).toBeTruthy();
		expect(evaluateWhen(when('cnt', 'gt', '3'), 5, {})).toBeTruthy();
	});

	it('pos: decides against context.position with every operator', () => {
		const ctx: WhenContext = { position: 3 };
		expect(evaluateWhen(when('pos', 'equ', '3'), 0, ctx)).toBeTruthy();
		expect(evaluateWhen(when('pos', 'neq', '3'), 0, ctx)).toBeFalsy();
		expect(evaluateWhen(when('pos', 'gt', '2'), 0, ctx)).toBeTruthy();
		expect(evaluateWhen(when('pos', 'lt', '2'), 0, ctx)).toBeFalsy();
		expect(evaluateWhen(when('pos', 'gte', '3'), 0, ctx)).toBeTruthy();
		expect(evaluateWhen(when('pos', 'lte', '3'), 0, ctx)).toBeTruthy();
	});

	it('pos: undecidable without context.position', () => {
		expect(evaluateWhen(when('pos', 'equ', '1'), 0, {})).toBeUndefined();
	});

	it('revPos: measures from the end using total and position', () => {
		// 5 siblings, position 4 -> revPos = 5-4+1 = 2 (second from last).
		const ctx: WhenContext = { position: 4, total: 5 };
		expect(evaluateWhen(when('revPos', 'equ', '2'), 0, ctx)).toBeTruthy();
		// The very last item (position === total) has revPos === 1.
		expect(evaluateWhen(when('revPos', 'equ', '1'), 0, { position: 5, total: 5 })).toBeTruthy();
	});

	it('revPos: undecidable without both position and total', () => {
		expect(evaluateWhen(when('revPos', 'equ', '1'), 0, { position: 1 })).toBeUndefined();
		expect(evaluateWhen(when('revPos', 'equ', '1'), 0, { total: 5 })).toBeUndefined();
	});

	it('posEven/posOdd: decide against context.position parity', () => {
		expect(evaluateWhen(when('posEven', 'equ', '1'), 0, { position: 2 })).toBeTruthy();
		expect(evaluateWhen(when('posEven', 'equ', '1'), 0, { position: 3 })).toBeFalsy();
		expect(evaluateWhen(when('posOdd', 'equ', '1'), 0, { position: 3 })).toBeTruthy();
		expect(evaluateWhen(when('posOdd', 'equ', '1'), 0, { position: 2 })).toBeFalsy();
	});

	it('posEven/posOdd: undecidable without context.position', () => {
		expect(evaluateWhen(when('posEven', 'equ', '1'), 0, {})).toBeUndefined();
	});

	it('depth/maxDepth: decide against their own context fields', () => {
		expect(evaluateWhen(when('depth', 'gt', '1'), 0, { depth: 2 })).toBeTruthy();
		expect(evaluateWhen(when('depth', 'gt', '1'), 0, {})).toBeUndefined();
		expect(evaluateWhen(when('maxDepth', 'equ', '3'), 0, { maxDepth: 3 })).toBeTruthy();
		expect(evaluateWhen(when('maxDepth', 'equ', '3'), 0, {})).toBeUndefined();
	});

	it('var: compares a string presLayoutVars field by equality', () => {
		const ctx: WhenContext = { presLayoutVars: { direction: 'rev' } };
		expect(evaluateWhen(when('var', 'equ', 'rev', 'dir'), 0, ctx)).toBeTruthy();
		expect(evaluateWhen(when('var', 'neq', 'norm', 'dir'), 0, ctx)).toBeTruthy();
		expect(evaluateWhen(when('var', 'equ', 'norm', 'dir'), 0, ctx)).toBeFalsy();
	});

	it('var: compares a boolean presLayoutVars field by equality', () => {
		const ctx: WhenContext = { presLayoutVars: { orgChart: true } };
		expect(evaluateWhen(when('var', 'equ', 'true', 'orgChart'), 0, ctx)).toBeTruthy();
	});

	it('var: compares a numeric presLayoutVars field with ordering operators', () => {
		const ctx: WhenContext = { presLayoutVars: { childMax: 4 } };
		expect(evaluateWhen(when('var', 'gt', '3', 'chMax'), 0, ctx)).toBeTruthy();
		expect(evaluateWhen(when('var', 'lte', '4', 'chMax'), 0, ctx)).toBeTruthy();
	});

	it('var: undecidable without presLayoutVars, an unknown @arg, or a gt/lt op on a string field', () => {
		expect(evaluateWhen(when('var', 'equ', 'rev', 'dir'), 0, {})).toBeUndefined();
		expect(
			evaluateWhen(when('var', 'equ', 'x', 'notAVariable'), 0, {
				presLayoutVars: { direction: 'rev' },
			}),
		).toBeUndefined();
		expect(
			evaluateWhen(when('var', 'gt', 'norm', 'dir'), 0, { presLayoutVars: { direction: 'rev' } }),
		).toBeUndefined();
	});

	it('var: arg="dir" defaults to "norm" when presLayoutVars carries no explicit direction (ECMA-376 default)', () => {
		// Real built-in layoutDefs (measured against `basic-process--hier5.pptx`
		// in `smartart-gallery-ground-truth.test.ts`) gate their primary
		// arrangement algorithm behind `func="var" arg="dir" op="equ" val="norm"`
		// and never write an explicit `dgm:dir` for the common (non-reversed)
		// case, so `presLayoutVars` here carries no `direction` field at all -
		// this must decide `true`, not stay undecidable, or the interpreter
		// never engages for the majority of the built-in gallery.
		const ctx: WhenContext = { presLayoutVars: {} };
		expect(evaluateWhen(when('var', 'equ', 'norm', 'dir'), 0, ctx)).toBeTruthy();
		expect(evaluateWhen(when('var', 'equ', 'rev', 'dir'), 0, ctx)).toBeFalsy();
		expect(evaluateWhen(when('var', 'neq', 'norm', 'dir'), 0, ctx)).toBeFalsy();
	});

	it('var: an explicit direction still wins over the "norm" default', () => {
		const ctx: WhenContext = { presLayoutVars: { direction: 'rev' } };
		expect(evaluateWhen(when('var', 'equ', 'norm', 'dir'), 0, ctx)).toBeFalsy();
		expect(evaluateWhen(when('var', 'equ', 'rev', 'dir'), 0, ctx)).toBeTruthy();
	});

	it('var: only "dir" gets a default - an absent non-defaulted field stays undecidable', () => {
		expect(
			evaluateWhen(when('var', 'equ', 'l', 'hierBranch'), 0, { presLayoutVars: {} }),
		).toBeUndefined();
	});

	it('unknown func returns undefined (keeps the caller on its blind fallback)', () => {
		expect(evaluateWhen(when('bogus', 'equ', '1'), 3, {})).toBeUndefined();
	});

	// G-radial: `func="cnt"` with a COMPOUND `@axis` (ECMA-376 21.4.7.5) - the
	// real condition `basic-radial--hier5.pptx`'s "cycle" layoutNode uses to
	// decide `stAng` (`<dgm:if axis="ch ch" ptType="node node" st="1 1"
	// cnt="1 0" func="cnt" op="lte" val="1">`, wrapped one level inside the
	// `dir="norm"` choose's own `<dgm:if>`). COM-verified: this diagram's hub
	// ("Node One") has 3 real satellites (Two/Three/Four), so "my first
	// child's own children" = 3, `3 <= 1` is FALSE - PowerPoint renders the
	// ELSE branch's `stAng=0`, reproduced exactly by the SAME formula
	// `computeCycleRingLayout` already uses for `basic-cycle`
	// (`angle = stAngDeg + i*step - 90`) once `stAng=0` is substituted for the
	// wrongly-resolved `90`.
	describe('cnt: compound @axis navigation (ECMA-376 21.4.7.5)', () => {
		/** "Node One" (root/hub) -> Two/Three/Four; Four -> Five (a deeper solo grandchild). */
		function radialHubNodes(): PptxSmartArtNode[] {
			return [
				{ id: 'one', text: 'Node One' },
				{ id: 'two', text: 'Node Two', parentId: 'one' },
				{ id: 'three', text: 'Node Three', parentId: 'one' },
				{ id: 'four', text: 'Node Four', parentId: 'one' },
				{ id: 'five', text: 'Node Five', parentId: 'four' },
			];
		}

		function compoundCnt(op: string, val: string): PptxSmartArtWhen {
			return {
				function: 'cnt',
				operator: op,
				value: val,
				axis: ['ch', 'ch'],
				pointTypes: ['node', 'node'],
				start: [1, 1],
				count: [1, 0],
			};
		}

		it('"basic-radial--hier5.pptx" own condition (st="1 1" cnt="1 0" <= 1): FALSE for a 3-satellite hub', () => {
			const ctx: WhenContext = { nodes: radialHubNodes() };
			// hop 1 (ch, st=1 cnt=1): the diagram's only root, "Node One".
			// hop 2 (ch, st=1 cnt=0 = unbounded): ALL of Node One's own
			// children = Two/Three/Four = 3.
			expect(evaluateWhen(compoundCnt('lte', '1'), 5, ctx)).toBeFalsy();
			expect(evaluateWhen(compoundCnt('gt', '1'), 5, ctx)).toBeTruthy();
			expect(evaluateWhen(compoundCnt('equ', '3'), 5, ctx)).toBeTruthy();
		});

		it('the SAME condition is TRUE for a hub with only 1 real satellite', () => {
			const oneSatellite: PptxSmartArtNode[] = [
				{ id: 'one', text: 'Node One' },
				{ id: 'two', text: 'Node Two', parentId: 'one' },
			];
			const ctx: WhenContext = { nodes: oneSatellite };
			expect(evaluateWhen(compoundCnt('lte', '1'), 2, ctx)).toBeTruthy();
		});

		it('falls back to the plain nodeCount when no `nodes` context is supplied (no regression for an existing caller)', () => {
			// Same compound condition, but the caller has no data-model tree to
			// offer (e.g. a bare `chooseAlgType` unit test) - must keep comparing
			// the coarse `nodeCount` scalar exactly as before this axis
			// navigation existed, not silently decide `undefined`/wrong.
			expect(evaluateWhen(compoundCnt('lte', '1'), 1, {})).toBeTruthy();
			expect(evaluateWhen(compoundCnt('lte', '1'), 5, {})).toBeFalsy();
		});

		it('a bare single-hop axis with no st/cnt ALSO navigates the real tree, not the caller\'s flat nodeCount ("radial-list--hier5.pptx"\'s own satellite-count choose: 3 top-level satellites, not the flat total of 5)', () => {
			const bareAxisCnt: PptxSmartArtWhen = {
				function: 'cnt',
				operator: 'gt',
				value: '2',
				axis: ['ch'],
				pointTypes: ['node'],
			};
			// `radialHubNodes()`'s own top-level (root-only) axis="ch" count is 1
			// ("Node One", the only root) - genuinely FALSE for "gt 2", even
			// though the flat `nodeCount` (5, every point at every depth) would
			// say TRUE. See `evaluateWhen`'s own doc comment: this generalisation
			// was tried, found to regress `radial-list--hier5.pptx` further in
			// isolation, then landed together with the fixes that regression was
			// exposing (`resolveRingItemNode`'s `forEachOrigin` check, the
			// `hasHub`/`hubRatio` fallback suppression, and
			// `deriveCompositeSquareChildAspect`) - both `radial-list` and
			// `tabbed-arc--hier5.pptx` measurably improve with all of them
			// together (see the SmartArt round-3 report for exact numbers).
			expect(evaluateWhen(bareAxisCnt, 5, { nodes: radialHubNodes() })).toBeFalsy();
		});

		it('a bare single-hop axis counting the ACTUAL top-level set ("Node One" has 3 real children) resolves TRUE for a matching threshold', () => {
			const bareAxisCnt: PptxSmartArtWhen = {
				function: 'cnt',
				operator: 'equ',
				value: '1',
				axis: ['ch'],
				pointTypes: ['node'],
			};
			// Only ONE root ("Node One") in `radialHubNodes()` - genuinely 1, not
			// the flat total of 5.
			expect(evaluateWhen(bareAxisCnt, 5, { nodes: radialHubNodes() })).toBeTruthy();
		});

		it('falls back to nodeCount for a bare single-hop axis when no `nodes` context is supplied (no regression for an existing caller)', () => {
			const bareAxisCnt: PptxSmartArtWhen = {
				function: 'cnt',
				operator: 'gt',
				value: '2',
				axis: ['ch'],
				pointTypes: ['node'],
			};
			expect(evaluateWhen(bareAxisCnt, 5, {})).toBeTruthy();
		});
	});
});
