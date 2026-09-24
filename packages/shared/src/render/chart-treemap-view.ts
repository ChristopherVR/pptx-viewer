/**
 * View-model builder for the treemap chart kind.
 *
 * Split out of `chart-surface-treemap.ts` (which re-exports this) to keep
 * that file's several chart-kind builders each under the repo's per-file
 * line budget.
 *
 * Ported from:
 *   packages/react/src/viewer/utils/chart-surface-treemap.tsx  (renderTreemapChart)
 *
 * @module chart-treemap-view
 */

import type { PptxChartData, PptxElement } from 'pptx-viewer-core';

import { resolveChartTitleText } from './chart-auto-title';
import { emptyChrome } from './chart-surface-common';
import { buildHierarchicalTreemapPrimitives, treemapBranchLabels } from './chart-treemap-hierarchy';
import type { ChartViewModel, LegendEntry } from './chart-view-model';
import { buildLegend, computePlotLayout, paletteColor } from './chart-view-model';

/**
 * Build the view-model for a treemap chart.
 *
 * Uses a slice-and-dice layout (alternate horizontal/vertical splits) with
 * items sorted largest-first.  Inline labels are added when the cell is wide
 * enough.  Mirrors `renderTreemapChart` in React's `chart-surface-treemap.tsx`.
 */
export function buildTreemapViewModel(
	element: PptxElement,
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
): ChartViewModel {
	const layout = computePlotLayout(element.width, element.height, chartData, false);
	const primitives = buildHierarchicalTreemapPrimitives(chartData, categoryLabels, {
		x: layout.plotLeft,
		y: layout.plotTop,
		w: layout.plotWidth,
		h: layout.plotHeight,
	});

	// Legend: one entry per series (matching React: no per-item legend).
	const legendPos = chartData.style?.legendPosition ?? 'b';
	const { legend, legendX, legendY, legendAnchor } = buildLegend(
		chartData.series,
		chartData.colorPalette,
		layout.svgWidth,
		legendPos,
		layout.svgHeight,
		layout.plotTop,
	);

	// One legend entry per TOP-LEVEL branch, matching the one colour every leaf
	// under that branch is painted with (COM-verified: charts-com.pptx slide
	// 28 legend reads "Branch 1/2/3", never one swatch per leaf).
	const branchLabels = treemapBranchLabels(chartData, categoryLabels);
	const catLegend: LegendEntry[] = branchLabels.map((label, i) => ({
		color: paletteColor(i, chartData.colorPalette),
		label,
	}));

	const title = resolveChartTitleText(chartData);

	return {
		svgWidth: layout.svgWidth,
		svgHeight: layout.svgHeight,
		title,
		titleX: layout.svgWidth / 2,
		titleY: 14,
		...emptyChrome(),
		primitives,
		// Prefer per-category legend over per-series legend for treemap.
		legend: chartData.style?.hasLegend ? (catLegend.length > 0 ? catLegend : legend) : [],
		legendX,
		legendY,
		legendAnchor,
	};
}
