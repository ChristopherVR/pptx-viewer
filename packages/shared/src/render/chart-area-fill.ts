/**
 * The chart-area (and plot-area) background, resolved once for every binding.
 *
 * All five viewers painted a hardcoded `#0f172a11` wash across the whole chart
 * SVG. PowerPoint decks routinely write `<c:spPr><a:noFill/></c:spPr>` on
 * `c:chartSpace` and `c:plotArea` precisely so the chart floats on the slide;
 * the wash boxed every such chart into a visible grey panel that is not in the
 * source. Honouring the authored fill (an explicit `<a:noFill/>`) was the
 * first fix, but a chart with NO `c:spPr` at all (the common case: only a
 * deliberately-styled chart writes one) still fell back to the same synthetic
 * wash, which is just as wrong: real PowerPoint never paints a highlight box
 * behind an unstyled chart, it is fully transparent like the `noFill` case.
 * Measured against a real-world deck (a plain single-series bar chart with no
 * `c:chartSpace/c:spPr` at all) PowerPoint's own export shows no grey
 * anywhere; this module now treats "no fill recorded" the same whether the
 * source said `noFill` explicitly or said nothing, matching `plotAreaFill`
 * below, which never had a synthetic default in the first place.
 */

import type { PptxChartData } from 'pptx-viewer-core';

/**
 * The wash the bindings used to paint whenever a chart declared no fill of
 * its own. No longer used as an automatic default for real chart data (see
 * the module doc comment); kept only for `buildFallbackViewModel`'s
 * unsupported/empty-chart placeholder, which has no chart data to read a fill
 * from and still wants a visible box to represent "a chart goes here".
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
 * painted: the source declared `a:noFill`, or (matching real PowerPoint)
 * simply never wrote a `c:chartSpace/c:spPr` at all.
 */
export function chartAreaFill(chartData: PptxChartData | undefined): string | undefined {
	return resolve(chartData?.style?.chartAreaFill, undefined);
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
