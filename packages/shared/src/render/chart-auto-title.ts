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

/** The title text to draw, or `undefined` when the chart shows no title. */
export function resolveChartTitleText(chartData: PptxChartData): string | undefined {
	if (!chartData.style?.hasTitle) {
		return undefined;
	}
	if (chartData.title) {
		return chartData.title;
	}
	if (chartData.series.length === 1) {
		return chartData.series[0].name || undefined;
	}
	return chartData.series.length > 1 ? CHART_AUTO_TITLE : undefined;
}
