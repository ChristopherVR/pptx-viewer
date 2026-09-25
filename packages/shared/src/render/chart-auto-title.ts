/**
 * The text a chart's title shows, including PowerPoint's AUTO title.
 *
 * A `c:title` with no `c:tx` (the default for a chart inserted in
 * PowerPoint) is not an empty title: PowerPoint shows the only series' name
 * for a single-series chart (a pie titled "Sales"), and the literal
 * "Chart Title" otherwise. Every chart family's view model resolves its title
 * through here, so the 2D chart and the 3D chart's chrome overlay agree.
 *
 * @module chart-auto-title
 */
import type { PptxChartData } from 'pptx-viewer-core';

/** PowerPoint's own placeholder for an auto title on a multi-series chart. */
export const CHART_AUTO_TITLE = 'Chart Title';

/**
 * Office 2016+ extended (`cx:`) chart types, which have no classic-chart
 * "use the lone series' name as the title" convention: COM-verified against
 * every chartex-family slide in charts-com.pptx (waterfall on slide 26
 * through box-whisker on slide 32), an empty `cx:title` always renders the
 * literal "Chart Title", even for a single-series chart like waterfall or
 * funnel. A `cx:series` with no authored `cx:tx` also falls back to a
 * synthesized name ("Series 1"), which would otherwise leak into the title.
 */
const CHARTEX_ONLY_TYPES = new Set<PptxChartData['chartType']>([
	'waterfall',
	'funnel',
	'treemap',
	'sunburst',
	'boxWhisker',
	'histogram',
	'regionMap',
]);

/**
 * A classic chart with NO `c:title` element still gets an auto title when it
 * plots exactly one series and `c:autoTitleDeleted` is not set: PowerPoint
 * titles it with that series' name (COM-verified, charts-com.pptx slides 5,
 * 6 and 24: an ofPie and a pie with no `c:title` show "Sales"). Returns the
 * chart with `style.hasTitle` switched on in that case, so the layout
 * reserves the title band; otherwise the chart itself. An explicit
 * `style.hasTitle === false` (the title toggled off in the editor) and the
 * ChartEx families never auto-title this way.
 */
export function withAutoTitle(chartData: PptxChartData): PptxChartData {
	if (
		chartData.style?.hasTitle !== undefined ||
		chartData.chartChrome?.autoTitleDeleted === true ||
		CHARTEX_ONLY_TYPES.has(chartData.chartType) ||
		chartData.series.length !== 1 ||
		!chartData.series[0].name
	) {
		return chartData;
	}
	return { ...chartData, style: { ...chartData.style, hasTitle: true } };
}

/** The title text to draw, or `undefined` when the chart shows no title. */
export function resolveChartTitleText(chartData: PptxChartData): string | undefined {
	if (!chartData.style?.hasTitle) {
		return undefined;
	}
	if (chartData.title) {
		return chartData.title;
	}
	const isChartExOnlyType = CHARTEX_ONLY_TYPES.has(chartData.chartType);
	if (!isChartExOnlyType && chartData.series.length === 1) {
		return chartData.series[0].name || undefined;
	}
	return chartData.series.length > 0 ? CHART_AUTO_TITLE : undefined;
}
