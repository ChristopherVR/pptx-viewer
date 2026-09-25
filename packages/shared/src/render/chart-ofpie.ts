/**
 * chart-ofpie.ts: framework-agnostic view-model builder for the OOXML
 * "Pie of Pie" / "Bar of Pie" chart (`c:ofPieChart`, CT_OfPieChart).
 *
 * A single data series is split into a PRIMARY pie plus a SECONDARY plot (a
 * smaller pie for `ofPieType === 'pie'`, or a vertical stacked bar for
 * `ofPieType === 'bar'`). The primary pie shows the points kept in the first
 * plot plus one aggregated "Other" slice standing in for every point moved to
 * the secondary plot; the secondary plot expands that "Other" slice into its
 * constituent points. `c:serLines` draws the two connector lines linking the
 * "Other" slice to the secondary plot.
 *
 * Split membership + layout live in `chart-ofpie-split`; the secondary plot and
 * connector geometry in `chart-ofpie-secondary`. Geometry reuses the shared pie
 * primitives so every binding renders identical `ofPie` output.
 *
 * @module chart-ofpie
 */
import type { PptxChartData, PptxElement } from 'pptx-viewer-core';

import { resolveChartTitleText } from './chart-auto-title';
import { resolveVaryColorFill } from './chart-datapoint-style';
import {
	buildSecondaryBar,
	buildSecondaryPie,
	buildSerLines,
	sliceLabel,
} from './chart-ofpie-secondary';
import type { OfPieGeom } from './chart-ofpie-split';
import { computeOfPieGeom, resolveSecondaryIndices, sliceAngles } from './chart-ofpie-split';
import type {
	ChartViewModel,
	LegendEntry,
	SvgPath,
	SvgPrimitive,
	SvgText,
} from './chart-view-model';
import { computePieSlicePath, paletteColor } from './chart-view-model';

/** Build primary-pie slice paths + optional value labels. */
function buildPrimarySlices(
	geom: OfPieGeom,
	primaryValues: number[],
	fills: string[],
	showLabels: boolean,
	startAngle: number,
): { primitives: SvgPath[]; labels: SvgText[] } {
	const angles = sliceAngles(primaryValues, startAngle);
	const primitives: SvgPath[] = [];
	const labels: SvgText[] = [];
	angles.forEach((a, i) => {
		const geoSlice = computePieSlicePath(
			geom.primaryCx,
			geom.primaryCy,
			geom.primaryR,
			0,
			a.start,
			a.end,
		);
		primitives.push({
			kind: 'path',
			d: geoSlice.d,
			fill: fills[i],
			stroke: '#ffffff',
			strokeWidth: 1.5,
			part: { role: 'dataPoint', seriesIndex: 0, pointIndex: i },
		});
		if (showLabels) {
			labels.push(sliceLabel(geoSlice.labelX, geoSlice.labelY, primaryValues[i]));
		}
	});
	return { primitives, labels };
}

/**
 * Build the full pie-of-pie / bar-of-pie view-model. Splits the first series
 * into a primary pie (kept points + one aggregated "Other" slice) and a
 * secondary pie/bar expanding the moved points, with serLines connectors.
 */
export function buildOfPieViewModel(
	element: PptxElement,
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
): ChartViewModel {
	const options = chartData.ofPieOptions ?? { ofPieType: 'pie' };
	const series = chartData.series[0];
	const values = series?.values ?? [];
	const palette = chartData.colorPalette;
	const showLabels = chartData.style?.hasDataLabels === true;

	const secondaryIdx = resolveSecondaryIndices(values, options);
	const keptIndices = values.map((_v, i) => i).filter((i) => !secondaryIdx.has(i));
	const secondaryIndices = values.map((_v, i) => i).filter((i) => secondaryIdx.has(i));

	const geom = computeOfPieGeom(element, options.secondPieSize ?? 75, options.ofPieType === 'bar');

	// Colours: each point keeps its original palette colour. The aggregated
	// "Other" slice is the series' point AFTER the last real one: PowerPoint
	// styles it with the `c:dPt` whose idx equals the point count (accent1
	// lumMod 60% in every built-in style; COM-verified charts-com.pptx slides
	// 5-6), falling back to the next palette colour.
	const pointFill = (i: number): string =>
		series ? resolveVaryColorFill(series, i, paletteColor(i, palette)) : paletteColor(i, palette);
	const keptFills = keptIndices.map(pointFill);
	const secondaryFills = secondaryIndices.map(pointFill);
	const otherFill = pointFill(values.length);

	const otherSum = secondaryIndices.reduce((s, i) => s + Math.abs(values[i]), 0);
	const primaryValues = [...keptIndices.map((i) => Math.abs(values[i])), otherSum];
	const primaryFills = [...keptFills, otherFill];

	// Rotation: PowerPoint turns the primary pie so the "Other" slice is
	// centred on 3 o'clock, facing the secondary plot, and starts the
	// secondary pie where that slice ends (COM-verified charts-com.pptx
	// slide 5: kept slices from +28.4deg clockwise, Other centred on 0deg,
	// secondary slices from +28.4deg).
	const primaryTotal = primaryValues.reduce((s, v) => s + v, 0) || 1;
	const otherHalfSpan = (otherSum / primaryTotal) * Math.PI;
	const primary = buildPrimarySlices(geom, primaryValues, primaryFills, showLabels, otherHalfSpan);
	const secondaryValues = secondaryIndices.map((i) => Math.abs(values[i]));
	const toBar = options.ofPieType === 'bar';
	const secondary =
		secondaryValues.length > 0
			? toBar
				? buildSecondaryBar(geom, secondaryValues, secondaryFills, showLabels)
				: buildSecondaryPie(geom, secondaryValues, secondaryFills, showLabels, otherHalfSpan)
			: { primitives: [], labels: [] };

	const primitives: SvgPrimitive[] = [];
	// Connector lines behind the plots.
	if (options.serLines !== false && secondaryValues.length > 0) {
		const primaryAngles = sliceAngles(primaryValues, otherHalfSpan);
		primitives.push(...buildSerLines(geom, primaryAngles[primaryAngles.length - 1], toBar));
	}
	primitives.push(...primary.primitives, ...secondary.primitives);

	const dataLabels: SvgText[] = [...primary.labels, ...secondary.labels];

	const legend: LegendEntry[] = categoryLabels.map((label, i) => ({
		color: paletteColor(i, palette),
		label,
	}));
	const title = resolveChartTitleText(chartData);

	return {
		svgWidth: geom.svgWidth,
		svgHeight: geom.svgHeight,
		title,
		titleX: geom.svgWidth / 2,
		titleY: 14,
		gridlines: [],
		axisLabels: [],
		zeroLine: undefined,
		categoryLabels: [],
		primitives,
		dataLabels,
		legend: chartData.style?.hasLegend ? legend : [],
		legendX: geom.svgWidth / 2,
		legendY: geom.svgHeight - 8,
		legendAnchor: 'middle',
	};
}
