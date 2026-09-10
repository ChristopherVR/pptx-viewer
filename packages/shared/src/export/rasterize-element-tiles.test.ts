// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import type { RasterizedTile } from './rasterize-element-tiles';
import { groupTilesByRow } from './rasterize-element-tiles';

function tile(overrides: Partial<RasterizedTile>): RasterizedTile {
	return {
		col: 0,
		row: 0,
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		canvas: document.createElement('canvas'),
		strategy: 'foreignObject',
		...overrides,
	};
}

describe('groupTilesByRow', () => {
	it('groups tiles into a [row][col] 2D array', () => {
		const t00 = tile({ row: 0, col: 0 });
		const t01 = tile({ row: 0, col: 1 });
		const t10 = tile({ row: 1, col: 0 });

		const rows = groupTilesByRow([t00, t01, t10]);

		expect(rows).toStrictEqual([[t00, t01], [t10]]);
	});

	it('returns a single-row array for an untiled (single-tile) export', () => {
		const only = tile({ row: 0, col: 0 });
		expect(groupTilesByRow([only])).toStrictEqual([[only]]);
	});

	it('returns a single empty row for no tiles', () => {
		expect(groupTilesByRow([])).toStrictEqual([[]]);
	});

	it('does not pollute Array.prototype/Object.prototype for a tile with a malicious row/col', () => {
		// Regression test for the CodeQL js/prototype-polluting-assignment
		// finding: `rows[tile.row][tile.col] = tile` must never be reached with
		// `row`/`col` values that resolve to `__proto__` at runtime, since
		// `RasterizedTile[]` is a public export a caller could construct from
		// untrusted data despite the `number` type declaration.
		const malicious = tile({
			row: '__proto__' as unknown as number,
			col: 'polluted' as unknown as number,
		});

		expect(() => groupTilesByRow([malicious])).not.toThrow();
		expect(({} as Record<string, unknown>).polluted).toBeUndefined();
		expect(([] as unknown[] as Record<string, unknown>).polluted).toBeUndefined();
	});

	it('skips a tile with a negative row/col instead of throwing', () => {
		const negative = tile({ row: -1, col: 0 });
		expect(() => groupTilesByRow([negative])).not.toThrow();
	});
});
