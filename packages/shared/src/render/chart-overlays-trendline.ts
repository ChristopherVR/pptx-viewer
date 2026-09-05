/**
 * chart-overlays-trendline.ts: public `computeTrendlinePrimitives` API,
 * turning each series' `computeTrendlinePoints` fit into `SvgPrimitive[]`.
 * Split out of chart-overlays.ts to keep that module under the repo's
 * file-size guideline.
 *
 * Ported / adapted from:
 *   packages/react/src/viewer/utils/chart-trendlines.tsx (regression engine)
 *   packages/shared/src/render/chart-trendlines.ts (shared port)
 *
 * @module chart-overlays-trendline
 */

import type { PptxChartData, PptxChartSeries, PptxChartTrendline } from 'pptx-viewer-core';

import { DEFAULT_CHART_DATA_LABEL_PX } from './chart-font';
import { applyLabelManualLayout } from './chart-manual-layout';
import { computeTrendlinePoints } from './chart-overlays-trendline-fit';
import type { PlotLayout, SvgPath, SvgPrimitive, SvgText, ValueRange } from './chart-view-model';
import { formatAxisValue, seriesColor } from './chart-view-model';

/**
 * Build `SvgPrimitive[]` for all trendlines declared by every series in
 * `chartData`. Returns an empty array when no series declares a trendline.
 *
 * Each trendline produces:
 *   - one `SvgPath` (dashed polyline in the series / trendline colour), and
 *   - optionally one `SvgText` with the equation / R-squared label at the last point.
 *
 * @param chartData  Full parsed chart data.
 * @param catCount   Number of categories (x-slots), e.g. `chartData.categories.length || 1`.
 * @param layout     Plot-area bounding box from `computePlotLayout`.
 * @param range      Value-axis range from `computeValueRange` / `computeStackedValueRange`.
 * @param mode       `'bar'` for bar/column, `'line'` for line/area/scatter.
 * @param colorPalette  Optional resolved palette (same as passed to `seriesColor`).
 */
export function computeTrendlinePrimitives(
	chartData: PptxChartData,
	catCount: number,
	layout: PlotLayout,
	range: ValueRange,
	mode: 'line' | 'bar' = 'line',
	colorPalette?: readonly string[],
): SvgPrimitive[] {
	const out: SvgPrimitive[] = [];

	chartData.series.forEach((series: PptxChartSeries, si: number) => {
		if (!series.trendlines || series.trendlines.length === 0) {
			return;
		}

		series.trendlines.forEach((tl: PptxChartTrendline) => {
			const { points, equation, rSquared } = computeTrendlinePoints(
				tl,
				series.values,
				catCount,
				layout,
				range,
				mode,
			);
			if (points.length < 2) {
				return;
			}

			const pathD = points
				.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
				.join(' ');
			const strokeColor = tl.color ?? seriesColor(series, si, colorPalette);

			const pathPrimitive: SvgPath = {
				kind: 'path',
				d: pathD,
				fill: 'none',
				stroke: strokeColor,
				strokeWidth: 1.5,
			};
			out.push(pathPrimitive);

			const labelParts: string[] = [];
			if (tl.displayEq && equation) {
				labelParts.push(equation);
			}
			if (tl.displayRSq) {
				// `c:trendlineLbl/c:numFmt`: an explicit format code wins over the
				// default fixed 4-decimal display; `sourceLinked` (or no numFmt at
				// all) keeps that default, matching PowerPoint's own R-squared display.
				const numberFormat =
					tl.label && tl.label.sourceLinked === false ? tl.label.numberFormatCode : undefined;
				labelParts.push(
					numberFormat
						? `R² = ${formatAxisValue(rSquared, numberFormat)}`
						: `R² = ${rSquared.toFixed(4)}`,
				);
			}

			if (labelParts.length > 0) {
				const last = points[points.length - 1];
				// `c:trendlineLbl/c:layout/c:manualLayout`: a dragged label wins over
				// the default "hug the trendline's last point" anchor.
				const anchor = applyLabelManualLayout(
					tl.label?.layout,
					{ width: layout.svgWidth, height: layout.svgHeight },
					{ x: last.x, y: last.y - 6 },
				);
				const labelText: SvgText = {
					kind: 'text',
					x: anchor.x,
					y: anchor.y,
					text: labelParts.join('  '),
					fontSize: DEFAULT_CHART_DATA_LABEL_PX,
					fill: strokeColor,
					textAnchor: 'end',
				};
				out.push(labelText);
			}
		});
	});

	return out;
}
