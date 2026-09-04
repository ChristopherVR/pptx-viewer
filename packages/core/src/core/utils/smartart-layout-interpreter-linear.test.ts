import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode, PptxSmartArtNode } from '../types';
import { arrangeSnake } from './smartart-layout-interpreter-linear';
import type { ArrangementPlan } from './smartart-layout-interpreter-model';

function planFor(node: PptxSmartArtLayoutNode): ArrangementPlan {
	return { kind: 'snake', node };
}

function nodes(n: number): PptxSmartArtNode[] {
	return Array.from({ length: n }, (_, i) => ({ id: `n${i}`, text: `${i}` }));
}

/** Read back each rendered node's `(col, row)` grid cell from its pixel position. */
function cellsOf(
	result: ReturnType<typeof arrangeSnake>,
	cellW: number,
	cellH: number,
): Array<{ col: number; row: number }> {
	return result.nodes.map((rendered) => {
		if (rendered.kind !== 'rect') {
			throw new Error('expected rect nodes');
		}
		return {
			col: Math.round((rendered.x - 6) / cellW),
			row: Math.round((rendered.y - 6) / cellH),
		};
	});
}

// G1: `grDir`/`flowDir`/`contDir`/`bkpt` algorithm params on `dgm:alg[@type=snake]`.
describe('arrangeSnake DiagramML params', () => {
	it('defaults to a row-major boustrophedon grid when no params are present (no regression)', () => {
		const plan = planFor({ algorithm: { type: 'snake' }, children: [{ name: 'item' }] });
		const result = arrangeSnake(plan, nodes(6), { width: 300, height: 200 }, ['#fff'], 'flat', 'e');
		// 6 nodes, box 300x200 -> heuristic picks cols=3,rows=2 (matches the
		// pre-existing sqrt(n*w/h) guess). Row 1 (index 3..5) should reverse.
		expect(result.nodes).toHaveLength(6);
		const cellW = result.nodes[0].kind === 'rect' ? result.nodes[0].width : 0;
		const cellH = result.nodes[0].kind === 'rect' ? result.nodes[0].height : 0;
		const cells = cellsOf(result, cellW + 1e-9, cellH + 1e-9);
		// Row 0 reads left-to-right; row 1 (the alternate row) reads right-to-left.
		expect(cells[0].row).toBe(0);
		expect(cells[3].row).toBe(1);
		expect(cells[3].col).toBeGreaterThan(cells[5].col);
	});

	it('contDir=sameDir disables the boustrophedon reversal', () => {
		const plan = planFor({
			algorithm: { type: 'snake', parameters: [{ type: 'contDir', value: 'sameDir' }] },
			children: [{ name: 'item' }],
		});
		const result = arrangeSnake(plan, nodes(6), { width: 300, height: 200 }, ['#fff'], 'flat', 'e');
		const cellW = result.nodes[0].kind === 'rect' ? result.nodes[0].width : 0;
		const cellH = result.nodes[0].kind === 'rect' ? result.nodes[0].height : 0;
		const cells = cellsOf(result, cellW + 1e-9, cellH + 1e-9);
		// Every row now reads left-to-right: index 3 (first of row 1) is col 0.
		expect(cells[3]).toStrictEqual({ col: 0, row: 1 });
		expect(cells[5]).toStrictEqual({ col: 2, row: 1 });
	});

	it('flowDir=col fills down each column before moving to the next', () => {
		const plan = planFor({
			algorithm: {
				type: 'snake',
				parameters: [
					{ type: 'flowDir', value: 'col' },
					{ type: 'bkpt', value: 'fixed' },
				],
			},
			constraints: [{ type: 'bkPtFixedVal', value: 3 }],
			children: [{ name: 'item' }],
		});
		const result = arrangeSnake(plan, nodes(6), { width: 200, height: 300 }, ['#fff'], 'flat', 'e');
		const cellW = result.nodes[0].kind === 'rect' ? result.nodes[0].width : 0;
		const cellH = result.nodes[0].kind === 'rect' ? result.nodes[0].height : 0;
		const cells = cellsOf(result, cellW + 1e-9, cellH + 1e-9);
		// bkPtFixedVal=3 -> 3 rows/column; index 3 starts column 1. contDir
		// defaults to reversal, so column 1 (the alternate line) reads bottom-up.
		expect(cells[0]).toStrictEqual({ col: 0, row: 0 });
		expect(cells[2]).toStrictEqual({ col: 0, row: 2 });
		expect(cells[3]).toStrictEqual({ col: 1, row: 2 });
		expect(cells[5]).toStrictEqual({ col: 1, row: 0 });
	});

	it('grDir=tR mirrors the column axis so the grid grows from the top-right', () => {
		const plan = planFor({
			algorithm: {
				type: 'snake',
				parameters: [
					{ type: 'grDir', value: 'tR' },
					{ type: 'contDir', value: 'sameDir' },
					{ type: 'bkpt', value: 'fixed' },
				],
			},
			constraints: [{ type: 'bkPtFixedVal', value: 3 }],
			children: [{ name: 'item' }],
		});
		const result = arrangeSnake(plan, nodes(6), { width: 300, height: 200 }, ['#fff'], 'flat', 'e');
		const cellW = result.nodes[0].kind === 'rect' ? result.nodes[0].width : 0;
		const cellH = result.nodes[0].kind === 'rect' ? result.nodes[0].height : 0;
		const cells = cellsOf(result, cellW + 1e-9, cellH + 1e-9);
		// sameDir + fixed 3-per-row -> row-major reading order, but grDir=tR
		// mirrors columns: item 0 lands at the rightmost column (2), not 0.
		expect(cells[0]).toStrictEqual({ col: 2, row: 0 });
		expect(cells[2]).toStrictEqual({ col: 0, row: 0 });
	});
});
