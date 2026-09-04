/**
 * chart-cartesian-stacked-labels.ts: the (non-percent) stacked bar/column data
 * labels, split out of `chart-cartesian-bars.ts` to keep that file within the
 * repo's ~300-LOC limit.
 *
 * @module chart-cartesian-stacked-labels
 */
import type { PptxChartData, PptxChartSeries } from 'pptx-viewer-core';

import { resolveBarLabelPlacement } from './chart-data-label-anchor';
import { buildDataLabelText } from './chart-data-label-text';
import { DEFAULT_CHART_DATA_LABEL_PX } from './chart-font';
import type { PlotLayout, SvgText, ValueRange } from './chart-view-model';
import { valueToY } from './chart-view-model';

/**
 * Push the abs-value stacked data labels matching the original cartesian
 * builder: one label per (category x series) at the bar mid, only when data
 * labels are on. `c:dLblPos` (ctr/inBase/inEnd/outEnd) repositions the label
 * on the bar rect, and a per-point `c:dLbl/c:layout` drag shifts it further,
 * via the same `resolveBarLabelPlacement` pipeline the clustered path uses.
 */
export function pushClusteredStackedLabels(
	chartData: PptxChartData,
	series: ReadonlyArray<PptxChartSeries>,
	sourceIndices: ReadonlyArray<number>,
	catCount: number,
	layout: PlotLayout,
	range: ValueRange,
	dataLabels: SvgText[],
): void {
	const barGroupWidth = layout.plotWidth / catCount,
		seriesCount = Math.max(series.length, 1),
		singleBarWidth = (barGroupWidth * 0.7) / seriesCount,
		groupOffset = (barGroupWidth - singleBarWidth * seriesCount) / 2;

	for (let ci = 0; ci < catCount; ci++) {
		const sourceIndex = sourceIndices[ci] ?? ci;
		for (let si = 0; si < series.length; si++) {
			const val = series[si].values[sourceIndex] ?? 0,
				barX = layout.plotLeft + barGroupWidth * ci + groupOffset + singleBarWidth * si,
				zeroY = valueToY(0, range, layout.plotTop, layout.plotBottom),
				valY = valueToY(val, range, layout.plotTop, layout.plotBottom),
				barY = Math.min(zeroY, valY),
				barH = Math.max(Math.abs(zeroY - valY), 1),
				label = buildDataLabelText({
					chartData,
					series: series[si],
					pointIndex: sourceIndex,
					value: val,
				});
			if (label === undefined) {
				continue;
			}
			const anchor = resolveBarLabelPlacement(
				chartData,
				series[si],
				sourceIndex,
				{ x: barX, y: barY, width: singleBarWidth, height: barH },
				val,
				'vertical',
				{ width: layout.svgWidth, height: layout.svgHeight },
			);
			dataLabels.push({
				kind: 'text',
				x: anchor.x,
				y: anchor.y,
				text: label.text,
				fontSize: DEFAULT_CHART_DATA_LABEL_PX,
				fill: label.color ?? '#334155',
				textAnchor: anchor.textAnchor,
				...(anchor.dominantBaseline ? { dominantBaseline: anchor.dominantBaseline } : {}),
			});
		}
	}
}
