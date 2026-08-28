import type { SurfaceLabel } from './surface-chart-3d-geom';

/**
 * Pure geometry helpers for an interactive 3D CARTESIAN chart scene (category
 * axis x depth/series axis x value axis), three-agnostic so the row/col/camera
 * maths is unit-testable without mocking WebGL.
 *
 * Generalises the surface chart's grid/camera conventions
 * ({@link ./surface-chart-3d-geom.ts}) for a plot whose Z (depth) axis is the
 * SERIES axis rather than a second value dimension, and whose depth extent is
 * driven by the authored `c:view3D/@depthPercent` (percentage of the plot's
 * own width) rather than 1:1 with the row count. `bar3D`
 * ({@link ./bar-chart-3d-scene.ts}) is the first consumer; `line3D`/`area3D`
 * are expected to reuse this module unchanged, only swapping the mesh built
 * from the resulting grid/camera placement.
 *
 * @module cartesian-chart-3d-geom
 */

/** Half-unit spacing between adjacent category slots, in world units. Matches
 * the surface chart's `GRID_SPACING` so the two scene kinds share one visual
 * scale. */
const GRID_SPACING = 0.5;
/** World-space height of the tallest data point (value axis extent). */
export const MAX_VALUE_HEIGHT = 1.5;

/** World-space width (category axis) x depth (series axis) of the plot grid. */
export interface CartesianGridExtent {
	gridWidth: number;
	gridDepth: number;
}

/**
 * Compute the world-space grid extent: `gridWidth` scales with the category
 * count exactly like the surface chart's column axis; `gridDepth` is the
 * chart's authored depth as a percentage of that width
 * (`c:view3D/@depthPercent`, ECMA-376 default 100), NOT a per-series 1:1
 * spacing, matching the OOXML semantics ("chart depth as a percentage of base
 * width"). `rows` still gates the minimum depth so a single-series chart
 * keeps a visible sliver of depth instead of collapsing to a flat plane.
 */
export function computeCartesianGridExtent(
	cols: number,
	rows: number,
	depthPercent?: number,
): CartesianGridExtent {
	const gridWidth = Math.max(cols - 1, 1) * GRID_SPACING;
	const depthScale = Math.min(Math.max((depthPercent ?? 100) / 100, 0.05), 3);
	const gridDepth = Math.max(gridWidth * depthScale, rows > 1 ? GRID_SPACING : GRID_SPACING * 0.5);
	return { gridWidth, gridDepth };
}

/** The `c:view3D` fields a cartesian 3D scene's camera placement cares about. */
export interface CartesianCameraView3D {
	/** X-axis rotation in degrees (-90...90); PowerPoint's "elevation". */
	rotX?: number;
	/** Y-axis rotation in degrees (0...360); PowerPoint's "rotation". */
	rotY?: number;
	/** Perspective angle in degrees (0...240, `c:view3D/c:perspective`). Ignored when `rAngAx` is set. */
	rperspective?: number;
	/** Chart depth as a percentage of base width (`c:view3D/@depthPercent`). */
	depthPercent?: number;
	/** Right-angle axes (`c:view3D/@rAngAx`): PowerPoint renders near-orthographically. */
	rAngAx?: boolean;
}

const DEFAULT_ELEVATION_DEG = 15;
const DEFAULT_AZIMUTH_DEG = 20;
const DEFAULT_PERSPECTIVE_DEG = 30;
const FOV_MIN = 15;
const FOV_MAX = 75;
/** Near-orthographic FOV used when `rAngAx` (right-angle axes) is authored. */
const RIGHT_ANGLE_FOV = 20;
/** `c:view3D/c:perspective` is documented 0-240 degrees; PowerPoint's own UI
 * caps the picker at 120, so anything past that is treated as "very deep". */
const PERSPECTIVE_MAX_DEG = 120;

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

function normalizeAzimuth(deg: number): number {
	const wrapped = deg % 360;
	return wrapped < 0 ? wrapped + 360 : wrapped;
}

/**
 * Resolve the camera's vertical field of view from `c:view3D`. `rAngAx`
 * (right-angle axes) asks PowerPoint to drop true perspective, so this maps
 * it to a narrow, near-orthographic FOV; otherwise `perspective` (0-120
 * degrees in practice) scales linearly onto a `[FOV_MIN, FOV_MAX]` degree
 * range. Not measured against PowerPoint's own COM-rendered output: this is a
 * reasonable, documented approximation, not a claimed exact match.
 */
export function resolveCartesianCameraFov(view3D?: CartesianCameraView3D): number {
	if (view3D?.rAngAx) {
		return RIGHT_ANGLE_FOV;
	}
	const perspective = clamp(
		view3D?.rperspective ?? DEFAULT_PERSPECTIVE_DEG,
		0,
		PERSPECTIVE_MAX_DEG,
	);
	return FOV_MIN + (perspective / PERSPECTIVE_MAX_DEG) * (FOV_MAX - FOV_MIN);
}

/** Camera position + look-at target + resolved field of view. */
export interface CartesianCameraPlacement {
	position: readonly [number, number, number];
	target: readonly [number, number, number];
	fov: number;
}

/**
 * Camera placement that frames a scene of world-space bounding radius
 * `maxExtent`, looking at `[0, targetY, 0]`.
 *
 * The camera sits on a sphere around that target at the elevation/azimuth
 * given by `rotX`/`rotY` (PowerPoint-like defaults when either is absent,
 * matching the flat oblique-projection engine's own defaults so an untagged
 * 3D chart looks consistent across presentations), at a distance derived
 * from the resolved FOV so the scene's bounding sphere stays framed
 * regardless of how narrow (near-orthographic) or wide the perspective is.
 *
 * `rotX` is clamped to `(-90, 90)` exclusive: exactly on the vertical axis is
 * a degenerate `lookAt`/OrbitControls case (an ill-defined up vector).
 *
 * Pure sphere-placement math, extracted out of
 * {@link computeCartesianCameraPlacement} so a non-cartesian 3D chart scene
 * (no category/series grid to speak of) can reuse the identical
 * camera-placement approach instead of duplicating it. `pie3D`
 * ({@link ../pie-chart-3d-geom.ts}, `computePieChart3DCameraPlacement`) is
 * the first such consumer.
 */
export function computeSphericalCameraPlacement(
	maxExtent: number,
	targetY: number,
	view3D?: CartesianCameraView3D,
): CartesianCameraPlacement {
	const fov = resolveCartesianCameraFov(view3D);
	const halfFovRad = (fov * Math.PI) / 360;
	// Distance for the scene's bounding radius to just fit the vertical FOV, plus margin.
	const radius = (Math.max(maxExtent, 0.01) / Math.tan(halfFovRad)) * 0.75;
	const target: readonly [number, number, number] = [0, targetY, 0];

	const elevationDeg = clamp(view3D?.rotX ?? DEFAULT_ELEVATION_DEG, -89, 89);
	const azimuthDeg = normalizeAzimuth(view3D?.rotY ?? DEFAULT_AZIMUTH_DEG);

	// Polar angle measured from the +Y axis; spherical -> cartesian.
	const phi = ((90 - elevationDeg) * Math.PI) / 180;
	const theta = (azimuthDeg * Math.PI) / 180;
	const sinPhi = Math.sin(phi);

	return {
		position: [
			radius * sinPhi * Math.sin(theta),
			radius * Math.cos(phi) + target[1],
			radius * sinPhi * Math.cos(theta),
		],
		target,
		fov,
	};
}

/**
 * Camera placement that frames the whole cartesian grid. Thin wrapper around
 * {@link computeSphericalCameraPlacement} with the cartesian grid's own
 * extent + look-at height.
 */
export function computeCartesianCameraPlacement(
	cols: number,
	rows: number,
	view3D?: CartesianCameraView3D,
): CartesianCameraPlacement {
	const { gridWidth, gridDepth } = computeCartesianGridExtent(cols, rows, view3D?.depthPercent);
	const maxExtent = Math.max(gridWidth, gridDepth, MAX_VALUE_HEIGHT);
	return computeSphericalCameraPlacement(maxExtent, MAX_VALUE_HEIGHT * 0.2, view3D);
}

/**
 * Build the axis labels (category along the front edge, series along the
 * right edge) as world-anchored {@link SurfaceLabel}s, reusing the surface
 * chart's label type + DOM overlay ({@link ./surface-chart-3d-label-overlay.ts})
 * unchanged. Thinned to at most `maxCat`/`maxSer` entries to avoid clutter,
 * mirroring `buildSurfaceLabels`.
 */
export function buildCartesianChart3DLabels(
	cols: number,
	rows: number,
	categoryLabels: ReadonlyArray<string>,
	seriesNames: ReadonlyArray<string>,
	depthPercent: number | undefined,
	maxCat = 8,
	maxSer = 6,
): SurfaceLabel[] {
	const { gridWidth, gridDepth } = computeCartesianGridExtent(cols, rows, depthPercent);
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

	return labels;
}
