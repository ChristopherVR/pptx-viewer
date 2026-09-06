/**
 * Drag-to-value math for an interactive 3D `pie3D` wedge, three-agnostic so it
 * is unit-testable without mocking WebGL.
 *
 * A pie3D wedge has no single visible world axis a screen-space pointer delta
 * can be projected onto the way a bar3D box's height or a surface3D vertex's
 * height can (`chart-3d-pointer-interaction.ts`'s `Chart3DDragCalibrationInput`
 * model): like the flat SVG pie/doughnut, a wedge's value is a SHARE of the
 * series total, changed by sweeping its trailing edge around the pie's centre.
 * `chart-interaction-pie.ts`'s `resolvePieSliceShareValue` already holds that
 * exact renormalisation formula (dragging the flat pie), so this module only
 * supplies the 3D-specific half: turning a raycast hit on the pie's own plane
 * into an angle in the SAME convention `computePieChart3DSliceAngles` uses for
 * `startAngle`/`thetaStart`.
 *
 * `THREE.CylinderGeometry` places a vertex at parametric angle `theta` at
 * local `(x, z) = (radius*sin(theta), radius*cos(theta))` (its own `generateTorso`
 * step), so recovering `theta` from a world `(x, z)` hit point uses
 * `Math.atan2(x, z)`, NOT the `atan2(y, x)` convention the flat 2D SVG pie's
 * screen-space drag uses.
 *
 * @module pie-chart-3d-drag
 */
import { resolvePieSliceShareValue } from './chart-interaction-pie';

/** Geometry one pie3D wedge drag needs, resolved once at drag start. */
export interface PieChart3DDragGeometry {
	/** Series 0's current values (a pie3D chart plots a single series), snapshotted at drag start. */
	values: readonly number[];
	pointIndex: number;
	/**
	 * The dragged wedge's own leading-edge angle, in the SAME convention
	 * `computePieChart3DSliceAngles` assigns as `startAngle` (already the
	 * cumulative angle swept by every slice before this one, so no separate
	 * "before" sum needs recomputing here the way the 2D geometry does).
	 */
	leadingAngle: number;
}

/**
 * Resolve the drag geometry for the wedge at `pointIndex`, or `null` when it
 * cannot be found in `wedges` or `pointIndex` is out of range in `values`.
 */
export function buildPieChart3DDragGeometry(
	wedges: ReadonlyArray<{ pointIndex: number; startAngle: number }>,
	values: readonly number[],
	pointIndex: number,
): PieChart3DDragGeometry | null {
	if (pointIndex < 0 || pointIndex >= values.length) {
		return null;
	}
	const wedge = wedges.find((w) => w.pointIndex === pointIndex);
	if (!wedge) {
		return null;
	}
	return { values, pointIndex, leadingAngle: wedge.startAngle };
}

/**
 * Convert a world-space hit point on the pie's own plane (already relative to
 * the pie's centre, i.e. the `x`/`z` of a raycast against the invisible disc
 * `pie-chart-3d-interaction-wiring.ts` raycasts, not a wedge mesh's own,
 * possibly `c:explosion`-offset, local space) into the angle convention
 * `computePieChart3DSliceAngles`'s `startAngle`/`thetaStart` use.
 */
export function pieChart3DPointerAngle(x: number, z: number): number {
	return Math.atan2(x, z);
}

/**
 * New value for the dragged wedge given the pointer's current angle on the
 * pie's plane (see {@link pieChart3DPointerAngle}). Delegates the actual
 * renormalisation to the flat 2D pie's own `resolvePieSliceShareValue`, so a
 * pie3D wedge drag renormalises every other (unchanged) slice's value exactly
 * like its flat SVG counterpart.
 */
export function resolvePieChart3DDragValue(
	geometry: PieChart3DDragGeometry,
	pointerAngle: number,
): number {
	return resolvePieSliceShareValue(
		pointerAngle,
		geometry.leadingAngle,
		geometry.values,
		geometry.pointIndex,
	);
}
