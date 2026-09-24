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

import { computeDepthVector } from './chart-3d-depth';
import type { Chart3DProjection } from './chart-3d-projection';
import { resolveChart3DProjection } from './chart-3d-projection';
import { buildChartViewModel } from './chart-view-model-build';
import type { ChartViewModel, SvgRect } from './chart-view-model-types';

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

/** `null` until a chart type/grouping's true-3D geometry is implemented; the scene falls back to the flat 2D render. */
export type Chart3DGeometry = Chart3DBarGeometry | null;

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
 * Build the `bar3D` box geometry from the flat 2D view-model's own front-face
 * rectangles. Returns `null` when the chart's grouping/direction is not yet
 * modelled (`standard` grouping, or a horizontal `c:barDir val="bar"` chart)
 * so the caller falls back to the flat 2D render instead of a wrong one.
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
		boxes.push({
			x: rect.x,
			y: rect.y,
			w: rect.w,
			h: rect.h,
			color: rect.fill,
			seriesIndex,
			categoryIndex: rect.part?.pointIndex ?? 0,
			shape: resolveBoxShape(chartData, seriesIndex),
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
	return {
		element,
		width: element.width,
		height: element.height,
		chartType,
		projection,
		vm,
		geometry,
	};
}
