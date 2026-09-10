import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode, PptxSmartArtWhen } from '../types';
import { selectConstraints } from './smartart-constraint-branch-index';

function when(overrides: Partial<PptxSmartArtWhen>): PptxSmartArtWhen {
	return { function: 'cnt', operator: 'equ', value: '0', ...overrides };
}

function node(overrides: Partial<PptxSmartArtLayoutNode>): PptxSmartArtLayoutNode {
	return { name: 'composite', ...overrides };
}

describe('smartArt choose-aware constraint selection (selectConstraints)', () => {
	it('picks the constraints of the branch whose guard chain decides true, ignoring the others', () => {
		// `basic-venn--flat3.pptx`'s exact shape: `circ1`'s `ctrX` differs per
		// data-point-count branch under the SAME composite's `dgm:choose`.
		const cnt2 = { type: 'ctrX', for: 'ch', forName: 'circ1', factor: 0.3 };
		const cnt3 = { type: 'ctrX', for: 'ch', forName: 'circ1', factor: 0.5 };
		const composite = node({
			constraintCandidates: [
				{ guard: [when({ value: '2' })], constraint: cnt2 },
				{ guard: [when({ value: '3' })], constraint: cnt3 },
			],
		});
		const selected = selectConstraints(composite, 3, { nodes: [] });
		expect(selected).toStrictEqual([cnt3]);
	});

	it('groups multiple dgm:constr entries under the SAME branch into one result', () => {
		const ctrX = { type: 'ctrX', for: 'ch', forName: 'circ1', factor: 0.5 };
		const ctrY = { type: 'ctrY', for: 'ch', forName: 'circ1', factor: 0.25 };
		const guard = [when({ value: '3' })];
		const composite = node({
			constraintCandidates: [
				{ guard, constraint: ctrX },
				{ guard, constraint: ctrY },
			],
		});
		const selected = selectConstraints(composite, 3, { nodes: [] });
		expect(selected).toStrictEqual([ctrX, ctrY]);
	});

	it('never treats an unconditional (empty-guard) branch as decidably selected', () => {
		// An outermost `dgm:else` with no ancestor `dgm:if` carries no
		// condition of its own - nothing proves its siblings false, so it must
		// stay a fallback, never a positive match, even when it is the only
		// candidate whose guard chain is (vacuously) satisfied.
		const fallback = { type: 'ctrX', for: 'ch', forName: 'circ1', factor: 0.1 };
		const composite = node({
			constraintCandidates: [{ guard: [], constraint: fallback }],
		});
		expect(selectConstraints(composite, 3, { nodes: [] })).toBeUndefined();
	});

	it('returns undefined when no branch decides (falls back to the blind union)', () => {
		const cnt2 = { type: 'ctrX', for: 'ch', forName: 'circ1', factor: 0.3 };
		const composite = node({
			constraintCandidates: [{ guard: [when({ value: '2' })], constraint: cnt2 }],
		});
		// nodeCount=3 never satisfies the cnt==2 guard, and there is no other
		// branch to fall through to.
		expect(selectConstraints(composite, 3, { nodes: [] })).toBeUndefined();
	});

	it('returns undefined for a node with no constraintCandidates at all (the common, unbranched case)', () => {
		expect(selectConstraints(node({}), 3, { nodes: [] })).toBeUndefined();
	});

	it('returns undefined when nodeCount is omitted (no diagram to evaluate the guard against)', () => {
		const cnt3 = { type: 'ctrX', for: 'ch', forName: 'circ1', factor: 0.5 };
		const composite = node({
			constraintCandidates: [{ guard: [when({ value: '3' })], constraint: cnt3 }],
		});
		expect(selectConstraints(composite, undefined, { nodes: [] })).toBeUndefined();
	});
});
