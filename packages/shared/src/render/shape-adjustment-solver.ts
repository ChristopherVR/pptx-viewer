import type { AdjustmentAxisSolver, ShapeAdjustmentSolver } from './shape-adjustment-model';
/**
 * `shape-adjustment-solver`: turning a pointer position into `a:avLst` values.
 *
 * The counterpart to `shape-adjustment-handles`, which MEASURES each handle
 * (where it sits, and how far it travels per unit of guide value) off the
 * preset geometry. That measurement is captured once, at pointer-down, into a
 * {@link ShapeAdjustmentSolver}; everything here is the O(1) arithmetic each
 * `pointermove` then runs against it.
 *
 * Values are OOXML GUIDE units throughout, never a 0-1 fraction: React once
 * clamped them with `Math.min(1, ...)` and collapsed a 16667 corner radius to a
 * square corner, and its unit tests asserted the same wrong scale.
 *
 * @module render/shape-adjustment-solver
 */
import { ANGLE_UNITS_PER_RADIAN, ANGLE_UNITS_PER_TURN } from './shape-adjustment-probe';

/** Wrap `value` into `[0, 21600000)`. */
function wrapAngle(value: number): number {
	return ((value % ANGLE_UNITS_PER_TURN) + ANGLE_UNITS_PER_TURN) % ANGLE_UNITS_PER_TURN;
}

/**
 * The guide value for a pointer at `(localX, localY)` in element-local px.
 *
 * Linear handles project the pointer onto the measured travel direction, which
 * for `roundRect` reduces exactly to the old `deltaX / (ss/100000)` formula.
 * Angular handles take the swept angle about the shape centre, so dragging the
 * end of a `pie` wedge halfway round the circle moves it halfway round.
 */
export function solveShapeAdjustmentValue(
	solver: ShapeAdjustmentSolver,
	localX: number,
	localY: number,
): number {
	if (solver.kind === 'angular') {
		const anchorAngle = Math.atan2(
			solver.anchorY - solver.centerY,
			solver.anchorX - solver.centerX,
		);
		const pointerAngle = Math.atan2(localY - solver.centerY, localX - solver.centerX);
		let delta = pointerAngle - anchorAngle;
		while (delta > Math.PI) {
			delta -= 2 * Math.PI;
		}
		while (delta <= -Math.PI) {
			delta += 2 * Math.PI;
		}
		const next = solver.startValue + delta * ANGLE_UNITS_PER_RADIAN;
		// A full-turn range is a wrap, not a clamp: an angle dragged past zero
		// must come round rather than stick at the bound.
		return Math.round(
			solver.max - solver.min >= ANGLE_UNITS_PER_TURN - 1
				? wrapAngle(next)
				: Math.max(solver.min, Math.min(solver.max, next)),
		);
	}

	const lengthSquared = solver.dirX * solver.dirX + solver.dirY * solver.dirY;
	if (lengthSquared <= 0) {
		return Math.round(solver.startValue);
	}
	const offset = (localX - solver.anchorX) * solver.dirX + (localY - solver.anchorY) * solver.dirY;
	const next = solver.startValue + offset / lengthSquared;
	return Math.round(Math.max(solver.min, Math.min(solver.max, next)));
}

/**
 * The `shapeAdjustments` patch a pointer at `(localX, localY)` implies for a
 * handle: one entry per guide the handle drives.
 */
export function solveShapeAdjustments(
	solvers: readonly AdjustmentAxisSolver[],
	localX: number,
	localY: number,
): Record<string, number> {
	const patch: Record<string, number> = {};
	for (const axis of solvers) {
		patch[axis.key] = solveShapeAdjustmentValue(axis.solver, localX, localY);
	}
	return patch;
}
