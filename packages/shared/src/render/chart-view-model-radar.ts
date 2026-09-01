/**
 * chart-view-model-radar.ts: the radar / spider view-model builder. Split out
 * of `chart-view-model.ts`.
 *
 * @module chart-view-model-radar
 */
/* eslint-disable one-var -- this module predates the rule and combining every
   sibling `const`/`let` in a function into one comma-list (oxlint's own
   `--fix` cannot do this safely once a non-declaration statement sits between
   them) would churn geometry code far beyond this change's scope. */

import type { PptxChartData, PptxElement } from 'pptx-viewer-core';

import { DEFAULT_CHART_DATA_LABEL_PX, DEFAULT_CHART_TEXT_PX } from './chart-font';
import { buildLegend, computePlotLayout } from './chart-view-model-layout';
import { computeRadarPoints, radarAngle, radarRingPoints } from './chart-view-model-points';
import { buildMarkTooltip, formatAxisValue, seriesColor } from './chart-view-model-scale';
import type {
	ChartViewModel,
	SvgCircle,
	SvgLine,
	SvgPolygon,
	SvgPrimitive,
	SvgText,
} from './chart-view-model-types';

const RADAR_RINGS = 4,
	RADAR_RING_COLOR = '#cbd5e1',
	RADAR_SPOKE_COLOR = '#94a3b8',
	RADAR_LABEL_COLOR = '#64748b';

/**
 * Build the view-model for a radar / spider chart. Polar, so it has no
 * cartesian gridlines/axes; ring + spoke geometry and the data polygons all
 * live in `primitives`, perimeter category labels in `categoryLabels`.
 * Mirrors React's `renderRadarChart` (chart-radar.tsx).
 */
export function buildRadarViewModel(
	element: PptxElement,
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
): ChartViewModel {
	const layout = computePlotLayout(element.width, element.height, chartData, false),
		cx = layout.plotLeft + layout.plotWidth / 2,
		cy = layout.plotTop + layout.plotHeight / 2,
		radius = Math.max(Math.min(layout.plotWidth, layout.plotHeight) / 2 - 4, 1),
		catCount = Math.max(categoryLabels.length, 1),
		maxVal = Math.max(1, ...chartData.series.flatMap((s) => s.values.map((v) => Math.abs(v)))),
		primitives: SvgPrimitive[] = [],
		perimeterLabels: SvgText[] = [];

	// Concentric gridline rings (dashed except the outermost).
	for (let r = 1; r <= RADAR_RINGS; r++) {
		const rr = (radius * r) / RADAR_RINGS;
		primitives.push({
			kind: 'polygon',
			points: radarRingPoints(cx, cy, rr, catCount),
			fill: 'none',
			stroke: RADAR_RING_COLOR,
			strokeWidth: 0.5,
			dashArray: r < RADAR_RINGS ? '3 2' : undefined,
		} satisfies SvgPolygon);
	}

	// Axis spokes + perimeter category labels.
	for (let i = 0; i < catCount; i++) {
		const angle = radarAngle(i, catCount);
		primitives.push({
			kind: 'line',
			x1: cx,
			y1: cy,
			x2: cx + radius * Math.cos(angle),
			y2: cy + radius * Math.sin(angle),
			stroke: RADAR_SPOKE_COLOR,
			strokeWidth: 0.5,
		} satisfies SvgLine);
		const labelR = radius + 10;
		perimeterLabels.push({
			kind: 'text',
			x: cx + labelR * Math.cos(angle),
			y: cy + labelR * Math.sin(angle),
			text: categoryLabels[i] ?? '',
			fontSize: DEFAULT_CHART_TEXT_PX,
			fill: RADAR_LABEL_COLOR,
			textAnchor: 'middle',
			dominantBaseline: 'central',
		});
	}

	// Per-series data polygons + vertex dots. `c:radarStyle` (PowerPoint's own
	// default is `marker`) decides the polygon fill and whether vertex markers
	// are drawn: `filled` paints the enclosed area solid (PowerPoint's own
	// ~60% opacity) with no markers; `standard` is an outline only, also with
	// no markers; `marker` (the pre-existing behaviour, also the fallback for
	// an absent/unrecognised value) draws a light fill plus vertex markers.
	const radarStyle = chartData.radarStyle ?? 'marker',
		polygonFill = radarStyle === 'standard' ? 'none' : undefined,
		polygonOpacity = radarStyle === 'filled' ? 0.6 : radarStyle === 'standard' ? undefined : 0.2;
	const dataLabels: SvgText[] = [];
	chartData.series.forEach((series, si) => {
		const c = seriesColor(series, si, chartData.colorPalette),
			pts = computeRadarPoints(series.values, maxVal, radius, cx, cy, catCount);
		if (pts.length === 0) {
			return;
		}
		const pointsStr = pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
		primitives.push({
			kind: 'polygon',
			points: pointsStr,
			fill: polygonFill ?? c,
			opacity: polygonOpacity,
			stroke: c,
			strokeWidth: 1.5,
			part: { role: 'series', seriesIndex: si },
			title: series.name.length > 0 ? series.name : undefined,
		} satisfies SvgPolygon);
		if (radarStyle === 'marker') {
			pts.forEach((p, vi) => {
				primitives.push({
					kind: 'circle',
					cx: p.x,
					cy: p.y,
					r: 3,
					fill: c,
					part: { role: 'dataPoint', seriesIndex: si, pointIndex: vi },
					title: buildMarkTooltip(
						series.name,
						categoryLabels[vi],
						series.values[vi] ?? 0,
						series.numberFormat,
					),
				} satisfies SvgCircle);
			});
		}

		if (chartData.style?.hasDataLabels) {
			pts.forEach((p, vi) => {
				const val = series.values[vi];
				if (val === undefined) {
					return;
				}
				dataLabels.push({
					kind: 'text',
					x: p.x,
					y: p.y - 8,
					text: formatAxisValue(val, series.numberFormat),
					fontSize: DEFAULT_CHART_DATA_LABEL_PX,
					fill: '#334155',
					textAnchor: 'middle',
				});
			});
		}
	});

	const legendPos = chartData.style?.legendPosition ?? 'b',
		{ legend, legendX, legendY, legendAnchor } = buildLegend(
			chartData.series,
			chartData.colorPalette,
			layout.svgWidth,
			legendPos,
			layout.svgHeight,
			layout.plotTop,
		),
		title = chartData.style?.hasTitle && chartData.title ? chartData.title : undefined;

	return {
		svgWidth: layout.svgWidth,
		svgHeight: layout.svgHeight,
		title,
		titleX: layout.svgWidth / 2,
		titleY: 12,
		gridlines: [],
		axisLabels: [],
		zeroLine: undefined,
		categoryLabels: perimeterLabels,
		primitives,
		dataLabels,
		legend: chartData.style?.hasLegend ? legend : [],
		legendX,
		legendY,
		legendAnchor,
	};
}
