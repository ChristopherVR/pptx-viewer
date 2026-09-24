/**
 * chart-legend-swatch.ts: legend swatch shape for line-drawn chart kinds
 * (line, scatter, and the line series of a bar+line combo).
 *
 * PowerPoint draws two different legend swatch shapes depending on how a
 * series is plotted: a filled rectangle for area-like series (bar, area,
 * pie, ...), and a short line segment with the series' own point marker for
 * a line-drawn series (line, scatter). The shared engine used to draw a
 * plain rect for every chart kind, so a line chart's legend never showed the
 * line/marker sample PowerPoint does, even though the plotted series itself
 * rendered correctly.
 *
 * This is a pure decision function (CLAUDE.md Rule 2), one step further than
 * a plain descriptor: `buildLineLegendSwatch` returns ready-to-render
 * `SvgPrimitive`s (a `line` plus the series' own marker shape, via the same
 * `buildMarkerPrimitive` the chart's data points use), positioned in a local
 * 10x10 box matching the existing rect swatch's origin/size. Every binding
 * already has a generic primitive -> JSX/template mapper for the main chart
 * primitives, so drawing a line-style swatch is just running these through
 * that SAME mapper instead of a per-binding reimplementation of line/marker
 * shape logic. `resolveLegendSwatchKind` is the single place that decides
 * which chart kinds get a line sample instead of a rect, so a new binding (or
 * a future chart kind) cannot diverge on the answer.
 *
 * @module chart-legend-swatch
 */
import type { PptxChartSeries } from 'pptx-viewer-core';

import { resolveDataPointMarker } from './chart-datapoint-style';
import { buildMarkerPrimitive } from './chart-marker-shape';
import type { SvgPrimitive } from './chart-svg-primitives';
import type { SupportedChartKind } from './chart-view-model-kinds';

/** Which shape a binding draws for one legend entry's colour swatch. */
export type LegendSwatchKind = 'rect' | 'line';

/** Ready-to-render primitives for a line-style legend swatch (see module doc). */
export interface LegendLineSwatch {
	/**
	 * Positioned in the same local box the rect swatch uses (`x: 0, y: -7,
	 * width: 10, height: 10`): a horizontal line across its vertical centre,
	 * plus the series' own marker shape at the box's centre. Empty only when
	 * the series draws neither (`a:ln/a:noFill` AND `c:symbol="none"`), which
	 * never happens for an un-authored series (the default marker is a circle).
	 */
	primitives: SvgPrimitive[];
}

/** Legend swatch line width in px: a fixed icon size, independent of the plotted series' own stroke width. */
export const LEGEND_LINE_SWATCH_WIDTH = 2;

/** Legend swatch marker radius in px: a fixed icon size, independent of the series' own `c:marker/c:size`. */
export const LEGEND_MARKER_RADIUS = 3;

/** Vertical centre of the swatch box (matches the rect swatch's `y: -7, height: 10`). */
const SWATCH_CENTER_Y = -2;
/** Swatch box width in px (matches the rect swatch's `width: 10`). */
const SWATCH_WIDTH = 10;

/**
 * Which chart kinds get a line-style legend swatch instead of a filled rect.
 *
 * Deliberately narrow: only kinds whose whole plot is a drawn line/marker
 * (line, scatter). A filled radar or an area chart still reads as a filled
 * region in PowerPoint's own legend, so they keep the rect swatch; a
 * bar+line combo resolves its line series individually (see
 * `chart-combo.ts`), not through this whole-chart check.
 */
export function resolveLegendSwatchKind(kind: SupportedChartKind): LegendSwatchKind {
	return kind === 'line' || kind === 'scatter' ? 'line' : 'rect';
}

/**
 * Build the line-style legend swatch primitives for one series.
 *
 * The marker uses the series' OWN marker (`c:ser/c:marker`), never a `c:dPt`
 * per-point override: a legend sample represents the whole series, matching
 * PowerPoint. `pointIndex: -1` is not a real data point, so
 * {@link resolveDataPointMarker}'s `c:dPt` lookup never matches it. The marker
 * is always drawn at {@link LEGEND_MARKER_RADIUS}, ignoring the series' own
 * `c:marker/c:size`, so the legend icon stays a consistent small size
 * regardless of how large the plotted markers are.
 */
export function buildLineLegendSwatch(
	series: Pick<PptxChartSeries, 'marker' | 'color' | 'lineNoFill' | 'dataPoints' | 'idx'>,
	color: string,
	seriesPosition = 0,
): LegendLineSwatch {
	const resolved = resolveDataPointMarker(series, -1, seriesPosition),
		primitives: SvgPrimitive[] = [];
	if (!series.lineNoFill) {
		primitives.push({
			kind: 'line',
			x1: 0,
			y1: SWATCH_CENTER_Y,
			x2: SWATCH_WIDTH,
			y2: SWATCH_CENTER_Y,
			stroke: color,
			strokeWidth: LEGEND_LINE_SWATCH_WIDTH,
		});
	}
	const marker = buildMarkerPrimitive({
		symbol: resolved.symbol,
		// Deliberately ignore the series' authored size (see doc comment above).
		size: undefined,
		cx: SWATCH_WIDTH / 2,
		cy: SWATCH_CENTER_Y,
		fill: resolved.fill ?? color,
		defaultRadius: LEGEND_MARKER_RADIUS,
	});
	if (marker) {
		primitives.push(marker);
	}
	return { primitives };
}

/**
 * Build a trendline's own legend swatch: a plain dashed/dotted line sample,
 * no marker (a trendline has no data points of its own). Same local box as
 * {@link buildLineLegendSwatch} so it lines up with every other entry.
 */
export function buildTrendlineLegendSwatch(
	color: string,
	strokeWidth: number,
	dashArray: string | undefined,
): LegendLineSwatch {
	return {
		primitives: [
			{
				kind: 'line',
				x1: 0,
				y1: SWATCH_CENTER_Y,
				x2: SWATCH_WIDTH,
				y2: SWATCH_CENTER_Y,
				stroke: color,
				strokeWidth,
				dashArray,
			},
		],
	};
}
