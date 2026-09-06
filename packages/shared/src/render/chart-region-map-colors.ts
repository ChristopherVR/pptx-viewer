/**
 * Colour-scale and colour-legend helpers for the regionMap chart kind.
 *
 * Split out of `chart-waterfall-map.ts` (which re-exports `sequentialColorScale`
 * / `normalizeValue`) to keep that file's two unrelated chart kinds (waterfall,
 * regionMap) each under the repo's per-file line budget.
 *
 * @module chart-region-map-colors
 */

import { lerpColor } from './chart-region-map-data';
import type { SvgRect, SvgText } from './chart-view-model';
import { formatAxisValue } from './chart-view-model';

/** Bands the region-map colour legend is drawn with. See its use site. */
const REGION_LEGEND_BANDS = 32;

/**
 * 3-stop sequential colour scale: light (#dbeafe) -> mid (#3b82f6) -> dark (#1e3a5f).
 * Mirrors `sequentialColorScale` in React's `chart-map.tsx`.
 */
export function sequentialColorScale(t: number): string {
	const clamped = Math.max(0, Math.min(1, t));
	if (clamped <= 0.5) {
		return lerpColor('#dbeafe', '#3b82f6', clamped * 2);
	}
	return lerpColor('#3b82f6', '#1e3a5f', (clamped - 0.5) * 2);
}

/** Normalise a value to [0..1] within a min/max range. */
export function normalizeValue(value: number, min: number, max: number): number {
	if (max === min) {
		return 0.5;
	}
	return (value - min) / (max - min);
}

export interface RegionMapColorLegendParams {
	svgWidth: number;
	legendY: number;
	minVal: number;
	maxVal: number;
	colorScale: (t: number) => string;
	attribution?: string;
	svgHeight: number;
}

/**
 * Build the colour-legend bar (banded gradient approximation), its min/max
 * value labels, and the optional attribution text, in the same order the
 * regionMap view-model draws them.
 */
export function buildRegionMapColorLegend(
	params: RegionMapColorLegendParams,
): Array<SvgRect | SvgText> {
	const { svgWidth, legendY, minVal, maxVal, colorScale, attribution, svgHeight } = params;
	const primitives: Array<SvgRect | SvgText> = [];

	const barW = Math.min(svgWidth * 0.4, 160);
	const barX = (svgWidth - barW) / 2;

	// The ramp is banded, not a paint server: `SvgPrimitive` has no gradient
	// kind, and inventing one would need a matching change in all five
	// projectors. Two half-width rects (what this used to emit) read as a
	// two-tone bar rather than a scale, so the band count is high enough that
	// the seams fall below a pixel at any legend width a slide can produce.
	for (let band = 0; band < REGION_LEGEND_BANDS; band++) {
		primitives.push({
			kind: 'rect',
			x: barX + (band / REGION_LEGEND_BANDS) * barW,
			y: legendY,
			// A hair of overlap: adjacent rects on fractional pixel boundaries
			// otherwise leave hairline gaps once the slide's zoom transform lands.
			w: barW / REGION_LEGEND_BANDS + 0.5,
			h: 8,
			fill: colorScale((band + 0.5) / REGION_LEGEND_BANDS),
		} satisfies SvgRect);
	}

	// Legend min/max labels.
	primitives.push(
		{
			kind: 'text',
			x: barX,
			y: legendY + 18,
			text: formatAxisValue(minVal),
			fontSize: 7,
			fill: '#64748b',
			textAnchor: 'middle',
		} satisfies SvgText,
		{
			kind: 'text',
			x: barX + barW,
			y: legendY + 18,
			text: formatAxisValue(maxVal),
			fontSize: 7,
			fill: '#64748b',
			textAnchor: 'middle',
		} satisfies SvgText,
	);

	if (attribution) {
		primitives.push({
			kind: 'text',
			x: svgWidth - 4,
			y: svgHeight - 4,
			text: attribution,
			fontSize: 5,
			fill: '#64748b',
			textAnchor: 'end',
		} satisfies SvgText);
	}

	return primitives;
}
