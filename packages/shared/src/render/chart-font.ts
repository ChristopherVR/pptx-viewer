/**
 * chart-font.ts: the single pt -> px boundary for chart text.
 *
 * Core parses every chart font size in POINTS (`c:txPr` run sizes are stored
 * as `sz / 100`, e.g. `sz="1195"` -> 11.95 pt; see core's chart-axis-parser),
 * and that unit is part of core's public model: editors and inspectors read
 * and write points. The SVG chart view-model, however, lives in slide-pixel
 * space (96 dpi), where PowerPoint paints one point as 4/3 px. Rendering the
 * parsed number directly as `SvgText.fontSize` therefore drew ALL chart text
 * at 75% of its true size (issue #132).
 *
 * Every parsed chart font size must cross the pt -> px boundary exactly once,
 * at the moment it enters an `SvgText` descriptor, and that conversion lives
 * here. Do NOT convert in core (its unit is points by contract) and do NOT
 * convert again in a binding projector (the view-model is already px).
 *
 * The default constants are PowerPoint's chart text defaults expressed in px:
 * 10 pt body text (axis ticks, category labels, axis titles) and 9 pt data
 * labels.
 *
 * @module chart-font
 */

/** CSS pixels per typographic point (96 dpi / 72 dpi = 4/3). */
export const CHART_PX_PER_PT = 4 / 3;

/**
 * Convert a chart font size parsed in points (core's unit) to slide-px for
 * `SvgText.fontSize`. E.g. 11.95 pt -> 15.93 px.
 */
export function chartFontPx(sizePt: number): number {
	return sizePt * CHART_PX_PER_PT;
}

/**
 * PowerPoint's default chart body text size (10 pt) in slide-px (13.33):
 * axis tick labels, category labels, axis titles, and display-unit captions
 * fall back to this when the chart XML declares no explicit size.
 */
export const DEFAULT_CHART_TEXT_PX = chartFontPx(10);

/**
 * PowerPoint's default data-label text size (9 pt) in slide-px (12): value /
 * category / percent labels attached to data marks fall back to this.
 */
export const DEFAULT_CHART_DATA_LABEL_PX = chartFontPx(9);
