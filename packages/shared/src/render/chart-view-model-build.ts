/**
 * chart-view-model-build.ts: `buildChartViewModel` and the post-passes every
 * chart kind's view-model goes through (legend entries, area fills, user-shape
 * overlay, manual layouts). Split out of `chart-view-model.ts`, which
 * re-exports everything here.
 *
 * @module chart-view-model-build
 */
/* eslint-disable one-var -- this module predates the rule and combining every
   sibling `const`/`let` in a function into one comma-list (oxlint's own
   `--fix` cannot do this safely once a non-declaration statement sits between
   them) would churn geometry code far beyond this change's scope. */

import type { ChartPptxElement, PptxChartData, PptxElement } from 'pptx-viewer-core';

import { applyChart3DDepth } from './chart-3d-depth';
import { chartAreaCornerRadius, chartAreaFill, plotAreaFill } from './chart-area-fill';
import { buildCartesianViewModel } from './chart-cartesian';
import { buildComboViewModel, buildStockViewModel } from './chart-combo-stock';
import { applyDataPointPictureFills } from './chart-datapoint-picture-fills';
import { buildBoxWhiskerViewModel, buildHistogramViewModel } from './chart-distribution';
import { buildFunnelViewModel, buildSunburstViewModel } from './chart-funnel-sunburst';
import { applyLegendEntryOverrides } from './chart-legend-entries';
import { buildOfPieViewModel } from './chart-ofpie';
import { buildSurfaceViewModel, buildTreemapViewModel } from './chart-surface-treemap';
import { resolveChartTitleRunSpans } from './chart-title-runs';
import { resolveChartTitleTextStyle } from './chart-title-style';
import { buildChartUserShapeOverlay } from './chart-user-shape-overlay';
import { resolveChartKind } from './chart-view-model-kinds';
import type { SupportedChartKind } from './chart-view-model-kinds';
import { withManualLayouts } from './chart-view-model-manual';
import { buildFallbackViewModel, buildPieViewModel } from './chart-view-model-pie';
import { computePieLayout } from './chart-view-model-points';
import { buildRadarViewModel } from './chart-view-model-radar';
import type { ChartViewModel } from './chart-view-model-types';
import { buildRegionMapViewModel, buildWaterfallViewModel } from './chart-waterfall-map';

// ─────────────────────────────────────────────────────────────────────────────
// Main view-model builder
// ─────────────────────────────────────────────────────────────────────────────

export function buildChartViewModel(element: PptxElement): ChartViewModel {
	if (element.type !== 'chart') {
		return buildFallbackViewModel(element.width, element.height, 'Chart');
	}
	const chartEl = element as ChartPptxElement,
		chartData = chartEl.chartData;

	if (!chartData || chartData.series.length === 0) {
		return buildFallbackViewModel(element.width, element.height, chartData?.title ?? 'Chart');
	}

	const chartType = chartData.chartType ?? 'bar',
		kind = resolveChartKind(chartType);

	if (kind === 'unsupported') {
		return buildFallbackViewModel(element.width, element.height, chartData.title ?? chartType);
	}

	const longestLen = chartData.series.reduce((m, s) => Math.max(m, s.values.length), 0),
		categoryLabels =
			chartData.categories.length > 0
				? chartData.categories
				: Array.from({ length: longestLen }, (_, i) => String(i + 1));

	// Pie-of-pie / bar-of-pie splits one series across a primary + secondary plot.
	if (chartType === 'ofPie') {
		return finishViewModel(
			buildOfPieViewModel(element, chartData, categoryLabels),
			chartData,
			element,
		);
	}

	// 3D chart kinds keep their flat geometry but get an oblique depth pass driven
	// by c:view3D so they read as 3D instead of collapsing to a flat plot.
	const flat = buildFlatViewModel(element, chartData, categoryLabels, kind);
	if (is3DChartType(chartType)) {
		// pie3D's ellipse tilt foreshortens about the same centre buildPieViewModel
		// laid the slices out from (doughnut3D does not exist in OOXML, so this is
		// always a hole-less pie layout).
		let pieCenter: { cx: number; cy: number } | undefined;
		if (chartType === 'pie3D') {
			const pieLayout = computePieLayout(element.width, element.height, chartData, false);
			pieCenter = { cx: pieLayout.cx, cy: pieLayout.cy };
		}
		const walls = {
			floor: chartData.floor,
			sideWall: chartData.sideWall,
			backWall: chartData.backWall,
		};
		return finishViewModel(
			applyChart3DDepth(flat, chartType, chartData.view3D, walls, chartData.grouping, pieCenter),
			chartData,
			element,
		);
	}
	return finishViewModel(flat, chartData, element);
}

/**
 * The post-passes every chart kind's view-model goes through, in order: the
 * `c:manualLayout` title / legend re-anchoring (on the builder's automatic
 * anchors), the `c:userShapes` overlay, the chart / plot area fills, and the
 * `c:legendEntry` overrides.
 */
function finishViewModel(
	vm: ChartViewModel,
	chartData: PptxChartData,
	frame: { id: string; width: number; height: number },
): ChartViewModel {
	return withLegendEntries(
		withChartAreaFill(
			withDataPointPictureFills(
				withUserShapeOverlay(withManualLayouts(vm, chartData, frame), chartData),
				chartData,
				frame.id,
			),
			chartData,
		),
		chartData,
	);
}

/**
 * Rewrite data-point rects with a `c:dPt/c:pictureOptions` picture fill to
 * `url(#...)` and attach the `<pattern>` defs a binding must render for it
 * (C2-G9 render half). Runs after the user-shape overlay so overlay
 * primitives (which carry no `part`) are never mistaken for data points, and
 * before the legend/area-fill passes since those don't touch `primitives`.
 */
function withDataPointPictureFills(
	vm: ChartViewModel,
	chartData: PptxChartData,
	elementId: string,
): ChartViewModel {
	const { primitives, defs } = applyDataPointPictureFills(chartData, elementId, vm.primitives);
	if (defs.length === 0) {
		return vm;
	}
	return { ...vm, primitives, defs: [...(vm.defs ?? []), ...defs] };
}

/**
 * Apply `c:legendEntry` deletion + text-style overrides to a finished
 * view-model's legend. The single call site every chart kind's `vm.legend`
 * passes through before returning from `buildChartViewModel`; see
 * `chart-legend-entries.ts`.
 */
function withLegendEntries(vm: ChartViewModel, chartData: PptxChartData): ChartViewModel {
	const legend = applyLegendEntryOverrides(vm.legend, chartData.style?.legendEntries);
	return legend === vm.legend ? vm : { ...vm, legend };
}

/**
 * Stamp the resolved chart-area / plot-area fills onto a finished view-model so
 * every binding paints (or skips) the same background rect. A chart that
 * declares `<a:noFill/>` gets `areaFill: undefined` and no rect at all.
 */
function withChartAreaFill(vm: ChartViewModel, chartData: PptxChartData): ChartViewModel {
	const titleRunSpans = resolveChartTitleRunSpans(chartData);
	return {
		...vm,
		areaFill: chartAreaFill(chartData),
		areaRadius: chartAreaCornerRadius(chartData),
		titleStyle: resolveChartTitleTextStyle(chartData),
		...(titleRunSpans ? { titleRunSpans } : {}),
		plotFill: plotAreaFill(chartData),
	};
}

/**
 * Append the chart's `c:userShapes` drawing overlay to a finished view-model.
 *
 * The overlay primitives are positioned in the same SVG coordinate space as the
 * chart (`svgWidth` x `svgHeight`) and layered last so they sit above the data
 * marks. Returns the view-model unchanged when the chart has no overlay.
 */
function withUserShapeOverlay(vm: ChartViewModel, chartData: PptxChartData): ChartViewModel {
	const overlay = buildChartUserShapeOverlay(chartData.userShapes, vm.svgWidth, vm.svgHeight);
	if (overlay.length === 0) {
		return vm;
	}
	return {
		...vm,
		primitives: [...vm.primitives, ...overlay],
		userShapes: overlay,
	};
}

/** Whether a chart type carries an inherent 3D depth treatment. */
function is3DChartType(chartType: string): boolean {
	return (
		chartType === 'bar3D' ||
		chartType === 'pie3D' ||
		chartType === 'line3D' ||
		chartType === 'area3D'
	);
}

/** Build the flat (2D) view-model for a resolved chart kind. */
function buildFlatViewModel(
	element: PptxElement,
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
	kind: SupportedChartKind,
): ChartViewModel {
	if (kind === 'pie' || kind === 'doughnut') {
		return buildPieViewModel(element, chartData, categoryLabels, kind === 'doughnut');
	}

	if (kind === 'radar') {
		return buildRadarViewModel(element, chartData, categoryLabels);
	}

	if (kind === 'combo') {
		return buildComboViewModel(element, chartData, categoryLabels);
	}
	if (kind === 'stock') {
		return buildStockViewModel(element, chartData, categoryLabels);
	}
	if (kind === 'surface') {
		return buildSurfaceViewModel(element, chartData, categoryLabels);
	}
	if (kind === 'treemap') {
		return buildTreemapViewModel(element, chartData, categoryLabels);
	}
	if (kind === 'waterfall') {
		return buildWaterfallViewModel(element, chartData, categoryLabels);
	}
	if (kind === 'regionMap') {
		return buildRegionMapViewModel(element, chartData, categoryLabels);
	}
	if (kind === 'funnel') {
		return buildFunnelViewModel(element, chartData, categoryLabels);
	}
	if (kind === 'sunburst') {
		return buildSunburstViewModel(element, chartData, categoryLabels);
	}
	if (kind === 'histogram') {
		return buildHistogramViewModel(element, chartData, categoryLabels);
	}
	if (kind === 'boxWhisker') {
		return buildBoxWhiskerViewModel(element, chartData, categoryLabels);
	}

	return buildCartesianViewModel(element, chartData, categoryLabels, kind);
}
