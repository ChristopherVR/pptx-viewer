/**
 * `chart-3d-interaction`: framework-neutral, three.js-free maths for
 * click-to-select and drag-to-value on the opt-in true-3D chart scenes
 * (bar3D / line3D / area3D / pie3D / surface3D).
 *
 * The 3D scenes already raycast pointer moves against their meshes for hover
 * tooltips (`bar-chart-3d-hit-test.ts`, `cartesian-chart-3d-hit-test.ts`,
 * `pie-chart-3d-hit-test.ts`, `surface-chart-3d-hit-test.ts`). This module
 * turns that SAME raycast hit into the identical {@link ChartPartRef} the 2D
 * chart-interaction model (`chart-interaction.ts`, `chart-canvas-drag.ts`)
 * already uses, so a 3D mark selection drives the same inspector panel a 2D
 * mark does.
 *
 * Drag-to-value has no single fixed screen axis to divide a pointer delta by
 * (unlike the 2D SVG, which is always dragged along its own vertical pixel
 * axis): the scene's camera can be orbited to any angle, so "up" on screen is
 * not fixed. Instead the scene (which owns the camera) projects two points
 * already known to sit on the mark's OWN value axis, at two distinct data
 * values, to screen space, and this module turns that screen-space
 * calibration plus a pointer delta into a value delta. Kept free of any
 * `three` import so it is unit-testable with plain numbers.
 *
 * @module chart-3d-interaction
 */
import type { ChartPartRef } from './chart-view-model';

/**
 * Minimum pointer travel (px) before a mark press becomes a value drag,
 * mirroring {@link CHART_DRAG_THRESHOLD_PX} (`chart-canvas-drag.ts`): without
 * a threshold, every click on a mark would commit a (tiny) value change, so a
 * user could never select a mark without editing it.
 */
export const CHART_3D_DRAG_THRESHOLD_PX = 3;

/** Emissive colour + intensity applied to a selected mark's material. */
export const CHART_3D_SELECTED_EMISSIVE = '#3b82f6';
export const CHART_3D_SELECTED_EMISSIVE_INTENSITY = 0.55;

/** The (series, point) a 3D raycast hit landed on. Every hit-test module's `*Hit` shape already carries this, just under kind-specific field names. */
export interface Chart3DMarkHit {
	seriesIndex: number;
	pointIndex: number;
}

/**
 * Map a 3D raycast hit (or none) to the same selection descriptor the 2D
 * chart-interaction model uses.
 */
export function chart3DHitToPartRef(hit: Chart3DMarkHit | null | undefined): ChartPartRef | null {
	if (!hit) {
		return null;
	}
	return { role: 'dataPoint', seriesIndex: hit.seriesIndex, pointIndex: hit.pointIndex };
}

/** Whether a mesh's own (series, point) reference is the currently-selected part. */
export function chart3DMarkMatchesPart(
	mark: Chart3DMarkHit,
	part: ChartPartRef | null | undefined,
): boolean {
	return (
		part !== null &&
		part !== undefined &&
		part.role === 'dataPoint' &&
		part.seriesIndex === mark.seriesIndex &&
		part.pointIndex === mark.pointIndex
	);
}

/** A 2D point in CSS pixels (screen space). */
export interface ScreenPoint2D {
	x: number;
	y: number;
}

/** Screen-space calibration of a mark's value axis, valid only until the camera next moves. */
export interface Chart3DValueAxisCalibration {
	/** Screen-space unit vector pointing in the direction of increasing value. */
	directionScreen: ScreenPoint2D;
	/** Screen pixels of travel, along {@link directionScreen}, per +1 data value unit. */
	pixelsPerUnit: number;
}

/**
 * Calibrate a value axis from two already-projected screen points known to
 * correspond to two distinct data values on the same mark (e.g. its
 * value-zero base and its current top). Returns `null` when the two values
 * coincide or the two screen points are (near) coincident (camera looking
 * straight down the axis), since no calibration is possible.
 *
 * Order-independent: swapping `(screenAtValue0, value0)` with
 * `(screenAtValue1, value1)` yields the same {@link chart3DPointerDeltaToValueDelta}
 * result, since the direction vector and `pixelsPerUnit` sign flip together.
 */
export function calibrateChart3DValueAxis(
	screenAtValue0: ScreenPoint2D,
	value0: number,
	screenAtValue1: ScreenPoint2D,
	value1: number,
): Chart3DValueAxisCalibration | null {
	const valueSpan = value1 - value0;
	const dx = screenAtValue1.x - screenAtValue0.x;
	const dy = screenAtValue1.y - screenAtValue0.y;
	const pixelSpan = Math.hypot(dx, dy);
	if (valueSpan === 0 || pixelSpan < 1e-6 || !Number.isFinite(valueSpan)) {
		return null;
	}
	return {
		directionScreen: { x: dx / pixelSpan, y: dy / pixelSpan },
		pixelsPerUnit: pixelSpan / valueSpan,
	};
}

/**
 * Convert a screen-space pointer delta (current position minus drag-start
 * position, in CSS px) into a value delta, using a calibration taken at drag
 * start. Add the result to the mark's value at drag start to get the live
 * (or committed) dragged value.
 */
export function chart3DPointerDeltaToValueDelta(
	calibration: Chart3DValueAxisCalibration,
	pointerDeltaScreen: ScreenPoint2D,
): number {
	const dot =
		pointerDeltaScreen.x * calibration.directionScreen.x +
		pointerDeltaScreen.y * calibration.directionScreen.y;
	return dot / calibration.pixelsPerUnit;
}
