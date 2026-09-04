/**
 * chart-combo-series.ts: per-series primitive/label builders for the combo
 * (bar + line) chart, split out of `chart-combo.ts` to keep that file within
 * the repo's ~300-LOC limit.
 *
 * @module chart-combo-series
 */
import type { PptxChartData, PptxChartSeries } from 'pptx-viewer-core';

import { resolveBarLabelPlacement, resolveMarkerLabelPlacement } from './chart-data-label-anchor';
import { DEFAULT_CHART_DATA_LABEL_PX } from './chart-font';
import type {
	PlotLayout,
	SvgCircle,
	SvgPolyline,
	SvgPrimitive,
	SvgText,
	ValueRange,
} from './chart-view-model';
import { formatAxisValue, seriesColor, valueToY } from './chart-view-model';

/** Bar-series data labels, honouring `c:dLblPos` and any per-point manual drag. */
export function appendBarLabels(
	series: PptxChartSeries,
	chartData: PptxChartData,
	layout: PlotLayout,
	catCount: number,
	range: ValueRange,
	sourceIndices: ReadonlyArray<number>,
	labels: SvgText[],
	xPositions?: ReadonlyArray<number>,
): void {
	if (!chartData.style?.hasDataLabels) {
		return;
	}
	const groupWidth = layout.plotWidth / catCount;
	const barWidth = groupWidth * 0.7;
	const offset = (groupWidth - barWidth) / 2;
	sourceIndices.forEach((sourceIndex, displayIndex) => {
		const value = series.values[sourceIndex] ?? 0;
		const zeroY = valueToY(0, range, layout.plotTop, layout.plotBottom);
		const valueY = valueToY(value, range, layout.plotTop, layout.plotBottom);
		const x =
			xPositions?.[displayIndex] ??
			layout.plotLeft + groupWidth * displayIndex + offset + barWidth / 2;
		const barY = Math.min(zeroY, valueY);
		const barH = Math.max(Math.abs(zeroY - valueY), 1);
		// c:dLblPos (ctr/inBase/inEnd/outEnd) decides where on the bar the label
		// sits; a per-point c:dLbl/c:layout drag shifts it further.
		const anchor = resolveBarLabelPlacement(
			chartData,
			series,
			sourceIndex,
			{ x: x - barWidth / 2, y: barY, width: barWidth, height: barH },
			value,
			'vertical',
			{ width: layout.svgWidth, height: layout.svgHeight },
		);
		labels.push({
			kind: 'text',
			x: anchor.x,
			y: anchor.y,
			text: formatAxisValue(value, series.numberFormat),
			fontSize: DEFAULT_CHART_DATA_LABEL_PX,
			fill: '#334155',
			textAnchor: anchor.textAnchor,
			...(anchor.dominantBaseline ? { dominantBaseline: anchor.dominantBaseline } : {}),
		});
	});
}

/** One combo line-series' polyline + markers + data labels. */
export function appendLineSeries(
	series: PptxChartSeries,
	seriesIndex: number,
	chartData: PptxChartData,
	layout: PlotLayout,
	range: ValueRange,
	barGroupWidth: number,
	sourceIndices: ReadonlyArray<number>,
	primitives: SvgPrimitive[],
	dataLabels: SvgText[],
	xPositions?: ReadonlyArray<number>,
): void {
	if (series.values.length === 0) {
		return;
	}
	const fill = seriesColor(series, seriesIndex, chartData.colorPalette);
	const points = sourceIndices.map((sourceIndex, displayIndex) => {
		const value = series.values[sourceIndex] ?? 0;
		return {
			x:
				xPositions?.[displayIndex] ??
				layout.plotLeft + barGroupWidth * displayIndex + barGroupWidth / 2,
			y: valueToY(value, range, layout.plotTop, layout.plotBottom),
			sourceIndex,
			value,
		};
	});
	primitives.push({
		kind: 'polyline',
		points: points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' '),
		stroke: fill,
		strokeWidth: 2.4,
		fill: 'none',
	} satisfies SvgPolyline);
	primitives.push(
		...points.map(
			(point) =>
				({
					kind: 'circle',
					cx: point.x,
					cy: point.y,
					r: 2.5,
					fill,
					part: { role: 'dataPoint', seriesIndex, pointIndex: point.sourceIndex },
				}) satisfies SvgCircle,
		),
	);
	if (!chartData.style?.hasDataLabels) {
		return;
	}
	points.forEach((point) => {
		// c:dLblPos (t/b/l/r/ctr) decides where round the marker the label sits;
		// a per-point c:dLbl/c:layout drag shifts it further.
		const anchor = resolveMarkerLabelPlacement(
			chartData,
			series,
			point.sourceIndex,
			point,
			{ width: layout.svgWidth, height: layout.svgHeight },
			7,
		);
		dataLabels.push({
			kind: 'text',
			x: anchor.x,
			y: anchor.y,
			text: formatAxisValue(point.value, series.numberFormat),
			fontSize: DEFAULT_CHART_DATA_LABEL_PX,
			fill: '#334155',
			textAnchor: anchor.textAnchor,
			...(anchor.dominantBaseline ? { dominantBaseline: anchor.dominantBaseline } : {}),
		});
	});
}
