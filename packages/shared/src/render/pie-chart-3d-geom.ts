/**
 * Pure geometry helpers for an interactive 3D `pie3D` chart scene, three-agnostic
 * so the wedge-angle / explosion / camera maths is unit-testable without
 * mocking WebGL.
 *
 * A pie chart has no category/series grid to speak of, so this module does NOT
 * reuse {@link ./cartesian-chart-3d-geom.ts} wholesale; it reuses only the
 * generic piece of that module that fits (the sphere camera placement,
 * {@link computeSphericalCameraPlacement}) and supplies pie-appropriate
 * siblings for the rest: a fixed disc radius, a thickness driven by the
 * authored `c:view3D/@hPercent` (height as a percentage of chart width - the
 * ECMA-376 field pie3D actually authors for its "puck" thickness, distinct
 * from `depthPercent` which only applies to cartesian 3D kinds), and per-slice
 * wedge angles that mirror the flat SVG engine's `computePieSlices` angle
 * bookkeeping (see `./chart-view-model.ts`) so the true-3D and 2D-fallback
 * presentations always agree on slice proportions, start angle, and explosion
 * direction.
 *
 * @module pie-chart-3d-geom
 */
import type { CartesianCameraPlacement, CartesianCameraView3D } from './cartesian-chart-3d-geom';
import { computeSphericalCameraPlacement } from './cartesian-chart-3d-geom';

/** World-space outer radius of the pie disc. Matches the bar3D scene's world scale. */
export const PIE_RADIUS = 1;
/** Wedge thickness (world units) at the ECMA-376 default `hPercent` of 100. */
const BASE_THICKNESS_RATIO = 0.3;
/** Never let an extreme `hPercent` collapse the wedges to an invisible sliver, or blow up past a chunky block. */
const MIN_THICKNESS_SCALE = 0.05;
const MAX_THICKNESS_SCALE = 3;
/** Margin so the camera frames the disc with room for exploded slices + labels. */
const CAMERA_EXTENT_MARGIN = 1.35;

/** The `c:view3D` fields a pie3D scene's camera + wedge thickness care about. */
export interface PieChart3DView3D extends CartesianCameraView3D {
	/** Pie "puck" height as a percentage of chart width (`c:view3D/@hPercent`). */
	hPercent?: number;
}

/**
 * Resolve the wedge thickness (world units, the Y-axis extent of every
 * `CylinderGeometry` wedge) from the authored `c:view3D/@hPercent`. Absent
 * uses the ECMA-376 default of 100 (percent), matching
 * {@link ./cartesian-chart-3d-geom.ts}'s `depthPercent` clamp shape.
 */
export function computePieChart3DThickness(view3D?: PieChart3DView3D): number {
	const scale = Math.min(
		Math.max((view3D?.hPercent ?? 100) / 100, MIN_THICKNESS_SCALE),
		MAX_THICKNESS_SCALE,
	);
	return PIE_RADIUS * BASE_THICKNESS_RATIO * scale;
}

/**
 * Camera placement that frames the pie disc (plus its wedge thickness),
 * reusing {@link computeSphericalCameraPlacement} - the same
 * elevation/azimuth/FOV approach `bar3D` uses - with a pie-appropriate extent
 * (radius, not a category/series grid) and a look-at height centred on the
 * puck's thickness.
 */
export function computePieChart3DCameraPlacement(
	view3D?: PieChart3DView3D,
): CartesianCameraPlacement {
	const thickness = computePieChart3DThickness(view3D);
	const maxExtent = PIE_RADIUS * CAMERA_EXTENT_MARGIN;
	return computeSphericalCameraPlacement(maxExtent, thickness / 2, view3D);
}

/** One pie3D wedge's angle range + explosion pull-out direction. */
export interface PieChart3DSliceAngle {
	pointIndex: number;
	value: number;
	/**
	 * Arc start angle in radians, in the SAME convention `computePieSlices`
	 * uses (`-PI/2` = 12 o'clock, increasing clockwise-on-screen), passed
	 * straight through to `THREE.CylinderGeometry`'s `thetaStart`. A
	 * documented approximation of PowerPoint's own pie3D orientation, not a
	 * claimed pixel-exact camera-frame match (mirrors this module's other
	 * `c:view3D` maths).
	 */
	startAngle: number;
	/** Arc sweep in radians (`CylinderGeometry`'s `thetaLength`). */
	thetaLength: number;
	/** World-space [x, z] offset applied to the wedge centre for `c:explosion` pull-out. */
	explodeOffset: readonly [number, number];
}

/**
 * Build the per-slice angle + explosion geometry for a pie3D scene, mirroring
 * `computePieSlices`' cumulative-angle bookkeeping (`chart-view-model.ts`) so
 * the true-3D wedges and the flat SVG fallback always agree on where each
 * slice starts, how wide it sweeps, and how far `c:explosion` pulls it out.
 *
 * `firstSliceAngleDeg` is `c:firstSliceAng` (degrees clockwise from 12
 * o'clock); `explosions` is the per-point pull-out distance as a percentage
 * of the outer radius (0-100), aligned index-for-index with `values`.
 */
export function computePieChart3DSliceAngles(
	values: ReadonlyArray<number>,
	explosions: ReadonlyArray<number> | undefined,
	firstSliceAngleDeg: number | undefined,
	outerRadius: number,
): PieChart3DSliceAngle[] {
	const total = values.reduce((s, v) => s + Math.abs(v), 0) || 1;
	let cumAngle = -Math.PI / 2 + ((firstSliceAngleDeg ?? 0) * Math.PI) / 180;
	return values.map((value, pointIndex) => {
		const sliceAngle = (Math.abs(value) / total) * Math.PI * 2;
		const startAngle = cumAngle;
		cumAngle += sliceAngle;
		const explosion = explosions?.[pointIndex] ?? 0;
		let explodeOffset: readonly [number, number] = [0, 0];
		if (explosion > 0) {
			const mid = (startAngle + cumAngle) / 2;
			const offset = outerRadius * (explosion / 100);
			explodeOffset = [Math.cos(mid) * offset, Math.sin(mid) * offset];
		}
		return { pointIndex, value, startAngle, thetaLength: sliceAngle, explodeOffset };
	});
}
