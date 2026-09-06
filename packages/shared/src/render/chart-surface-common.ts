/**
 * Shared colour ramp and view-model chrome helpers for the surface and
 * treemap chart kinds.
 *
 * Split out of `chart-surface-treemap.ts` (which re-exports `surfaceColor`)
 * to keep that file's several chart-kind builders each under the repo's
 * per-file line budget.
 *
 * @module chart-surface-common
 */

import type { ChartViewModel } from './chart-view-model';

/**
 * Map a normalised value t in [0..1] to a surface colour ramp (blue-green-red).
 *
 * Exported so the interactive 3D scene adapter (`surface-chart-3d-data.ts`)
 * tints its mesh with the exact same ramp as this module's flat/isometric SVG
 * fallback: one colour formula, never two to drift apart.
 */
export function surfaceColor(t: number): { r: number; g: number; b: number } {
	return {
		r: Math.round(30 + 200 * t),
		g: Math.round(80 + 100 * (1 - Math.abs(t - 0.5) * 2)),
		b: Math.round(200 * (1 - t) + 30),
	};
}

/** Darken an rgb triplet by a factor in [0..1]. */
export function darkenRgb(r: number, g: number, b: number, factor: number): string {
	return `rgb(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)})`;
}

/** The chart-chrome fields every surface/treemap view-model leaves empty. */
export function emptyChrome(): Pick<
	ChartViewModel,
	'gridlines' | 'axisLabels' | 'zeroLine' | 'categoryLabels' | 'dataLabels'
> {
	return {
		gridlines: [],
		axisLabels: [],
		zeroLine: undefined,
		categoryLabels: [],
		dataLabels: [],
	};
}
