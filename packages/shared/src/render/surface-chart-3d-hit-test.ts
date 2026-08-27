/**
 * Pure raycast-to-data-cell mapping for the interactive 3D surface chart mesh
 * ({@link ./surface-chart-3d-scene.ts}).
 *
 * Every other chart kind's hover tooltip (bar / line / area / scatter / bubble
 * / pie / radar / map) is projected as a native SVG `<title>` child on the
 * mark itself (`buildMarkTooltip` in `chart-view-model.ts`); a browser shows
 * that title on hover for free. The WebGL surface mesh has no SVG marks to
 * attach a `<title>` to, so the scene controller raycasts the pointer against
 * the mesh, maps the hit back to the (series, category) cell it belongs to
 * with the pure functions here, and sets that same `buildMarkTooltip` text as
 * the canvas element's own `title` attribute, i.e. the identical native-tooltip
 * mechanism every other mark already uses.
 *
 * Kept three-agnostic (no runtime `three` import, only a raw face index in and
 * a row/col out) so the row/col math is unit-testable without mocking WebGL.
 *
 * @module surface-chart-3d-hit-test
 */
import { buildMarkTooltip } from './chart-view-model';

/** The (series, category) grid cell a raycast hit landed on. */
export interface SurfaceCellHit {
	/** Series index (grid row). */
	row: number;
	/** Category index (grid column). */
	col: number;
}

/**
 * Map a three.js `Raycaster` intersection's `faceIndex` (a triangle index into
 * the surface mesh, built by `buildSurfaceGeometry`'s `THREE.PlaneGeometry`)
 * back to the (row, col) grid cell whose facet the triangle belongs to.
 *
 * `PlaneGeometry(width, height, widthSegs, depthSegs)` emits `widthSegs *
 * depthSegs` quads in row-major order, each split into 2 triangles, so
 * `floor(faceIndex / 2)` is the quad index and `floor(quadIndex / widthSegs)`
 * / `quadIndex % widthSegs` recover its row/col. A facet spans the four grid
 * vertices `[row, col]..[row+1, col+1]`; it is reported anchored at its
 * top-left corner `(row, col)`, mirroring the SVG isometric surface renderer's
 * `part: { seriesIndex: row, pointIndex: col }` anchor convention
 * (`chart-surface-treemap.ts`) so both presentations agree on which data point
 * a given facet "is".
 *
 * Returns `null` when `faceIndex` is out of range for a `cols x rows` grid
 * (fewer than 2 columns or rows has no facets at all).
 */
export function surfaceFaceIndexToCell(
	faceIndex: number,
	cols: number,
	rows: number,
): SurfaceCellHit | null {
	const quadsPerRow = cols - 1;
	const quadsPerCol = rows - 1;
	if (!Number.isFinite(faceIndex) || faceIndex < 0 || quadsPerRow <= 0 || quadsPerCol <= 0) {
		return null;
	}
	const quadIndex = Math.floor(faceIndex / 2);
	const row = Math.floor(quadIndex / quadsPerRow);
	const col = quadIndex % quadsPerRow;
	if (row < 0 || row >= quadsPerCol || col < 0 || col >= quadsPerRow) {
		return null;
	}
	return { row, col };
}

/** The subset of {@link SurfaceChart3DSceneOptions} the hover tooltip needs. */
export interface SurfaceHoverTooltipData {
	cols: number;
	rows: number;
	categoryLabels: ReadonlyArray<string>;
	seriesNames: ReadonlyArray<string>;
	/** Raw (un-normalised) values, row-major, length rows*cols. */
	values?: Float32Array;
	/** Per-series number-format codes (`c:ser/.../numFmt/@formatCode`), aligned to `seriesNames`. */
	numberFormats?: ReadonlyArray<string | undefined>;
}

/**
 * Build the hover-tooltip text for a raycast hit on the surface mesh, or
 * `undefined` when there is no hit, the hit falls outside the data grid, or
 * the scene was mounted without raw `values` (older callers that only supply
 * the normalised height/colour maps keep rendering with no tooltip).
 *
 * Mirrors `buildMarkTooltip`'s "<series>, <category>: <value>" text exactly,
 * so a surface facet's tooltip reads identically to every other chart kind's.
 */
export function buildSurfaceHoverTooltip(
	faceIndex: number | null | undefined,
	data: SurfaceHoverTooltipData,
): string | undefined {
	if (faceIndex === undefined || faceIndex === null || !data.values) {
		return undefined;
	}
	const cell = surfaceFaceIndexToCell(faceIndex, data.cols, data.rows);
	if (!cell) {
		return undefined;
	}
	const idx = cell.row * data.cols + cell.col;
	const value = data.values[idx];
	if (value === undefined) {
		return undefined;
	}
	return buildMarkTooltip(
		data.seriesNames[cell.row],
		data.categoryLabels[cell.col],
		value,
		data.numberFormats?.[cell.row],
	);
}
