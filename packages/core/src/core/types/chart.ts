/**
 * Chart types: chart categories, series data, style metadata, data tables,
 * trendlines, error bars, and the composite `PptxChartData`.
 *
 * @module pptx-types/chart
 */

import type { PptxChartAxisLabelFormatting } from './chart-axis';
import type { PptxChartPivotFormats } from './chart-pivot-format';
import type { PptxChartPivotSource } from './chart-pivot-source';
import type { PptxChartPrintSettings } from './chart-print-settings';
import type { PptxChartProtection } from './chart-protection';
import type { PptxChartUserShape } from './chart-user-shapes';
import type { XmlObject } from './common';

export type { PptxChartUserShape, PptxChartUserShapeParagraph } from './chart-user-shapes';

// ==========================================================================
// Chart types
// ==========================================================================

/**
 * Supported chart type discriminators.
 *
 * @example
 * ```ts
 * const type: PptxChartType = "bar";
 * // => "bar" — one of: "bar" | "line" | "pie" | "doughnut" | "area" | "scatter" | …
 * ```
 */
export type PptxChartType =
	| 'bar'
	| 'line'
	| 'pie'
	| 'ofPie'
	| 'doughnut'
	| 'area'
	| 'scatter'
	| 'bubble'
	| 'radar'
	| 'stock'
	| 'bar3D'
	| 'line3D'
	| 'pie3D'
	| 'area3D'
	| 'surface'
	| 'histogram'
	| 'waterfall'
	| 'funnel'
	| 'treemap'
	| 'sunburst'
	| 'boxWhisker'
	| 'regionMap'
	| 'combo'
	| 'unknown';

/**
 * Supported trendline regression types.
 *
 * @example
 * ```ts
 * const type: PptxChartTrendlineType = "linear";
 * // => "linear" — one of: "linear" | "exponential" | "logarithmic" | "polynomial" | "power" | "movingAvg"
 * ```
 */
export type PptxChartTrendlineType =
	| 'linear'
	| 'exponential'
	| 'logarithmic'
	| 'polynomial'
	| 'power'
	| 'movingAvg';

/**
 * Configuration for a chart trendline (regression line).
 *
 * @example
 * ```ts
 * const trendline: PptxChartTrendline = {
 *   trendlineType: "linear",
 *   displayEq: true,
 *   displayRSq: true,
 *   color: "#FF0000",
 * };
 * // => satisfies PptxChartTrendline
 * ```
 */
export interface PptxChartTrendline {
	trendlineType: PptxChartTrendlineType;
	name?: string;
	order?: number;
	period?: number;
	forward?: number;
	backward?: number;
	intercept?: number;
	displayRSq?: boolean;
	displayEq?: boolean;
	color?: string;
	label?: PptxChartTrendlineLabel | null;
}

/** Typed, commonly edited properties of `c:trendlineLbl`. */
export interface PptxChartTrendlineLabel {
	layout?: PptxChartManualLayout;
	numberFormatCode?: string;
	sourceLinked?: boolean;
}

/** Error-bar direction axis. */
export type PptxChartErrBarDir = 'x' | 'y';
/** Error-bar display type (both sides, negative only, or positive only). */
export type PptxChartErrBarType = 'both' | 'minus' | 'plus';
/**
 * How the error-bar value is calculated.
 *
 * @example
 * ```ts
 * const valType: PptxChartErrValType = "percentage";
 * // => "percentage" — one of: "cust" | "fixedVal" | "percentage" | "stdDev" | "stdErr"
 * ```
 */
export type PptxChartErrValType = 'cust' | 'fixedVal' | 'percentage' | 'stdDev' | 'stdErr';

/**
 * Error bars for a chart series.
 *
 * @example
 * ```ts
 * const bars: PptxChartErrBars = {
 *   direction: "y",
 *   barType: "both",
 *   valType: "percentage",
 *   val: 5,
 * };
 * // => satisfies PptxChartErrBars
 * ```
 */
export interface PptxChartErrBars {
	direction: PptxChartErrBarDir;
	barType: PptxChartErrBarType;
	valType: PptxChartErrValType;
	val?: number;
	customPlus?: number[];
	customMinus?: number[];
	noEndCap?: boolean;
	color?: string;
}

/**
 * Visibility flags for the chart data table (axes + legend keys).
 *
 * @example
 * ```ts
 * const dt: PptxChartDataTable = {
 *   showHorzBorder: true,
 *   showVertBorder: true,
 *   showOutline: true,
 *   showKeys: true,
 * };
 * // => satisfies PptxChartDataTable
 * ```
 */
export interface PptxChartDataTable {
	showHorzBorder?: boolean;
	showVertBorder?: boolean;
	showOutline?: boolean;
	showKeys?: boolean;
}

/**
 * Line appearance for chart helper lines (drop lines, hi-low lines).
 *
 * @example
 * ```ts
 * const style: PptxChartLineStyle = {
 *   color: "#AAAAAA",
 *   width: 1,
 *   dashStyle: "dash",
 * };
 * // => satisfies PptxChartLineStyle
 * ```
 */
export interface PptxChartLineStyle {
	color?: string;
	width?: number;
	dashStyle?: string;
}

/** Marker symbol types for line/scatter chart data points. */
export type PptxChartMarkerSymbol =
	| 'circle'
	| 'dash'
	| 'diamond'
	| 'dot'
	| 'none'
	| 'picture'
	| 'plus'
	| 'square'
	| 'star'
	| 'triangle'
	| 'x'
	| 'auto';

/** Shape properties extracted from c:spPr for chart formatting. */
export interface PptxChartShapeProps {
	fillColor?: string;
	strokeColor?: string;
	strokeWidth?: number;
	/** Line dash style (a:prstDash/@val), e.g. 'solid', 'dash', 'dot', 'lgDash'. */
	strokeDashStyle?: string;
}

/** Up/down bar formatting on line and stock charts (`c:upDownBars`). */
export interface PptxChartUpDownBars {
	/** Gap between bars as a percentage, constrained to 0 through 500. */
	gapWidth?: number;
	upBars?: PptxChartShapeProps;
	downBars?: PptxChartShapeProps;
}

/** Marker appearance on a chart series or data point. */
export interface PptxChartMarker {
	symbol: PptxChartMarkerSymbol;
	/** Marker size in points, constrained by ST_MarkerSize to 2 through 72. */
	size?: number;
	spPr?: PptxChartShapeProps;
}

/** Per-data-point formatting override (c:dPt). */
export interface PptxChartDataPoint {
	idx: number;
	spPr?: PptxChartShapeProps;
	explosion?: number;
	invertIfNegative?: boolean;
	marker?: PptxChartMarker;
	/** Render a bubble-chart point with a 3-D appearance. */
	bubble3D?: boolean;
}

/** Schema values accepted by `c:dLblPos`. */
export type PptxChartDataLabelPosition =
	| 'bestFit'
	| 'b'
	| 'ctr'
	| 'inBase'
	| 'inEnd'
	| 'l'
	| 'outEnd'
	| 'r'
	| 't';

/** Individual data label override (c:dLbl). */
export interface PptxChartDataLabel {
	idx: number;
	/** Suppress this data point's automatically generated label. */
	deleted?: boolean;
	showVal?: boolean;
	showCatName?: boolean;
	showSerName?: boolean;
	showPercent?: boolean;
	showLegendKey?: boolean;
	showBubbleSize?: boolean;
	position?: PptxChartDataLabelPosition;
	text?: string;
	separator?: string;
	showLeaderLines?: boolean;
}

/** Axis number format. */
export interface PptxChartAxisNumFmt {
	formatCode: string;
	sourceLinked?: boolean;
}

/** Typed contents of a value-axis display-unit label (`c:dispUnitsLbl`). */
export interface PptxChartDisplayUnitsLabel {
	/** Literal label text. Omit to preserve the source text subtree. */
	text?: string;
	/** Manual label placement. `null` removes only the manual layout. */
	layout?: PptxChartManualLayout | null;
	/** Label shape formatting. `null` removes `c:spPr`. */
	spPr?: PptxChartShapeProps | null;
}

/** Axis formatting for category, value, or date axes. */
export interface PptxChartAxisFormatting extends PptxChartAxisLabelFormatting {
	axisType: 'catAx' | 'valAx' | 'dateAx' | 'serAx';
	/** Axis position: "b" (bottom), "l" (left), "r" (right), "t" (top). */
	axPos?: 'b' | 'l' | 'r' | 't';
	/** Unique axis identifier (c:axId/@val) used to link series to axes. */
	axisId?: number;
	/** Cross-axis identifier — the axis this axis crosses. */
	crossAxisId?: number;
	/** Automatic crossing mode (`c:crosses`). Mutually exclusive with `crossesAt`. */
	crosses?: 'autoZero' | 'min' | 'max';
	/** Explicit crossing value (`c:crossesAt`). Units depend on the axis type. */
	crossesAt?: number;
	/** Whether a value axis crosses between or at category tick marks. */
	crossBetween?: 'between' | 'midCat';
	numFmt?: PptxChartAxisNumFmt;
	titleText?: string;
	spPr?: PptxChartShapeProps;
	fontFamily?: string;
	fontSize?: number;
	fontBold?: boolean;
	fontColor?: string;
	/** Whether major gridlines are present (`c:majorGridlines`). */
	majorGridlines?: boolean;
	/** Whether minor gridlines are present (`c:minorGridlines`). */
	minorGridlines?: boolean;
	majorGridlinesSpPr?: PptxChartShapeProps;
	minorGridlinesSpPr?: PptxChartShapeProps;
	/** Minimum axis value override (c:min/@val). */
	min?: number;
	/** Maximum axis value override (c:max/@val). */
	max?: number;
	/** Axis value direction (`c:scaling/c:orientation/@val`). */
	orientation?: 'minMax' | 'maxMin';
	/** Whether the axis is deleted/hidden (c:delete/@val). */
	deleted?: boolean;
	/**
	 * Display units for value axis (c:dispUnits/c:builtInUnit/@val).
	 * When set to 'custom', the actual divisor is in {@link displayUnitsValue}.
	 */
	displayUnits?:
		| 'hundreds'
		| 'thousands'
		| 'tenThousands'
		| 'hundredThousands'
		| 'millions'
		| 'tenMillions'
		| 'hundredMillions'
		| 'billions'
		| 'trillions'
		| 'custom';
	/** Custom display unit divisor value (c:dispUnits/c:custUnit/@val). Only used when displayUnits is 'custom'. */
	displayUnitsValue?: number;
	/**
	 * Display-unit label contents (`c:dispUnits/c:dispUnitsLbl`). A string is
	 * retained as a compatibility shorthand for `{ text: string }`; `null`
	 * explicitly removes the label.
	 */
	displayUnitsLabel?: string | PptxChartDisplayUnitsLabel | null;
	/** Whether logarithmic scaling is enabled (presence of c:scaling/c:logBase). */
	logScale?: boolean;
	/** Logarithmic base value (c:scaling/c:logBase/@val), typically 10 or e. */
	logBase?: number;
	/** Major-unit interval between primary tick marks (c:majorUnit/@val). */
	majorUnit?: number;
	/** Minor-unit interval between secondary tick marks (c:minorUnit/@val). */
	minorUnit?: number;
	/** Calendar unit used to interpret date-axis serial values. */
	baseTimeUnit?: 'days' | 'months' | 'years';
	majorTimeUnit?: 'days' | 'months' | 'years';
	minorTimeUnit?: 'days' | 'months' | 'years';
}

/** 3D wall or floor element formatting. */
export interface PptxChart3DSurface {
	thickness?: number;
	spPr?: PptxChartShapeProps;
}

/** Office 2016 ChartEx box-and-whisker series layout options. */
export interface PptxChartBoxWhiskerOptions {
	quartileMethod?: 'inclusive' | 'exclusive';
	showMeanLine?: boolean;
	showMeanMarker?: boolean;
	/** Show non-outlier (inner) data points. */
	showInnerPoints?: boolean;
	showOutlierPoints?: boolean;
}

/** Office 2016 ChartEx histogram and Pareto series layout options. */
export interface PptxChartHistogramOptions {
	/** Maps to `clusteredColumn` for histogram columns or `paretoLine`. */
	layout?: 'histogram' | 'pareto';
	/** Exactly one of binSize and binCount is emitted by the ChartEx writer. */
	binSize?: number;
	binCount?: number;
	intervalClosed?: 'l' | 'r';
	underflow?: number | 'auto';
	overflow?: number | 'auto';
}

/** Office 2016 ChartEx waterfall series layout options. */
export interface PptxChartWaterfallOptions {
	/** Zero-based data point indexes rendered as absolute subtotal or total bars. */
	subtotalIndices?: number[];
	/** Whether connector lines are visible between adjacent bars. */
	connectorLines?: boolean;
}

/** Office 2016 ChartEx geographic series dimensions and layout options. */
export interface PptxChartRegionMapOptions {
	/** Optional provider entity identifiers aligned with categories and values. */
	entityIds?: string[];
	/** Original `cx:pt/@idx` values for category points. */
	categorySourceIndices?: number[];
	/** Original `cx:pt/@idx` values for colour-value points. */
	valueSourceIndices?: number[];
	/** Original `cx:pt/@idx` values for entity-ID points. */
	entityIdSourceIndices?: number[];
	regionLabelLayout?: 'none' | 'bestFitOnly' | 'showAll';
	projectionType?: 'mercator' | 'miller' | 'robinson' | 'albers';
	viewedRegionType?:
		| 'dataOnly'
		| 'postalCode'
		| 'county'
		| 'state'
		| 'countryRegion'
		| 'countryRegionList'
		| 'world';
	cultureLanguage?: string;
	/** ISO-3166-1 alpha-2 region code. */
	cultureRegion?: string;
	attribution?: string;
	/** Opaque authored provider cache under `cx:geography/cx:geoCache`. */
	geographyCache?: XmlObject;
}

/** Layout for parent category labels in a hierarchical ChartEx treemap. */
export type PptxChartParentLabelLayout = 'none' | 'banner' | 'overlapping';

/** Per-series layout options for an Office 2016+ ChartEx treemap. */
export interface PptxChartTreemapOptions {
	parentLabelLayout?: PptxChartParentLabelLayout;
}

/**
 * A single data series within a chart.
 *
 * @example
 * ```ts
 * const series: PptxChartSeries = {
 *   name: "Revenue",
 *   values: [100, 120, 140],
 *   color: "#4F81BD",
 *   trendlines: [{ trendlineType: "linear" }],
 * };
 * // => satisfies PptxChartSeries
 * ```
 */
export interface PptxChartSeries {
	name: string;
	values: number[];
	/**
	 * Blank-value mask aligned index-for-index with {@link values}: `true` marks
	 * a category whose numeric cache point (`c:numCache/c:pt`) was absent or
	 * empty, i.e. a genuine blank rather than a real `0`. Present only when the
	 * source series actually contains blanks; when set, blank slots in
	 * {@link values} carry `0` as a placeholder. Renderers honour
	 * `c:dispBlanksAs` (gap / zero / span) using this mask.
	 */
	blanks?: boolean[];
	color?: string;
	trendlines?: PptxChartTrendline[];
	errBars?: PptxChartErrBars[];
	dataPoints?: PptxChartDataPoint[];
	marker?: PptxChartMarker;
	dataLabels?: PptxChartDataLabel[];
	explosion?: number;
	/**
	 * Series-level `c:invertIfNegative`: when true, bar/column data points with a
	 * negative value are drawn with an inverted (lightened) fill. A per-point
	 * `c:dPt/c:invertIfNegative` overrides this for that point. Absent when the
	 * source XML omits the flag.
	 */
	invertIfNegative?: boolean;
	/**
	 * Whether this line/scatter series is drawn with bezier smoothing
	 * (`c:ser/c:smooth/@val`). Absent when the source XML omits `c:smooth`.
	 */
	smooth?: boolean;
	/** Axis ID this series is plotted against (links to PptxChartAxisFormatting.axisId). */
	axisId?: number;
	/**
	 * Per-series chart type, used for combo charts where individual series are
	 * plotted with different chart types (e.g. a bar series and a line series in
	 * the same chart). Maps to the OOXML chart-type container that holds the
	 * series (`c:barChart`, `c:lineChart`, etc.). Omitted for single-type charts,
	 * where the chart-level {@link PptxChartData.chartType} applies to every
	 * series.
	 */
	seriesChartType?: PptxChartType;
	boxWhiskerOptions?: PptxChartBoxWhiskerOptions;
	histogramOptions?: PptxChartHistogramOptions;
	waterfallOptions?: PptxChartWaterfallOptions;
	regionMapOptions?: PptxChartRegionMapOptions;
	treemapOptions?: PptxChartTreemapOptions;
}

/**
 * Chart-level data-label options (`c:dLbls` directly under a chart-type
 * container, applying to every series). Mirrors the OOXML `c:show*` flags
 * and `c:dLblPos`.
 */
export interface PptxChartDataLabelOptions {
	/** Show the numeric value (`c:showVal`). */
	showValue?: boolean;
	/** Show the category name (`c:showCatName`). */
	showCategory?: boolean;
	/** Show the series name (`c:showSerName`). */
	showSeriesName?: boolean;
	/** Show the percentage (`c:showPercent`, pie/doughnut). */
	showPercent?: boolean;
	/** Show the legend key swatch (`c:showLegendKey`). */
	showLegendKey?: boolean;
	/** Show bubble size (`c:showBubbleSize`). */
	showBubbleSize?: boolean;
	/** Text placed between combined label components (`c:separator`). */
	separator?: string;
	/** Show leader lines where supported (`c:showLeaderLines`). */
	showLeaderLines?: boolean;
	/**
	 * Label position (`c:dLblPos`). Valid values depend on the chart type
	 * (`ctr`, `inEnd`, `inBase`, `outEnd`, `bestFit`, `l`, `r`, `t`, `b`).
	 * Omit to let PowerPoint use the type default.
	 */
	position?: PptxChartDataLabelPosition;
}

/** Typed text defaults for a single chart legend entry. */
export interface PptxChartLegendTextStyle {
	fontFamily?: string;
	fontSize?: number;
	bold?: boolean;
	italic?: boolean;
	color?: string;
}

/** Per-series legend entry override (`c:legendEntry`). */
export interface PptxChartLegendEntry {
	index: number;
	deleted?: boolean;
	textStyle?: PptxChartLegendTextStyle;
}

/**
 * Style / formatting metadata for a chart.
 *
 * @example
 * ```ts
 * const style: PptxChartStyle = {
 *   styleId: 2,
 *   hasLegend: true,
 *   legendPosition: "b",
 *   hasDataLabels: true,
 * };
 * // => satisfies PptxChartStyle
 * ```
 */
export interface PptxChartStyle {
	/** Chart style index from `c:style/@val`. */
	styleId?: number;
	/** Whether the chart has a visible legend. */
	hasLegend?: boolean;
	/** Legend position (t, b, l, r, tr). */
	legendPosition?: string;
	/** Per-series visibility and text-style overrides. */
	legendEntries?: PptxChartLegendEntry[];
	/** Whether the chart has a title. */
	hasTitle?: boolean;
	/** Whether gridlines are visible. */
	hasGridlines?: boolean;
	/** Whether data labels are shown. */
	hasDataLabels?: boolean;
	/** Chart-level data-label content/position options (when `hasDataLabels`). */
	dataLabels?: PptxChartDataLabelOptions;
}

/**
 * External data source reference for a chart (c:externalData).
 *
 * Charts can reference an external Excel workbook via a relationship ID
 * that points to an external file (TargetMode="External"). The
 * `autoUpdate` flag indicates whether the chart should refresh its
 * cached data from the external source on open.
 *
 * @example
 * ```ts
 * const ext: PptxExternalData = {
 *   relId: "rId2",
 *   targetPath: "file:///C:/Data/budget.xlsx",
 *   autoUpdate: true,
 * };
 * // => satisfies PptxExternalData
 * ```
 */
export interface PptxExternalData {
	/** Relationship ID referencing the external data source in the chart .rels. */
	relId: string;
	/** Resolved external file path or URL from the relationship target. */
	targetPath?: string;
	/** Whether to auto-update data from the external source on open. */
	autoUpdate?: boolean;
	/** Raw binary data of the embedded xlsx workbook (from ppt/embeddings/). */
	embeddedWorkbookData?: Uint8Array;
}

/**
 * Options specific to the OOXML "Pie of Pie" / "Bar of Pie" chart
 * (`c:ofPieChart`, ECMA-376 §21.2.2.126 / CT_OfPieChart).
 *
 * The primary discriminator is {@link ofPieType}: `"pie"` produces a
 * pie-of-pie chart whose secondary plot is itself a pie, while `"bar"`
 * produces a bar-of-pie chart whose secondary plot is a horizontal bar.
 *
 * - {@link splitType} chooses the split rule.
 * - {@link splitPos} is the threshold value used by `pos`/`val`/`percent`.
 * - {@link secondPieSize} controls the secondary plot's size (5–200%).
 * - {@link serLines} toggles the leader lines connecting the plots.
 * - {@link gapWidth} is the gap between the plots in percent (0–500).
 */
export interface PptxChartOfPieOptions {
	ofPieType: 'pie' | 'bar';
	splitType?: 'auto' | 'cust' | 'percent' | 'pos' | 'val';
	splitPos?: number;
	custSplit?: number[];
	secondPieSize?: number;
	serLines?: boolean;
	gapWidth?: number;
}

/** Classic `c:bubbleChart` options from CT_BubbleChart. */
export interface PptxBubbleChartOptions {
	bubble3D?: boolean;
	/** Bubble diameter scale in percent, constrained to 0 through 300. */
	bubbleScale?: number;
	showNegativeBubbles?: boolean;
	sizeRepresents?: 'area' | 'w';
}

/**
 * 3D viewing parameters for a chart (`c:view3D`, ECMA-376 §21.2.2.228 /
 * CT_View3D).
 *
 * All fields are optional and round-trip verbatim.
 *
 * - {@link rotX} — X-axis rotation in degrees (-90…90).
 * - {@link rotY} — Y-axis rotation in degrees (0…360).
 * - {@link depthPercent} — chart depth as a percentage of base width.
 * - {@link rAngAx} — `true` if axes meet at right angles.
 * - {@link perspective} — perspective angle in degrees (0…240).
 * - {@link hPercent} — height as a percentage of chart width.
 */
export interface PptxChartView3D {
	rotX?: number;
	rotY?: number;
	depthPercent?: number;
	rAngAx?: boolean;
	perspective?: number;
	hPercent?: number;
}

/**
 * Chart "chrome" flags from `c:chart` that round-trip cleanly even when
 * rendering ignores them.
 *
 * - {@link autoTitleDeleted} — `c:autoTitleDeleted/@val`. Suppresses the
 *   auto-generated title for single-series charts.
 * - {@link dispBlanksAs} — `c:dispBlanksAs/@val`. How blank cells
 *   render: `"gap"`, `"zero"`, or `"span"`.
 * - {@link showDLblsOverMax} — `c:showDLblsOverMax/@val`. Keeps data
 *   labels visible for points exceeding the value-axis maximum.
 *
 * `c:plotVisOnly` lives on {@link PptxChartData.plotVisibleOnly} and is
 * intentionally not duplicated here.
 */
export interface PptxChartChrome {
	autoTitleDeleted?: boolean;
	dispBlanksAs?: 'gap' | 'zero' | 'span';
	showDLblsOverMax?: boolean;
}

/** Manual chart placement from `c:layout/c:manualLayout` (CT_ManualLayout). */
export interface PptxChartManualLayout {
	layoutTarget?: 'inner' | 'outer';
	xMode?: 'edge' | 'factor';
	yMode?: 'edge' | 'factor';
	widthMode?: 'edge' | 'factor';
	heightMode?: 'edge' | 'factor';
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	/**
	 * Raw `c:extLst` (CT_ExtensionList) of the `c:manualLayout`, captured
	 * verbatim so it round-trips through the typed model. Without this, a dirty
	 * write of an edited layout would drop the extension list (the manual node
	 * is rebuilt from the typed fields). Emitted as the trailing child, matching
	 * the CT_ManualLayout schema order.
	 */
	ext?: XmlObject;
}

/**
 * Typed manual layouts for chart regions that accept `c:layout`.
 * A `null` region removes its manual layout without removing extensions.
 */
export interface PptxChartLayouts {
	title?: PptxChartManualLayout | null;
	plotArea?: PptxChartManualLayout | null;
	legend?: PptxChartManualLayout | null;
}

/** Parsed data extracted from an embedded xlsx workbook. */
export interface PptxEmbeddedWorkbookData {
	/** Category labels from the first column/row. */
	categories: string[];
	/** Data series extracted from worksheet cells. */
	series: Array<{ name: string; values: number[] }>;
	/** Whether the workbook uses the 1904 date system. */
	date1904?: boolean;
}

/** Raw numeric category cache used by a classic ChartML date axis. */
export interface PptxChartDateCategories {
	values: number[];
	/** False/default uses Excel's 1900 date system; true uses the 1904 system. */
	date1904?: boolean;
	/** Number format copied from the numeric category cache. */
	formatCode?: string;
}

/**
 * Complete parsed chart data for a {@link ChartPptxElement}.
 *
 * @example
 * ```ts
 * const chart: PptxChartData = {
 *   title: "Q4 Sales",
 *   chartType: "bar",
 *   categories: ["Jan", "Feb", "Mar"],
 *   series: [
 *     { name: "Revenue", values: [100, 120, 140] },
 *   ],
 *   grouping: "clustered",
 *   style: { hasLegend: true, legendPosition: "b" },
 * };
 * // => satisfies PptxChartData
 * ```
 */
export interface PptxChartData {
	title?: string;
	chartType: PptxChartType;
	categories: string[];
	/**
	 * Hierarchical category levels in source XML order for ChartEx hierarchy charts.
	 * Level 0 contains the leaf labels and remains mirrored by {@link categories}
	 * for consumers that only understand a flat category axis.
	 */
	categoryLevels?: string[][];
	dateCategories?: PptxChartDateCategories;
	series: PptxChartSeries[];
	/** Chart style/formatting metadata. */
	style?: PptxChartStyle;
	/** Grouping mode for bar/area/line charts: 'clustered' | 'stacked' | 'percentStacked' */
	grouping?: 'clustered' | 'stacked' | 'percentStacked';
	/**
	 * Whether the first (or only) series varies its point colours
	 * (`c:varyColors/@val`). Pie/doughnut default this on; single-series
	 * bar/column honour it by giving each point a distinct palette colour.
	 * Absent when the source XML omits `c:varyColors`.
	 */
	varyColors?: boolean;
	/**
	 * Pie/doughnut start angle in degrees clockwise from 12 o'clock
	 * (`c:firstSliceAng/@val`, 0 through 360). Absent uses the default 0.
	 */
	firstSliceAngle?: number;
	/**
	 * Doughnut hole diameter as a percentage of the outer diameter
	 * (`c:holeSize/@val`, 10 through 90). Absent uses the renderer default.
	 */
	doughnutHoleSize?: number;
	/**
	 * Bar/column gap between category clusters as a percentage of bar width
	 * (`c:gapWidth/@val`, 0 through 500). Absent uses the renderer default.
	 */
	barGapWidth?: number;
	/**
	 * Clustered bar/column overlap between series within a category as a
	 * percentage (`c:overlap/@val`, -100 through 100). Absent uses 0.
	 */
	barOverlap?: number;
	/** Internal: path to the chart XML part in the PPTX archive (for round-trip save). */
	chartPartPath?: string;
	/** Internal: relationship ID linking the graphic frame to the chart part. */
	chartRelationshipId?: string;
	/** `null` explicitly removes an existing ChartML data table. */
	dataTable?: PptxChartDataTable | null;
	dropLines?: PptxChartLineStyle;
	hiLowLines?: PptxChartLineStyle;
	/** `null` explicitly removes an existing up/down-bars container. */
	upDownBars?: PptxChartUpDownBars | null;
	axes?: PptxChartAxisFormatting[];
	floor?: PptxChart3DSurface;
	sideWall?: PptxChart3DSurface;
	backWall?: PptxChart3DSurface;
	/** External data source reference (c:externalData) linking to an external workbook. */
	externalData?: PptxExternalData;

	/**
	 * Parsed data from the embedded xlsx workbook (from ppt/embeddings/).
	 *
	 * When a chart references an embedded Excel workbook via `c:externalData`,
	 * the xlsx is parsed to extract categories and series. This data serves as
	 * a fallback when the chart XML's cached series data is empty or incomplete.
	 */
	embeddedWorkbookData?: PptxEmbeddedWorkbookData;

	/**
	 * Pivot table data source reference (c:pivotSource).
	 *
	 * When present, the chart's data originates from a PivotTable.
	 * The chart still renders using its cached series data; this field
	 * is metadata about the data origin, preserved for round-trip fidelity.
	 */
	pivotSource?: PptxChartPivotSource | null;
	/**
	 * Whether only visible cells are plotted (c:plotVisOnly).
	 * When `true` (the default), hidden cells are excluded from the chart.
	 * When `false`, hidden data IS plotted.
	 */
	plotVisibleOnly?: boolean;

	/**
	 * Color palette extracted from the chart's Office 2013+ color style part
	 * (`chartColorStyle*.xml`). When present, this palette takes priority over
	 * the `c:style/@val`-derived palette in `getChartStylePalette`.
	 *
	 * Each entry is a resolved hex colour string (e.g. `"#4472C4"`).
	 */
	colorPalette?: string[];

	/**
	 * Color cycling method from the chart color style part's `meth` attribute.
	 *
	 * - `"cycle"` — repeat the palette colours in order (default)
	 * - `"withinLinear"` — gradient within each series
	 * - `"acrossLinear"` — gradient across series
	 */
	colorMethod?: 'cycle' | 'withinLinear' | 'acrossLinear';
	/** Internal source color-style part path used for lossless dirty saves. */
	colorStylePartPath?: string;
	/** Internal parsed palette snapshot used to detect actual edits. */
	colorStyleOriginalPalette?: string[];
	/** Internal parsed method snapshot used to detect actual edits. */
	colorStyleOriginalMethod?: 'cycle' | 'withinLinear' | 'acrossLinear';

	/**
	 * Pie-of-pie / Bar-of-pie options (`c:ofPieChart`, CT_OfPieChart).
	 *
	 * Present only when {@link chartType} is `"ofPie"`. Carries the split
	 * configuration, secondary plot size, and serLines flag so that an
	 * `ofPieChart` element can be re-emitted on save with full fidelity.
	 */
	ofPieOptions?: PptxChartOfPieOptions;
	/** Classic bubble-chart display options (`c:bubbleChart`). */
	bubbleOptions?: PptxBubbleChartOptions;

	/**
	 * 3D viewing parameters (`c:view3D`, CT_View3D).
	 *
	 * Parsed from and emitted to `c:chart/c:view3D`. Absent when the
	 * chart XML has no `c:view3D` element.
	 */
	view3D?: PptxChartView3D;

	/**
	 * Top-level chart chrome flags (`c:autoTitleDeleted`,
	 * `c:dispBlanksAs`, `c:showDLblsOverMax`).
	 *
	 * Each flag is omitted from the emitted XML when absent on the
	 * source data, so absence does not produce empty `<c:…/>` placeholders.
	 */
	chartChrome?: PptxChartChrome;
	/** `c:chartSpace/c:printSettings`; `null` removes the container on save. */
	printSettings?: PptxChartPrintSettings | null;
	/** `c:chartSpace/c:protection`; `null` removes the container on save. */
	protection?: PptxChartProtection | null;
	/** Editable manual placement for the title, plot area, and legend. */
	layouts?: PptxChartLayouts;

	/**
	 * Raw `c:userShapes` XML subtree (a drawing tree) preserved verbatim.
	 *
	 * `c:userShapes` references a separate drawing part containing
	 * shapes drawn over the chart. The reference is preserved as-is so
	 * that round-trip save re-emits the original element without
	 * attempting to parse the nested drawing tree.
	 */
	userShapesXml?: unknown;

	/**
	 * Parsed, renderable drawing-overlay shapes resolved from the separate
	 * drawing part referenced by `c:userShapes/@r:id`
	 * (`ppt/drawings/drawingN.xml`). Each entry carries chart-relative anchor
	 * geometry plus light shape/text formatting so the viewer can render an
	 * overlay on top of the chart plot. Render-only: {@link userShapesXml}
	 * remains the source of truth for round-trip save.
	 */
	userShapes?: PptxChartUserShape[];

	/**
	 * Raw `c:pivotFmts` XML subtree preserved verbatim.
	 *
	 * `c:pivotFmts` carries a list of `c:pivotFmt` formatting overrides
	 * for charts whose data originates from a PivotTable. Preserved
	 * verbatim for round-trip fidelity.
	 */
	/** Typed pivot-chart format persistence; `null` removes `c:pivotFmts`. */
	pivotFormats?: PptxChartPivotFormats | null;

	/**
	 * Color-map override (`c:clrMapOvr`) carrying 12 attributes that
	 * remap theme colour roles for this chart only. Preserved as a flat
	 * `attribute → value` map for round-trip fidelity.
	 */
	clrMapOvr?: Record<string, string>;
}
