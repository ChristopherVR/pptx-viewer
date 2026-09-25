/**
 * chart-title-band.ts: where a chart's title sits and how much room it takes
 * at the top of the chart, derived from the title's own font size.
 *
 * Every chart family used to reserve a fixed 20 px band for the title and
 * draw its baseline at y=12..14, which fits the viewer's 12 px default but
 * clips anything larger: PowerPoint's own default title is 14 pt (18.67 px),
 * and an 18 pt title lost its top to the chart's SVG edge, in 2D and in the
 * 3D chrome overlay alike.
 *
 * PowerPoint lays the title out as a text box whose top sits a fixed inset
 * below the chart area's top (about 7.2 pt of chart-area padding plus the
 * title's own 3.6 pt text inset), so its first baseline is that inset plus
 * the font's ascent. For a 14 pt title that puts the baseline 24 pt below the
 * chart top, matching `gt/chart-01`'s measured title baseline (the
 * oblique-3D chrome's `OBLIQUE_TITLE_BASELINE`). The plot area then starts
 * below the title box, after the same 8 px inset the layout keeps at every
 * other edge.
 *
 * `chartTitleBand` is the pure decision; `chartTitleBandFor` resolves the
 * title font for a chart and returns `undefined` for a chart without a title
 * (whose layout is unchanged); `withChartTitleBand` is the view-model
 * post-pass that moves the title baseline and a top legend to match.
 *
 * @module chart-title-band
 */
import type { PptxChartData } from 'pptx-viewer-core';

import { CHART_PX_PER_PT } from './chart-font';
import { resolveLegendPlacement } from './chart-legend-placement';
import { resolveChartTitleRunSpans } from './chart-title-runs';
import { resolveChartTitleTextStyle } from './chart-title-style';
import type { ChartViewModel } from './chart-view-model-types';

/** Chart-area padding (7.2 pt) plus the title box's top text inset (3.6 pt), in px. */
export const CHART_TITLE_TOP_INSET_PX = 10.8 * CHART_PX_PER_PT;
/** The title box's bottom text inset (3.6 pt), in px. */
const TITLE_BOTTOM_INSET_PX = 3.6 * CHART_PX_PER_PT;
/** Font ascent above the baseline, as a fraction of the font size. */
const TITLE_ASCENT = 0.95;
/** Font descent below the baseline, as a fraction of the font size. */
const TITLE_DESCENT = 0.25;
/** Baseline-to-baseline distance of a wrapped title, as a fraction of the font size. */
const TITLE_LINE_HEIGHT = 1.2;
/** The fixed title reservation every layout used before the band was font-sized. */
export const LEGACY_CHART_TITLE_BAND_PX = 20;

/** Where the title's first baseline sits and how far down its band reaches. */
export interface ChartTitleBand {
	/** The first line's baseline (`vm.titleY`), in px below the chart top. */
	baselineY: number;
	/**
	 * The title box's bottom edge, in px below the chart top. Layouts add this
	 * to their 8 px top inset, so the plot starts 8 px below the title box.
	 */
	bandHeight: number;
}

/**
 * The title band for a title drawn at `fontSizePx` over `lines` lines.
 * Pure. Non-finite or non-positive inputs fall back to a single 12 px line.
 */
export function chartTitleBand(fontSizePx: number, lines = 1): ChartTitleBand {
	const size = Number.isFinite(fontSizePx) && fontSizePx > 0 ? fontSizePx : 12;
	const lineCount = Number.isFinite(lines) && lines >= 1 ? Math.floor(lines) : 1;
	const baselineY = CHART_TITLE_TOP_INSET_PX + size * TITLE_ASCENT;
	const lastBaseline = baselineY + (lineCount - 1) * size * TITLE_LINE_HEIGHT;
	return {
		baselineY,
		bandHeight: lastBaseline + size * TITLE_DESCENT + TITLE_BOTTOM_INSET_PX,
	};
}

/** The largest font size the title draws with: its base style or any larger run. */
export function chartTitleFontPx(chartData: PptxChartData | undefined): number {
	const base = resolveChartTitleTextStyle(chartData).fontSize;
	const runs = resolveChartTitleRunSpans(chartData) ?? [];
	return runs.reduce((max, run) => Math.max(max, run.fontSize), base);
}

/**
 * The title band for `chartData`, or `undefined` when the chart shows no
 * title (`style.hasTitle` off), so a title-less chart's layout is untouched.
 * The title renders as one SVG `<text>` line, so the band is one line tall.
 */
export function chartTitleBandFor(
	chartData: PptxChartData | undefined,
): ChartTitleBand | undefined {
	if (!chartData?.style?.hasTitle) {
		return undefined;
	}
	return chartTitleBand(chartTitleFontPx(chartData));
}

/**
 * The height a layout reserves above its plot for the title: the band's
 * height, or 0 without a title. Replaces the fixed `hasTitle ? 20 : 0`.
 */
export function chartTitleReservePx(chartData: PptxChartData | undefined): number {
	return chartTitleBandFor(chartData)?.bandHeight ?? 0;
}

/**
 * Put a finished view-model's title on the font-sized baseline, and move a
 * top (`'t'`) legend down by however much the band grew past the legacy
 * 20 px reservation, so it stays between the title and the plot. A chart
 * without a title, or a view-model without one, is returned unchanged.
 */
export function withChartTitleBand(vm: ChartViewModel, chartData: PptxChartData): ChartViewModel {
	const band = chartTitleBandFor(chartData);
	if (!band || vm.title === undefined) {
		return vm;
	}
	const placement = resolveLegendPlacement(chartData.style?.legendPosition ?? 'b');
	const topLegend = chartData.style?.hasLegend && placement.side === 't' && !placement.overlaysPlot;
	return {
		...vm,
		titleY: band.baselineY,
		...(topLegend ? { legendY: vm.legendY + band.bandHeight - LEGACY_CHART_TITLE_BAND_PX } : {}),
	};
}
