/**
 * chart-manual-layout.ts: pure conversion of `c:layout/c:manualLayout`
 * (CT_ManualLayout) into pixel rectangles for the chart engine.
 *
 * Core parses a chart's manual title / plot-area / legend placement into
 * `chartData.layouts` (see `PptxChartLayouts`), but until now the view-model
 * never read it, so a chart whose author dragged the legend into a corner or
 * shrank the plot area rendered with the automatic layout in every binding.
 *
 * ECMA-376 21.2.2.95 (manualLayout) semantics, all values fractions of the
 * chart (element) width / height:
 *
 * - `xMode` / `yMode` `edge`: `x` / `y` is the absolute position of the
 *   element's left / top edge. `factor` (the default when absent): `x` / `y`
 *   is an offset from the element's automatic position.
 * - `wMode` / `hMode` `factor` (the default): `w` / `h` is the element's
 *   width / height. `edge`: `w` / `h` is the position of its right / bottom
 *   edge, so the size is `edge - left`.
 *
 * Every field falls back to the automatic value on its own: PowerPoint
 * commonly writes only `x`/`y` for a moved title or legend, and only that
 * pair should override.
 */

import type { PptxChartData, PptxChartLayouts, PptxChartManualLayout } from 'pptx-viewer-core';

/** An axis-aligned rectangle in the chart's pixel space. */
export interface ChartLayoutRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** The chart frame the fractions are measured against. */
export interface ChartFrameSize {
	width: number;
	height: number;
}

/** True when the layout carries at least one of the four placement fields. */
export function hasManualLayoutFields(
	layout: PptxChartManualLayout | null | undefined,
): layout is PptxChartManualLayout {
	return (
		layout !== null &&
		layout !== undefined &&
		(layout.x !== undefined ||
			layout.y !== undefined ||
			layout.width !== undefined ||
			layout.height !== undefined)
	);
}

/** The manual layout of one chart region, when the chart declares one. */
export function manualLayoutOf(
	chartData: Pick<PptxChartData, 'layouts'> | undefined,
	region: keyof PptxChartLayouts,
): PptxChartManualLayout | undefined {
	const layout = chartData?.layouts?.[region];
	return hasManualLayoutFields(layout) ? layout : undefined;
}

/**
 * Resolve a manual layout to a pixel rectangle. Each field the layout omits
 * keeps its `auto` value; `factor`-mode positions offset from `auto`.
 * Returns `undefined` when the layout carries no placement field at all.
 */
export function resolveManualLayoutRect(
	layout: PptxChartManualLayout | null | undefined,
	frame: ChartFrameSize,
	auto: ChartLayoutRect,
): ChartLayoutRect | undefined {
	if (!hasManualLayoutFields(layout)) {
		return undefined;
	}
	const x =
		layout.x === undefined
			? auto.x
			: layout.xMode === 'edge'
				? layout.x * frame.width
				: auto.x + layout.x * frame.width;
	const y =
		layout.y === undefined
			? auto.y
			: layout.yMode === 'edge'
				? layout.y * frame.height
				: auto.y + layout.y * frame.height;
	const width =
		layout.width === undefined
			? auto.width
			: layout.widthMode === 'edge'
				? layout.width * frame.width - x
				: layout.width * frame.width;
	const height =
		layout.height === undefined
			? auto.height
			: layout.heightMode === 'edge'
				? layout.height * frame.height - y
				: layout.height * frame.height;
	return { x, y, width: Math.max(width, 1), height: Math.max(height, 1) };
}

/** Font size the bindings draw the chart title with (`fontSize={12}`). */
export const CHART_TITLE_FONT_PX = 12;
/** Average glyph advance of that title font, used to estimate its box width. */
const TITLE_GLYPH_ADVANCE = 0.6;

/** Legend metrics shared with `chart-legend-layout.ts` (`LEGEND_ITEM_*`). */
const LEGEND_ITEM_WIDTH = 80,
	LEGEND_ITEM_HEIGHT = 14;

/** A text anchor point in the chart's pixel space. */
export interface ChartAnchorPoint {
	x: number;
	y: number;
}

/**
 * Where a manually placed title's text anchor (middle, baseline) goes.
 *
 * The title's automatic box is a full-width band whose text is centred, so
 * a `factor` offset shifts that band. When the layout gives no width, the
 * box is as wide as the text (PowerPoint sizes a title to its content), so
 * an `edge` x lands the text's LEFT edge there rather than its centre.
 */
export function manualTitleAnchor(
	layout: PptxChartManualLayout | null | undefined,
	frame: ChartFrameSize,
	title: string,
	auto: ChartAnchorPoint,
): ChartAnchorPoint | undefined {
	const textWidth = Math.max(title.length * CHART_TITLE_FONT_PX * TITLE_GLYPH_ADVANCE, 1);
	const autoRect: ChartLayoutRect = {
		x: auto.x - textWidth / 2,
		y: auto.y - CHART_TITLE_FONT_PX,
		width: textWidth,
		height: CHART_TITLE_FONT_PX * 1.4,
	};
	const rect = resolveManualLayoutRect(layout, frame, autoRect);
	if (!rect) {
		return undefined;
	}
	return { x: rect.x + rect.width / 2, y: rect.y + CHART_TITLE_FONT_PX };
}

/**
 * Where a manually placed legend's anchor goes, in the convention
 * `computeChartLegendLayout` reads: a vertical legend (`legendAnchor:
 * 'start'`) starts its first row at the anchor; a horizontal one centres its
 * row on the anchor's x with the anchor's y as the baseline.
 */
export function manualLegendAnchor(
	layout: PptxChartManualLayout | null | undefined,
	frame: ChartFrameSize,
	entryCount: number,
	vertical: boolean,
	auto: ChartAnchorPoint,
): ChartAnchorPoint | undefined {
	const count = Math.max(entryCount, 1);
	const autoRect: ChartLayoutRect = vertical
		? { x: auto.x, y: auto.y, width: LEGEND_ITEM_WIDTH, height: count * LEGEND_ITEM_HEIGHT }
		: {
				x: auto.x - (count * LEGEND_ITEM_WIDTH) / 2,
				y: auto.y - LEGEND_ITEM_HEIGHT / 2,
				width: count * LEGEND_ITEM_WIDTH,
				height: LEGEND_ITEM_HEIGHT,
			};
	const rect = resolveManualLayoutRect(layout, frame, autoRect);
	if (!rect) {
		return undefined;
	}
	return vertical
		? { x: rect.x, y: rect.y }
		: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/**
 * Offset from the chart element's pixel space to a view-model's SVG space.
 *
 * Cartesian view-models use the element box as their viewBox (no offset);
 * the pie family lays out on a `size x size` square that the bindings centre
 * with `xMidYMid meet`, so a manual layout measured on the element has to be
 * shifted by half the letterbox on each axis.
 */
export function chartFrameToViewOffset(
	frame: ChartFrameSize,
	view: { svgWidth: number; svgHeight: number },
): ChartAnchorPoint {
	return { x: (frame.width - view.svgWidth) / 2, y: (frame.height - view.svgHeight) / 2 };
}
