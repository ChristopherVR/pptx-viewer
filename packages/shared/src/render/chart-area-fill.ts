/**
 * The chart-area (and plot-area) background, resolved once for every binding.
 *
 * All five viewers painted a hardcoded `#0f172a11` wash across the whole chart
 * SVG. PowerPoint decks routinely write `<c:spPr><a:noFill/></c:spPr>` on
 * `c:chartSpace` and `c:plotArea` precisely so the chart floats on the slide;
 * the wash boxed every such chart into a visible grey panel that is not in the
 * source. Honouring the authored fill is the fix, and keeping the wash as the
 * fallback leaves charts that say nothing looking exactly as they did.
 */

import type { PptxChartData } from 'pptx-viewer-core';

/**
 * The wash the bindings have always painted when a chart declares no fill of
 * its own. Kept as the default so an unstyled chart still reads as a distinct
 * surface against the slide.
 */
export const DEFAULT_CHART_AREA_FILL = '#0f172a11';

/** Resolve one recorded fill value to an SVG `fill`, or `undefined` to skip. */
function resolve(fill: string | undefined, fallback: string | undefined): string | undefined {
	if (fill === 'none') {
		return undefined;
	}
	return fill ?? fallback;
}

/**
 * SVG `fill` for the chart-area rect, or `undefined` when nothing should be
 * painted (the source declared `a:noFill`).
 */
export function chartAreaFill(chartData: PptxChartData | undefined): string | undefined {
	return resolve(chartData?.style?.chartAreaFill, DEFAULT_CHART_AREA_FILL);
}

/**
 * SVG `fill` for the plot-area rect, or `undefined` when nothing should be
 * painted. Unlike the chart area there is no default wash: a plot area that
 * says nothing inherits the chart area behind it.
 */
export function plotAreaFill(chartData: PptxChartData | undefined): string | undefined {
	return resolve(chartData?.style?.plotAreaFill, undefined);
}

/**
 * PowerPoint's own "Rounded corners" checkbox radius (Format Chart Area),
 * approximated as a fixed slide-px value close to its rendered look; there is
 * no authored radius value in `c:roundedCorners` (it is a plain boolean), so
 * every rounded chart gets the same corner.
 */
const ROUNDED_CORNERS_RADIUS_PX = 8;

/**
 * SVG `rx`/`ry` corner radius for the chart-area rect when
 * `c:chartSpace/c:roundedCorners` is set, or `undefined` (square corners)
 * otherwise.
 */
export function chartAreaCornerRadius(chartData: PptxChartData | undefined): number | undefined {
	return chartData?.roundedCorners === true ? ROUNDED_CORNERS_RADIUS_PX : undefined;
}
