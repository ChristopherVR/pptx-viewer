/**
 * chart-combo-classify.ts: per-series type classification + clustered-bar
 * geometry for the bar/line combo chart (`chart-combo.ts`), split out to keep
 * that file within the repo's ~300-LOC limit.
 *
 * `buildComboViewModel` used to hardcode "series 0 is the bar, every other
 * series is a line", ignoring the parser's own per-series
 * {@link PptxChartSeries.seriesChartType} (set for every series of a genuine
 * multi-container combo: `c:barChart`/`c:lineChart`/etc. each tag their own
 * `c:ser` entries). That made a 2-bar + 1-line combo render its second bar
 * series as a line, and a line-first combo (`c:lineChart` before `c:barChart`
 * in the source XML) render its bar series as a line too. Classifying by the
 * actual tag - falling back to the historical index-0-is-bar heuristic only
 * when no series carries a tag at all - fixes both without disturbing the
 * many existing combo fixtures/tests that never set `seriesChartType`.
 *
 * Area-typed combo series are grouped under "line" for now (rendered as a
 * plain line, not a filled area): true bar+area combos are less common than
 * bar+line, and reusing `chart-cartesian-area.ts`'s per-chart area builder
 * for an arbitrary subset would require re-deriving its palette-index
 * convention; tracked as a follow-up rather than risking a half-implemented
 * fill here.
 *
 * @module chart-combo-classify
 */
import type { PptxChartData, PptxChartSeries } from 'pptx-viewer-core';

import { resolveBarLabelPlacement } from './chart-data-label-anchor';
import { DEFAULT_CHART_DATA_LABEL_PX } from './chart-font';
import type { ChartPartRef, PlotLayout, SvgRect, SvgText, ValueRange } from './chart-view-model';
import { formatAxisValue, seriesColor, valueToY } from './chart-view-model';

export type ComboSeriesKind = 'bar' | 'line';

/**
 * Which combo lane a series belongs to. Series 0 defaults to "bar" and every
 * other series defaults to "line" ONLY when the series carries no
 * `seriesChartType` tag at all (legacy/untagged combo data); a tagged series
 * always uses its own tag, regardless of position.
 */
export function classifyComboSeries(series: PptxChartSeries, index: number): ComboSeriesKind {
	const type = series.seriesChartType;
	if (type === 'bar' || type === 'bar3D') {
		return 'bar';
	}
	if (type === undefined) {
		return index === 0 ? 'bar' : 'line';
	}
	// line, line3D, area, area3D, scatter, and anything else this builder does
	// not have a dedicated lane for: render as a line rather than silently
	// dropping the series.
	return 'line';
}

/** Original `chartData.series` indices split into the bar and line lanes. */
export function groupComboSeriesIndices(series: ReadonlyArray<PptxChartSeries>): {
	barIndices: number[];
	lineIndices: number[];
} {
	const barIndices: number[] = [];
	const lineIndices: number[] = [];
	series.forEach((entry, index) => {
		(classifyComboSeries(entry, index) === 'bar' ? barIndices : lineIndices).push(index);
	});
	return { barIndices, lineIndices };
}

/**
 * Clustered bar rects for an arbitrary subset of `chartData.series` (their
 * ORIGINAL indices, so colour/legend stay keyed to the whole series list, not
 * the subset). With exactly one index this reduces to the previous
 * single-bar-per-category geometry byte-for-byte.
 */
export function computeComboBarCluster(
	barIndices: ReadonlyArray<number>,
	chartData: PptxChartData,
	catCount: number,
	layout: PlotLayout,
	primaryRange: ValueRange,
	secondaryRange: ValueRange | undefined,
	secondaryIndexes: ReadonlySet<number>,
	sourceIndices: ReadonlyArray<number>,
	xPositions?: ReadonlyArray<number>,
): SvgRect[] {
	if (barIndices.length === 0) {
		return [];
	}
	const seriesCount = barIndices.length,
		barGroupWidth = layout.plotWidth / Math.max(catCount, 1),
		singleBarWidth = (barGroupWidth * 0.7) / seriesCount,
		clusterWidth = singleBarWidth * seriesCount,
		rects: SvgRect[] = [];

	for (let displayIndex = 0; displayIndex < catCount; displayIndex++) {
		const sourceIndex = sourceIndices[displayIndex] ?? displayIndex,
			center =
				xPositions?.[displayIndex] ??
				layout.plotLeft + barGroupWidth * displayIndex + barGroupWidth / 2,
			clusterLeft = center - clusterWidth / 2;
		barIndices.forEach((originalIndex, si) => {
			const series = chartData.series[originalIndex],
				value = series.values[sourceIndex] ?? 0,
				range =
					secondaryIndexes.has(originalIndex) && secondaryRange ? secondaryRange : primaryRange,
				zeroY = valueToY(0, range, layout.plotTop, layout.plotBottom),
				valY = valueToY(value, range, layout.plotTop, layout.plotBottom),
				part: ChartPartRef = {
					role: 'dataPoint',
					seriesIndex: originalIndex,
					pointIndex: sourceIndex,
				};
			rects.push({
				kind: 'rect',
				x: clusterLeft + singleBarWidth * si,
				y: Math.min(zeroY, valY),
				w: singleBarWidth,
				h: Math.max(Math.abs(zeroY - valY), 1),
				fill: seriesColor(series, originalIndex, chartData.colorPalette),
				rx: 1,
				part,
			});
		});
	}
	return rects;
}

/** Data labels for {@link computeComboBarCluster}'s rects, one call per bar-lane series. */
export function appendComboBarClusterLabels(
	barIndices: ReadonlyArray<number>,
	chartData: PptxChartData,
	layout: PlotLayout,
	catCount: number,
	primaryRange: ValueRange,
	secondaryRange: ValueRange | undefined,
	secondaryIndexes: ReadonlySet<number>,
	sourceIndices: ReadonlyArray<number>,
	labels: SvgText[],
	xPositions?: ReadonlyArray<number>,
): void {
	if (!chartData.style?.hasDataLabels || barIndices.length === 0) {
		return;
	}
	const seriesCount = barIndices.length,
		barGroupWidth = layout.plotWidth / Math.max(catCount, 1),
		singleBarWidth = (barGroupWidth * 0.7) / seriesCount,
		clusterWidth = singleBarWidth * seriesCount;

	for (let displayIndex = 0; displayIndex < catCount; displayIndex++) {
		const sourceIndex = sourceIndices[displayIndex] ?? displayIndex,
			center =
				xPositions?.[displayIndex] ??
				layout.plotLeft + barGroupWidth * displayIndex + barGroupWidth / 2,
			clusterLeft = center - clusterWidth / 2;
		barIndices.forEach((originalIndex, si) => {
			const series = chartData.series[originalIndex],
				value = series.values[sourceIndex] ?? 0,
				range =
					secondaryIndexes.has(originalIndex) && secondaryRange ? secondaryRange : primaryRange,
				zeroY = valueToY(0, range, layout.plotTop, layout.plotBottom),
				valY = valueToY(value, range, layout.plotTop, layout.plotBottom),
				x = clusterLeft + singleBarWidth * si,
				barY = Math.min(zeroY, valY),
				barH = Math.max(Math.abs(zeroY - valY), 1),
				anchor = resolveBarLabelPlacement(
					chartData,
					series,
					sourceIndex,
					{ x, y: barY, width: singleBarWidth, height: barH },
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
}
