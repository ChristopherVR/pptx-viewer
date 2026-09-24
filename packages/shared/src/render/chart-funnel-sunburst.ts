/**
 * View-model builder for the funnel chart kind, plus the barrel that
 * re-exports its sunburst sibling (`chart-sunburst-view.ts`) so every
 * existing `./chart-funnel-sunburst` import keeps working after the two
 * were split into their own files to stay under the repo's per-file line
 * budget.
 *
 * Ported from:
 *   packages/react/src/viewer/utils/chart-sunburst-funnel.tsx (renderFunnelChart,
 *     renderSunburstChart)
 *   packages/vue/src/viewer/components/chart/FunnelChart.vue
 *   packages/vue/src/viewer/components/chart/SunburstChart.vue
 *
 * Both bindings carried identical geometry; this module reconciles them into one
 * pure builder per kind that returns the engine's standard `ChartViewModel`
 * (SVG primitives only, zero framework / DOM dependencies).
 *
 * Funnel:   one descending centred bar per value of series[0], width
 *           proportional to abs(value), all one colour; value label inline,
 *           category name on a left-side axis.
 * Sunburst: concentric arc rings, one ring per series, each ring split into arc
 *           segments proportional to abs(value); outer rings fade in opacity.
 *
 * @module chart-funnel-sunburst
 */

import type { PptxChartData, PptxElement } from 'pptx-viewer-core';

import { resolveChartTitleText } from './chart-auto-title';
import { dataLabelFontOverride, resolveDataLabelTextStyle } from './chart-data-label-text';
import { DEFAULT_CHART_TEXT_PX } from './chart-font';
import type { ChartViewModel, SvgPath, SvgPrimitive, SvgText } from './chart-view-model';
import {
	AXIS_LABEL_COLOR,
	computePlotLayout,
	formatAxisValue,
	paletteColor,
} from './chart-view-model';

export type { SunburstArc } from './chart-sunburst-hierarchy';
export { computeHierarchicalSunburstArcs, computeSunburstArcs } from './chart-sunburst-hierarchy';
export { buildSunburstViewModel } from './chart-sunburst-view';

// ─────────────────────────────────────────────────────────────────────────────
// Shared empty-chrome helper (funnel / sunburst have no cartesian axes)
// ─────────────────────────────────────────────────────────────────────────────

function emptyChrome(): Pick<
	ChartViewModel,
	'gridlines' | 'axisLabels' | 'zeroLine' | 'categoryLabels'
> {
	return {
		gridlines: [],
		axisLabels: [],
		zeroLine: undefined,
		categoryLabels: [],
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// Funnel geometry
// ─────────────────────────────────────────────────────────────────────────────

/** One funnel bar plus its centred label descriptor. */
export interface FunnelSegment {
	/** SVG path `d` of the bar (a plain centred rectangle). */
	d: string;
	/** Fill colour: the series' own colour, the same for every bar. */
	fill: string;
	/** Bar width in px. */
	topW: number;
	/** Same as `topW`: a funnel bar has no taper. Kept for API stability. */
	botW: number;
	/** Centred label X. */
	labelX: number;
	/** Centred label Y. */
	labelY: number;
	/** Label text: the point's formatted value. */
	labelText: string;
	/** Label font size. */
	fontSize: number;
	/** Category-axis label X (left of the plot area). */
	categoryLabelX: number;
	/** Category-axis label Y (vertically centred on the bar). */
	categoryLabelY: number;
	/** Category-axis label text. */
	categoryText: string;
}

/**
 * Compute the descending funnel bars for series[0].
 *
 * Each bar is a plain rectangle centred on the plot's horizontal midline,
 * its width proportional to `abs(value) / max(abs(values))`. COM-verified
 * against charts-com.pptx slide 27 (chartEx2.xml): PowerPoint draws flat
 * centred bars, not tapering trapezoids, all painted the series' one colour
 * (never a colour cycling per bar), with the point's VALUE as its inline
 * label and the category name on a left-side axis instead.
 */
export function computeFunnelSegments(
	values: ReadonlyArray<number>,
	plotLeft: number,
	plotTop: number,
	plotWidth: number,
	plotHeight: number,
	categories: ReadonlyArray<string>,
	colorPalette: readonly string[] | undefined,
	seriesColorOverride?: string,
): FunnelSegment[] {
	const count = values.length;
	if (count === 0) {
		return [];
	}
	const maxVal = Math.max(...values.map((v) => Math.abs(v)), 1);
	const segH = plotHeight / Math.max(count, 1);
	const centerX = plotLeft + plotWidth / 2;
	// An explicit series colour (c:ser/cx:series spPr solidFill) wins over the
	// palette default; either way every bar takes the SAME single colour.
	const fill = seriesColorOverride ?? paletteColor(0, colorPalette);
	const out: FunnelSegment[] = [];

	for (let i = 0; i < count; i++) {
		const val = values[i];
		const w = (Math.abs(val) / maxVal) * plotWidth;
		const y = plotTop + i * segH;
		const labelY = y + segH / 2 + 4;

		const d = [
			`M ${centerX - w / 2} ${y}`,
			`L ${centerX + w / 2} ${y}`,
			`L ${centerX + w / 2} ${y + segH}`,
			`L ${centerX - w / 2} ${y + segH}`,
			'Z',
		].join(' ');

		out.push({
			d,
			fill,
			topW: w,
			botW: w,
			labelX: centerX,
			labelY,
			labelText: formatAxisValue(val),
			fontSize: Math.min(10, segH * 0.4),
			categoryLabelX: plotLeft - 8,
			categoryLabelY: labelY,
			categoryText: categories[i] ?? '',
		});
	}
	return out;
}

/**
 * Build the view-model for a funnel chart: descending centred bars from
 * series[0], each labelled with its value; the category names form a
 * left-side axis instead of the inline label (COM-verified: charts-com.pptx
 * slide 27). Mirrors `renderFunnelChart` (React) / `FunnelChart.vue`.
 */
export function buildFunnelViewModel(
	element: PptxElement,
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
): ChartViewModel {
	const layout = computePlotLayout(element.width, element.height, chartData, false);
	const values = chartData.series[0]?.values ?? [];
	const segments = computeFunnelSegments(
		values,
		layout.plotLeft,
		layout.plotTop,
		layout.plotWidth,
		layout.plotHeight,
		categoryLabels,
		chartData.colorPalette,
		chartData.series[0]?.color,
	);

	const primitives: SvgPrimitive[] = [];
	const dataLabels: SvgText[] = [];

	for (const seg of segments) {
		primitives.push({
			kind: 'path',
			d: seg.d,
			fill: seg.fill,
			stroke: '#ffffff',
			strokeWidth: 1,
		} satisfies SvgPath);
	}
	const funnelSeries = chartData.series[0];
	segments.forEach((seg, i) => {
		dataLabels.push({
			kind: 'text',
			x: seg.labelX,
			y: seg.labelY,
			text: seg.labelText,
			fontSize: seg.fontSize,
			fill: '#ffffff',
			textAnchor: 'middle',
			fontWeight: 'bold',
			...(funnelSeries
				? dataLabelFontOverride(resolveDataLabelTextStyle(chartData, funnelSeries, i))
				: {}),
		});
	});

	const title = resolveChartTitleText(chartData);
	const categoryAxisLabels: SvgText[] = segments.map((seg) => ({
		kind: 'text',
		x: seg.categoryLabelX,
		y: seg.categoryLabelY,
		text: seg.categoryText,
		fontSize: DEFAULT_CHART_TEXT_PX,
		fill: AXIS_LABEL_COLOR,
		textAnchor: 'end',
	}));

	return {
		svgWidth: layout.svgWidth,
		svgHeight: layout.svgHeight,
		title,
		titleX: layout.svgWidth / 2,
		titleY: 14,
		...emptyChrome(),
		categoryLabels: categoryAxisLabels,
		primitives,
		dataLabels,
		// Funnel does not draw a separate legend swatch list (labels are inline).
		legend: [],
		legendX: layout.svgWidth / 2,
		legendY: layout.svgHeight - 8,
		legendAnchor: 'middle',
	};
}
