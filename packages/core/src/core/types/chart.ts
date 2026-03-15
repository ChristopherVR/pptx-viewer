/**
 * Chart types: chart categories, series data, style metadata, data tables,
 * trendlines, error bars, and the composite `PptxChartData`.
 *
 * @module pptx-types/chart
 */

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
  | "bar"
  | "line"
  | "pie"
  | "doughnut"
  | "area"
  | "scatter"
  | "bubble"
  | "radar"
  | "stock"
  | "bar3D"
  | "line3D"
  | "pie3D"
  | "area3D"
  | "surface"
  | "histogram"
  | "waterfall"
  | "funnel"
  | "treemap"
  | "sunburst"
  | "boxWhisker"
  | "regionMap"
  | "combo"
  | "unknown";

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
  | "linear"
  | "exponential"
  | "logarithmic"
  | "polynomial"
  | "power"
  | "movingAvg";

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
  order?: number;
  period?: number;
  forward?: number;
  backward?: number;
  intercept?: number;
  displayRSq?: boolean;
  displayEq?: boolean;
  color?: string;
}

/** Error-bar direction axis. */
export type PptxChartErrBarDir = "x" | "y";
/** Error-bar display type (both sides, negative only, or positive only). */
export type PptxChartErrBarType = "both" | "minus" | "plus";
/**
 * How the error-bar value is calculated.
 *
 * @example
 * ```ts
 * const valType: PptxChartErrValType = "percentage";
 * // => "percentage" — one of: "cust" | "fixedVal" | "percentage" | "stdDev" | "stdErr"
 * ```
 */
export type PptxChartErrValType =
  | "cust"
  | "fixedVal"
  | "percentage"
  | "stdDev"
  | "stdErr";

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
}

/** Marker appearance on a chart series or data point. */
export interface PptxChartMarker {
  symbol: PptxChartMarkerSymbol;
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
}

/** Individual data label override (c:dLbl). */
export interface PptxChartDataLabel {
  idx: number;
  showVal?: boolean;
  showCatName?: boolean;
  showSerName?: boolean;
  showPercent?: boolean;
  showLegendKey?: boolean;
  showBubbleSize?: boolean;
  position?: string;
  text?: string;
}

/** Axis number format. */
export interface PptxChartAxisNumFmt {
  formatCode: string;
  sourceLinked?: boolean;
}

/** Axis formatting for category, value, or date axes. */
export interface PptxChartAxisFormatting {
  axisType: 'catAx' | 'valAx' | 'dateAx' | 'serAx';
  /** Axis position: "b" (bottom), "l" (left), "r" (right), "t" (top). */
  axPos?: 'b' | 'l' | 'r' | 't';
  /** Unique axis identifier (c:axId/@val) used to link series to axes. */
  axisId?: number;
  /** Cross-axis identifier — the axis this axis crosses. */
  crossAxisId?: number;
  numFmt?: PptxChartAxisNumFmt;
  titleText?: string;
  spPr?: PptxChartShapeProps;
  fontFamily?: string;
  fontSize?: number;
  fontBold?: boolean;
  fontColor?: string;
  majorGridlinesSpPr?: PptxChartShapeProps;
  minorGridlinesSpPr?: PptxChartShapeProps;
  /** Minimum axis value override (c:min/@val). */
  min?: number;
  /** Maximum axis value override (c:max/@val). */
  max?: number;
  /** Whether the axis is deleted/hidden (c:delete/@val). */
  deleted?: boolean;
}

/** 3D wall or floor element formatting. */
export interface PptxChart3DSurface {
  thickness?: number;
  spPr?: PptxChartShapeProps;
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
  color?: string;
  trendlines?: PptxChartTrendline[];
  errBars?: PptxChartErrBars[];
  dataPoints?: PptxChartDataPoint[];
  marker?: PptxChartMarker;
  dataLabels?: PptxChartDataLabel[];
  explosion?: number;
  /** Axis ID this series is plotted against (links to PptxChartAxisFormatting.axisId). */
  axisId?: number;
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
  /** Whether the chart has a title. */
  hasTitle?: boolean;
  /** Whether gridlines are visible. */
  hasGridlines?: boolean;
  /** Whether data labels are shown. */
  hasDataLabels?: boolean;
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
  series: PptxChartSeries[];
  /** Chart style/formatting metadata. */
  style?: PptxChartStyle;
  /** Grouping mode for bar/area/line charts: 'clustered' | 'stacked' | 'percentStacked' */
  grouping?: "clustered" | "stacked" | "percentStacked";
  /** Internal: path to the chart XML part in the PPTX archive (for round-trip save). */
  chartPartPath?: string;
  /** Internal: relationship ID linking the graphic frame to the chart part. */
  chartRelationshipId?: string;
  dataTable?: PptxChartDataTable;
  dropLines?: PptxChartLineStyle;
  hiLowLines?: PptxChartLineStyle;
  axes?: PptxChartAxisFormatting[];
  floor?: PptxChart3DSurface;
  sideWall?: PptxChart3DSurface;
  backWall?: PptxChart3DSurface;
  /** External data source reference (c:externalData) linking to an external workbook. */
  externalData?: PptxExternalData;
}
