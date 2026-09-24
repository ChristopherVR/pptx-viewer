/**
 * The pure, three-free description of a 3D chart that `<pptx-three-view>`
 * mounts (`kind: 'chart'`). Built from a chart element by
 * `buildChart3DSpecForElement`; consumed by `chart-3d-view-scene.ts`.
 *
 * The spec is deliberately built ON TOP of the existing flat 2D chart engine
 * (`buildChartViewModel`) rather than beside it: for a `bar3D` chart with
 * PowerPoint's own default `c:view3D/@rAngAx=1` (an oblique, not perspective,
 * projection - see `chart-3d-projection.ts`), the flat 2D fallback's plot
 * (gridlines, axis ticks, title, legend) is ALREADY pixel-correct and
 * perfectly undistorted (verified against `gt/chart-01.webp`), and its
 * `bar` cartesian layout already gets category/series positioning, gap
 * width and stacking exactly right. This spec reuses that chrome and those
 * front-face rectangles directly; `chart-3d-view-scene.ts` only has to draw
 * REAL boxes (instead of flat 2D parallelograms) behind the SAME chrome.
 *
 * @module chart-3d-spec
 */
import type {
	ChartPptxElement,
	PptxBar3DShape,
	PptxChartData,
	PptxElement,
} from 'pptx-viewer-core';

import { buildAreaChart3DDataForElement } from './area-chart-3d-data';
import type { AreaChart3DSceneOptions } from './area-chart-3d-data';
import { buildBarChart3DDataForElement } from './bar-chart-3d-data';
import type { BarChart3DSceneOptions } from './bar-chart-3d-data';
import { computeDepthVector } from './chart-3d-depth';
import type { Chart3DProjection } from './chart-3d-projection';
import { resolveChart3DProjection } from './chart-3d-projection';
import { buildChartViewModel } from './chart-view-model-build';
import type { ChartViewModel, SvgRect } from './chart-view-model-types';
import { buildLineChart3DDataForElement } from './line-chart-3d-data';
import type { LineChart3DSceneOptions } from './line-chart-3d-data';
import { buildPieChart3DDataForElement } from './pie-chart-3d-data';
import type { PieChart3DSceneOptions } from './pie-chart-3d-data';
import { buildSurfaceChart3DDataForElement } from './surface-chart-3d-data';
import type { SurfaceChart3DSceneOptions } from './surface-chart-3d-scene';

/** The chart types the 3D chart scene renders (a `surface` chart is 3D only when `chartData.view3D` is set; see below). */
export const CHART_3D_TYPES: ReadonlySet<string> = new Set([
	'bar3D',
	'line3D',
	'area3D',
	'pie3D',
	'surface',
]);

/**
 * One `bar3D` box: front-face rectangle in the flat 2D view-model's own SVG
 * pixel space (already gap-width/clustering/stacking-correct), extruded
 * backward in world Z by `depthMagnitude`.
 */
export interface Chart3DBarBox {
	x: number;
	y: number;
	w: number;
	h: number;
	color: string;
	seriesIndex: number;
	categoryIndex: number;
	/** The point's authored value (hover tooltip, drag start). */
	value: number;
	shape: PptxBar3DShape | undefined;
	/**
	 * World-Z extrusion depth (SVG px units), the SAME quantity the flat 2D
	 * fallback's `chart-3d-depth.ts#computeDepthVector` uses for its
	 * `magnitude`. Every box in a supported (`clustered` / `stacked` /
	 * `percentStacked`) grouping shares one chart-wide depth: those groupings
	 * keep every series COPLANAR (one Z plane), matching PowerPoint's own
	 * `gt/chart-01.webp` (no visible per-series depth separation). `standard`
	 * grouping (each series its own full depth ROW, see `gt/chart-04.webp`)
	 * is NOT yet modelled; see the chart track's progress log.
	 */
	depthMagnitude: number;
}

export interface Chart3DBarGeometry {
	kind: 'bar';
	boxes: readonly Chart3DBarBox[];
}

/** `null` until a chart type/grouping's oblique geometry is implemented; the scene then uses {@link Chart3DSpec.perspective}. */
export type Chart3DGeometry = Chart3DBarGeometry | null;

/**
 * The perspective scene a chart falls back to when the oblique geometry does
 * not cover it yet (line/area/pie/surface, and bar3D's `standard` grouping,
 * horizontal bars and round shapes). Each is a hosted scene module from the
 * pre-`<pptx-three-view>` renderer, now drawn through the shared renderer.
 */
export type Chart3DPerspectiveScene =
	| { kind: 'bar'; options: BarChart3DSceneOptions }
	| { kind: 'line'; options: LineChart3DSceneOptions }
	| { kind: 'area'; options: AreaChart3DSceneOptions }
	| { kind: 'pie'; options: PieChart3DSceneOptions }
	| { kind: 'surface'; options: SurfaceChart3DSceneOptions };

export interface Chart3DSpec {
	/** The chart element the spec was built from (identity drives remounts). */
	element: PptxElement;
	width: number;
	height: number;
	chartType: string;
	projection: Chart3DProjection;
	/**
	 * The full flat 2D view-model, reused for chrome (title, legend, axis
	 * ticks, gridlines, area/plot fill). The scene draws these via
	 * `chart-view-model-dom.ts`'s piece renderers and skips `vm.primitives`/
	 * `vm.dataLabels` (the flat oblique bars/extrusion), replacing them with
	 * real WebGL geometry from `geometry`.
	 */
	vm: ChartViewModel;
	geometry: Chart3DGeometry;
	/** Category labels (authored, or 1..n when the chart has none). */
	categoryLabels: readonly string[];
	/** The perspective scene used when `geometry` is `null`; `null` when neither applies (the 2D fallback stays). */
	perspective: Chart3DPerspectiveScene | null;
}

const SUPPORTED_BAR_GROUPINGS: ReadonlySet<string> = new Set([
	'clustered',
	'stacked',
	'percentStacked',
]);

/** Resolve a box's `c:bar3DChart/c:shape`, overridden per-series by `c:ser/c:shape`. */
function resolveBoxShape(
	chartData: PptxChartData,
	seriesIndex: number,
): PptxBar3DShape | undefined {
	return chartData.series[seriesIndex]?.shape ?? chartData.barShape;
}

/**
 * `c:shape` values this pass renders as a true 3D box (the ONLY shape
 * visually verified against ground truth so far: `gt/chart-01.webp`'s
 * thin, subtly-beveled columns). `cylinder`/`cone`/`pyramid` (gt/chart-07..09)
 * are a materially different PowerPoint convention (a genuinely round,
 * full-width volume, not a thin oblique bevel - see the chart track's
 * progress log) and are deliberately NOT modelled yet; a chart using them
 * falls back to the flat 2D render rather than an unverified guess.
 */
function isSupportedBoxShape(shape: PptxBar3DShape | undefined): boolean {
	return shape === undefined || shape === 'box';
}

/**
 * Build the `bar3D` box geometry from the flat 2D view-model's own front-face
 * rectangles. Returns `null` when the chart's grouping/direction/shape is not
 * yet modelled (`standard` grouping, a horizontal `c:barDir val="bar"` chart,
 * or a non-`box` `c:shape`) so the caller falls back to the flat 2D render
 * instead of a wrong or unverified one.
 */
function buildBarGeometry(vm: ChartViewModel, chartData: PptxChartData): Chart3DGeometry {
	const grouping = chartData.grouping ?? 'clustered';
	if (!SUPPORTED_BAR_GROUPINGS.has(grouping) || chartData.barDirection === 'bar') {
		return null;
	}
	const depthMagnitude = computeDepthVector(chartData.view3D).magnitude;
	const boxes: Chart3DBarBox[] = [];
	for (const prim of vm.primitives) {
		if (prim.kind !== 'rect' || prim.part?.role !== 'dataPoint') {
			continue;
		}
		const rect = prim as SvgRect;
		const seriesIndex = rect.part?.seriesIndex ?? 0;
		const shape = resolveBoxShape(chartData, seriesIndex);
		if (!isSupportedBoxShape(shape)) {
			return null;
		}
		boxes.push({
			x: rect.x,
			y: rect.y,
			w: rect.w,
			h: rect.h,
			color: rect.fill,
			seriesIndex,
			categoryIndex: rect.part?.pointIndex ?? 0,
			value: chartData.series[seriesIndex]?.values[rect.part?.pointIndex ?? 0] ?? 0,
			shape,
			depthMagnitude,
		});
	}
	if (boxes.length === 0) {
		return null;
	}
	return { kind: 'bar', boxes };
}

/** Whether `chartType` is a 3D chart PowerPoint would ever render through `c:view3D`. */
function is3DChartType(chartType: string, view3D: unknown): boolean {
	if (chartType === 'surface') {
		// c:surfaceChart (2D, top-view only) and c:surface3DChart both parse to
		// chartType 'surface'; core sets chartData.view3D only when the chart
		// XML has a c:view3D element at all, which a 2D top-view surface never
		// does. See the chart track's progress log for the caveat that this
		// hasn't been verified against a real 2D top-view fixture.
		return view3D !== undefined;
	}
	return CHART_3D_TYPES.has(chartType);
}

/** Build the 3D spec for a chart element, or `null` when it is not a 3D chart. */
export function buildChart3DSpecForElement(element: PptxElement): Chart3DSpec | null {
	if (element.type !== 'chart') {
		return null;
	}
	const chartEl = element as ChartPptxElement;
	const chartData = chartEl.chartData;
	const chartType = chartData?.chartType ?? '';
	if (!chartData || !is3DChartType(chartType, chartData.view3D)) {
		return null;
	}
	const vm = buildChartViewModel(element);
	const projection = resolveChart3DProjection(chartType, chartData.view3D);
	const geometry = chartType === 'bar3D' ? buildBarGeometry(vm, chartData) : null;
	const longest = chartData.series.reduce((m, series) => Math.max(m, series.values.length), 0);
	const categoryLabels =
		chartData.categories.length > 0
			? chartData.categories
			: Array.from({ length: longest }, (_, i) => String(i + 1));
	return {
		element,
		width: element.width,
		height: element.height,
		chartType,
		projection,
		vm,
		geometry,
		categoryLabels,
		perspective: geometry ? null : buildPerspectiveScene(element),
	};
}

/** The perspective scene for a chart the oblique geometry does not cover, or `null`. */
function buildPerspectiveScene(element: PptxElement): Chart3DPerspectiveScene | null {
	const size = { width: element.width, height: element.height };
	switch ((element as ChartPptxElement).chartData?.chartType) {
		case 'bar3D': {
			const options = buildBarChart3DDataForElement(element, size);
			return options ? { kind: 'bar', options } : null;
		}
		case 'line3D': {
			const options = buildLineChart3DDataForElement(element, size);
			return options ? { kind: 'line', options } : null;
		}
		case 'area3D': {
			const options = buildAreaChart3DDataForElement(element, size);
			return options ? { kind: 'area', options } : null;
		}
		case 'pie3D': {
			const options = buildPieChart3DDataForElement(element, size);
			return options ? { kind: 'pie', options } : null;
		}
		case 'surface': {
			const options = buildSurfaceChart3DDataForElement(element, size);
			return options ? { kind: 'surface', options } : null;
		}
		default:
			return null;
	}
}
