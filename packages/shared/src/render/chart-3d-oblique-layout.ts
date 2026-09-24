/**
 * PowerPoint's right-angle-axes (`c:view3D/@rAngAx=1`) 3D bar chart, laid out
 * as a real box in world space and drawn with an oblique projection.
 *
 * Measured against PowerPoint's own COM export of the ground-truth deck
 * (`e2e/fixtures/three-d-parity/gt/chart-01..06.webp`):
 *
 * - The plot is a box `W x H x D`: X along the category axis (value axis for a
 *   horizontal `c:barDir="bar"` chart), Y up, Z receding from the front edge
 *   of the floor. A world point `(x, y, z)` lands on screen at
 *   `(ox + x + z sin(rotY), oy - y - z sin(rotX))`: the front plane is drawn
 *   flat, depth shears up and to the right.
 * - A bar's depth equals its width, and each depth ROW is
 *   `barWidth * (1 + gapDepth / 100)` deep with the bar centred in it. Clustered
 *   and stacked charts have one row; `standard` puts each series on its own
 *   row, series 1 at the front.
 * - Gridlines run along the back wall and along the wall or floor that holds
 *   the value axis; there are no wall fills or outlines.
 * - Value labels sit 13.5pt off the front edge of the value axis; category
 *   (and `standard` series) labels 14pt off theirs.
 * - The value axis has NO headroom: data topping out at exactly 5 gets a 0..5
 *   axis (a 2D chart would get 0..6).
 *
 * The box fills a plot region calibrated from the same exports. PowerPoint
 * sizes a multi-row (`standard`) box slightly smaller than the region; this
 * layout fills it, which draws `gt/chart-04` about 12% taller.
 *
 * @module chart-3d-oblique-layout
 */
import type { PptxChartData, PptxElement } from 'pptx-viewer-core';

import { buildBars, buildGridlines, formatValueLabel } from './chart-3d-oblique-bars';
import {
	buildObliqueLabels,
	OBLIQUE_CATEGORY_LABEL_GAP,
	OBLIQUE_VALUE_LABEL_GAP,
} from './chart-3d-oblique-labels';
import type { ObliqueLabel } from './chart-3d-oblique-labels';
import { axisTargetIntervals, niceValueAxisBounds } from './chart-axis-nice';
import { axisTickValues } from './chart-view-model-chrome';
import type { ChartViewModel } from './chart-view-model-types';
import { estimateTextWidth } from './text-wrap-estimate';

export type { ObliqueLabel } from './chart-3d-oblique-labels';

/** Points to chart px (96 dpi). */
const PT = 4 / 3;
/** Least room left either side of the label + box group. */
const MARGIN_SIDE = 18 * PT;
/** PowerPoint centres the label + box group this far left of the frame centre. */
const GROUP_CENTER_OFFSET = 3 * PT;
/** Front-face height / width of a one-row column box (`gt/chart-01..03`). */
const COLUMN_FRONT_ASPECT = 0.455;
/** Projected height / width of a multi-row (`standard`) column box, depth included (`gt/chart-04`). */
const COLUMN_PROJECTED_ASPECT = 0.476;
/** Category extent / value extent of a horizontal bar chart's box (`gt/chart-05..06`). */
const HORIZONTAL_ASPECT = 0.483;
const TOP_WITH_TITLE = 46.5 * PT;
const TOP_NO_TITLE = 14 * PT;
const BOTTOM_WITH_LEGEND = 57.5 * PT;
const BOTTOM_NO_LEGEND = 31 * PT;

const DEFAULT_GAP_WIDTH = 150;
const DEFAULT_GAP_DEPTH = 150;

/** One bar as a world-space box. */
export interface ObliqueBar {
	x: number;
	y: number;
	z: number;
	/** Extent along world X / Y / Z. */
	w: number;
	h: number;
	d: number;
	color: string;
	seriesIndex: number;
	categoryIndex: number;
	value: number;
}

/** A gridline segment in world space. */
export interface ObliqueGridline {
	from: readonly [number, number, number];
	to: readonly [number, number, number];
}

export interface ObliqueChartLayout {
	horizontal: boolean;
	grouping: 'clustered' | 'stacked' | 'percentStacked' | 'standard';
	/** Chart px of world (0, 0, 0): the front-bottom-left corner of the floor. */
	origin: { x: number; y: number };
	/** Screen shift per world unit of depth: `(sin rotY, -sin rotX)`. */
	shear: { x: number; y: number };
	box: { w: number; h: number; d: number };
	range: { min: number; max: number; majorUnit: number };
	/** Chart px per value unit along the value axis. */
	valueScale: number;
	bars: ObliqueBar[];
	gridlines: ObliqueGridline[];
	labels: ObliqueLabel[];
}

/** Chart px of a world point. */
export function obliqueToScreen(
	layout: Pick<ObliqueChartLayout, 'origin' | 'shear'>,
	p: readonly [number, number, number],
): { x: number; y: number } {
	return {
		x: layout.origin.x + p[0] + p[2] * layout.shear.x,
		y: layout.origin.y - p[1] + p[2] * layout.shear.y,
	};
}

type Grouping = ObliqueChartLayout['grouping'];

function resolveGrouping(chartData: PptxChartData): Grouping {
	const g = chartData.grouping;
	if (g === 'stacked' || g === 'percentStacked') {
		return g;
	}
	return chartData.groupingStandard ? 'standard' : 'clustered';
}

/** Data extent along the value axis, per grouping. */
function dataExtent(chartData: PptxChartData, grouping: Grouping, nCat: number): [number, number] {
	if (grouping === 'percentStacked') {
		return [0, 1];
	}
	let lo = 0;
	let hi = 0;
	for (let c = 0; c < nCat; c++) {
		let pos = 0;
		let neg = 0;
		for (const s of chartData.series) {
			const v = s.values[c] ?? 0;
			if (grouping === 'stacked') {
				if (v >= 0) {
					pos += v;
				} else {
					neg += v;
				}
			} else {
				hi = Math.max(hi, v);
				lo = Math.min(lo, v);
			}
		}
		hi = Math.max(hi, pos);
		lo = Math.min(lo, neg);
	}
	return [lo, hi];
}

function valueRange(
	chartData: PptxChartData,
	grouping: Grouping,
	nCat: number,
	valueLengthPx: number,
): ObliqueChartLayout['range'] {
	const axis = chartData.axes?.find((a) => a.axisType === 'valAx');
	const [lo, hi] = dataExtent(chartData, grouping, nCat);
	const auto = niceValueAxisBounds(lo, hi, axisTargetIntervals(valueLengthPx), 0);
	const min = typeof axis?.min === 'number' ? axis.min : auto.min;
	let max = typeof axis?.max === 'number' ? axis.max : auto.max;
	if (max <= min) {
		max = min + auto.majorUnit;
	}
	const majorUnit = axis?.majorUnit && axis.majorUnit > 0 ? axis.majorUnit : auto.majorUnit;
	return { min, max, majorUnit };
}

/** The resolved oblique layout for a `bar3D` chart element, or `null`. */
export function computeObliqueBarLayout(
	element: PptxElement,
	vm: ChartViewModel,
): ObliqueChartLayout | null {
	if (element.type !== 'chart' || !element.chartData) {
		return null;
	}
	const chartData = element.chartData;
	const nSer = chartData.series.length;
	const nCat = chartData.series.reduce((m, s) => Math.max(m, s.values.length), 0);
	if (nSer === 0 || nCat === 0) {
		return null;
	}
	const horizontal = chartData.barDirection === 'bar';
	const grouping = resolveGrouping(chartData);
	const rotX = ((chartData.view3D?.rotX ?? 15) * Math.PI) / 180;
	const rotY = ((chartData.view3D?.rotY ?? 20) * Math.PI) / 180;
	const shear = { x: Math.sin(rotY), y: -Math.sin(rotX) };
	const gapWidth = (chartData.barGapWidth ?? DEFAULT_GAP_WIDTH) / 100;
	const gapDepth = (chartData.gapDepth ?? DEFAULT_GAP_DEPTH) / 100;
	const slots = grouping === 'clustered' ? nSer : 1;
	const rows = grouping === 'standard' ? nSer : 1;

	const labelFont = vm.axisLabels[0]?.fontSize ?? 16;
	const catLabels =
		chartData.categories.length > 0
			? chartData.categories
			: Array.from({ length: nCat }, (_, i) => String(i + 1));
	const widest = (texts: readonly string[]): number =>
		texts.reduce((m, t) => Math.max(m, estimateTextWidth(t, labelFont)), 0);

	// Vertical band the projected box fills.
	const top = vm.title ? TOP_WITH_TITLE : TOP_NO_TITLE;
	const hasBottomLegend =
		chartData.style?.hasLegend !== false && (chartData.style?.legendPosition ?? 'b') === 'b';
	const bottom = vm.svgHeight - (hasBottomLegend ? BOTTOM_WITH_LEGEND : BOTTOM_NO_LEGEND);
	const regionH = Math.max(1, bottom - top);
	// Value labels are measured on a provisional axis; their width only moves
	// the box by a few px.
	const provisional = valueRange(chartData, grouping, nCat, regionH);
	const valueTexts = axisTickValues({
		...provisional,
		span: provisional.max - provisional.min,
	}).map((v) => formatValueLabel(chartData, grouping, v));
	const leftBand =
		(horizontal ? widest(catLabels) : widest(valueTexts)) +
		(horizontal ? OBLIQUE_CATEGORY_LABEL_GAP : OBLIQUE_VALUE_LABEL_GAP);
	const seriesLabelW =
		grouping === 'standard' && !horizontal ? widest(chartData.series.map((s) => s.name)) : 0;
	// Series labels sit off each depth row's centre along the right edge, so
	// they reach past the box's back-right corner only by what the last half
	// row does not cover.
	const seriesOverhang = (depth: number): number =>
		seriesLabelW > 0
			? Math.max(0, OBLIQUE_CATEGORY_LABEL_GAP + seriesLabelW - (depth * shear.x) / (2 * rows))
			: 0;

	// Size from the height and the front face's aspect, then cap by width.
	const depthPerCat = (rows * (1 + gapDepth)) / (nCat * (slots + gapWidth));
	const sinX = -shear.y;
	const maxGroup = vm.svgWidth - 2 * MARGIN_SIDE;
	let catExtent: number;
	let valueExtent: number;
	if (horizontal) {
		catExtent = regionH / (1 + depthPerCat * sinX);
		valueExtent = catExtent / HORIZONTAL_ASPECT;
		const widthFor = (v: number, c: number): number => leftBand + v + c * depthPerCat * shear.x;
		if (widthFor(valueExtent, catExtent) > maxGroup) {
			const scale = (maxGroup - leftBand) / (valueExtent + catExtent * depthPerCat * shear.x);
			catExtent *= scale;
			valueExtent *= scale;
		}
	} else {
		// Empirical, from PowerPoint's exports: a one-row box keeps its FRONT
		// face at a fixed aspect (`gt/chart-01..03`, within 1%); a multi-row
		// `standard` box instead keeps its whole projected outline at one
		// (`gt/chart-04`'s width to within 0.5%; its height still comes out
		// about 12% taller than PowerPoint's).
		if (rows === 1) {
			catExtent = regionH / (COLUMN_FRONT_ASPECT + depthPerCat * sinX);
		} else {
			catExtent = regionH / COLUMN_PROJECTED_ASPECT / (1 + depthPerCat * shear.x);
		}
		const boxWidth = catExtent * (1 + depthPerCat * shear.x);
		const overhang = seriesOverhang(catExtent * depthPerCat);
		if (leftBand + boxWidth + overhang > maxGroup) {
			catExtent *= (maxGroup - leftBand - overhang) / boxWidth;
		}
		valueExtent = Math.min(
			regionH - catExtent * depthPerCat * sinX,
			rows === 1 ? catExtent * COLUMN_FRONT_ASPECT : Number.POSITIVE_INFINITY,
		);
	}
	const depth = catExtent * depthPerCat;
	const projectedW = (horizontal ? valueExtent : catExtent) + depth * shear.x;
	const projectedH = (horizontal ? catExtent : valueExtent) + depth * sinX;
	const groupW = leftBand + projectedW + seriesOverhang(depth);
	const left = vm.svgWidth / 2 - GROUP_CENTER_OFFSET - groupW / 2 + leftBand;
	// Centre vertically in the band when the width cap made the box shorter.
	const bottomEdge = bottom - (regionH - projectedH) / 2;
	const range = valueRange(chartData, grouping, nCat, valueExtent);
	const valueScale = valueExtent / (range.max - range.min);
	const origin = { x: left, y: bottomEdge };
	const box = horizontal
		? { w: valueExtent, h: catExtent, d: depth }
		: { w: catExtent, h: valueExtent, d: depth };
	const layout: ObliqueChartLayout = {
		horizontal,
		grouping,
		origin,
		shear,
		box,
		range,
		valueScale,
		bars: [],
		gridlines: [],
		labels: [],
	};
	layout.bars = buildBars(chartData, vm, layout, { nCat, slots, rows, gapWidth, gapDepth });
	layout.gridlines = buildGridlines(layout);
	layout.labels = buildObliqueLabels(layout, {
		fontSize: labelFont,
		categories: catLabels,
		seriesNames: chartData.series.map((s) => s.name),
		valueText: (v) => formatValueLabel(chartData, grouping, v),
	});
	return layout;
}
