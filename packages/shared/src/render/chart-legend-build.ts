/**
 * chart-legend-build.ts: builds the base `LegendEntry[]` (colour + label +
 * optional line-style swatch) and the legend's anchor position for a chart
 * view-model. Split out of `chart-view-model-layout.ts` to keep it within the
 * repo's ~300-LOC limit.
 *
 * @module chart-legend-build
 */
import type { PptxChartSeries, PptxChartTrendlineType } from 'pptx-viewer-core';

import { resolveLegendPlacement } from './chart-legend-placement';
import { buildLineLegendSwatch, buildTrendlineLegendSwatch } from './chart-legend-swatch';
import type { LegendSwatchKind } from './chart-legend-swatch';
import { DEFAULT_TRENDLINE_DASH, DEFAULT_TRENDLINE_WIDTH } from './chart-trendline-defaults';
import { seriesColor } from './chart-view-model-scale';
import type { LegendEntry } from './chart-view-model-types';
import { buildDashArray } from './connector-dash';

/** Excel's own trendline-family legend prefix (`"Linear (Series1)"`, ...). */
const TRENDLINE_LEGEND_PREFIX: Record<PptxChartTrendlineType, string> = {
	linear: 'Linear',
	exponential: 'Expon.',
	logarithmic: 'Log.',
	power: 'Power',
	polynomial: 'Poly.',
	movingAvg: 'Moving Average',
};

/**
 * Resolve a legend's anchor position from its declared side, independent of
 * what entries it holds. Split out of `buildLegend` so a non-series legend
 * (the surface chart's value-band legend, `chart-surface-legend.ts`) can
 * reuse the exact same placement rules instead of re-deriving them.
 */
export function resolveLegendAnchorPosition(
	svgWidth: number,
	svgHeight: number,
	plotTop: number,
	legendPos: string,
): { legendX: number; legendY: number; legendAnchor: 'start' | 'middle' | 'end' } {
	let legendX = svgWidth / 2,
		legendY = svgHeight - 8,
		legendAnchor: 'start' | 'middle' | 'end' = 'middle';

	// `tr` shares `'r'`'s coordinates (a right-aligned column starting at
	// plotTop): that is already "top-right corner"; it just does not reserve
	// plot-area space the way a reserved `'r'` legend does (see computePlotLayout).
	const side = resolveLegendPlacement(legendPos).side;
	if (side === 'r') {
		legendX = svgWidth - 75;
		legendY = plotTop;
		legendAnchor = 'start';
	} else if (side === 'l') {
		legendX = 4;
		legendY = plotTop;
		legendAnchor = 'start';
	} else if (side === 't') {
		legendY = 28;
	}

	return { legendX, legendY, legendAnchor };
}

/**
 * Build the base legend entries + anchor position for a chart view model.
 *
 * @param swatchKind Which legend entries draw a line + marker sample instead
 *   of the default filled rect (see `chart-legend-swatch.ts`). A single value
 *   applies to every entry (the whole-chart line/scatter case); an array
 *   resolves per series index (a bar+line combo, where only the line series
 *   get the line sample). Defaults to `'rect'` for every existing caller that
 *   predates line-aware legends.
 */
export function buildLegend(
	series: ReadonlyArray<PptxChartSeries>,
	colorPalette: readonly string[] | undefined,
	svgWidth: number,
	legendPos: string,
	svgHeight: number,
	plotTop: number,
	swatchKind: LegendSwatchKind | ReadonlyArray<LegendSwatchKind> = 'rect',
): {
	legend: LegendEntry[];
	legendX: number;
	legendY: number;
	legendAnchor: 'start' | 'middle' | 'end';
} {
	const legend: LegendEntry[] = series.map((s, i) => {
		const color = seriesColor(s, i, colorPalette),
			kind = Array.isArray(swatchKind) ? (swatchKind[i] ?? 'rect') : swatchKind;
		return {
			color,
			label: s.name,
			...(kind === 'line' ? { lineSwatch: buildLineLegendSwatch(s, color, i) } : {}),
		};
	});

	// A trendline gets its own legend entry, right after its owning series
	// (Excel/PowerPoint: `"Linear (Series1)"`, a dotted line sample). Trendlines
	// are only ever legal on bar/line/area/scatter series, so this is a no-op
	// for every other chart kind (`series.trendlines` is simply absent there).
	series.forEach((s, i) => {
		if (!s.trendlines || s.trendlines.length === 0) {
			return;
		}
		const fallbackColor = seriesColor(s, i, colorPalette);
		s.trendlines.forEach((tl) => {
			const color = tl.color ?? fallbackColor;
			const strokeWidth = tl.lineWidth ?? DEFAULT_TRENDLINE_WIDTH;
			legend.push({
				color,
				label: tl.name ?? `${TRENDLINE_LEGEND_PREFIX[tl.trendlineType]} (${s.name})`,
				lineSwatch: buildTrendlineLegendSwatch(
					color,
					strokeWidth,
					buildDashArray(tl.lineDashStyle ?? DEFAULT_TRENDLINE_DASH, strokeWidth),
				),
			});
		});
	});

	const { legendX, legendY, legendAnchor } = resolveLegendAnchorPosition(
		svgWidth,
		svgHeight,
		plotTop,
		legendPos,
	);

	return { legend, legendX, legendY, legendAnchor };
}
