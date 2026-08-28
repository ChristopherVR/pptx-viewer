/**
 * Pure raycast-hit -> hover-tooltip mapping for the interactive 3D pie chart
 * scene ({@link ./pie-chart-3d-scene.ts}).
 *
 * Like `bar3D` (each data point is its own box mesh), every pie3D wedge is
 * its OWN `CylinderGeometry` mesh, so the scene controller tags every wedge's
 * `userData` with its point index directly and a `Raycaster.intersectObjects`
 * hit reports it straight from the hit object - no face-index arithmetic
 * needed. This module only builds the tooltip text from that index, kept
 * three-agnostic so it is unit-testable without mocking WebGL. Mirrors
 * {@link ./bar-chart-3d-hit-test.ts} exactly.
 *
 * @module pie-chart-3d-hit-test
 */
import { buildMarkTooltip } from './chart-view-model';

/** The pie3D wedge a raycast hit landed on, plus its authored value. */
export interface PieChart3DHit {
	pointIndex: number;
	value: number;
}

/** The subset of {@link PieChart3DSceneOptions} the hover tooltip needs. */
export interface PieChart3DHoverTooltipData {
	categoryLabels: ReadonlyArray<string>;
	seriesName: string | undefined;
	numberFormat: string | undefined;
}

/**
 * Build the hover-tooltip text for a raycast hit on a pie3D wedge mesh, or
 * `undefined` when there is no hit.
 *
 * Mirrors `buildMarkTooltip`'s "<series>, <category>: <value>" text exactly,
 * so a pie3D wedge's tooltip reads identically to the flat SVG pie
 * renderer's.
 */
export function buildPieChart3DHoverTooltip(
	hit: PieChart3DHit | null | undefined,
	data: PieChart3DHoverTooltipData,
): string | undefined {
	if (!hit) {
		return undefined;
	}
	return buildMarkTooltip(
		data.seriesName,
		data.categoryLabels[hit.pointIndex],
		hit.value,
		data.numberFormat,
	);
}
