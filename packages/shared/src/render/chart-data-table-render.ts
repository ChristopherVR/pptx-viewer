/**
 * chart-data-table-render.ts - SVG primitives for a chart's data table
 * (`c:dTable`), rendered as a grid below the plot area.
 *
 * Laid out the way PowerPoint lays it out (COM-verified, charts-com.pptx
 * slide 2; geometry in `chart-data-table-metrics.ts`): directly under the
 * plot, the category header row standing in for the category axis labels,
 * one data column per plot category band, and the series-key column hanging
 * left of the plot. The table used to start 4px below the plot with its own
 * key column INSIDE the plot width, so its columns drifted off the bars and
 * its header collided with the category labels drawn in the same band.
 *
 * Honours every flag `PptxChartDataTable` carries: `showHorzBorder` /
 * `showVertBorder` / `showOutline` / `showKeys`, plus `spPr` (border stroke
 * colour/width, optional background fill) and `txPr` (cell text colour /
 * font-family / size / bold / italic).
 *
 * @module chart-data-table-render
 */
import type { PptxChartData, PptxChartSeries } from 'pptx-viewer-core';

import { resolveDataTableMetrics } from './chart-data-table-metrics';
import type { PlotLayout, SvgLine, SvgPrimitive, SvgText } from './chart-view-model';
import { formatAxisValue, seriesColor } from './chart-view-model';

/** Minimum row height; the real height scales with the cell font. */
export const DATA_TABLE_ROW_H = 14;
/** Minimum header-row height. */
export const DATA_TABLE_HEADER_H = 14;
/** Minimum width of the series-key column. */
export const DATA_TABLE_KEY_W = 40;
export const DATA_TABLE_PADDING = 4;
/** PowerPoint's built-in table rule colour (tx1 at 15%). */
const DEFAULT_BORDER_COLOR = '#D9D9D9';
/** PowerPoint's built-in chart text colour (tx1 at 65%). */
const DEFAULT_TEXT_COLOR = '#595959';

/**
 * Build `SvgPrimitive[]` for the data table below the plot area. Columns =
 * categories; rows = series, with an optional series-key column.
 *
 * @param chartData  Full parsed chart data (`dataTable` must be present).
 * @param layout     Plot-area bounding box; the table hangs from `plotBottom`.
 * @param colorPalette  Optional resolved colour palette (same as chart).
 */
export function computeDataTablePrimitives(
	chartData: PptxChartData,
	layout: PlotLayout,
	colorPalette?: readonly string[],
): SvgPrimitive[] {
	const table = chartData.dataTable;
	const metrics = resolveDataTableMetrics(chartData);
	const categories = chartData.categories;
	const series = chartData.series;
	if (!table || !metrics || (categories.length === 0 && series.length === 0)) {
		return [];
	}

	const out: SvgPrimitive[] = [];
	const showH = table.showHorzBorder !== false;
	const showV = table.showVertBorder !== false;
	const showO = table.showOutline !== false;
	const showK = table.showKeys !== false;
	const stroke = table.spPr?.strokeColor ?? DEFAULT_BORDER_COLOR;
	const strokeWidth = table.spPr?.strokeWidth ?? 1;
	const text = {
		fontSize: metrics.fontSize,
		fill: table.txPr?.color ?? DEFAULT_TEXT_COLOR,
		fontFamily: table.txPr?.fontFamily,
		fontStyle: (table.txPr?.italic ? 'italic' : 'normal') as 'italic' | 'normal',
		fontWeight: (table.txPr?.bold ? 'bold' : 'normal') as 'bold' | 'normal',
		dominantBaseline: 'central' as const,
	};
	const { rowH, keyW } = metrics;
	const catCount = Math.max(categories.length, 1);
	const cellW = layout.plotWidth / catCount;
	const top = layout.plotBottom;
	const bottom = top + metrics.height;
	const left = layout.plotLeft - keyW;
	const right = layout.plotLeft + layout.plotWidth;
	const line = (x1: number, y1: number, x2: number, y2: number): SvgLine => ({
		kind: 'line',
		x1,
		y1,
		x2,
		y2,
		stroke,
		strokeWidth,
	});
	const label = (x: number, y: number, value: string, anchor: 'start' | 'middle'): SvgText => ({
		kind: 'text',
		x,
		y,
		text: value,
		textAnchor: anchor,
		...text,
	});

	if (table.spPr?.fillColor) {
		out.push({
			kind: 'rect',
			x: left,
			y: top,
			w: right - left,
			h: bottom - top,
			fill: table.spPr.fillColor,
		});
	}
	if (showO) {
		// The header row spans the data columns only; the key column starts
		// under it, exactly as PowerPoint frames the table.
		out.push(line(layout.plotLeft, top, right, top));
		out.push(line(right, top, right, bottom));
		out.push(line(right, bottom, left, bottom));
		out.push(line(left, bottom, left, top + rowH));
		out.push(line(left, top + rowH, layout.plotLeft, top + rowH));
		out.push(line(layout.plotLeft, top, layout.plotLeft, top + rowH));
	}

	categories.forEach((cat, ci) => {
		out.push(label(layout.plotLeft + ci * cellW + cellW / 2, top + rowH / 2, cat, 'middle'));
		if (showV && ci > 0) {
			const x = layout.plotLeft + ci * cellW;
			out.push(line(x, top, x, bottom));
		}
	});
	if (showV && showK) {
		out.push(line(layout.plotLeft, top, layout.plotLeft, bottom));
	}

	series.forEach((s: PptxChartSeries, si: number) => {
		const rowTop = top + rowH * (si + 1);
		const cy = rowTop + rowH / 2;
		if (showH) {
			out.push(line(showK ? left : layout.plotLeft, rowTop, right, rowTop));
		}
		if (showK) {
			const swatch = Math.max(6, Math.round(metrics.fontSize * 0.55));
			out.push({
				kind: 'rect',
				x: left + DATA_TABLE_PADDING,
				y: cy - swatch / 2,
				w: swatch,
				h: swatch,
				fill: seriesColor(s, si, colorPalette),
			});
			out.push(label(left + DATA_TABLE_PADDING + swatch + 3, cy, s.name, 'start'));
		}
		categories.forEach((_cat, ci) => {
			const val = s.values[ci];
			const x = layout.plotLeft + ci * cellW + cellW / 2;
			out.push(label(x, cy, val !== undefined ? formatAxisValue(val) : '', 'middle'));
		});
	});

	return out;
}
