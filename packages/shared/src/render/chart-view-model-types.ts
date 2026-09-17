/**
 * chart-view-model-types.ts: the framework-neutral descriptor types of the
 * chart engine (plot layout, interactive part refs, SVG primitives, legend
 * entries and the `ChartViewModel` every binding projects into its own SVG).
 * Split out of `chart-view-model.ts`, which re-exports everything here.
 *
 * @module chart-view-model-types
 */

import type { PptxChartLegendTextStyle } from 'pptx-viewer-core';

import type { LegendLineSwatch } from './chart-legend-swatch';
import type { ChartSvgDef } from './chart-svg-def-types';
import type { SvgLine, SvgPrimitive, SvgText } from './chart-svg-primitives';
import type { ChartTitleRunSpan } from './chart-title-runs';
import type { ChartTitleTextStyle } from './chart-title-style';
import type { ValueRange } from './chart-view-model-scale';

export type { ChartSvgDef, ChartSvgPatternDef } from './chart-svg-def-types';
export * from './chart-svg-primitives';

/** Bounding-box of the chart's usable plot area in SVG coordinates. */
export interface PlotLayout {
	svgWidth: number;
	svgHeight: number;
	plotLeft: number;
	plotTop: number;
	plotRight: number;
	plotBottom: number;
	plotWidth: number;
	plotHeight: number;
	/**
	 * `plotHeight` before any `c:plotArea/c:layout/c:manualLayout` override is
	 * applied. PowerPoint's automatic gridline-count decision (see
	 * `axisTargetIntervals` in chart-axis-nice.ts) is driven by the chart's
	 * natural size, not by where the author later dragged the plot rectangle;
	 * an `inner`-target manual layout in particular reserves no axis-label
	 * band at all, so `plotHeight` alone can read far taller than the chart
	 * PowerPoint actually sized its gridline count against (issue #132: a
	 * manually-laid-out percent chart got 7 gridlines here, 4 in PowerPoint).
	 */
	autoPlotHeight: number;
}

/**
 * Reserved-space options for `computePlotLayout` (secondary axes + data table).
 * Structurally identical to `LayoutOptions` in `chart-axis.ts`; declared locally
 * to avoid a circular import (chart-axis depends on this module's `ValueRange`).
 */
export interface PlotLayoutOptions {
	hasSecondaryValueAxis?: boolean;
	hasSecondaryCategoryAxis?: boolean;
	/** The primary (only, in the common case) category axis sits at the top. */
	categoryAxisAtTop?: boolean;
	hasDataTable?: boolean;
	dataTableRowCount?: number;
}
// ─────────────────────────────────────────────────────────────────────────────
// Interactive chart parts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reference to an interactive chart sub-part, carried by the primitives that
 * represent data marks (bars, dots, slices, series lines). Bindings use it to
 * make marks clickable/draggable in edit mode and to sync selection with the
 * chart inspector; primitives without a `part` stay purely decorative.
 */
export interface ChartPartRef {
	/** 'dataPoint' targets one (series, category) cell; 'series' the whole series. */
	role: 'dataPoint' | 'series';
	seriesIndex: number;
	/** Category/point index. Absent when the primitive spans the whole series. */
	pointIndex?: number;
}

/**
 * Vertical drag-to-value context, present on cartesian view-models whose data
 * marks can be dragged vertically to change their value (clustered bar, line,
 * scatter, bubble). `secondarySeriesIndexes` lists series plotted against
 * `secondaryRange` instead of `range`.
 */
export interface ChartValueDrag {
	range: ValueRange;
	secondaryRange?: ValueRange;
	secondarySeriesIndexes?: number[];
	plotTop: number;
	plotBottom: number;
}

// SVG primitive descriptors (SvgRect / SvgPath / SvgPolyline / SvgCircle /
// SvgLine / SvgText / SvgPolygon / SvgAreaGradient / SvgPrimitive) moved to
// `chart-svg-primitives.ts` to keep this file within the repo's ~300-LOC
// limit; `chart-view-model.ts` re-exports them from there.

// ─────────────────────────────────────────────────────────────────────────────
// Legend
// ─────────────────────────────────────────────────────────────────────────────

export interface LegendEntry {
	color: string;
	label: string;
	/** Per-entry text override from `c:legendEntry/c:txPr`, applied by `applyLegendEntryOverrides`. */
	textStyle?: PptxChartLegendTextStyle;
	/**
	 * Present only for a line-drawn series (line / scatter, or a combo chart's
	 * line series): draw a line + marker sample instead of the default filled
	 * rect, matching PowerPoint. See `chart-legend-swatch.ts`.
	 */
	lineSwatch?: LegendLineSwatch;
}

// ─────────────────────────────────────────────────────────────────────────────
// Full chart view-model
// ─────────────────────────────────────────────────────────────────────────────

export interface ChartViewModel {
	svgWidth: number;
	svgHeight: number;
	title: string | undefined;
	titleX: number;
	titleY: number;
	gridlines: SvgLine[];
	axisLabels: SvgText[];
	zeroLine: SvgLine | undefined;
	categoryLabels: SvgText[];
	primitives: SvgPrimitive[];
	dataLabels: SvgText[];
	legend: LegendEntry[];
	legendX: number;
	legendY: number;
	legendAnchor: 'start' | 'middle' | 'end';
	/**
	 * Right-side (secondary) value-axis gridlines, emitted only when one or more
	 * series are mapped to a secondary value axis. Absent otherwise so existing
	 * projectors that ignore this field keep working unchanged.
	 */
	secondaryGridlines?: SvgLine[];
	/** Right-side (secondary) value-axis tick labels. Present only with a secondary axis. */
	secondaryAxisLabels?: SvgText[];
	/**
	 * SVG `fill` for the full-bleed chart-area rect, resolved from
	 * `c:chartSpace/c:spPr`. `undefined` means the chart declared `a:noFill` and
	 * NOTHING should be painted behind it. See `chart-area-fill.ts`.
	 */
	areaFill?: string;
	/**
	 * SVG `rx`/`ry` corner radius for the chart-area rect, when
	 * `c:chartSpace/c:roundedCorners` is set. `undefined` (square corners) is
	 * the default PowerPoint uses for a chart with no fill at all, so a
	 * projector should omit the attribute rather than pass `0`.
	 */
	areaRadius?: number;
	/**
	 * Font the title is drawn with (`c:title` run properties, then the chart
	 * style part, then the viewer defaults). See `chart-title-style.ts`.
	 */
	titleStyle?: ChartTitleTextStyle;
	/**
	 * Per-run `<tspan>` descriptors for a title with typed rich text
	 * (`c:title/c:tx/c:rich`, `PptxChartData.titleRuns`). Present only when the
	 * title carries typed runs; a projector should draw these INSTEAD of a
	 * single flat `vm.title` text node when set, and fall back to `title` /
	 * `titleStyle` otherwise. See `chart-title-runs.ts`.
	 */
	titleRunSpans?: ChartTitleRunSpan[];
	/**
	 * SVG `fill` for the plot-area rect, resolved from `c:plotArea/c:spPr`.
	 * `undefined` means paint nothing and let the chart area show through.
	 */
	plotFill?: string;
	/**
	 * Overlay primitives (regression trendlines, error bars, axis titles) layered
	 * on top of the base cartesian primitives. Already appended to `primitives`;
	 * surfaced separately so a projector can style/segregate them if desired.
	 */
	overlays?: SvgPrimitive[];
	/**
	 * Data-table primitives rendered below the plot area (when `chartData.dataTable`
	 * is set). Already appended to `primitives`; surfaced separately for projectors.
	 */
	dataTable?: SvgPrimitive[];
	/**
	 * Present when the chart's data marks support vertical drag-to-value editing
	 * (clustered bar / line / scatter / bubble). Absent for stacked, polar, and
	 * hierarchical kinds, where a vertical drag has no single-value meaning.
	 */
	valueDrag?: ChartValueDrag;
	/**
	 * Drawing-overlay primitives resolved from the chart's `c:userShapes`
	 * (shapes/text drawn on top of the plot). Already appended to `primitives`;
	 * surfaced separately so projectors can segregate them if desired. Absent
	 * when the chart has no overlay.
	 */
	userShapes?: SvgPrimitive[];
	/**
	 * `<defs>` a binding must render before `primitives`, so a primitive's
	 * `fill: 'url(#id)'` resolves. Currently populated only by data-point
	 * picture fills (`c:dPt/c:pictureOptions`, C2-G9); absent when the chart
	 * has none, so a projector that ignores this field paints exactly as
	 * before.
	 */
	defs?: ChartSvgDef[];
}
