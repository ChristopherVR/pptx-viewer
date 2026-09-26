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
import type { ChartPptxElement, PptxElement } from 'pptx-viewer-core';

import { computeObliqueBarLayout } from './chart-3d-oblique-layout';
import type { ObliqueChartLayout } from './chart-3d-oblique-layout';
import { computePerspChartLayout } from './chart-3d-persp-layout';
import type { PerspChartLayout } from './chart-3d-persp-layout';
import { computePieChartLayout, widenPieViewModel } from './chart-3d-pie-layout';
import type { PieChartLayout } from './chart-3d-pie-layout';
import type { Chart3DProjection } from './chart-3d-projection';
import { resolveChart3DProjection } from './chart-3d-projection';
import { buildChartViewModel } from './chart-view-model-build';
import type { ChartViewModel } from './chart-view-model-types';

/** The chart types the 3D chart scene renders (`surface` covers the 2D and 3D surface charts; see below). */
export const CHART_3D_TYPES: ReadonlySet<string> = new Set([
	'bar3D',
	'line3D',
	'area3D',
	'pie3D',
	'surface',
]);

/**
 * A right-angle-axes `bar3D` chart laid out as a real box in world space
 * (walls, gridlines, bars, axis labels); see `chart-3d-oblique-layout.ts`.
 */
export interface Chart3DObliqueGeometry {
	kind: 'oblique';
	layout: ObliqueChartLayout;
}

/** A perspective (`rAngAx=0`) line / area chart on PowerPoint's box (`chart-3d-persp-layout.ts`). */
export interface Chart3DPerspGeometry {
	kind: 'perspective';
	layout: PerspChartLayout;
}

/** A 3-D Pie on PowerPoint's fitted perspective camera (`chart-3d-pie-layout.ts`). */
export interface Chart3DPieGeometry {
	kind: 'pie';
	layout: PieChartLayout;
}

/** A chart's 3D geometry; `null` when it has nothing to draw (no series or categories). */
export type Chart3DGeometry =
	| Chart3DObliqueGeometry
	| Chart3DPerspGeometry
	| Chart3DPieGeometry
	| null;

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
}

/**
 * Build the right-angle-axes `bar3D` geometry: every grouping, direction and
 * `c:shape` (`chart-3d-oblique-layout.ts`, `chart-3d-oblique-shape-mesh.ts`).
 */
function buildBarGeometry(element: PptxElement, vm: ChartViewModel): Chart3DGeometry {
	const layout = computeObliqueBarLayout(element, vm);
	return layout && layout.bars.length > 0 ? { kind: 'oblique', layout } : null;
}

/** Chart types drawn on the perspective box layout. */
const PERSP_BOX_TYPES: ReadonlySet<string> = new Set(['line3D', 'area3D', 'surface', 'bar3D']);

function buildPieGeometry(element: PptxElement, vm: ChartViewModel): Chart3DGeometry {
	const layout = computePieChartLayout(element, widenPieViewModel(vm, element));
	return layout ? { kind: 'pie', layout } : null;
}

function buildPerspGeometry(
	element: PptxElement,
	vm: ChartViewModel,
	oblique: boolean,
): Chart3DGeometry {
	const layout = computePerspChartLayout(element, vm, { oblique });
	return layout ? { kind: 'perspective', layout } : null;
}

/**
 * Whether `chartType` has a 3D scene. `surface` covers both `c:surfaceChart`
 * (PowerPoint draws it as a flat top view) and `c:surface3DChart`: the
 * published `surfaceChart3D` opt-in has always meant "render every surface
 * chart in 3D", so both get the perspective surface scene.
 */
function is3DChartType(chartType: string): boolean {
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
	if (!chartData || !is3DChartType(chartType)) {
		return null;
	}
	const vm = buildChartViewModel(element);
	const projection = resolveChart3DProjection(chartType, chartData.view3D);
	const geometry =
		chartType === 'bar3D' && projection.mode === 'oblique'
			? buildBarGeometry(element, vm)
			: PERSP_BOX_TYPES.has(chartType) &&
				  (projection.mode === 'perspective' || chartType !== 'bar3D')
				? buildPerspGeometry(element, vm, projection.mode === 'oblique')
				: chartType === 'pie3D'
					? buildPieGeometry(element, vm)
					: null;
	if (!geometry) {
		// Nothing to draw in 3D (no series or categories): the 2D chart stays.
		return null;
	}
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
	};
}
