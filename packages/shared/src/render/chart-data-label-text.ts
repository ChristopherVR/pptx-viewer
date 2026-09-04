/**
 * chart-data-label-text.ts: what a chart data label actually SAYS.
 *
 * `c:dLbls` does not just switch labels on. It carries `c:showVal`,
 * `c:showCatName`, `c:showSerName`, `c:showPercent`, `c:showBubbleSize` and
 * `c:separator`, and PowerPoint combines whichever are set. Every builder in
 * this engine used to print `formatAxisValue(value, numberFormat)` regardless,
 * so a pie configured to show percentages - the most common labelled chart in a
 * business deck - displayed raw values, and a combined "Category, 34%" label was
 * impossible.
 *
 * The flags live in three places and override each other in this order:
 *
 *   1. the per-point `c:dLbl` for this index (highest),
 *   2. the SERIES-level `c:ser/c:dLbls`,
 *   3. the chart-type-level `c:*Chart/c:dLbls` (lowest).
 *
 * Order 2 is the one that matters in practice and the one that was missing:
 * PowerPoint writes the user's choices onto the series and leaves the
 * chart-type-level group all-zero, so reading only the chart level reports
 * "show nothing" for a chart that visibly shows percentages. Verified against a
 * COM-authored pie in `e2e/fixtures/chart-data-fidelity.pptx`.
 *
 * @module chart-data-label-text
 */
import type { PptxChartData, PptxChartSeries } from 'pptx-viewer-core';

import { formatChartNumberWithColor } from './chart-number-format';
import { formatAxisValue } from './chart-view-model';

/** The label content flags, after the three-level cascade has been applied. */
export interface ResolvedDataLabelContent {
	showValue: boolean;
	showCategory: boolean;
	showSeriesName: boolean;
	showPercent: boolean;
	showBubbleSize: boolean;
	/** Text joining the enabled components. PowerPoint's own default is `", "`. */
	separator: string;
	/** `c:dLbl/c:delete`: this one label is suppressed. */
	deleted: boolean;
	/** Literal `c:dLbl/c:tx/c:rich` text, which replaces everything else. */
	customText?: string;
}

/** PowerPoint's default separator between combined label components. */
const DEFAULT_SEPARATOR = ', ';

/**
 * Resolve the label content flags for one point.
 *
 * When NOTHING anywhere sets a content flag the result is "value only", which is
 * what every builder did unconditionally before this module existed, so charts
 * with no `c:dLbls` content markup render byte-identically.
 */
export function resolveDataLabelContent(
	chartData: PptxChartData,
	series: PptxChartSeries,
	pointIndex: number,
): ResolvedDataLabelContent {
	const chartLevel = chartData.style?.dataLabels;
	const seriesLevel = series.dataLabelOptions;
	const point = series.dataLabels?.find((label) => label.idx === pointIndex);

	const pick = (
		fromPoint: boolean | undefined,
		fromSeries: boolean | undefined,
		fromChart: boolean | undefined,
	): boolean | undefined => fromPoint ?? fromSeries ?? fromChart;

	const showValue = pick(point?.showVal, seriesLevel?.showValue, chartLevel?.showValue);
	const showCategory = pick(
		point?.showCatName,
		seriesLevel?.showCategory,
		chartLevel?.showCategory,
	);
	const showSeriesName = pick(
		point?.showSerName,
		seriesLevel?.showSeriesName,
		chartLevel?.showSeriesName,
	);
	const showPercent = pick(point?.showPercent, seriesLevel?.showPercent, chartLevel?.showPercent);
	const showBubbleSize = pick(
		point?.showBubbleSize,
		seriesLevel?.showBubbleSize,
		chartLevel?.showBubbleSize,
	);

	const anySet =
		showValue === true ||
		showCategory === true ||
		showSeriesName === true ||
		showPercent === true ||
		showBubbleSize === true;

	return {
		// Nothing declared anywhere => the historical "just print the value".
		showValue: anySet ? showValue === true : true,
		showCategory: showCategory === true,
		showSeriesName: showSeriesName === true,
		showPercent: showPercent === true,
		showBubbleSize: showBubbleSize === true,
		separator:
			point?.separator ?? seriesLevel?.separator ?? chartLevel?.separator ?? DEFAULT_SEPARATOR,
		deleted: point?.deleted === true,
		...(point?.text !== undefined ? { customText: point.text } : {}),
	};
}

/** Inputs `buildDataLabelText` needs beyond the chart and series. */
export interface DataLabelTextParams {
	chartData: PptxChartData;
	series: PptxChartSeries;
	pointIndex: number;
	value: number;
	/**
	 * Denominator for `c:showPercent`. Defaults to the sum of this series'
	 * absolute values, which is what a percentage means on a pie / doughnut /
	 * ofPie, the only kinds PowerPoint offers the flag for.
	 */
	percentBase?: number;
}

/** A built data label: its text, and the `[Red]`/`[Blue]` colour it carries, if any. */
export interface DataLabelTextResult {
	text: string;
	/**
	 * A colour from the resolved number-format's `[Red]`/`[Blue]`/etc. section
	 * (see `chart-number-format.ts`). Only set when the label renders AS the
	 * formatted value with no other combined component: a joined "Category,
	 * -42" label has no way to tint just the number in one flat `<text>`
	 * element, so the caller's own default colour applies there instead.
	 */
	color?: string;
}

/**
 * Build the text of one data label, or `undefined` when the label is deleted or
 * resolves to nothing. Pure: the caller decides where to draw it.
 */
export function buildDataLabelText(params: DataLabelTextParams): DataLabelTextResult | undefined {
	const { chartData, series, pointIndex, value, percentBase } = params;
	const content = resolveDataLabelContent(chartData, series, pointIndex);
	if (content.deleted) {
		return undefined;
	}
	if (content.customText !== undefined) {
		return { text: content.customText };
	}

	// c:dLbl/c:numFmt > c:ser/c:dLbls/c:numFmt (series level) >
	// c:*Chart/c:dLbls/c:numFmt (chart-type level) > the series' own cell
	// format: the same point > series > chart-type cascade the content flags
	// above use. A label may show a different (typically more compact) format
	// than the axis/series it belongs to.
	const point = series.dataLabels?.find((label) => label.idx === pointIndex);
	const seriesLevelOptions = series.dataLabelOptions;
	const chartLevelOptions = chartData.style?.dataLabels;
	const numberFormat =
		point?.numberFormat ??
		seriesLevelOptions?.numberFormat ??
		chartLevelOptions?.numberFormat ??
		series.numberFormat;

	const parts: string[] = [];
	let valueColor: string | undefined;
	// PowerPoint's own component order, matching the Format Data Labels list.
	if (content.showSeriesName && series.name.length > 0) {
		parts.push(series.name);
	}
	if (content.showCategory) {
		const category = chartData.categories[pointIndex];
		if (category !== undefined && category.length > 0) {
			parts.push(category);
		}
	}
	if (content.showValue) {
		const formatted = formatChartNumberWithColor(value, numberFormat);
		parts.push(formatted?.text ?? formatAxisValue(value, numberFormat));
		valueColor = formatted?.color;
	}
	if (content.showPercent) {
		const base = percentBase ?? series.values.reduce((total, entry) => total + Math.abs(entry), 0);
		parts.push(base > 0 ? `${Math.round((Math.abs(value) / base) * 100)}%` : '0%');
	}
	if (content.showBubbleSize) {
		const size = series.bubbleSizes?.[pointIndex];
		if (size !== undefined) {
			parts.push(formatAxisValue(size, series.numberFormat));
		}
	}

	const text = parts.join(content.separator);
	if (text.length === 0) {
		return undefined;
	}
	return { text, color: parts.length === 1 && content.showValue ? valueColor : undefined };
}
