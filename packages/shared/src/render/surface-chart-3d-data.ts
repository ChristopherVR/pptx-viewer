/**
 * Adapts a chart's `PptxChartData` into the flat typed-array grid the
 * interactive 3D surface scene ({@link ./surface-chart-3d-scene.ts},
 * `mountSurfaceChart3D`) needs to mount.
 *
 * The SVG surface renderer (`chart-surface-treemap.ts`) and this adapter both
 * normalise values the same way (`computeValueRange` + `surfaceColor`), so the
 * 3D view's colour ramp matches the 2D fallback exactly: one set of chart
 * maths, two presentations.
 *
 * @module surface-chart-3d-data
 */

import type { ChartPptxElement, PptxChartData, PptxElement } from 'pptx-viewer-core';

import { hexToRgb } from './animation-color';
import { resolveSurfaceBandFill } from './chart-surface-bands';
import { surfaceColor } from './chart-surface-treemap';
import { computeValueRange, resolveChartKind } from './chart-view-model';
import type {
	SurfaceChart3DSceneOptions,
	SurfaceChart3DSurfaceColors,
} from './surface-chart-3d-scene';

/** Inputs shared with the 2D surface renderer's sizing/labeling. */
export interface SurfaceChart3DDataOptions {
	width: number;
	height: number;
	/** Draw wireframe grid lines over the surface mesh. Default `true`. */
	wireframe?: boolean;
}

/** `c:floor`/`c:sideWall`/`c:backWall` fill colours the 3D scene can paint. */
function resolveSurfaceColors(chartData: PptxChartData): SurfaceChart3DSurfaceColors | undefined {
	const floor = chartData.floor?.spPr?.fillColor;
	const sideWall = chartData.sideWall?.spPr?.fillColor;
	const backWall = chartData.backWall?.spPr?.fillColor;
	if (!floor && !sideWall && !backWall) {
		return undefined;
	}
	return { floor, sideWall, backWall };
}

/**
 * Build the {@link SurfaceChart3DSceneOptions} `mountSurfaceChart3D` needs from
 * a chart element's data, or `null` when the chart has no plottable grid (no
 * series, or every series has zero categories).
 */
export function buildSurfaceChart3DData(
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
	options: SurfaceChart3DDataOptions,
): SurfaceChart3DSceneOptions | null {
	const seriesCount = chartData.series.length;
	const catCount = categoryLabels.length;
	if (seriesCount === 0 || catCount === 0) {
		return null;
	}

	const range = computeValueRange(chartData.series);
	const heightMap = new Float32Array(seriesCount * catCount);
	const colorMap = new Float32Array(seriesCount * catCount * 3);
	// Raw (un-normalised) values, kept alongside the [0,1] heightMap so the
	// scene's raycast hover tooltip (`surface-chart-3d-hit-test.ts`) can report
	// the authored value rather than its normalised height.
	const values = new Float32Array(seriesCount * catCount);

	for (let row = 0; row < seriesCount; row++) {
		for (let col = 0; col < catCount; col++) {
			const idx = row * catCount + col;
			const val = chartData.series[row]?.values[col] ?? 0;
			values[idx] = val;
			const t = range.span > 0 ? (val - range.min) / range.span : 0;
			heightMap[idx] = t;
			const bandFill = resolveSurfaceBandFill(t, chartData.bandFmts);
			const { r, g, b } = bandFill ? hexToRgb(bandFill) : surfaceColor(t);
			const ci = idx * 3;
			colorMap[ci] = r / 255;
			colorMap[ci + 1] = g / 255;
			colorMap[ci + 2] = b / 255;
		}
	}

	return {
		cols: catCount,
		rows: seriesCount,
		heightMap,
		colorMap,
		values,
		numberFormats: chartData.series.map((s) => s.numberFormat),
		wireframe: options.wireframe ?? true,
		categoryLabels,
		seriesNames: chartData.series.map((s) => s.name),
		width: options.width,
		height: options.height,
		view3D: chartData.view3D
			? { rotX: chartData.view3D.rotX, rotY: chartData.view3D.rotY }
			: undefined,
		surfaceColors: resolveSurfaceColors(chartData),
	};
}

/**
 * Single decision point every binding calls to decide whether a chart element
 * should mount the interactive 3D surface scene: resolves the chart kind, the
 * category-label fallback (mirrors `buildChartViewModel`'s `categoryLabels`
 * derivation exactly, so 2D and 3D never disagree about what a category is
 * called), and the 3D grid, in one place.
 *
 * Returns `null` when the element is not a chart, its kind does not resolve to
 * `surface` (covers both `surface` and `surface3D` `c:chartType`s), or the
 * chart has no plottable grid. Callers gate the 3D scene on this alone; a
 * non-null result means "render the WebGL view", `null` means "fall back to
 * the SVG isometric/flat surface renderer".
 */
export function buildSurfaceChart3DDataForElement(
	element: PptxElement,
	options: SurfaceChart3DDataOptions,
): SurfaceChart3DSceneOptions | null {
	if (element.type !== 'chart') {
		return null;
	}
	const chartEl = element as ChartPptxElement;
	const chartData = chartEl.chartData;
	if (!chartData || chartData.series.length === 0) {
		return null;
	}
	if (resolveChartKind(chartData.chartType ?? 'bar') !== 'surface') {
		return null;
	}

	const longestLen = chartData.series.reduce((m, s) => Math.max(m, s.values.length), 0);
	const categoryLabels =
		chartData.categories.length > 0
			? chartData.categories
			: Array.from({ length: longestLen }, (_, i) => String(i + 1));

	return buildSurfaceChart3DData(chartData, categoryLabels, options);
}
