/**
 * Flat colour-mapped grid view-model builder for the surface chart kind (the
 * fallback used when the grid has fewer than 2 series or 2 categories), plus
 * the `buildSurfaceViewModel` dispatcher between it and the isometric builder.
 *
 * Split out of `chart-surface-treemap.ts` (which re-exports
 * `buildSurfaceViewModel`) to keep that file's several chart-kind builders
 * each under the repo's per-file line budget.
 *
 * Ported from:
 *   packages/react/src/viewer/utils/chart-surface-treemap.tsx  (renderSurfaceChart)
 *
 * @module chart-surface-flat
 */

import type { PptxChartData, PptxElement } from 'pptx-viewer-core';

import { resolveSurfaceBandFill } from './chart-surface-bands';
import { emptyChrome, surfaceColor } from './chart-surface-common';
import { buildIsometricSurfaceViewModel } from './chart-surface-isometric';
import type { ChartValueDrag, ChartViewModel, SvgRect } from './chart-view-model';
import {
	buildLegend,
	buildMarkTooltip,
	computePlotLayout,
	computeValueRange,
} from './chart-view-model';

function buildFlatSurfaceViewModel(
	element: PptxElement,
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
): ChartViewModel {
	const layout = computePlotLayout(element.width, element.height, chartData, false);
	const range = computeValueRange(chartData.series);
	const catCount = Math.max(categoryLabels.length, 1);
	const seriesCount = chartData.series.length;
	const cellW = layout.plotWidth / Math.max(catCount - 1, 1);
	const cellH = layout.plotHeight / Math.max(seriesCount - 1, 1);

	const primitives: SvgRect[] = [];

	for (let si = 0; si < seriesCount; si++) {
		for (let ci = 0; ci < catCount; ci++) {
			const val = chartData.series[si]?.values[ci] ?? 0;
			const t = range.span > 0 ? (val - range.min) / range.span : 0;
			const { r, g, b } = surfaceColor(t);
			const bandFill = resolveSurfaceBandFill(t, chartData.bandFmts);
			// One rect per (series, category) cell, so unlike the isometric mesh
			// the mark maps to exactly one authored value.
			primitives.push({
				kind: 'rect',
				x: layout.plotLeft + ci * cellW,
				y: layout.plotTop + si * cellH,
				w: cellW + 0.5,
				h: cellH + 0.5,
				fill: bandFill ?? `rgb(${r},${g},${b})`,
				opacity: 0.85,
				part: { role: 'dataPoint', seriesIndex: si, pointIndex: ci },
				title: buildMarkTooltip(
					chartData.series[si]?.name,
					categoryLabels[ci],
					val,
					chartData.series[si]?.numberFormat,
				),
			} satisfies SvgRect);
		}
	}

	const legendPos = chartData.style?.legendPosition ?? 'b';
	const { legend, legendX, legendY, legendAnchor } = buildLegend(
		chartData.series,
		chartData.colorPalette,
		layout.svgWidth,
		legendPos,
		layout.svgHeight,
		layout.plotTop,
	);

	const title = chartData.style?.hasTitle && chartData.title ? chartData.title : undefined;

	// One rect per (series, category) cell already carries an unambiguous
	// single value (unlike the isometric mesh's shared-corner facets), so the
	// same vertical drag-to-value path a line/bar mark uses applies directly.
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
		...emptyChrome(),
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
 * Renders an isometric 3-D-like projection when the grid has >= 2 series and
 * >= 2 categories; falls back to a flat colour-mapped grid otherwise.
 * Mirrors `renderSurfaceChart` / `renderIsometricSurfaceFallback` in React's
 * `chart-surface-treemap.tsx`.
 */
export function buildSurfaceViewModel(
	element: PptxElement,
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
): ChartViewModel {
	const catCount = Math.max(categoryLabels.length, 1);
	const seriesCount = chartData.series.length;

	if (seriesCount >= 2 && catCount >= 2) {
		return buildIsometricSurfaceViewModel(element, chartData, categoryLabels);
	}
	return buildFlatSurfaceViewModel(element, chartData, categoryLabels);
}
