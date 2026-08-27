/**
 * Pure raycast-hit -> hover-tooltip mapping for the interactive 3D bar chart
 * scene ({@link ./bar-chart-3d-scene.ts}).
 *
 * Unlike the surface chart's single continuous mesh (which recovers a grid
 * cell from a triangle `faceIndex`, see `surface-chart-3d-hit-test.ts`), each
 * bar3D data point is its OWN box mesh, so the scene controller tags every
 * box's `userData` with its (series, category) indices directly and a
 * `Raycaster.intersectObjects` hit reports them straight from the hit
 * object - no face-index arithmetic needed. This module only builds the
 * tooltip text from those indices, kept three-agnostic so it is unit-testable
 * without mocking WebGL.
 *
 * @module bar-chart-3d-hit-test
 */
import { buildMarkTooltip } from './chart-view-model';

/** The (series, category) a raycast hit landed on, plus its authored value. */
export interface BarChart3DHit {
	seriesIndex: number;
	categoryIndex: number;
	value: number;
}

/** The subset of {@link BarChart3DSceneOptions} the hover tooltip needs. */
export interface BarChart3DHoverTooltipData {
	categoryLabels: ReadonlyArray<string>;
	seriesNames: ReadonlyArray<string>;
	numberFormats?: ReadonlyArray<string | undefined>;
}

/**
 * Build the hover-tooltip text for a raycast hit on a bar3D box mesh, or
 * `undefined` when there is no hit.
 *
 * Mirrors `buildMarkTooltip`'s "<series>, <category>: <value>" text exactly,
 * so a bar3D box's tooltip reads identically to the flat SVG bar renderer's.
 */
export function buildBarChart3DHoverTooltip(
	hit: BarChart3DHit | null | undefined,
	data: BarChart3DHoverTooltipData,
): string | undefined {
	if (!hit) {
		return undefined;
	}
	return buildMarkTooltip(
		data.seriesNames[hit.seriesIndex],
		data.categoryLabels[hit.categoryIndex],
		hit.value,
		data.numberFormats?.[hit.seriesIndex],
	);
}
