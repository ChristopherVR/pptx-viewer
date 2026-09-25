/**
 * Value-band legend for the surface chart kind.
 *
 * PowerPoint never labels a surface chart's legend with series names: every
 * one of its four surface subtypes (3-D Surface, 3-D Surface (Wireframe),
 * Contour, Wireframe Contour) instead divides the value axis into major-unit
 * bands and shows one legend swatch per band ("0-0.5", "0.5-1", ...),
 * because the whole point of the colour ramp is to read a Z value off the
 * mesh's colour, not to identify which authored series a facet came from.
 * COM-verified against `charts-com.pptx` slides 7-10 (surface types 83-86):
 * a series-name legend never appears on any of the four.
 *
 * Split out of `chart-surface-bands.ts` (which owns the colour ramp and wall
 * panels) to keep each module focused and under the repo's ~300-LOC budget.
 *
 * @module chart-surface-legend
 */
import type { PptxChartBandFmt } from 'pptx-viewer-core';

import { resolveLegendAnchorPosition } from './chart-legend-build';
import { resolveSurfaceBandFill } from './chart-surface-bands';
import { surfaceColor } from './chart-surface-common';
import { axisTickValues } from './chart-view-model-chrome';
import { formatAxisValue } from './chart-view-model-scale';
import type { ValueRange } from './chart-view-model-scale';
import type { LegendEntry } from './chart-view-model-types';

/** One value band: `[min, max)` of the data range, with the colour it paints. */
export interface SurfaceValueBand {
	min: number;
	max: number;
	/** Normalised midpoint in `[0, 1]`, used to sample the continuous colour ramp. */
	midT: number;
	color: string;
}

/**
 * Divide `range` into the same major-unit bands its value axis would draw
 * ticks at (`axisTickValues`), so a legend built from these lines up exactly
 * with the colour a viewer would read off the mesh at each gridline. Falls
 * back to a single band spanning the whole range when the axis has no more
 * than one tick (a flat or single-point dataset).
 */
export function buildSurfaceValueBands(
	range: ValueRange,
	bandFmts: ReadonlyArray<PptxChartBandFmt> | undefined,
): SurfaceValueBand[] {
	const ticks = axisTickValues(range);
	const boundaries = ticks.length >= 2 ? ticks : [range.min, range.max];

	const bands: SurfaceValueBand[] = [];
	for (let i = 0; i < boundaries.length - 1; i++) {
		const min = boundaries[i],
			max = boundaries[i + 1];
		const midT = range.span > 0 ? ((min + max) / 2 - range.min) / range.span : 0.5;
		const clampedT = Math.min(1, Math.max(0, midT));
		const { r, g, b } = surfaceColor(clampedT);
		bands.push({
			min,
			max,
			midT: clampedT,
			color: resolveSurfaceBandFill(clampedT, bandFmts) ?? `rgb(${r},${g},${b})`,
		});
	}
	return bands;
}

/**
 * Build the surface chart's value-band legend entries + anchor position,
 * mirroring `buildLegend`'s return shape so callers swap one for the other
 * without touching their view-model assembly.
 */
export function buildSurfaceLegend(
	bands: ReadonlyArray<SurfaceValueBand>,
	svgWidth: number,
	legendPos: string,
	svgHeight: number,
	plotTop: number,
): {
	legend: LegendEntry[];
	legendX: number;
	legendY: number;
	legendAnchor: 'start' | 'middle' | 'end';
} {
	const legend: LegendEntry[] = bands.map((band) => ({
		color: band.color,
		label: `${formatAxisValue(band.min)}-${formatAxisValue(band.max)}`,
	}));
	const { legendX, legendY, legendAnchor } = resolveLegendAnchorPosition(
		svgWidth,
		svgHeight,
		plotTop,
		legendPos,
	);
	return { legend, legendX, legendY, legendAnchor };
}

/** Look up the band a normalised `t` in `[0, 1]` falls into, for mesh/grid fills. */
export function surfaceBandColorAt(bands: ReadonlyArray<SurfaceValueBand>, t: number): string {
	if (bands.length === 0) {
		const { r, g, b } = surfaceColor(t);
		return `rgb(${r},${g},${b})`;
	}
	const clamped = Math.min(1, Math.max(0, t));
	const bucket = Math.min(bands.length - 1, Math.floor(clamped * bands.length));
	return bands[bucket].color;
}
