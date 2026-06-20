/**
 * View-model builders for funnel and sunburst chart kinds.
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
 * Funnel:   one descending trapezoid per value of series[0]; the bottom width of
 *           each segment equals the next value's top width (last segment tapers
 *           to 30% of its own width). Centred inline labels (category or value).
 * Sunburst: concentric arc rings, one ring per series, each ring split into arc
 *           segments proportional to abs(value); outer rings fade in opacity.
 *
 * @module chart-funnel-sunburst
 */

import type { PptxChartData, PptxElement } from 'pptx-viewer-core';

import type { ChartViewModel, SvgPath, SvgPrimitive, SvgText } from './chart-view-model';
import { computePlotLayout, formatAxisValue, paletteColor } from './chart-view-model';

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

/** One funnel trapezoid plus its centred label descriptor. */
export interface FunnelSegment {
	/** SVG path `d` of the trapezoid. */
	d: string;
	/** Fill colour (palette by index). */
	fill: string;
	/** Top edge width in px. */
	topW: number;
	/** Bottom edge width in px. */
	botW: number;
	/** Centred label X. */
	labelX: number;
	/** Centred label Y. */
	labelY: number;
	/** Label text (category or formatted value). */
	labelText: string;
	/** Label font size. */
	fontSize: number;
}

/**
 * Compute the descending funnel trapezoids for series[0].
 *
 * Each segment's top width is proportional to abs(value); its bottom width
 * matches the next value's top width, so consecutive segments share an edge.
 * The final segment tapers to 30% of its own width. Mirrors the React /
 * Vue funnel geometry exactly.
 */
export function computeFunnelSegments(
	values: ReadonlyArray<number>,
	plotLeft: number,
	plotTop: number,
	plotWidth: number,
	plotHeight: number,
	categories: ReadonlyArray<string>,
	colorPalette: readonly string[] | undefined,
): FunnelSegment[] {
	const count = values.length;
	if (count === 0) {
		return [];
	}
	const maxVal = Math.max(...values.map((v) => Math.abs(v)), 1);
	const segH = plotHeight / Math.max(count, 1);
	const centerX = plotLeft + plotWidth / 2;
	const out: FunnelSegment[] = [];

	for (let i = 0; i < count; i++) {
		const val = values[i];
		const topW = (Math.abs(val) / maxVal) * plotWidth;
		const nextVal = i + 1 < count ? Math.abs(values[i + 1]) : Math.abs(val) * 0.3;
		const botW = (nextVal / maxVal) * plotWidth;
		const y = plotTop + i * segH;

		const d = [
			`M ${centerX - topW / 2} ${y}`,
			`L ${centerX + topW / 2} ${y}`,
			`L ${centerX + botW / 2} ${y + segH}`,
			`L ${centerX - botW / 2} ${y + segH}`,
			'Z',
		].join(' ');

		out.push({
			d,
			fill: paletteColor(i, colorPalette),
			topW,
			botW,
			labelX: centerX,
			labelY: y + segH / 2 + 4,
			labelText: categories[i] ?? formatAxisValue(val),
			fontSize: Math.min(10, segH * 0.4),
		});
	}
	return out;
}

/**
 * Build the view-model for a funnel chart: descending trapezoids from series[0].
 * Mirrors `renderFunnelChart` (React) / `FunnelChart.vue`.
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
	for (const seg of segments) {
		dataLabels.push({
			kind: 'text',
			x: seg.labelX,
			y: seg.labelY,
			text: seg.labelText,
			fontSize: seg.fontSize,
			fill: '#ffffff',
			textAnchor: 'middle',
			fontWeight: 'bold',
		});
	}

	const title = chartData.style?.hasTitle && chartData.title ? chartData.title : undefined;

	return {
		svgWidth: layout.svgWidth,
		svgHeight: layout.svgHeight,
		title,
		titleX: layout.svgWidth / 2,
		titleY: 14,
		...emptyChrome(),
		primitives,
		dataLabels,
		// Funnel does not draw a separate legend swatch list (labels are inline).
		legend: [],
		legendX: layout.svgWidth / 2,
		legendY: layout.svgHeight - 8,
		legendAnchor: 'middle',
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// Sunburst geometry
// ─────────────────────────────────────────────────────────────────────────────

/** One sunburst ring arc segment. */
export interface SunburstArc {
	/** SVG path `d` of the arc (donut wedge). */
	d: string;
	/** Fill colour (palette by value index within the ring). */
	fill: string;
	/** Opacity (outer rings fade), clamped to >= 0.1. */
	opacity: number;
}

/**
 * Compute the concentric ring arcs for a sunburst chart: one ring per series,
 * each split into wedges proportional to abs(value). Mirrors the React / Vue
 * sunburst geometry; opacity is clamped to a 0.1 floor (the Vue behaviour, a
 * superset of React which let it drop unclamped).
 */
export function computeSunburstArcs(
	series: PptxChartData['series'],
	cx: number,
	cy: number,
	maxR: number,
	colorPalette: readonly string[] | undefined,
): SunburstArc[] {
	const seriesCount = Math.max(series.length, 1);
	const ringWidth = maxR / (seriesCount + 0.5);
	const out: SunburstArc[] = [];

	for (let si = 0; si < series.length; si++) {
		const s = series[si];
		const iR = ringWidth * (si + 0.5);
		const oR = ringWidth * (si + 1.5);
		const total = s.values.reduce((acc, v) => acc + Math.abs(v), 0) || 1;
		let startAngle = -Math.PI / 2;

		for (let vi = 0; vi < s.values.length; vi++) {
			const val = s.values[vi];
			const sweep = (Math.abs(val) / total) * Math.PI * 2;
			const endAngle = startAngle + sweep;
			const largeArc = sweep > Math.PI ? 1 : 0;

			const x1 = cx + oR * Math.cos(startAngle);
			const y1 = cy + oR * Math.sin(startAngle);
			const x2 = cx + oR * Math.cos(endAngle);
			const y2 = cy + oR * Math.sin(endAngle);
			const x3 = cx + iR * Math.cos(endAngle);
			const y3 = cy + iR * Math.sin(endAngle);
			const x4 = cx + iR * Math.cos(startAngle);
			const y4 = cy + iR * Math.sin(startAngle);

			out.push({
				d: `M ${x1} ${y1} A ${oR} ${oR} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${iR} ${iR} 0 ${largeArc} 0 ${x4} ${y4} Z`,
				fill: paletteColor(vi, colorPalette),
				opacity: Math.max(0.1, 0.9 - si * 0.1),
			});

			startAngle = endAngle;
		}
	}
	return out;
}

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

	const arcs = computeSunburstArcs(chartData.series, cx, cy, maxR, chartData.colorPalette);
	const primitives: SvgPrimitive[] = arcs.map(
		(arc) =>
			({
				kind: 'path',
				d: arc.d,
				fill: arc.fill,
				stroke: '#ffffff',
				strokeWidth: 1,
				opacity: arc.opacity,
			}) satisfies SvgPath,
	);

	const legend = chartData.style?.hasLegend
		? categoryLabels.map((label, i) => ({ color: paletteColor(i, chartData.colorPalette), label }))
		: [];

	const title = chartData.style?.hasTitle && chartData.title ? chartData.title : undefined;

	return {
		svgWidth: layout.svgWidth,
		svgHeight: layout.svgHeight,
		title,
		titleX: layout.svgWidth / 2,
		titleY: 14,
		...emptyChrome(),
		primitives,
		dataLabels: [],
		legend,
		legendX: layout.svgWidth / 2,
		legendY: layout.svgHeight - 8,
		legendAnchor: 'middle',
	};
}
