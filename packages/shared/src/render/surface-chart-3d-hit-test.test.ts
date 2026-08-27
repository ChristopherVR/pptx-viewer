/**
 * Regression coverage for the interactive 3D surface chart's raycast hover
 * tooltip: mapping a `Raycaster` intersection's `faceIndex` back to the
 * (series, category) data cell it belongs to, and building the same
 * `"<series>, <category>: <value>"` tooltip text every other chart mark's
 * SVG `<title>` already uses (`buildMarkTooltip` in `chart-view-model.ts`).
 */
import { describe, expect, it } from 'vitest';

import { buildSurfaceHoverTooltip, surfaceFaceIndexToCell } from './surface-chart-3d-hit-test';

describe('surfaceFaceIndexToCell', () => {
	it('maps face 0/1 (the first quad, split into 2 triangles) to (row 0, col 0)', () => {
		expect(surfaceFaceIndexToCell(0, 3, 2)).toStrictEqual({ row: 0, col: 0 });
		expect(surfaceFaceIndexToCell(1, 3, 2)).toStrictEqual({ row: 0, col: 0 });
	});

	it('advances the column within a row before wrapping to the next row', () => {
		// cols=3, rows=3 -> quadsPerRow=2, quadsPerCol=2 (a 2x2 grid of quads).
		expect(surfaceFaceIndexToCell(2, 3, 3)).toStrictEqual({ row: 0, col: 1 });
		expect(surfaceFaceIndexToCell(3, 3, 3)).toStrictEqual({ row: 0, col: 1 });
		// quadIndex 2 wraps to the next grid row.
		expect(surfaceFaceIndexToCell(4, 3, 3)).toStrictEqual({ row: 1, col: 0 });
	});

	it('returns null for a faceIndex past the last facet', () => {
		// 3 cols x 2 rows -> quadsPerRow=2, quadsPerCol=1 -> 2 quads -> 4 triangles (0..3).
		expect(surfaceFaceIndexToCell(4, 3, 2)).toBeNull();
		expect(surfaceFaceIndexToCell(99, 3, 2)).toBeNull();
	});

	it('returns null for a negative or non-finite faceIndex', () => {
		expect(surfaceFaceIndexToCell(-1, 3, 2)).toBeNull();
		expect(surfaceFaceIndexToCell(Number.NaN, 3, 2)).toBeNull();
	});

	it('returns null when the grid has fewer than 2 columns or rows (no facets at all)', () => {
		expect(surfaceFaceIndexToCell(0, 1, 3)).toBeNull();
		expect(surfaceFaceIndexToCell(0, 3, 1)).toBeNull();
	});
});

describe('buildSurfaceHoverTooltip', () => {
	const grid = {
		cols: 2,
		rows: 2,
		categoryLabels: ['Q1', 'Q2'],
		seriesNames: ['Revenue', 'Costs'],
		// row-major: row0 (Revenue) = [100, 150]; row1 (Costs) = [40, 60].
		values: new Float32Array([100, 150, 40, 60]),
	};

	it('builds the same "<series>, <category>: <value>" text as buildMarkTooltip', () => {
		// faceIndex 0 -> quad 0 -> (row 0, col 0) -> Revenue/Q1/100.
		expect(buildSurfaceHoverTooltip(0, grid)).toBe('Revenue, Q1: 100');
	});

	it('reports the correct series/category for a hit further into the grid', () => {
		// 2x2 grid has exactly one facet (faces 0-1), so re-derive from a bigger grid.
		const bigger = {
			cols: 3,
			rows: 2,
			categoryLabels: ['Q1', 'Q2', 'Q3'],
			seriesNames: ['Revenue', 'Costs'],
			values: new Float32Array([100, 150, 200, 40, 60, 80]),
		};
		// faceIndex 2/3 -> quad 1 -> (row 0, col 1) -> Revenue/Q2/150.
		expect(buildSurfaceHoverTooltip(2, bigger)).toBe('Revenue, Q2: 150');
	});

	it('honours a per-series number format', () => {
		const percentGrid = { ...grid, values: new Float32Array([0.5, 0.75, 0.1, 0.2]) };
		expect(
			buildSurfaceHoverTooltip(0, { ...percentGrid, numberFormats: ['0.00%', undefined] }),
		).toBe('Revenue, Q1: 50.00%');
	});

	it('returns undefined when faceIndex is undefined (no hit)', () => {
		expect(buildSurfaceHoverTooltip(undefined, grid)).toBeUndefined();
	});

	it('returns undefined when the scene has no raw values', () => {
		const { values: _values, ...noValues } = grid;
		expect(buildSurfaceHoverTooltip(0, noValues)).toBeUndefined();
	});

	it('returns undefined when the hit falls outside the data grid', () => {
		expect(buildSurfaceHoverTooltip(99, grid)).toBeUndefined();
	});
});
