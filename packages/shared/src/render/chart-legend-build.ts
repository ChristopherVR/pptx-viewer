/**
 * chart-legend-build.ts: builds the base `LegendEntry[]` (colour + label +
 * optional line-style swatch) and the legend's anchor position for a chart
 * view-model. Split out of `chart-view-model-layout.ts` to keep it within the
 * repo's ~300-LOC limit.
 *
 * @module chart-legend-build
 */
import type { PptxChartSeries } from 'pptx-viewer-core';

import { resolveLegendPlacement } from './chart-legend-placement';
import { buildLineLegendSwatch } from './chart-legend-swatch';
import type { LegendSwatchKind } from './chart-legend-swatch';
import { seriesColor } from './chart-view-model-scale';
import type { LegendEntry } from './chart-view-model-types';

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

	return { legend, legendX, legendY, legendAnchor };
}
