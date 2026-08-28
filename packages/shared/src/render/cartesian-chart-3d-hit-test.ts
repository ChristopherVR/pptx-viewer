/**
 * Pure raycast-hit -> hover-tooltip mapping shared by the interactive
 * line3D/area3D cartesian chart scenes ({@link ./line-chart-3d-scene.ts},
 * {@link ./area-chart-3d-scene.ts}).
 *
 * Each series path's data-point marker mesh tags its Object3D `userData` with
 * the (series, category, value) triple a raycast hit reports directly,
 * exactly like a bar3D box mesh does (see `bar-chart-3d-hit-test.ts`, the
 * original of this pattern). This module only builds the tooltip text from
 * those indices, kept three-agnostic so it is unit-testable without mocking
 * WebGL.
 *
 * @module cartesian-chart-3d-hit-test
 */
import { buildMarkTooltip } from './chart-view-model';

/** The (series, category) a raycast hit landed on, plus its authored value. */
export interface CartesianChart3DHit {
	seriesIndex: number;
	categoryIndex: number;
	value: number;
}

/** The subset of scene options the hover tooltip needs. */
export interface CartesianChart3DHoverTooltipData {
	categoryLabels: ReadonlyArray<string>;
	seriesNames: ReadonlyArray<string>;
	numberFormats?: ReadonlyArray<string | undefined>;
}

/**
 * Build the hover-tooltip text for a raycast hit on a line3D/area3D data-point
 * marker, or `undefined` when there is no hit.
 *
 * Mirrors `buildMarkTooltip`'s "<series>, <category>: <value>" text exactly,
 * so a line3D/area3D marker's tooltip reads identically to the flat SVG
 * line/area renderer's, and to `buildBarChart3DHoverTooltip`'s.
 */
export function buildCartesianChart3DHoverTooltip(
	hit: CartesianChart3DHit | null | undefined,
	data: CartesianChart3DHoverTooltipData,
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
