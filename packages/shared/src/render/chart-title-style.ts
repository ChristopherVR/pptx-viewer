/**
 * Chart title text style: the font every binding draws `vm.title` with.
 *
 * Cascade (highest wins): the title's own `c:tx/c:rich` / `c:txPr` run
 * properties (`PptxChartStyle.titleFont*`), then the chart-style part's
 * title entry, then this viewer's fixed defaults (12 px, semi-bold, slate).
 * Returned as a framework-neutral descriptor the bindings map straight onto
 * SVG `<text>` attributes, so a chart authored with a 24 pt red title reads
 * the same in all five bindings.
 *
 * @module chart-title-style
 */
import type { PptxChartData } from 'pptx-viewer-core';

import { chartFontPx } from './chart-font';
import { resolveChartStyleDefaults } from './chart-style-defaults';

/** Semi-bold weight the bindings historically hardcoded for the title. */
const DEFAULT_TITLE_FONT_WEIGHT = 600;
/** Slate-800; the colour the bindings historically hardcoded for the title. */
const DEFAULT_TITLE_FILL = '#1e293b';

/** Resolved SVG text attributes for the chart title. */
export interface ChartTitleTextStyle {
	/** `font-size`, in slide-px. */
	fontSize: number;
	/** `font-weight`. */
	fontWeight: number;
	/** `fill`. */
	fill: string;
	/** `font-family`, only when the title names a typeface. */
	fontFamily?: string;
}

/**
 * Resolve the title font for `chartData`. Pure; safe to call for a chart with
 * no title (the result is simply unused).
 */
export function resolveChartTitleTextStyle(
	chartData: PptxChartData | undefined,
): ChartTitleTextStyle {
	const style = chartData?.style;
	const defaults = resolveChartStyleDefaults(chartData);
	const hasStylePartTitle = chartData?.chartStyleDefinition?.title !== undefined;
	const fontSize =
		style?.titleFontSize !== undefined ? chartFontPx(style.titleFontSize) : defaults.titleTextPx;
	const fontWeight =
		style?.titleFontBold === undefined
			? DEFAULT_TITLE_FONT_WEIGHT
			: style.titleFontBold
				? 700
				: 400;
	const fill =
		style?.titleFontColor ?? (hasStylePartTitle ? defaults.titleTextColor : DEFAULT_TITLE_FILL);
	const fontFamily = style?.titleFontFamily?.trim() || undefined;
	return fontFamily ? { fontSize, fontWeight, fill, fontFamily } : { fontSize, fontWeight, fill };
}
