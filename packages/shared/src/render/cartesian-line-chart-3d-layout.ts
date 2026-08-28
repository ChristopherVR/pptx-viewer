/**
 * Pure path-layout maths for the interactive `line3D` and `area3D` scenes
 * ({@link ./line-chart-3d-scene.ts}, {@link ./area-chart-3d-scene.ts}).
 *
 * PowerPoint's real 3-D Line and 3-D Area chart types give every series its
 * own depth ("Z") plane along the series axis, exactly like a clustered
 * bar3D column (see {@link ./bar-chart-3d-layout.ts}) - unlike this engine's
 * flat oblique-projection line3D/area3D fallback ({@link ./chart-3d-depth.ts}),
 * which only offsets the whole chart by a single shared depth vector, with no
 * per-series stagger. Also unlike bar3D, PowerPoint's chart-type gallery
 * offers no "stacked 3-D Line"/"stacked 3-D Area", so every series always
 * plots its OWN authored values on its OWN plane, never a running sum.
 *
 * X (category axis) uses the exact same anchor formula as
 * `buildCartesianChart3DLabels`'s category labels, so a path vertex sits
 * directly under its axis label. Z (series/depth axis) uses the exact same
 * formula as `bar-chart-3d-layout.ts`'s clustered box Z, so a line3D/area3D
 * chart's depth planes line up with a bar3D chart's for the same
 * category/series grid.
 *
 * @module cartesian-line-chart-3d-layout
 */
import { computeCartesianGridExtent, MAX_VALUE_HEIGHT } from './cartesian-chart-3d-geom';
import type { ValueRange } from './chart-view-model';

/** One (series, category) data point, resolved to display value + colour. */
export interface CartesianLine3DPoint {
	seriesIndex: number;
	categoryIndex: number;
	value: number;
	color: string;
}

/** One path vertex, positioned in true 3D world space. */
export interface CartesianLine3DVertex {
	seriesIndex: number;
	categoryIndex: number;
	value: number;
	position: readonly [number, number, number];
}

/** One series' full 3D path: its depth plane + ordered (by category) vertices. */
export interface CartesianLine3DSeriesPath {
	seriesIndex: number;
	color: string;
	vertices: CartesianLine3DVertex[];
	/** World Z this series' depth plane sits at. */
	depthZ: number;
	/** World Y for value = 0 on this plane (area3D ribbon baseline / floor). */
	baselineY: number;
}

function normalizeToHeight(value: number, range: ValueRange): number {
	if (range.span <= 0) {
		return 0;
	}
	return ((value - range.min) / range.span) * MAX_VALUE_HEIGHT;
}

/**
 * Lay out one 3D path per series (grouped from the flat `points` list by
 * `seriesIndex`, sorted by `categoryIndex` within each series). Series with
 * no points are simply absent from the result (there is nothing to path).
 */
export function layoutCartesianLine3DSeries(
	points: ReadonlyArray<CartesianLine3DPoint>,
	cols: number,
	rows: number,
	range: ValueRange,
	depthPercent: number | undefined,
): CartesianLine3DSeriesPath[] {
	const { gridWidth, gridDepth } = computeCartesianGridExtent(cols, rows, depthPercent);
	const rowStep = gridDepth / Math.max(rows, 1);
	const baselineY = normalizeToHeight(0, range);

	const bySeries = new Map<number, CartesianLine3DPoint[]>();
	for (const p of points) {
		const list = bySeries.get(p.seriesIndex);
		if (list) {
			list.push(p);
		} else {
			bySeries.set(p.seriesIndex, [p]);
		}
	}

	const paths: CartesianLine3DSeriesPath[] = [];
	for (const [seriesIndex, seriesPoints] of bySeries) {
		const sorted = [...seriesPoints].sort((a, b) => a.categoryIndex - b.categoryIndex);
		const z = -gridDepth / 2 + rowStep * (seriesIndex + 0.5);
		const vertices: CartesianLine3DVertex[] = sorted.map((p) => {
			const x = -gridWidth / 2 + (p.categoryIndex / Math.max(cols - 1, 1)) * gridWidth;
			const y = normalizeToHeight(p.value, range);
			return {
				seriesIndex,
				categoryIndex: p.categoryIndex,
				value: p.value,
				position: [x, y, z],
			};
		});
		paths.push({
			seriesIndex,
			color: sorted[0]?.color ?? '#4472C4',
			vertices,
			depthZ: z,
			baselineY,
		});
	}
	return paths.sort((a, b) => a.seriesIndex - b.seriesIndex);
}

/**
 * Flatten a series path's vertices + baseline into an area3D fill ribbon: for
 * every pair of adjacent category vertices, two triangles connect the top
 * (value) edge to the bottom (baseline) edge. Returns a flat
 * `[x, y, z, x, y, z, ...]` triangle-list ready for a `BufferGeometry`
 * position attribute (9 numbers per triangle, 2 triangles per segment).
 *
 * A single-vertex path (one category) has no segment to fill and returns an
 * empty array; line3D never calls this (it only needs the raw vertex path for
 * its tube curve).
 */
export function buildAreaRibbonTriangles(path: CartesianLine3DSeriesPath): number[] {
	const { vertices, baselineY } = path;
	const out: number[] = [];
	for (let i = 0; i < vertices.length - 1; i++) {
		const [x1, y1, z1] = vertices[i].position;
		const [x2, y2, z2] = vertices[i + 1].position;
		// Top edge (the authored values) and bottom edge (the baseline), wound so
		// both triangles face the same way (+Y-ish normal) for consistent shading.
		out.push(x1, y1, z1, x1, baselineY, z1, x2, baselineY, z2);
		out.push(x1, y1, z1, x2, baselineY, z2, x2, y2, z2);
	}
	return out;
}
