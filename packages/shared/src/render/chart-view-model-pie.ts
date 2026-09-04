/**
 * chart-view-model-pie.ts: the fallback (unsupported / empty) and pie /
 * doughnut view-model builders. Split out of `chart-view-model.ts`, which
 * re-exports `buildFallbackViewModel`.
 *
 * @module chart-view-model-pie
 */
/* eslint-disable one-var -- this module predates the rule and combining every
   sibling `const`/`let` in a function into one comma-list (oxlint's own
   `--fix` cannot do this safely once a non-declaration statement sits between
   them) would churn geometry code far beyond this change's scope. */

import type { PptxChartData, PptxElement } from 'pptx-viewer-core';

import { DEFAULT_CHART_AREA_FILL } from './chart-area-fill';
import { buildDataLabelText } from './chart-data-label-text';
import { resolveDataPointExplosion, resolveVaryColorFill } from './chart-datapoint-style';
import { resolveLegendPlacement } from './chart-legend-placement';
import { buildPieDataLabels } from './chart-pie-labels';
import { computePieLayout, computePieSlices } from './chart-view-model-points';
import { buildMarkTooltip, paletteColor } from './chart-view-model-scale';
import type {
	ChartViewModel,
	LegendEntry,
	SvgPath,
	SvgPrimitive,
	SvgRect,
	SvgText,
} from './chart-view-model-types';

export function buildFallbackViewModel(
	width: number,
	height: number,
	label: string,
): ChartViewModel {
	// Match the frame box exactly (bindings stretch with preserveAspectRatio
	// "none"; a minimum here would scale the fallback non-uniformly).
	const svgWidth = Math.max(width, 1),
		svgHeight = Math.max(height, 1);
	return {
		svgWidth,
		svgHeight,
		// No chart data to read a fill from, so the historical wash stands.
		areaFill: DEFAULT_CHART_AREA_FILL,
		title: undefined,
		titleX: svgWidth / 2,
		titleY: 14,
		gridlines: [],
		axisLabels: [],
		zeroLine: undefined,
		categoryLabels: [],
		primitives: [
			{
				kind: 'rect',
				x: 4,
				y: 4,
				w: svgWidth - 8,
				h: svgHeight - 8,
				fill: '#f1f5f9',
				rx: 4,
			} satisfies SvgRect,
		],
		dataLabels: [
			{
				kind: 'text',
				x: svgWidth / 2,
				y: svgHeight / 2,
				text: label,
				fontSize: 10,
				fill: '#94a3b8',
				textAnchor: 'middle',
				dominantBaseline: 'central',
			} satisfies SvgText,
		],
		legend: [],
		legendX: svgWidth / 2,
		legendY: svgHeight - 8,
		legendAnchor: 'middle',
	};
}

export function buildPieViewModel(
	element: PptxElement,
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
	isDoughnut: boolean,
): ChartViewModel {
	const { cx, cy, outerR, innerR, size } = computePieLayout(
			element.width,
			element.height,
			chartData,
			isDoughnut,
		),
		svgWidth = Math.max(size, 100),
		svgHeight = Math.max(size, 60),
		pieSeries = chartData.series[0],
		values = pieSeries?.values ?? [],
		// c:firstSliceAng rotates the pie clockwise from 12 o'clock; c:explosion (per
		// series or per c:dPt) pulls slices outward.
		startAngle = -Math.PI / 2 + ((chartData.firstSliceAngle ?? 0) * Math.PI) / 180,
		explosions = pieSeries
			? values.map((_v, i) => resolveDataPointExplosion(pieSeries, i))
			: undefined,
		slices = computePieSlices(values, cx, cy, outerR, innerR, { startAngle, explosions }),
		primitives: SvgPrimitive[] = slices.map(
			({ d }, i) =>
				({
					kind: 'path',
					d,
					// Pie/doughnut vary colours per slice (c:varyColors defaults on), so each
					// slice takes its palette colour, with a per-point c:dPt fill overriding.
					fill: pieSeries
						? resolveVaryColorFill(pieSeries, i, paletteColor(i, chartData.colorPalette))
						: paletteColor(i, chartData.colorPalette),
					stroke: '#ffffff',
					strokeWidth: 1.5,
					part: { role: 'dataPoint', seriesIndex: 0, pointIndex: i },
					title: buildMarkTooltip(
						pieSeries?.name,
						categoryLabels[i],
						values[i] ?? 0,
						pieSeries?.numberFormat,
					),
				}) satisfies SvgPath,
		),
		dataLabels: SvgText[] = [];
	if (chartData.style?.hasDataLabels) {
		// Offset (outEnd / bestFit) labels sit outside the rim with c:leaderLines.
		// A pie's percentage base is the whole series, and `c:showPercent` is the
		// flag that makes the difference between "40" and "40%" on the commonest
		// labelled chart in a business deck.
		const percentBase = values.reduce((total, entry) => total + Math.abs(entry), 0),
			labelResult = buildPieDataLabels({
				slices,
				values,
				cx,
				cy,
				outerR,
				position: chartData.style.dataLabels?.position,
				showLeaderLines: chartData.style.dataLabels?.showLeaderLines,
				numberFormat: chartData.series[0]?.numberFormat,
				labelText: pieSeries
					? (pointIndex, value) =>
							buildDataLabelText({
								chartData,
								series: pieSeries,
								pointIndex,
								value,
								percentBase,
							})
					: undefined,
			});
		dataLabels.push(...labelResult.labels);
		primitives.push(...labelResult.leaderLines);
	}

	const legendPos = chartData.style?.legendPosition ?? 'b',
		// Legend swatches must match the slices: a per-point `c:dPt` fill overrides
		// the palette on the slice, so it overrides it on the swatch too.
		legend: LegendEntry[] = categoryLabels.map((label, i) => ({
			color: pieSeries
				? resolveVaryColorFill(pieSeries, i, paletteColor(i, chartData.colorPalette))
				: paletteColor(i, chartData.colorPalette),
			label,
		}));
	let legendX = svgWidth / 2;
	let legendY = svgHeight - 8;
	let legendAnchor: 'start' | 'middle' | 'end' = 'middle';

	if (legendPos === 't') {
		legendY = chartData.style?.hasTitle ? 24 : 8;
	} else if (resolveLegendPlacement(legendPos).overlaysPlot) {
		// `tr`: a right-aligned column starting near the top rather than the
		// automatic bottom-centred row, matching PowerPoint's own quick-layout
		// behaviour and the same 'start'-anchored vertical stack `'r'` uses
		// elsewhere in this engine (see chart-view-model-layout.ts's buildLegend).
		legendX = svgWidth - 75;
		legendY = chartData.style?.hasTitle ? 24 : 8;
		legendAnchor = 'start';
	}

	const title = chartData.style?.hasTitle && chartData.title ? chartData.title : undefined;

	return {
		svgWidth,
		svgHeight,
		title,
		titleX: svgWidth / 2,
		titleY: 14,
		gridlines: [],
		axisLabels: [],
		zeroLine: undefined,
		categoryLabels: [],
		primitives,
		dataLabels,
		legend: chartData.style?.hasLegend ? legend : [],
		legendX,
		legendY,
		legendAnchor,
	};
}
