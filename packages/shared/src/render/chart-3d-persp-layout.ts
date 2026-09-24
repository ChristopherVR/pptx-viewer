/**
 * PowerPoint's perspective 3D chart layout (`c:view3D/@rAngAx=0`) for the
 * cartesian families (line3D, area3D, surface3D): the plot box, the camera
 * that frames it (`chart-3d-persp-view.ts`), the value axis, where each
 * category and depth row sits, and the wall gridlines.
 *
 * Calibrated against `gt/chart-10..13,16`:
 *
 * - The box is 1 unit wide (categories), `BOX_HEIGHT` tall and one category
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

import { buildPerspLabels } from './chart-3d-persp-labels';
import type { PerspLabel } from './chart-3d-persp-labels';
import { fitPerspView, perspCameraFor } from './chart-3d-persp-view';
import type { PerspView } from './chart-3d-persp-view';
import { axisTargetIntervals, niceValueAxisBounds } from './chart-axis-nice';
import { axisTickValues } from './chart-view-model-chrome';
import type { ChartViewModel } from './chart-view-model-types';

export type { PerspLabel } from './chart-3d-persp-labels';

/** Points to chart px (96 dpi). */
const PT = 4 / 3;
/** Box height per unit of width (fitted 0.36 on three of four exports). */
const BOX_HEIGHT = 0.36;
const RECT_LEFT = 48 * PT;
const RECT_RIGHT = 60 * PT;
const RECT_TOP_WITH_TITLE = 48 * PT;
const RECT_TOP_NO_TITLE = 14 * PT;
const RECT_BOTTOM_WITH_LEGEND = 62 * PT;
const RECT_BOTTOM_NO_LEGEND = 31 * PT;
const DEFAULT_GAP = 150;

export type PerspKind = 'line' | 'area' | 'surface';
export type PerspGrouping = 'standard' | 'stacked' | 'percentStacked';

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
	/** Box units per value unit. */
	valueScale: number;
	/** Box x of each category. */
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
		default:
			return null;
	}
}

function groupingOf(kind: PerspKind, chartData: PptxChartData): PerspGrouping {
	const g = chartData.grouping;
	if (kind === 'area' && (g === 'stacked' || g === 'percentStacked')) {
		return g;
	}
	return 'standard';
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
	const grouping = groupingOf(kind, chartData);
	const valAx = chartData.axes?.find((a) => a.axisType === 'valAx');
	const midCat = (valAx?.crossBetween ?? (kind === 'line' ? 'between' : 'midCat')) === 'midCat';
	const view3D = chartData.view3D;

	const gapWidth = (chartData.barGapWidth ?? DEFAULT_GAP) / 100;
	const gapDepth = (chartData.gapDepth ?? DEFAULT_GAP) / 100;
	const slot = 1 / nCat;
	const rows = kind === 'surface' ? nSer : grouping === 'standard' ? nSer : 1;
	const markDepth = slot / (1 + gapWidth);
	const rowDepth = markDepth * (1 + gapDepth);
	const depthScale = (view3D?.depthPercent ?? 100) / 100;
	const d = rows * rowDepth * depthScale;
	const h = BOX_HEIGHT * ((view3D?.hPercent ?? 100) / 100);

	const camera = perspCameraFor(
		{ w: 1, h, d },
		view3D?.rotX ?? 15,
		view3D?.rotY ?? 20,
		view3D?.perspective ?? undefined,
	);
	const hasLegend =
		chartData.style?.hasLegend !== false && (chartData.style?.legendPosition ?? 'b') === 'b';
	const view = fitPerspView(camera, {
		left: RECT_LEFT,
		right: vm.svgWidth - RECT_RIGHT,
		top: vm.title ? RECT_TOP_WITH_TITLE : RECT_TOP_NO_TITLE,
		bottom: vm.svgHeight - (hasLegend ? RECT_BOTTOM_WITH_LEGEND : RECT_BOTTOM_NO_LEGEND),
	});

	const [lo, hi] = dataExtent(chartData, grouping, nCat);
	const auto = niceValueAxisBounds(lo, hi, axisTargetIntervals(view.focal * h), 0);
	const min = typeof valAx?.min === 'number' ? valAx.min : auto.min;
	let max = typeof valAx?.max === 'number' ? valAx.max : auto.max;
	if (max <= min) {
		max = min + auto.majorUnit;
	}
	const majorUnit = valAx?.majorUnit && valAx.majorUnit > 0 ? valAx.majorUnit : auto.majorUnit;
	const range = { min, max, majorUnit };

	const categoryX = Array.from({ length: nCat }, (_, c) =>
		midCat ? (nCat > 1 ? c / (nCat - 1) : 0.5) : (c + 0.5) * slot,
	);
	const layout: PerspChartLayout = {
		kind,
		grouping,
		view,
		range,
		valueScale: h / (max - min),
		categoryX,
		rows,
		rowDepth: rowDepth * depthScale,
		markDepth: markDepth * depthScale,
		colors: perspSeriesColors(chartData, vm),
		gridlines: buildGridlines(view, range, h),
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

function buildGridlines(
	view: PerspView,
	range: PerspChartLayout['range'],
	h: number,
): PerspGridline[] {
	const { w, d } = view.box;
	const lines: PerspGridline[] = [
		{ from: [0, 0, 0], to: [w, 0, 0] },
		{ from: [w, 0, 0], to: [w, 0, d] },
	];
	const span = range.max - range.min;
	for (const v of axisTickValues({ ...range, span })) {
		const y = ((v - range.min) / span) * h;
		lines.push({ from: [0, y, 0], to: [0, y, d] }, { from: [0, y, d], to: [w, y, d] });
	}
	return lines;
}
