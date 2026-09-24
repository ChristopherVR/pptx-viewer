/**
 * 2-D top-view grid builder for the surface chart kind (`c:surfaceChart`,
 * PowerPoint's "Contour" / "Wireframe Contour" types), plus the
 * `buildSurfaceViewModel` dispatcher between it and the isometric 3-D
 * builder (`c:surface3DChart`).
 *
 * Split out of `chart-surface-treemap.ts` (which re-exports
 * `buildSurfaceViewModel`) to keep that file's several chart-kind builders
 * each under the repo's per-file line budget.
 *
 * COM-verified against `charts-com.pptx` slides 9-10 (surface types 85/86,
 * "Contour" and "Wireframe Contour"): PowerPoint draws these as a flat,
 * head-on grid of value bands (category axis along the bottom, series axis
 * along the right, no Z axis), never as an isometric projection; a filled
 * band paints the whole cell, a wireframe one draws its outline only.
 *
 * Ported from:
 *   packages/react/src/viewer/utils/chart-surface-treemap.tsx  (renderSurfaceChart)
 *
 * @module chart-surface-flat
 */

import type { PptxChartData, PptxElement } from 'pptx-viewer-core';

import { resolveChartTitleText } from './chart-auto-title';
import { buildSurfaceTopViewAxisLabels } from './chart-surface-axes';
import { buildIsometricSurfaceViewModel } from './chart-surface-isometric';
import {
	buildSurfaceLegend,
	buildSurfaceValueBands,
	surfaceBandColorAt,
} from './chart-surface-legend';
import type { ChartValueDrag, ChartViewModel, SvgPolygon } from './chart-view-model';
import { buildMarkTooltip, computePlotLayout, computeValueRange } from './chart-view-model';

function buildFlatSurfaceViewModel(
	element: PptxElement,
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
): ChartViewModel {
	const layout = computePlotLayout(element.width, element.height, chartData, false);
	const range = computeValueRange(chartData.series, layout.autoPlotHeight);
	const bands = buildSurfaceValueBands(range, chartData.bandFmts);
	const catCount = Math.max(categoryLabels.length, 1);
	const seriesCount = chartData.series.length;
	const cellW = layout.plotWidth / catCount;
	const cellH = layout.plotHeight / Math.max(seriesCount, 1);
	// A wireframe (Excel/PowerPoint "Wireframe Contour") surface draws band
	// outlines only, never a filled cell. Every surface chart PowerPoint itself
	// authors writes `c:wireframe` explicitly (val="0" or "1"; COM-verified
	// against `charts-com.pptx` slides 7-10), so the absent-element case only
	// arises from hand-written XML; this treats it as the filled default, since
	// "surface chart" names a coloured surface and an unfilled default would
	// make the common case look broken.
	const isWireframe = chartData.wireframe === true;

	const primitives: SvgPolygon[] = [];

	for (let si = 0; si < seriesCount; si++) {
		for (let ci = 0; ci < catCount; ci++) {
			const val = chartData.series[si]?.values[ci] ?? 0;
			const t = range.span > 0 ? (val - range.min) / range.span : 0;
			const color = surfaceBandColorAt(bands, t);
			const x = layout.plotLeft + ci * cellW,
				y = layout.plotTop + si * cellH;
			const points = [
				`${x.toFixed(2)},${y.toFixed(2)}`,
				`${(x + cellW).toFixed(2)},${y.toFixed(2)}`,
				`${(x + cellW).toFixed(2)},${(y + cellH).toFixed(2)}`,
				`${x.toFixed(2)},${(y + cellH).toFixed(2)}`,
			].join(' ');
			primitives.push({
				kind: 'polygon',
				points,
				fill: isWireframe ? 'none' : color,
				stroke: isWireframe ? color : 'none',
				strokeWidth: isWireframe ? 1 : 0,
				opacity: isWireframe ? 1 : 0.9,
				part: { role: 'dataPoint', seriesIndex: si, pointIndex: ci },
				title: buildMarkTooltip(
					chartData.series[si]?.name,
					categoryLabels[ci],
					val,
					chartData.series[si]?.numberFormat,
				),
			} satisfies SvgPolygon);
		}
	}

	const legendPos = chartData.style?.legendPosition ?? 'b';
	const { legend, legendX, legendY, legendAnchor } = buildSurfaceLegend(
		bands,
		layout.svgWidth,
		legendPos,
		layout.svgHeight,
		layout.plotTop,
	);

	const title = resolveChartTitleText(chartData);
	const categoryAndSeriesLabels = buildSurfaceTopViewAxisLabels(
		categoryLabels,
		chartData.series,
		layout,
	);

	// One cell per (series, category) already carries an unambiguous single
	// value, so the same vertical drag-to-value path a line/bar mark uses
	// applies directly.
	const valueDrag: ChartValueDrag = {
		range,
		plotTop: layout.plotTop,
		plotBottom: layout.plotBottom,
	};

	return {
		svgWidth: layout.svgWidth,
		svgHeight: layout.svgHeight,
		title,
		titleX: layout.svgWidth / 2,
		titleY: 14,
		gridlines: [],
		axisLabels: [],
		zeroLine: undefined,
		categoryLabels: categoryAndSeriesLabels,
		dataLabels: [],
		primitives,
		legend: chartData.style?.hasLegend ? legend : [],
		legendX,
		legendY,
		legendAnchor,
		valueDrag,
	};
}

/**
 * Build the view-model for a surface chart.
 *
 * Renders the flat, head-on 2-D grid PowerPoint draws for its "Contour" /
 * "Wireframe Contour" top-view types (`chartData.surfaceTopView`), and the
 * isometric 3-D-like projection for its "3-D Surface" / "3-D Surface
 * (Wireframe)" types otherwise. Mirrors `renderSurfaceChart` /
 * `renderIsometricSurfaceFallback` in React's `chart-surface-treemap.tsx`.
 */
export function buildSurfaceViewModel(
	element: PptxElement,
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
): ChartViewModel {
	if (chartData.surfaceTopView) {
		return buildFlatSurfaceViewModel(element, chartData, categoryLabels);
	}
	return buildIsometricSurfaceViewModel(element, chartData, categoryLabels);
}
