/**
 * Adapts a `pie3D` chart's `PptxChartData` into the wedge-mesh layout the
 * interactive 3D scene ({@link ./pie-chart-3d-scene.ts}, `mountPieChart3D`)
 * needs to mount: one {@link PieChart3DWedge} per data point, positioned
 * around a shared centre in true 3D space.
 *
 * Colour resolution (`resolveVaryColorFill` / `paletteColor`) and explosion
 * resolution (`resolveDataPointExplosion`) are the SAME functions the flat
 * SVG oblique-projection pie3D engine uses (`buildPieViewModel` in
 * `./chart-view-model.ts`), so a pie3D chart's true-3D and 2D-fallback
 * presentations always agree on colour, value, and pull-out distance: one set
 * of chart maths, two presentations (mirrors {@link ./bar-chart-3d-data.ts}).
 *
 * @module pie-chart-3d-data
 */
import type { ChartPptxElement, PptxChartData, PptxElement } from 'pptx-viewer-core';

import { resolveDataPointExplosion, resolveVaryColorFill } from './chart-datapoint-style';
import { paletteColor } from './chart-view-model';
import type { PieChart3DSliceAngle, PieChart3DView3D } from './pie-chart-3d-geom';
import {
	computePieChart3DSliceAngles,
	computePieChart3DThickness,
	PIE_RADIUS,
} from './pie-chart-3d-geom';

/** One resolved wedge mesh: angle range, explosion offset, colour, and tooltip data. */
export interface PieChart3DWedge extends PieChart3DSliceAngle {
	color: string;
}

/** Inputs the interactive pie3D scene needs to mount. */
export interface PieChart3DSceneOptions {
	wedges: PieChart3DWedge[];
	categoryLabels: ReadonlyArray<string>;
	seriesName: string | undefined;
	numberFormat: string | undefined;
	outerRadius: number;
	thickness: number;
	width: number;
	height: number;
	/** Authored `c:view3D` driving the initial camera + wedge thickness. */
	view3D?: PieChart3DView3D;
}

export interface PieChart3DDataOptions {
	width: number;
	height: number;
}

/**
 * Build the {@link PieChart3DSceneOptions} `mountPieChart3D` needs, or `null`
 * when the chart has no plottable series (no series, or the (only) series has
 * no values).
 */
export function buildPieChart3DData(
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
	options: PieChart3DDataOptions,
): PieChart3DSceneOptions | null {
	const pieSeries = chartData.series[0];
	if (!pieSeries || pieSeries.values.length === 0) {
		return null;
	}

	const values = pieSeries.values;
	const explosions = values.map((_v, i) => resolveDataPointExplosion(pieSeries, i));
	const outerRadius = PIE_RADIUS;
	const angles = computePieChart3DSliceAngles(
		values,
		explosions,
		chartData.firstSliceAngle,
		outerRadius,
	);
	const wedges: PieChart3DWedge[] = angles.map((angle) => ({
		...angle,
		color: resolveVaryColorFill(
			pieSeries,
			angle.pointIndex,
			paletteColor(angle.pointIndex, chartData.colorPalette),
		),
	}));

	const view3D: PieChart3DView3D | undefined = chartData.view3D
		? {
				rotX: chartData.view3D.rotX,
				rotY: chartData.view3D.rotY,
				rperspective: chartData.view3D.perspective,
				rAngAx: chartData.view3D.rAngAx,
				hPercent: chartData.view3D.hPercent,
			}
		: undefined;

	return {
		wedges,
		categoryLabels,
		seriesName: pieSeries.name,
		numberFormat: pieSeries.numberFormat,
		outerRadius,
		thickness: computePieChart3DThickness(view3D),
		width: options.width,
		height: options.height,
		view3D,
	};
}

/**
 * Single decision point every binding calls to decide whether a chart element
 * should mount the interactive 3D pie scene: resolves the category-label
 * fallback (mirrors `buildChartViewModel`'s derivation exactly, so 2D and 3D
 * never disagree about what a category is called) and the wedge layout, in
 * one place.
 *
 * Returns `null` when the element is not a chart, its `c:chartType` is not
 * literally `pie3D` (a plain `pie`/`doughnut` chart never mounts the 3D
 * scene, even though `resolveChartKind` folds them onto the same 'pie'
 * kind), or the chart has no plottable series. A non-null result means
 * "render the WebGL scene"; `null` means "fall back to the flat SVG
 * oblique-projection pie3D renderer".
 */
export function buildPieChart3DDataForElement(
	element: PptxElement,
	options: PieChart3DDataOptions,
): PieChart3DSceneOptions | null {
	if (element.type !== 'chart') {
		return null;
	}
	const chartEl = element as ChartPptxElement;
	const chartData = chartEl.chartData;
	if (!chartData || chartData.series.length === 0) {
		return null;
	}
	if (chartData.chartType !== 'pie3D') {
		return null;
	}

	const pieSeries = chartData.series[0];
	const categoryLabels =
		chartData.categories.length > 0
			? chartData.categories
			: Array.from({ length: pieSeries.values.length }, (_, i) => String(i + 1));

	return buildPieChart3DData(chartData, categoryLabels, options);
}
