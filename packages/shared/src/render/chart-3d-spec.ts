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

import { buildAreaChart3DDataForElement } from './area-chart-3d-data';
import type { AreaChart3DSceneOptions } from './area-chart-3d-data';
import { buildBarChart3DDataForElement } from './bar-chart-3d-data';
import type { BarChart3DSceneOptions } from './bar-chart-3d-data';
import { computeObliqueBarLayout } from './chart-3d-oblique-layout';
import type { ObliqueChartLayout } from './chart-3d-oblique-layout';
import { computePerspChartLayout } from './chart-3d-persp-layout';
import type { PerspChartLayout } from './chart-3d-persp-layout';
import type { Chart3DProjection } from './chart-3d-projection';
import { resolveChart3DProjection } from './chart-3d-projection';
import { buildChartViewModel } from './chart-view-model-build';
import type { ChartViewModel } from './chart-view-model-types';
import { buildLineChart3DDataForElement } from './line-chart-3d-data';
import type { LineChart3DSceneOptions } from './line-chart-3d-data';
import { buildPieChart3DDataForElement } from './pie-chart-3d-data';
import type { PieChart3DSceneOptions } from './pie-chart-3d-data';
import { buildSurfaceChart3DDataForElement } from './surface-chart-3d-data';
import type { SurfaceChart3DSceneOptions } from './surface-chart-3d-scene';

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

/** `null` until a chart type's geometry is implemented; the scene then uses {@link Chart3DSpec.perspective}. */
export type Chart3DGeometry = Chart3DObliqueGeometry | Chart3DPerspGeometry | null;

/**
 * The perspective scene a chart falls back to when the oblique geometry does
 * not cover it (line/area/pie/surface, and a bar3D chart without right-angle
 * axes). Each is a hosted scene module from the
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

/**
 * Build the right-angle-axes `bar3D` geometry: every grouping, direction and
 * `c:shape` (`chart-3d-oblique-layout.ts`, `chart-3d-oblique-shape-mesh.ts`).
 */
function buildBarGeometry(element: PptxElement, vm: ChartViewModel): Chart3DGeometry {
	const layout = computeObliqueBarLayout(element, vm);
	return layout && layout.bars.length > 0 ? { kind: 'oblique', layout } : null;
}

/** Chart types drawn on the perspective box layout. */
const PERSP_BOX_TYPES: ReadonlySet<string> = new Set(['line3D', 'area3D', 'surface']);

function buildPerspGeometry(element: PptxElement, vm: ChartViewModel): Chart3DGeometry {
	const layout = computePerspChartLayout(element, vm);
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
			: projection.mode === 'perspective' && PERSP_BOX_TYPES.has(chartType)
				? buildPerspGeometry(element, vm)
				: null;
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
