/**
 * Geometry shared by the chart data table (`c:dTable`) renderer and the plot
 * layout that reserves room for it, so the two can never disagree.
 *
 * COM-verified against charts-com.pptx slide 2: PowerPoint draws the table
 * directly under the plot, its category header row REPLACING the category
 * axis labels, its data columns aligned with the plot's category bands, and
 * the series-key column hanging LEFT of the plot under the value-axis
 * labels. Cell text uses the chart's axis font (12pt in the built-in styles)
 * rather than a fixed 8px.
 *
 * @module chart-data-table-metrics
 */
import type { PptxChartData } from 'pptx-viewer-core';

import { chartFontPx } from './chart-font';
import { resolveChartStyleDefaults } from './chart-style-defaults';

/** Resolved data-table geometry. */
export interface DataTableMetrics {
	/** Cell text size in px. */
	fontSize: number;
	/** Height of the header row and of each series row. */
	rowH: number;
	/** Width of the series-key column left of the plot (0 without keys). */
	keyW: number;
	/** Total table height: header plus one row per series. */
	height: number;
}

/** Resolve the table metrics for `chartData`, or `undefined` without a table. */
export function resolveDataTableMetrics(chartData: PptxChartData): DataTableMetrics | undefined {
	const table = chartData.dataTable;
	if (!table) {
		return undefined;
	}
	const fontSize =
		table.txPr?.fontSize !== undefined
			? chartFontPx(table.txPr.fontSize)
			: resolveChartStyleDefaults(chartData).bodyTextPx;
	const rowH = Math.max(14, Math.round(fontSize * 1.45));
	const longestName = chartData.series.reduce((m, s) => Math.max(m, (s.name ?? '').length), 0);
	const keyW =
		table.showKeys === false ? 0 : Math.min(160, Math.max(40, longestName * fontSize * 0.55 + 24));
	return { fontSize, rowH, keyW, height: rowH * (1 + chartData.series.length) };
}

/**
 * The category axis labels to draw: none when a data table is shown, since
 * its header row carries the category names in their place.
 */
export function labelsBesideTable<T>(chartData: PptxChartData, axis: { labels: T[] }): T[] {
	return chartData.dataTable ? [] : axis.labels;
}
