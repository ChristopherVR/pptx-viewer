/**
 * View-model builder for the sunburst chart kind: concentric arc rings, one
 * ring per series (or, for a ChartEx hierarchy, one ring per category
 * level), each ring split into arc segments proportional to abs(value).
 *
 * Split out of `chart-funnel-sunburst.ts` (which re-exports this) to keep
 * that file's funnel + sunburst builders each under the repo's per-file
 * line budget.
 *
 * Ported from:
 *   packages/react/src/viewer/utils/chart-sunburst-funnel.tsx (renderSunburstChart)
 *   packages/vue/src/viewer/components/chart/SunburstChart.vue
 *
 * @module chart-sunburst-view
 */

import type { PptxChartData, PptxElement } from 'pptx-viewer-core';

import { resolveChartTitleText } from './chart-auto-title';
import { computeHierarchicalSunburstArcs, computeSunburstArcs } from './chart-sunburst-hierarchy';
import { emptyChrome } from './chart-surface-common';
import type { ChartViewModel, SvgPath, SvgPrimitive, SvgText } from './chart-view-model';
import { computePlotLayout, paletteColor } from './chart-view-model';

type HierarchicalChartData = PptxChartData & { categoryLevels?: string[][] };

/**
 * Build the view-model for a sunburst chart: concentric arc rings, one per
 * series. Mirrors `renderSunburstChart` (React) / `SunburstChart.vue`.
 */
export function buildSunburstViewModel(
	element: PptxElement,
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
): ChartViewModel {
	const layout = computePlotLayout(element.width, element.height, chartData, false);
	const cx = layout.plotLeft + layout.plotWidth / 2;
	const cy = layout.plotTop + layout.plotHeight / 2;
	const maxR = Math.min(layout.plotWidth, layout.plotHeight) / 2 - 4;
	const categoryLevels = (chartData as HierarchicalChartData).categoryLevels;

	const arcs = categoryLevels?.length
		? computeHierarchicalSunburstArcs(
				categoryLevels,
				chartData.series[0]?.values ?? [],
				cx,
				cy,
				maxR,
				chartData.colorPalette,
			)
		: computeSunburstArcs(chartData.series, cx, cy, maxR, chartData.colorPalette);
	const primitives: SvgPrimitive[] = arcs.map(
		(arc) =>
			({
				kind: 'path',
				d: arc.d,
				fill: arc.fill,
				stroke: '#ffffff',
				strokeWidth: 1,
				opacity: arc.opacity,
				part:
					arc.pointIndex === undefined
						? undefined
						: { role: 'dataPoint', seriesIndex: 0, pointIndex: arc.pointIndex },
			}) satisfies SvgPath,
	);

	// One label per arc, radiating outward and kept upright (COM-verified:
	// charts-com.pptx slide 29 labels every ring, at every angle).
	const dataLabels: SvgText[] = arcs
		.filter((arc): arc is typeof arc & { label: string } => Boolean(arc.label))
		.map((arc) => ({
			kind: 'text',
			x: arc.labelX,
			y: arc.labelY,
			text: arc.label,
			fontSize: 10,
			fill: '#ffffff',
			textAnchor: 'middle',
			dominantBaseline: 'central',
			transform: `rotate(${arc.labelRotation}, ${arc.labelX}, ${arc.labelY})`,
		}));

	const legendLabels = categoryLevels?.length
		? [...new Set(categoryLevels[categoryLevels.length - 1]?.filter(Boolean) ?? categoryLabels)]
		: categoryLabels;
	const legend = chartData.style?.hasLegend
		? legendLabels.map((label, i) => ({ color: paletteColor(i, chartData.colorPalette), label }))
		: [];

	const title = resolveChartTitleText(chartData);

	return {
		svgWidth: layout.svgWidth,
		svgHeight: layout.svgHeight,
		title,
		titleX: layout.svgWidth / 2,
		titleY: 14,
		...emptyChrome(),
		primitives,
		dataLabels,
		legend,
		legendX: layout.svgWidth / 2,
		legendY: layout.svgHeight - 8,
		legendAnchor: 'middle',
	};
}
