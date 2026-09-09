import { describe, expect, it } from 'vitest';

import type { ArrangementPlan } from './smartart-layout-interpreter-model';
import { snakeCell, snakeGridDims } from './smartart-layout-snake-grid';

describe('snakeGridDims', () => {
	it('uses the area-based guess when no bkpt is declared', () => {
		const plan: ArrangementPlan = { kind: 'snake', node: { algorithm: { type: 'snake' } } };
		const dims = snakeGridDims(plan, 6, 300, 200, 'row');
		expect(dims.cols * dims.rows).toBeGreaterThanOrEqual(6);
	});

	it('bkpt=fixed with bkPtFixedVal fixes the row line length', () => {
		const plan: ArrangementPlan = {
			kind: 'snake',
			node: {
				algorithm: { type: 'snake', parameters: [{ type: 'bkpt', value: 'fixed' }] },
				constraints: [{ type: 'bkPtFixedVal', value: 3 }],
			},
		};
		const dims = snakeGridDims(plan, 6, 300, 200, 'row');
		expect(dims).toStrictEqual({ cols: 3, rows: 2 });
	});

	it('flowDir=col fixes the column line length instead', () => {
		const plan: ArrangementPlan = {
			kind: 'snake',
			node: {
				algorithm: { type: 'snake', parameters: [{ type: 'bkpt', value: 'fixed' }] },
				constraints: [{ type: 'bkPtFixedVal', value: 3 }],
			},
		};
		const dims = snakeGridDims(plan, 6, 300, 200, 'col');
		expect(dims).toStrictEqual({ cols: 2, rows: 3 });
	});
});

describe('snakeCell', () => {
	it('reads row-major, left-to-right on the first line', () => {
		const dims = { cols: 3, rows: 2 };
		expect(snakeCell(0, dims, 'row', false, 'tL')).toStrictEqual({ col: 0, row: 0 });
		expect(snakeCell(2, dims, 'row', false, 'tL')).toStrictEqual({ col: 2, row: 0 });
	});

	it('reverses the alternate line when sameDir is false (boustrophedon)', () => {
		const dims = { cols: 3, rows: 2 };
		expect(snakeCell(3, dims, 'row', false, 'tL')).toStrictEqual({ col: 2, row: 1 });
		expect(snakeCell(5, dims, 'row', false, 'tL')).toStrictEqual({ col: 0, row: 1 });
	});

	it('keeps every line left-to-right when sameDir is true', () => {
		const dims = { cols: 3, rows: 2 };
		expect(snakeCell(3, dims, 'row', true, 'tL')).toStrictEqual({ col: 0, row: 1 });
		expect(snakeCell(5, dims, 'row', true, 'tL')).toStrictEqual({ col: 2, row: 1 });
	});

	it('grDir mirrors the column and/or row axis', () => {
		const dims = { cols: 3, rows: 2 };
		expect(snakeCell(0, dims, 'row', true, 'tR')).toStrictEqual({ col: 2, row: 0 });
		expect(snakeCell(0, dims, 'row', true, 'bL')).toStrictEqual({ col: 0, row: 1 });
		expect(snakeCell(0, dims, 'row', true, 'bR')).toStrictEqual({ col: 2, row: 1 });
	});
});
