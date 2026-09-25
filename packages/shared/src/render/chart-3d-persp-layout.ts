/**
 * PowerPoint's perspective 3D chart layout (`c:view3D/@rAngAx=0`) for the
 * cartesian families (line3D, area3D, surface3D): the plot box, the camera
 * that frames it (`chart-3d-persp-view.ts`), the value axis, where each
 * category and depth row sits, and the wall gridlines.
 *
 * Calibrated against `gt/chart-10..13,16`:
 *
 * - The box is 1 unit wide (categories), `boxHeight` tall and one category
 *   slot deep per depth row: a mark (area slab, line ribbon) is
 *   `slot / (1 + gapWidth)` deep and each row `mark * (1 + gapDepth)`, which
 *   with the 150/150 defaults is exactly one slot (fitted: 0.94-1.04).
 *   `standard` grouping (and line3D) gives each series a row, series 1 in
 *   front; stacked groupings share one row. A surface spans the whole floor.
 * - Categories sit at the slot centres (`c:crossBetween="between"`) or on the
 *   slot edges, first and last on the walls (`midCat`, area and surface's
 *   default).
 * - The value axis has no headroom (data topping out at 35 gets 0..35).
 * - The box fills a plot rect calibrated from the same exports, centred and
 *   floor-aligned; walls carry gridlines only, the floor its two outer edges.
 *
 * @module chart-3d-persp-layout
 */
import type { PptxChartData, PptxElement } from 'pptx-viewer-core';

import { buildPerspGridlines } from './chart-3d-persp-gridlines';
import { buildPerspLabels } from './chart-3d-persp-labels';
import type { PerspLabel } from './chart-3d-persp-labels';
import { fitPerspView, perspCameraFor } from './chart-3d-persp-view';
import type { PerspView } from './chart-3d-persp-view';
import { axisTargetIntervals, niceValueAxisBounds } from './chart-axis-nice';
import type { ChartViewModel } from './chart-view-model-types';

export type { PerspLabel } from './chart-3d-persp-labels';

/** Points to chart px (96 dpi). */
const PT = 4 / 3;
/** Box height of a one-row box, per unit of width (fitted 0.37 on `gt/chart-12,13`). */
const SINGLE_ROW_HEIGHT = 0.371;
/**
 * A multi-row box's height per unit of width plus depth: fitted 0.208 on
 * `gt/chart-10,11,16` (heights 0.357, 0.289 and 0.361 for depths 0.71, 0.39
 * and 0.71), so a deeper box stands taller.
 */
const MULTI_ROW_HEIGHT_PER_EXTENT = 0.208;
const RECT_LEFT = 48 * PT;
/** Right margin: room for the depth-row labels when there are any (`gt/chart-10,11` vs `12`). */
const RECT_RIGHT_WITH_SERIES = 60 * PT;
const RECT_RIGHT_NO_SERIES = 50 * PT;
const RECT_TOP_WITH_TITLE = 48 * PT;
const RECT_TOP_NO_TITLE = 14 * PT;
const RECT_BOTTOM_WITH_LEGEND = 62 * PT;
const RECT_BOTTOM_NO_LEGEND = 31 * PT;
const DEFAULT_GAP = 150;
/**
 * Category extent per unit of value extent for a horizontal bar box (no
 * ground truth for a perspective one; the right-angle-axes export,
 * `gt/chart-05`, keeps its box at 0.483).
 */
const HORIZONTAL_CATEGORY_EXTENT = 0.483;
/** Fitted box depth per nominal depth: 0.94-0.99 for multi-row boxes (`gt/chart-10,11,16`), 1.04 for one row (`gt/chart-12`). */
const DEPTH_FIT_MULTI_ROW = 0.96;
const DEPTH_FIT_SINGLE_ROW = 1.04;

export type PerspKind = 'line' | 'area' | 'surface' | 'bar';
export type PerspGrouping = 'standard' | 'clustered' | 'stacked' | 'percentStacked';

/** A gridline segment in box space. */
export interface PerspGridline {
	from: readonly [number, number, number];
	to: readonly [number, number, number];
}

export interface PerspChartLayout {
	kind: PerspKind;
	grouping: PerspGrouping;
	view: PerspView;
	range: { min: number; max: number; majorUnit: number };
	/** Values run along box x and categories up box y (a `c:barDir="bar"` bar chart). */
	horizontal: boolean;
	/** Box units per value unit, along the value axis. */
	valueScale: number;
	/** Position of each category along the category axis (box x, or box y when `horizontal`). */
	categoryX: number[];
	/** Number of depth rows and each row's depth. */
	rows: number;
	rowDepth: number;
	/** Depth of a slab or ribbon, centred in its row. */
	markDepth: number;
	/** Series colours, by series index. */
	colors: string[];
	gridlines: PerspGridline[];
	labels: PerspLabel[];
}

function kindOf(chartType: string): PerspKind | null {
	switch (chartType) {
		case 'line3D':
			return 'line';
		case 'area3D':
			return 'area';
		case 'surface':
		case 'surface3D':
			return 'surface';
		case 'bar3D':
			return 'bar';
		default:
			return null;
	}
}

function groupingOf(kind: PerspKind, chartData: PptxChartData): PerspGrouping {
	const g = chartData.grouping;
	if ((kind === 'area' || kind === 'bar') && (g === 'stacked' || g === 'percentStacked')) {
		return g;
	}
	return kind === 'bar' && !chartData.groupingStandard ? 'clustered' : 'standard';
}

/** Data extent on the value axis. */
function dataExtent(
	chartData: PptxChartData,
	grouping: PerspGrouping,
	nCat: number,
): [number, number] {
	if (grouping === 'percentStacked') {
		return [0, 1];
	}
	let lo = 0;
	let hi = 0;
	for (let c = 0; c < nCat; c++) {
		let sum = 0;
		for (const s of chartData.series) {
			const v = s.values[c] ?? 0;
			if (grouping === 'stacked') {
				sum += v;
				hi = Math.max(hi, sum);
				lo = Math.min(lo, sum);
			} else {
				hi = Math.max(hi, v);
				lo = Math.min(lo, v);
			}
		}
	}
	return [lo, hi];
}

/** Series colours as the flat chart resolved them (legend swatches carry them). */
export function perspSeriesColors(chartData: PptxChartData, vm: ChartViewModel): string[] {
	return chartData.series.map(
		(s, i) =>
			vm.legend.find((entry) => entry.label === s.name)?.color ?? vm.legend[i]?.color ?? '#4472c4',
	);
}

/** The perspective layout of a line3D / area3D / surface chart, or `null`. */
export function computePerspChartLayout(
	element: PptxElement,
	vm: ChartViewModel,
): PerspChartLayout | null {
	if (element.type !== 'chart' || !element.chartData) {
		return null;
	}
	const chartData = element.chartData;
	const kind = kindOf(chartData.chartType);
	const nSer = chartData.series.length;
	const nCat = chartData.series.reduce((m, s) => Math.max(m, s.values.length), 0);
	if (!kind || nSer === 0 || nCat === 0) {
		return null;
	}
	const horizontal = kind === 'bar' && chartData.barDirection === 'bar';
	const grouping = groupingOf(kind, chartData);
	const valAx = chartData.axes?.find((a) => a.axisType === 'valAx');
	const midCat =
		(valAx?.crossBetween ?? (kind === 'area' || kind === 'surface' ? 'midCat' : 'between')) ===
		'midCat';
	const view3D = chartData.view3D;

	const gapWidth = (chartData.barGapWidth ?? DEFAULT_GAP) / 100;
	const gapDepth = (chartData.gapDepth ?? DEFAULT_GAP) / 100;
	const slot = 1 / nCat;
	const rows = kind === 'surface' ? nSer : grouping === 'standard' ? nSer : 1;
	const markDepth = slot / (1 + gapWidth);
	const rowDepth = markDepth * (1 + gapDepth);
	const depthScale =
		((view3D?.depthPercent ?? 100) / 100) * (rows > 1 ? DEPTH_FIT_MULTI_ROW : DEPTH_FIT_SINGLE_ROW);
	const d = rows * rowDepth * depthScale;
	const baseHeight = rows > 1 ? MULTI_ROW_HEIGHT_PER_EXTENT * (1 + d) : SINGLE_ROW_HEIGHT;
	const heightScale = (view3D?.hPercent ?? 100) / 100;
	// Value extent along its axis, and the box.
	const valueExtent = horizontal ? 1 : baseHeight * heightScale;
	const catExtent = horizontal ? HORIZONTAL_CATEGORY_EXTENT * heightScale : 1;
	const box = horizontal ? { w: valueExtent, h: catExtent, d } : { w: 1, h: valueExtent, d };

	const camera = perspCameraFor(
		box,
		view3D?.rotX ?? 15,
		view3D?.rotY ?? 20,
		view3D?.perspective ?? undefined,
	);
	const hasLegend =
		chartData.style?.hasLegend !== false && (chartData.style?.legendPosition ?? 'b') === 'b';
	const view = fitPerspView(camera, {
		left: RECT_LEFT,
		right: vm.svgWidth - (rows > 1 ? RECT_RIGHT_WITH_SERIES : RECT_RIGHT_NO_SERIES),
		top: vm.title ? RECT_TOP_WITH_TITLE : RECT_TOP_NO_TITLE,
		bottom: vm.svgHeight - (hasLegend ? RECT_BOTTOM_WITH_LEGEND : RECT_BOTTOM_NO_LEGEND),
	});

	const [lo, hi] = dataExtent(chartData, grouping, nCat);
	const auto = niceValueAxisBounds(lo, hi, axisTargetIntervals(view.focal * valueExtent), 0);
	const min = typeof valAx?.min === 'number' ? valAx.min : auto.min;
	let max = typeof valAx?.max === 'number' ? valAx.max : auto.max;
	if (max <= min) {
		max = min + auto.majorUnit;
	}
	const majorUnit = valAx?.majorUnit && valAx.majorUnit > 0 ? valAx.majorUnit : auto.majorUnit;
	const range = { min, max, majorUnit };

	const categoryX = Array.from(
		{ length: nCat },
		(_, c) => (midCat ? (nCat > 1 ? c / (nCat - 1) : 0.5) : (c + 0.5) * slot) * catExtent,
	);
	const layout: PerspChartLayout = {
		kind,
		grouping,
		view,
		range,
		horizontal,
		valueScale: valueExtent / (max - min),
		categoryX,
		rows,
		rowDepth: rowDepth * depthScale,
		markDepth: markDepth * depthScale,
		colors: perspSeriesColors(chartData, vm),
		gridlines: buildPerspGridlines(box, range, horizontal),
		labels: [],
	};
	const catLabels =
		chartData.categories.length > 0
			? chartData.categories
			: Array.from({ length: nCat }, (_, i) => String(i + 1));
	layout.labels = buildPerspLabels(layout, {
		fontSize: vm.axisLabels[0]?.fontSize ?? 16,
		categories: catLabels,
		seriesNames: rows > 1 ? chartData.series.map((s) => s.name) : [],
		valueAxis: valAx,
		percent: grouping === 'percentStacked',
	});
	return layout;
}
