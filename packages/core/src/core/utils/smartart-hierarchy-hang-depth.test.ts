import { describe, expect, it } from 'vitest';

import { buildTree } from './smartart-helpers';
import { computeHangShape } from './smartart-hierarchy-hang-depth';

describe('computeHangShape', () => {
	it('a lone root with no children: fannedGenerations=1, maxHangDepth=0', () => {
		const roots = buildTree([{ id: 'r', text: 'Root' }]);
		expect(computeHangShape(roots, false, Number.POSITIVE_INFINITY)).toStrictEqual({
			fannedGenerations: 1,
			maxHangDepth: 0,
		});
	});

	// `organization-chart--flat3.pptx`'s own shape: root + 2 leaf children.
	// The root's own children always fan (never hang), so there is no
	// hanging tail at all here.
	it("root's own children fan with no hanging tail (organization-chart--flat3.pptx shape)", () => {
		const roots = buildTree([
			{ id: 'm', text: 'Alpha' },
			{ id: 'c1', text: 'Beta', parentId: 'm' },
			{ id: 'c2', text: 'Gamma', parentId: 'm' },
		]);
		expect(computeHangShape(roots, false, Number.POSITIVE_INFINITY)).toStrictEqual({
			fannedGenerations: 2,
			maxHangDepth: 0,
		});
	});

	// `organization-chart--hier5.pptx`'s own shape: root -> 2 children, each
	// with exactly one further child. Neither child is a "solo chain link"
	// (each has a real sibling in the root's own fanned row), so both hang
	// their own single child one hop down.
	it('two non-solo children each hang their own single child (organization-chart--hier5.pptx shape)', () => {
		const roots = buildTree([
			{ id: 'm', text: 'Node One' },
			{ id: 'c1', text: 'Node Two', parentId: 'm' },
			{ id: 'c2', text: 'Node Three', parentId: 'm' },
			{ id: 'g1', text: 'Node Five', parentId: 'c1' },
			{ id: 'g2', text: 'Node Four', parentId: 'c2' },
		]);
		expect(computeHangShape(roots, false, Number.POSITIVE_INFINITY)).toStrictEqual({
			fannedGenerations: 2,
			maxHangDepth: 1,
		});
	});

	// `organization-chart--hier8.pptx`'s own real tree shape (see
	// `diag-hangshape.ts` in the scratchpad, verified against the genuine
	// fixture's own parsed data model): the root has exactly ONE child
	// ("Branch A Child" - a solo chain link, no real siblings of its own),
	// whose own 5 ordinary children (one of which nests one further hanging
	// generation) therefore continue fanning per `placeAt`'s own
	// "solo chain link" rule (`spanW === normal.length`) - a SECOND fanned
	// generation past the root's own trivial 1-wide row, not present in the
	// simpler `organization-chart--hier5.pptx` shape above.
	it('a solo chain link continues fanning its own wide child row (organization-chart--hier8.pptx shape)', () => {
		const roots = buildTree([
			{ id: 'root', text: 'Branch A Root' },
			{ id: 'child', text: 'Branch A Child', parentId: 'root' },
			{ id: 'g1', text: 'Branch A Grandchild', parentId: 'child' },
			{ id: 'g2', text: 'Branch B Root', parentId: 'child' },
			{ id: 'g3', text: 'Branch B Child', parentId: 'child' },
			{ id: 'g4', text: 'Branch B Grandchild', parentId: 'child' },
			{ id: 'g5', text: 'Branch C Child', parentId: 'child' },
			{ id: 'gg1', text: 'Branch C Root', parentId: 'g4' },
		]);
		expect(computeHangShape(roots, true, 3)).toStrictEqual({
			fannedGenerations: 3,
			maxHangDepth: 1,
		});
	});

	// A shared-row node (real siblings of its own, `smartart-orgchart-
	// hierbranch.pptx`'s "Report One") never continues fanning even when its
	// own child count happens to match `spanW` - see `placeAt`'s own
	// `isSoloChainLink` doc comment for why this guard is essential.
	it('a node sharing a fanned row with real siblings hangs its children, never continues fanning', () => {
		const roots = buildTree([
			{ id: 'm', text: 'Manager' },
			{ id: 'r1', text: 'Report One', parentId: 'm' },
			{ id: 'r2', text: 'Report Two', parentId: 'm' },
			{ id: 'a', text: 'Analyst One', parentId: 'r1' },
			{ id: 'b', text: 'Analyst Two', parentId: 'r1' },
		]);
		expect(computeHangShape(roots, false, Number.POSITIVE_INFINITY)).toStrictEqual({
			fannedGenerations: 2,
			maxHangDepth: 1,
		});
	});

	it('orgChart assistants never widen a fanned row and never count toward hang depth on their own', () => {
		const roots = buildTree([
			{ id: 'm', text: 'Manager' },
			{ id: 'a1', text: 'Assistant', parentId: 'm', nodeType: 'asst' },
			{ id: 'c1', text: 'Child One', parentId: 'm' },
			{ id: 'c2', text: 'Child Two', parentId: 'm' },
		]);
		const withOrgChart = computeHangShape(roots, true, Number.POSITIVE_INFINITY);
		expect(withOrgChart).toStrictEqual({ fannedGenerations: 2, maxHangDepth: 0 });
	});
});
