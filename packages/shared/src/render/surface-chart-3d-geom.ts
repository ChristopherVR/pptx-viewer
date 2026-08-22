/**
 * Pure surface-chart 3D geometry helpers (framework- and three-agnostic).
 *
 * The vanilla three scene controller ({@link mountSurfaceChart3D}) feeds these
 * the loaded `three` module so the heavy library stays a dynamic, optional
 * import while the grid maths (plane subdivision -> height/colour displacement,
 * world-space label anchors) lives here as small, separately testable units.
 */

// Type-only import is erased at build time, so it never pulls `three` into the
// bundle; the real module is passed in by the dynamic-import call site.
import type * as THREE from 'three';

/** The subset of the `three` module surface the geometry builder uses. */
type ThreeModule = typeof THREE;

/** Half-unit spacing between adjacent grid points, in world units. */
const GRID_SPACING = 0.5;
/** Maximum height displacement (world units) for a normalised value of 1. */
export const MAX_HEIGHT = 1.5;

/** Grid world extent (width along cols, depth along rows). */
export interface GridExtent {
	gridWidth: number;
	gridDepth: number;
}

/** Compute the world-space width/depth of the data grid. */
export function computeGridExtent(cols: number, rows: number): GridExtent {
	return {
		gridWidth: Math.max(cols - 1, 1) * GRID_SPACING,
		gridDepth: Math.max(rows - 1, 1) * GRID_SPACING,
	};
}

/** A label to overlay over the canvas, with its world-space anchor point. */
export interface SurfaceLabel {
	/** Stable key for DOM reconciliation. */
	key: string;
	/** Display text. */
	text: string;
	/** World-space anchor [x, y, z] projected to screen each frame. */
	anchor: readonly [number, number, number];
	/** Logical axis the label belongs to (for styling). */
	axis: 'category' | 'series' | 'value';
}

/**
 * Build the surface mesh + wireframe geometries from the normalised height and
 * colour maps. The plane is subdivided to match the data grid, rotated into the
 * XZ plane, then each vertex is displaced in Y by its height and tinted by its
 * colour. Returns disposable geometries the caller adds to the scene.
 */
export function buildSurfaceGeometry(
	three: ThreeModule,
	cols: number,
	rows: number,
	heightMap: Float32Array,
	colorMap: Float32Array,
): { geometry: THREE.BufferGeometry; wireGeometry: THREE.BufferGeometry } {
	const widthSegs = Math.max(cols - 1, 0);
	const depthSegs = Math.max(rows - 1, 0);
	const { gridWidth, gridDepth } = computeGridExtent(cols, rows);

	const geo = new three.PlaneGeometry(gridWidth, gridDepth, widthSegs, depthSegs);
	// PlaneGeometry lies in the XY plane by default; rotate it flat into XZ.
	geo.rotateX(-Math.PI / 2);

	const pos = geo.attributes.position as THREE.BufferAttribute;
	const vertexCount = pos.count;
	const colors = new Float32Array(vertexCount * 3);

	for (let i = 0; i < vertexCount; i++) {
		// After the rotation, the (widthSegs+1) x (depthSegs+1) vertices stay in
		// row-major order, so col = i % cols and row = floor(i / cols) map onto the
		// data grid directly.
		const row = Math.floor(i / cols);
		const col = i % cols;
		const idx = row * cols + col;

		const h = idx < heightMap.length ? heightMap[idx] : 0;
		pos.setY(i, h * MAX_HEIGHT);

		const ci = idx * 3;
		colors[i * 3] = ci < colorMap.length ? colorMap[ci] : 0.5;
		colors[i * 3 + 1] = ci + 1 < colorMap.length ? colorMap[ci + 1] : 0.5;
		colors[i * 3 + 2] = ci + 2 < colorMap.length ? colorMap[ci + 2] : 0.5;
	}

	geo.setAttribute('color', new three.BufferAttribute(colors, 3));
	geo.computeVertexNormals();
	pos.needsUpdate = true;

	const wireGeometry = new three.WireframeGeometry(geo);
	return { geometry: geo, wireGeometry };
}

/**
 * Build the axis labels (category along the front edge, series along the right
 * edge, plus a single "Value" Y-axis label) as world-anchored {@link
 * SurfaceLabel}s. Category/series labels are thinned to at most `maxCat`/`maxSer`
 * entries to avoid clutter, mirroring the prior drei `Html` layout.
 */
export function buildSurfaceLabels(
	cols: number,
	rows: number,
	categoryLabels: ReadonlyArray<string>,
	seriesNames: ReadonlyArray<string>,
	maxCat = 8,
	maxSer = 6,
): SurfaceLabel[] {
	const { gridWidth, gridDepth } = computeGridExtent(cols, rows);
	const labels: SurfaceLabel[] = [];

	const catStep = Math.max(1, Math.ceil(categoryLabels.length / maxCat));
	for (let i = 0; i < categoryLabels.length; i += catStep) {
		const x = -gridWidth / 2 + (i / Math.max(cols - 1, 1)) * gridWidth;
		labels.push({
			key: `cat-${i}`,
			text: categoryLabels[i],
			anchor: [x, -0.15, gridDepth / 2 + 0.25],
			axis: 'category',
		});
	}

	const serStep = Math.max(1, Math.ceil(seriesNames.length / maxSer));
	for (let i = 0; i < seriesNames.length; i += serStep) {
		const z = -gridDepth / 2 + (i / Math.max(rows - 1, 1)) * gridDepth;
		labels.push({
			key: `ser-${i}`,
			text: seriesNames[i],
			anchor: [gridWidth / 2 + 0.3, -0.15, z],
			axis: 'series',
		});
	}

	labels.push({
		key: 'value-axis',
		text: 'Value',
		anchor: [-gridWidth / 2 - 0.35, 0.75, -gridDepth / 2],
		axis: 'value',
	});

	return labels;
}

/** The `c:view3D` fields the camera placement cares about. */
export interface SurfaceCameraView3D {
	/** X-axis rotation in degrees (-90...90); PowerPoint's "elevation". */
	rotX?: number;
	/** Y-axis rotation in degrees (0...360); PowerPoint's "rotation". */
	rotY?: number;
}

/** Default elevation/azimuth, matching the 2D engine's oblique-depth defaults
 * ({@link ../chart-3d-depth.ts}) so an untagged 3D chart looks consistent
 * whether it renders through the flat SVG path or this WebGL scene. */
const DEFAULT_ELEVATION_DEG = 15;
const DEFAULT_AZIMUTH_DEG = 20;
/** Total camera distance from the target, as a multiple of `dist`. Matches
 * the magnitude of the previous fixed isometric-like position
 * `[0.8, 0.7, 0.8] * dist` so the default framing does not change size. */
const RADIUS_FACTOR = Math.sqrt(0.8 ** 2 + 0.7 ** 2 + 0.8 ** 2);

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

/** Wrap a rotY-style angle into `[0, 360)`. */
function normalizeAzimuth(deg: number): number {
	const wrapped = deg % 360;
	return wrapped < 0 ? wrapped + 360 : wrapped;
}

/**
 * Camera placement that frames the whole grid.
 *
 * When `view3D` carries an authored `rotX` and/or `rotY`, the camera is
 * placed on a sphere around the target at the corresponding elevation/azimuth
 * (missing fields fall back to PowerPoint-like defaults, matching the 2D
 * engine's oblique-depth defaults so both presentations agree on an untagged
 * angle). When `view3D` is absent entirely (no `c:view3D` was authored), the
 * original fixed isometric-like offset is used unchanged, so charts nobody
 * has touched keep their exact prior framing.
 *
 * `rotX` (elevation) is clamped to (-90, 90) exclusive so the camera never
 * sits exactly on the vertical axis, which is a degenerate case for
 * `lookAt`/OrbitControls (an ill-defined up vector).
 */
export function computeCameraPlacement(
	cols: number,
	rows: number,
	view3D?: SurfaceCameraView3D,
): { position: readonly [number, number, number]; target: readonly [number, number, number] } {
	const { gridWidth, gridDepth } = computeGridExtent(cols, rows);
	const maxExtent = Math.max(gridWidth, gridDepth, MAX_HEIGHT);
	const dist = maxExtent * 1.8;
	const target: readonly [number, number, number] = [0, 0.3, 0];

	if (!view3D || (view3D.rotX === undefined && view3D.rotY === undefined)) {
		return { position: [dist * 0.8, dist * 0.7, dist * 0.8], target };
	}

	const radius = dist * RADIUS_FACTOR;
	const elevationDeg = clamp(view3D.rotX ?? DEFAULT_ELEVATION_DEG, -89, 89);
	const azimuthDeg = normalizeAzimuth(view3D.rotY ?? DEFAULT_AZIMUTH_DEG);

	// Polar angle measured from the +Y axis; spherical -> cartesian.
	const phi = ((90 - elevationDeg) * Math.PI) / 180;
	const theta = (azimuthDeg * Math.PI) / 180;
	const sinPhi = Math.sin(phi);

	return {
		position: [
			radius * sinPhi * Math.sin(theta),
			radius * Math.cos(phi),
			radius * sinPhi * Math.cos(theta),
		],
		target,
	};
}
