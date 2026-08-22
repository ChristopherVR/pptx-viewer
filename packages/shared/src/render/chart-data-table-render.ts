/**
 * chart-data-table-render.ts - SVG primitives for a chart's data table
 * (`c:dTable`), rendered as a grid below the plot area.
 *
 * Split out of `chart-overlays.ts` (approaching this repo's 300-line-ish
 * module guideline) so the data-table concern has its own home alongside its
 * dedicated test file.
 *
 * Honours every flag `PptxChartDataTable` carries: `showHorzBorder` /
 * `showVertBorder` / `showOutline` / `showKeys` (unchanged from the original
 * engine), plus `spPr` (border stroke colour/width, optional background fill)
 * and `txPr` (cell text colour/font-family/bold/italic; `txPr.fontSize`
 * overrides the 8px geometry-fit default below when explicitly set).
 *
 * @module chart-data-table-render
 */
import type { PptxChartData, PptxChartSeries } from 'pptx-viewer-core';

import { chartFontPx } from './chart-font';
import type { PlotLayout, SvgLine, SvgPrimitive, SvgRect, SvgText } from './chart-view-model';
import { formatAxisValue, seriesColor } from './chart-view-model';

/**
 * Layout constants for the SVG data table rendered below the plot area.
 * Kept as named constants so tests can assert against them without magic numbers.
 * Cell text defaults to 8 px deliberately: it is sized to fit this 14 px row
 * grid (a geometry fit, not a PowerPoint text-class default; see chart-font.ts).
 * An explicit `dataTable.txPr.fontSize` overrides that default.
 */
export const DATA_TABLE_ROW_H = 14;
export const DATA_TABLE_HEADER_H = 14;
export const DATA_TABLE_KEY_W = 60;
export const DATA_TABLE_PADDING = 4;
const DEFAULT_CELL_FONT_PX = 8;
const DEFAULT_BORDER_COLOR = '#cbd5e1';
const DEFAULT_TEXT_COLOR = '#334155';

/**
 * Build `SvgPrimitive[]` for a simple data table rendered below the plot area.
 *
 * The table is rendered as SVG `rect` (borders/fill) + `text` (labels)
 * primitives. Columns = categories; rows = series (with an optional
 * series-key column on the left when `dataTable.showKeys !== false`).
 *
 * Border flags from `PptxChartDataTable` are respected:
 *   - `showHorzBorder` - horizontal rules between rows
 *   - `showVertBorder` - vertical rules between columns
 *   - `showOutline`    - outer border rectangle
 *   - `showKeys`       - series name/colour key column
 *
 * Mirrors `renderChartDataTable` in chart-data-table.tsx (React), translated
 * to pure SVG primitives so every binding's projector renders it identically.
 *
 * @param chartData  Full parsed chart data (`dataTable` must be present).
 * @param layout     Plot-area bounding box - the table is placed at `plotBottom + 4`.
 * @param colorPalette  Optional resolved colour palette (same as chart).
 */
export function computeDataTablePrimitives(
	chartData: PptxChartData,
	layout: PlotLayout,
	colorPalette?: readonly string[],
): SvgPrimitive[] {
	const table = chartData.dataTable;
	if (!table) {
		return [];
	}

	const categories = chartData.categories;
	const series = chartData.series;
	if (categories.length === 0 && series.length === 0) {
		return [];
	}

	const out: SvgPrimitive[] = [];

	const showH = table.showHorzBorder !== false;
	const showV = table.showVertBorder !== false;
	const showO = table.showOutline !== false;
	const showK = table.showKeys !== false;

	const borderColor = table.spPr?.strokeColor ?? DEFAULT_BORDER_COLOR;
	const borderWidth = table.spPr?.strokeWidth ?? 1;
	const textColor = table.txPr?.color ?? DEFAULT_TEXT_COLOR;
	const fontFamily = table.txPr?.fontFamily;
	const fontSize =
		table.txPr?.fontSize !== undefined ? chartFontPx(table.txPr.fontSize) : DEFAULT_CELL_FONT_PX;
	// A default header weight of bold matches the original (pre-txPr) engine;
	// an explicit `txPr.bold` overrides the whole table uniformly, header
	// included, since CT_TextCharacterProperties is one cell-wide default.
	const headerWeight: 'bold' | 'normal' = table.txPr?.bold === false ? 'normal' : 'bold';
	const cellWeight: 'bold' | 'normal' = table.txPr?.bold ? 'bold' : 'normal';
	const fontStyle: 'italic' | 'normal' = table.txPr?.italic ? 'italic' : 'normal';

	const catCount = categories.length;
	const seriesCount = series.length;

	// Column metrics
	const keyColW = showK ? DATA_TABLE_KEY_W : 0;
	const totalW = layout.plotWidth;
	const cellW = catCount > 0 ? (totalW - keyColW) / catCount : totalW - keyColW;

	// Table top edge (just below the plot bottom)
	const tableTop = layout.plotBottom + DATA_TABLE_PADDING;

	// Total table height: 1 header row + N series rows
	const tableH = DATA_TABLE_HEADER_H + seriesCount * DATA_TABLE_ROW_H;

	// Background fill (c:dTable/c:spPr solid fill), painted first so every
	// border/text primitive layers on top of it.
	if (table.spPr?.fillColor) {
		out.push({
			kind: 'rect',
			x: layout.plotLeft,
			y: tableTop,
			w: totalW,
			h: tableH,
			fill: table.spPr.fillColor,
		} satisfies SvgRect);
	}

	// Outer border - rendered as four SvgLine segments because SvgRect has no
	// `stroke` field (only `fill`).
	if (showO) {
		const mkBorderLine = (x1: number, y1: number, x2: number, y2: number): SvgLine => ({
			kind: 'line',
			x1,
			y1,
			x2,
			y2,
			stroke: borderColor,
			strokeWidth: borderWidth,
		});
		out.push(mkBorderLine(layout.plotLeft, tableTop, layout.plotLeft + totalW, tableTop));
		out.push(
			mkBorderLine(layout.plotLeft + totalW, tableTop, layout.plotLeft + totalW, tableTop + tableH),
		);
		out.push(
			mkBorderLine(layout.plotLeft + totalW, tableTop + tableH, layout.plotLeft, tableTop + tableH),
		);
		out.push(mkBorderLine(layout.plotLeft, tableTop + tableH, layout.plotLeft, tableTop));
	}

	// Helper: x-position of column ci (0-based category columns, after key col)
	function colX(ci: number): number {
		return layout.plotLeft + keyColW + ci * cellW;
	}

	// Helper: y-position of row ri (0 = header)
	function rowY(ri: number): number {
		return tableTop + (ri === 0 ? 0 : DATA_TABLE_HEADER_H + (ri - 1) * DATA_TABLE_ROW_H);
	}

	// Header row: category labels
	categories.forEach((cat, ci) => {
		const x = colX(ci) + cellW / 2;
		const y = rowY(0) + DATA_TABLE_HEADER_H / 2 + 3;
		const label: SvgText = {
			kind: 'text',
			x,
			y,
			text: cat,
			fontSize,
			fill: textColor,
			textAnchor: 'middle',
			fontWeight: headerWeight,
			fontFamily,
			fontStyle,
		};
		out.push(label);

		// Vertical border after this column header (not after the last)
		if (showV && ci < catCount - 1) {
			const vx = colX(ci) + cellW;
			const vLine: SvgLine = {
				kind: 'line',
				x1: vx,
				y1: tableTop,
				x2: vx,
				y2: tableTop + tableH,
				stroke: borderColor,
				strokeWidth: borderWidth,
			};
			out.push(vLine);
		}
	});

	// Horizontal border under header
	if (showH) {
		const hy = tableTop + DATA_TABLE_HEADER_H;
		const hLine: SvgLine = {
			kind: 'line',
			x1: layout.plotLeft,
			y1: hy,
			x2: layout.plotLeft + totalW,
			y2: hy,
			stroke: borderColor,
			strokeWidth: borderWidth,
		};
		out.push(hLine);
	}

	// Vertical border between key column and first data column
	if (showK && showV) {
		const kvx = layout.plotLeft + keyColW;
		const kvLine: SvgLine = {
			kind: 'line',
			x1: kvx,
			y1: tableTop,
			x2: kvx,
			y2: tableTop + tableH,
			stroke: borderColor,
			strokeWidth: borderWidth,
		};
		out.push(kvLine);
	}

	// Data rows
	series.forEach((s: PptxChartSeries, si: number) => {
		const rowIndex = si + 1; // row 0 is the header
		const ry = rowY(rowIndex);
		const cellCy = ry + DATA_TABLE_ROW_H / 2 + 3;

		// Series key cell (colour swatch + name)
		if (showK) {
			const swatchX = layout.plotLeft + DATA_TABLE_PADDING;
			const swatchY = ry + DATA_TABLE_ROW_H / 2 - 3;
			const swatchColor = seriesColor(s, si, colorPalette);

			// Colour swatch as a small filled rect
			out.push({
				kind: 'rect',
				x: swatchX,
				y: swatchY,
				w: 7,
				h: 7,
				fill: swatchColor,
				rx: 1,
			});

			// Series name text
			const nameX = swatchX + 9;
			const nameLabel: SvgText = {
				kind: 'text',
				x: nameX,
				y: cellCy,
				text: s.name,
				fontSize,
				fill: textColor,
				textAnchor: 'start',
				fontWeight: cellWeight,
				fontFamily,
				fontStyle,
			};
			out.push(nameLabel);
		}

		// Data cells
		categories.forEach((_cat, ci) => {
			const val = s.values[ci];
			const cellLabel: SvgText = {
				kind: 'text',
				x: colX(ci) + cellW / 2,
				y: cellCy,
				text: val !== undefined ? formatAxisValue(val) : '',
				fontSize,
				fill: textColor,
				textAnchor: 'middle',
				fontWeight: cellWeight,
				fontFamily,
				fontStyle,
			};
			out.push(cellLabel);
		});

		// Horizontal border below this row (not after the last)
		if (showH && si < seriesCount - 1) {
			const hy2 = ry + DATA_TABLE_ROW_H;
			const hRowLine: SvgLine = {
				kind: 'line',
				x1: layout.plotLeft,
				y1: hy2,
				x2: layout.plotLeft + totalW,
				y2: hy2,
				stroke: borderColor,
				strokeWidth: borderWidth,
			};
			out.push(hRowLine);
		}
	});

	return out;
}
