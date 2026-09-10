import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutDefinition, PptxSmartArtLayoutNode } from '../types';
import { buildConstraintIndex } from './smartart-constraint-solver';
import { stackAsColumns } from './smartart-layout-interpreter-item-role-stack-columns';
import type { ItemRoleContent } from './smartart-layout-interpreter-item-role-transition';

/**
 * "Vertical Bracket List"'s own real `linNode` shape: `parTx` (0.25),
 * `bracket` (0.05, decorative, never resolves text), `spH` (0.02,
 * decorative), `desTx` (0.68) - summing to 1.0. `content`'s own order is
 * DELIBERATELY [desTx, parTx] (the reverse of document/declaration order),
 * matching the real corpus bug round 27 found: `resolveItemTextRoles`'s own
 * role-collection walk does not preserve the wrapper's document order.
 */
function verticalBracketListColumns(): {
	parTx: PptxSmartArtLayoutNode;
	desTx: PptxSmartArtLayoutNode;
	index: ReturnType<typeof buildConstraintIndex>;
} {
	const parTx: PptxSmartArtLayoutNode = { name: 'parTx' };
	const desTx: PptxSmartArtLayoutNode = { name: 'desTx' };
	const definition: PptxSmartArtLayoutDefinition = {
		rootNode: {
			name: 'linNode',
			algorithm: { type: 'lin', parameters: [{ type: 'linDir', value: 'fromL' }] },
			children: [parTx, { name: 'bracket' }, { name: 'spH' }, desTx],
			constraints: [
				{ type: 'w', for: 'ch', forName: 'parTx', referenceType: 'w', factor: 0.25 },
				{ type: 'w', for: 'ch', forName: 'bracket', referenceType: 'w', factor: 0.05 },
				{ type: 'w', for: 'ch', forName: 'spH', referenceType: 'w', factor: 0.02 },
				{ type: 'w', for: 'ch', forName: 'desTx', referenceType: 'w', factor: 0.68 },
			],
		},
	};
	return { parTx, desTx, index: buildConstraintIndex(definition) };
}

function baseOriginal(text: string) {
	return {
		kind: 'rect' as const,
		key: 'k',
		x: 0,
		y: 0,
		width: 867,
		height: 152,
		rx: 0,
		fill: '#fff',
		stroke: 'none',
		strokeWidth: 0,
		opacity: 1,
		text,
		fontSize: 60,
		textX: 0,
		textY: 0,
	};
}

describe('stackAsColumns', () => {
	it("lays two content columns out LEFT TO RIGHT in the wrapper's own DECLARED order, never `content`'s own array order, reserving the decorative roles' own width as a gap between them (round 27, \"Vertical Bracket List\")", () => {
		const { parTx, desTx, index } = verticalBracketListColumns();
		const original = baseOriginal('Node One');
		const box = { x: 53, y: 120, width: 867, height: 152 };
		// content in REVERSED order vs the wrapper's own declaration (desTx first).
		const content: ItemRoleContent[] = [
			{ role: desTx, nodeIds: ['child'] },
			{ role: parTx, nodeIds: ['self'] },
		];
		const [narrowCol, wideCol] = stackAsColumns(
			content,
			'linNode',
			original,
			box,
			index,
			undefined,
		);
		// parTx (0.25) must come out FIRST/LEFT despite being second in `content`.
		expect(narrowCol.x).toBeCloseTo(53, 0);
		expect(narrowCol.width).toBeCloseTo(0.25 * 867, 0);
		// desTx (0.68) starts AFTER parTx's own width PLUS the bracket/spH gap
		// (0.05+0.02=0.07 of 867 =~ 60.7), not immediately after parTx.
		const expectedGap = (0.05 + 0.02) * 867;
		expect(wideCol.x).toBeCloseTo(53 + 0.25 * 867 + expectedGap, 0);
		expect(wideCol.width).toBeCloseTo(0.68 * 867, 0);
		// Total declared weight includes the decorative roles too (round 20's
		// own non-text-sibling fix, mirrored here for columns): the two visible
		// columns' widths plus the reserved gap sum to the full box width.
		expect(narrowCol.width + expectedGap + wideCol.width).toBeCloseTo(867, 0);
	});

	it('degrades to a single, correctly-sized/positioned column for a LEAF point with only one resolved role ("Node Three", no child)', () => {
		const { parTx, index } = verticalBracketListColumns();
		const original = baseOriginal('Node Three');
		const box = { x: 53, y: 310, width: 867, height: 152 };
		const content: ItemRoleContent[] = [{ role: parTx, nodeIds: ['self'] }];
		const [onlyCol] = stackAsColumns(content, 'linNode', original, box, index, undefined);
		expect(onlyCol.x).toBeCloseTo(53, 0);
		expect(onlyCol.width).toBeCloseTo(0.25 * 867, 0);
	});

	it('falls back to an even split over just `content` when the declaring role declares no `w`-weighted children at all', () => {
		const a: PptxSmartArtLayoutNode = { name: 'a' };
		const b: PptxSmartArtLayoutNode = { name: 'b' };
		const index = buildConstraintIndex({ rootNode: { name: 'noConstraints', children: [a, b] } });
		const original = baseOriginal('x');
		const box = { x: 0, y: 0, width: 200, height: 50 };
		const content: ItemRoleContent[] = [
			{ role: a, nodeIds: ['1'] },
			{ role: b, nodeIds: ['2'] },
		];
		const [colA, colB] = stackAsColumns(content, 'noConstraints', original, box, index, undefined);
		expect(colA.width).toBeCloseTo(100, 0);
		expect(colB.width).toBeCloseTo(100, 0);
		expect(colA.x).toBeCloseTo(0, 0);
		expect(colB.x).toBeCloseTo(100, 0);
	});
});
