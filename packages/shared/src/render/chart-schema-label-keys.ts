/**
 * chart-schema-label-keys.ts: i18n keys for the chart wire tokens a binding may
 * have to spell out even when it is not driving the select from
 * `chart-editor-options`.
 *
 * WHY separate from `chart-editor-options.ts`: that module owns OPTION LISTS
 * (which values a control offers). These are LOOKUPS (how one value is
 * spelled), which is what a binding needs when the value set is fixed
 * elsewhere: an axis whose `axisType` is used as a fallback caption, or a panel
 * that offers chart types the shared option list does not carry. Keeping them
 * apart means adding a translation never changes anybody's option set.
 *
 * @module render/chart-schema-label-keys
 */
import type { PptxChartType } from 'pptx-viewer-core';

/**
 * Every `PptxChartType`, including the ones `CHART_TYPE_OPTIONS` leaves out.
 * The vanilla and Svelte panels offer funnel/treemap/sunburst, which React's
 * type select does not, and were printing those three as raw tokens.
 */
export const CHART_TYPE_LABEL_KEYS: Readonly<Record<PptxChartType, string>> = {
	bar: 'pptx.chart.typeBar',
	line: 'pptx.chart.typeLine',
	pie: 'pptx.chart.typePie',
	ofPie: 'pptx.chart.typeOfPie',
	doughnut: 'pptx.chart.typeDoughnut',
	area: 'pptx.chart.typeArea',
	scatter: 'pptx.chart.typeScatter',
	bubble: 'pptx.chart.typeBubble',
	radar: 'pptx.chart.typeRadar',
	stock: 'pptx.chart.typeStock',
	bar3D: 'pptx.chart.typeBar3D',
	line3D: 'pptx.chart.typeLine3D',
	pie3D: 'pptx.chart.typePie3D',
	area3D: 'pptx.chart.typeArea3D',
	surface: 'pptx.chart.typeSurface',
	histogram: 'pptx.chart.typeHistogram',
	waterfall: 'pptx.chart.typeWaterfall',
	funnel: 'pptx.chart.typeFunnel',
	treemap: 'pptx.chart.typeTreemap',
	sunburst: 'pptx.chart.typeSunburst',
	boxWhisker: 'pptx.chart.typeBoxWhisker',
	regionMap: 'pptx.chart.typeRegionMap',
	combo: 'pptx.chart.typeCombo',
	unknown: 'pptx.chart.typeUnknown',
};

/** `c:barDir`-independent grouping modes (`c:grouping`). */
export const CHART_GROUPING_LABEL_KEYS: Readonly<Record<string, string>> = {
	clustered: 'pptx.chart.groupingClustered',
	stacked: 'pptx.chart.groupingStacked',
	percentStacked: 'pptx.chart.groupingPercentStacked',
	standard: 'pptx.chart.groupingStandard',
};

/**
 * Axis element names. Panels fall back to the raw `axisType` when an axis has
 * no title, which is how `valAx` and `catAx` reached the user as caption text.
 */
export const CHART_AXIS_TYPE_LABEL_KEYS: Readonly<Record<string, string>> = {
	valAx: 'pptx.chart.valueAxis',
	catAx: 'pptx.chart.categoryAxis',
	dateAx: 'pptx.chart.dateAxis',
	serAx: 'pptx.chart.seriesAxis',
};

/**
 * Every `c:dLblPos` value. `DATA_LABEL_POSITION_OPTIONS` stops at the six a bar
 * or pie chart accepts; line and scatter charts additionally take above/below/
 * left/right, which two panels offered as bare `t`, `b`, `l`, `r`.
 */
export const CHART_DATA_LABEL_POSITION_LABEL_KEYS: Readonly<Record<string, string>> = {
	bestFit: 'pptx.chart.labelPosBestFit',
	ctr: 'pptx.chart.labelPosCenter',
	inEnd: 'pptx.chart.labelPosInsideEnd',
	inBase: 'pptx.chart.labelPosInsideBase',
	outEnd: 'pptx.chart.labelPosOutsideEnd',
	t: 'pptx.chart.labelPosAbove',
	b: 'pptx.chart.labelPosBelow',
	l: 'pptx.chart.labelPosLeft',
	r: 'pptx.chart.labelPosRight',
};

/** `c:trendline/c:trendlineType` values. */
export const CHART_TRENDLINE_LABEL_KEYS: Readonly<Record<string, string>> = {
	linear: 'pptx.chart.trendlineLinear',
	exp: 'pptx.chart.trendlineExponential',
	exponential: 'pptx.chart.trendlineExponential',
	log: 'pptx.chart.trendlineLogarithmic',
	logarithmic: 'pptx.chart.trendlineLogarithmic',
	poly: 'pptx.chart.trendlinePolynomial',
	polynomial: 'pptx.chart.trendlinePolynomial',
	power: 'pptx.chart.trendlinePower',
	movingAvg: 'pptx.chart.trendlineMovingAvg',
};

/** `c:errBars/c:errValType` values. */
export const CHART_ERROR_BAR_VALTYPE_LABEL_KEYS: Readonly<Record<string, string>> = {
	fixedVal: 'pptx.chart.errorBarFixed',
	percentage: 'pptx.chart.errorBarPercentage',
	stdDev: 'pptx.chart.errorBarStdDev',
	stdErr: 'pptx.chart.errorBarStdErr',
	cust: 'pptx.chart.errorBarCustom',
};

/** `c:marker/c:symbol` values. */
export const CHART_MARKER_SYMBOL_LABEL_KEYS: Readonly<Record<string, string>> = {
	auto: 'pptx.chart.markerAuto',
	none: 'pptx.chart.markerNone',
	circle: 'pptx.chart.markerCircle',
	square: 'pptx.chart.markerSquare',
	diamond: 'pptx.chart.markerDiamond',
	triangle: 'pptx.chart.markerTriangle',
	x: 'pptx.chart.markerX',
	star: 'pptx.chart.markerStar',
	plus: 'pptx.chart.markerPlus',
	dot: 'pptx.chart.markerDot',
	dash: 'pptx.chart.markerDash',
};

/** `a:prstDash` values used by chart gridlines. */
export const CHART_GRIDLINE_DASH_LABEL_KEYS: Readonly<Record<string, string>> = {
	solid: 'pptx.chart.dashSolid',
	dash: 'pptx.chart.dashDash',
	dot: 'pptx.chart.dashDot',
	dashDot: 'pptx.chart.dashDashDot',
	lgDash: 'pptx.chart.dashLong',
	sysDash: 'pptx.stroke.dashSysDash',
	sysDot: 'pptx.stroke.dashSysDot',
};

/** `c:errBars/c:errDir` values. */
export const CHART_ERROR_BAR_DIRECTION_LABEL_KEYS: Readonly<Record<string, string>> = {
	x: 'pptx.chart.errorBarDirectionX',
	y: 'pptx.chart.errorBarDirectionY',
};

/**
 * Caption for the fallback tile a binding paints when a chart element carries
 * no renderable series (an unsupported type, or data that failed to enrich).
 *
 * Vue, Svelte and Vanilla each built this string by hand as
 * `` `Chart: ${chartType}` ``, which put an untranslated English word and a raw
 * OOXML token on the slide. React and Angular paint no such tile at all, so
 * this is the only place the wording exists; keeping it here is what stops the
 * three that do from drifting again.
 *
 * @param chartType - Wire token from `PptxChartData.chartType`.
 * @param translate - The binding's translator. It must support the `{{type}}`
 *   interpolation used by `pptx.chart.placeholderLabel`.
 */
export function chartPlaceholderLabel(
	chartType: PptxChartType | string | undefined,
	translate: (key: string, params?: Record<string, string>) => string,
): string {
	const token = chartType ?? 'unknown';
	const typeKey = CHART_TYPE_LABEL_KEYS[token as PptxChartType];
	// An unmapped token is still worth showing: a deck may carry a chart kind
	// newer than this table, and a blank tile reads as a broken renderer.
	const typeName = typeKey === undefined ? token : translate(typeKey);
	return translate('pptx.chart.placeholderLabel', { type: typeName });
}
