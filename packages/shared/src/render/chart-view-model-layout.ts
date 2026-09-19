/**
 * chart-view-model-layout.ts: plot-area layout math for the chart engine
 * (the plot inset, legend/title/data-table/secondary-axis reservations, and
 * `c:plotArea/c:layout/c:manualLayout` overrides). Chart chrome (gridlines,
 * axis / category labels) lives in `chart-view-model-chrome.ts`; legend
 * building lives in `chart-legend-build.ts`. All three are re-exported by
 * `chart-view-model.ts`.
 *
 * @module chart-view-model-layout
 */
/* eslint-disable one-var -- this module predates the rule and combining every
   sibling `const`/`let` in a function into one comma-list (oxlint's own
   `--fix` cannot do this safely once a non-declaration statement sits between
   them) would churn geometry code far beyond this change's scope. */

import type { PptxChartData } from 'pptx-viewer-core';

import { chartFontPx, DEFAULT_CHART_TEXT_PX } from './chart-font';
import { reserveLegendSpace } from './chart-legend-placement';
import { manualLayoutOf, resolveManualLayoutRect } from './chart-manual-layout';
import type { PlotLayout, PlotLayoutOptions } from './chart-view-model-types';

/**
 * Compute the plot layout for a chart element.
 * Mirrors `computeLayout` from chart-layout.ts (React). When `options` is omitted
 * (or all its flags are falsy) the output is byte-identical to the original
 * viewer-first single-axis layout; the secondary-axis / data-table reservations
 * only apply when explicitly requested.
 */
/**
 * Vertical space to reserve under the plot for the category axis: the gap
 * `c:lblOffset` asks for, plus one line box of the axis font.
 *
 * The old flat 24 px was calibrated when chart text was drawn pt-as-px. Once
 * `chartFontPx` scaled every label by 4/3, an 11.95 pt axis no longer fitted in
 * 24 px and its labels were pushed back up onto the plot. The `Math.max(24, …)`
 * floor keeps the previous behaviour for default-font and axis-less charts, so
 * only oversized-font charts move.
 *
 * @param chartData The chart whose category axis is being measured.
 * @returns Pixels to reserve below the plot area.
 */
function categoryAxisBand(chartData: PptxChartData): number {
	const axis = chartData.axes?.find(
			(candidate) => candidate.axisType === 'catAx' || candidate.axisType === 'dateAx',
		),
		fontPx = axis?.fontSize !== undefined ? chartFontPx(axis.fontSize) : DEFAULT_CHART_TEXT_PX,
		offset = 4 + 8 * ((axis?.labelOffset ?? 100) / 100);
	return Math.max(24, offset + fontPx * 1.2);
}

/**
 * Horizontal space to reserve to the LEFT of the plot for the axis band.
 *
 * The 40 px default is sized for a value axis's short numeric ticks (up to a
 * few digits). A horizontal-bar chart's left axis instead carries the
 * category TEXT (the chart is transposed: categories run down the left,
 * values along the bottom), which is routinely wider than that, e.g. an
 * inserted chart's default "Category 1" label measures ~72 px at the default
 * 13.33 px axis font. Left at the 40 px default, that text clipped against
 * the chart's own SVG edge (x=0) before it ever reached the plot area,
 * rendering "Category 1" as "egory 1". `leftCategoryLabelWidth` (from
 * `widestCategoryLabelWidth` in chart-horizontal-bars-helpers.ts) lets the
 * horizontal-bar builder widen this band to fit its actual label text; every
 * other caller keeps the unchanged 40 px numeric-axis default.
 */
function leftAxisBand(leftCategoryLabelWidth: number | undefined): number {
	return Math.max(40, (leftCategoryLabelWidth ?? 0) + 4);
}

export function computePlotLayout(
	elementWidth: number,
	elementHeight: number,
	chartData: PptxChartData,
	hasAxes: boolean,
	options?: PlotLayoutOptions,
): PlotLayout {
	// The SVG viewBox must equal the element's frame box exactly: bindings render
	// it with `preserveAspectRatio="none"`, so ANY minimum here (historically
	// 320x180) makes the chart scale non-uniformly inside its host (issue #132:
	// a 475x174 frame got a 475x180 viewBox, squeezing y by 0.967).
	const svgWidth = Math.max(1, elementWidth),
		svgHeight = Math.max(1, elementHeight);

	let plotLeft = hasAxes ? 8 + leftAxisBand(options?.leftCategoryLabelWidth) : 8,
		plotTop = 8,
		plotRight = svgWidth - 8,
		plotBottom = svgHeight - (hasAxes ? categoryAxisBand(chartData) : 8);

	// `c:catAx/c:axPos val="t"` on the PRIMARY (and, in the common case, only)
	// category axis: PowerPoint draws that axis's tick labels above the plot,
	// not below it. Reserving the label band at the bottom regardless of
	// `axPos` (the historical behaviour here) leaves no room at the top, so the
	// labels get drawn outside the chart's own SVG bounds and clip against its
	// edge. Move the reservation to match where the labels actually land.
	if (hasAxes && options?.categoryAxisAtTop) {
		plotBottom = svgHeight - 8;
		plotTop += categoryAxisBand(chartData);
	}

	const style = chartData.style,
		legendPos = style?.legendPosition ?? 'b';

	if (style?.hasTitle) {
		plotTop += 20;
	}
	if (style?.hasLegend) {
		// `tr` (top-right corner) overlays the plot per PowerPoint's own
		// quick-layout behaviour: no band is reserved for it, unlike b/t/l/r.
		({ plotLeft, plotTop, plotRight, plotBottom } = reserveLegendSpace(legendPos, {
			plotLeft,
			plotTop,
			plotRight,
			plotBottom,
		}));
	}

	// Secondary value axis on the right.
	if (options?.hasSecondaryValueAxis) {
		plotRight -= 40;
	}
	// Secondary category axis on the top.
	if (options?.hasSecondaryCategoryAxis) {
		plotTop += 16;
	}
	// Data table below the chart.
	if (options?.hasDataTable) {
		const rowCount = options.dataTableRowCount ?? 1;
		plotBottom -= 14 + rowCount * 14;
	}

	// The automatic plot height, before any manual layout override below can
	// change it: see `PlotLayout.autoPlotHeight`'s doc comment.
	const autoPlotHeight = Math.max(plotBottom - plotTop, 1);

	// c:plotArea/c:layout/c:manualLayout: the author placed the plot area by
	// hand. Each field the layout omits keeps the automatic value above, which
	// is also what a `factor`-mode offset is relative to. An `outer` target
	// (the default) includes the axis labels, so the plot proper is inset by
	// the same bands the automatic layout reserves for them.
	const plotLayout = manualLayoutOf(chartData, 'plotArea'),
		manual = resolveManualLayoutRect(
			plotLayout,
			{ width: svgWidth, height: svgHeight },
			{ x: plotLeft, y: plotTop, width: plotRight - plotLeft, height: plotBottom - plotTop },
		);
	if (plotLayout && manual) {
		plotLeft = manual.x;
		plotTop = manual.y;
		plotRight = manual.x + manual.width;
		plotBottom = manual.y + manual.height;
		if (hasAxes && plotLayout.layoutTarget !== 'inner') {
			plotLeft += leftAxisBand(options?.leftCategoryLabelWidth);
			plotBottom -= categoryAxisBand(chartData) - 8;
		}
	}

	const plotWidth = Math.max(plotRight - plotLeft, 1),
		plotHeight = Math.max(plotBottom - plotTop, 1);

	return {
		svgWidth,
		svgHeight,
		plotLeft,
		plotTop,
		plotRight: plotLeft + plotWidth,
		plotBottom: plotTop + plotHeight,
		plotWidth,
		plotHeight,
		autoPlotHeight,
	};
}
