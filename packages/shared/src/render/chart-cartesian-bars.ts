/**
 * chart-cartesian-bars.ts: bar / column plot-primitive builders for the enriched
 * cartesian chart engine (clustered, stacked, percentStacked).
 *
 * Split out of `chart-cartesian-plots.ts` to keep each module within the repo's
 * ~300-LOC limit. Pure helpers consumed by `buildCartesianViewModel`. Clustered
 * bars honour a secondary value range; non-percent stacked reuses the original
 * `computeStackedBarRects` geometry byte-for-byte; percentStacked normalises each
 * category to 100% with in-bar percent labels (matching React).
 *
 * @module chart-cartesian-bars
 */
import type { PptxChartData, PptxChartSeries } from 'pptx-viewer-core';

import { buildPercentStackedBars } from './chart-cartesian-percent-stacked';
import type { SeriesPlotResult } from './chart-cartesian-plots';
import { pushClusteredStackedLabels } from './chart-cartesian-stacked-labels';
import { resolveBarLabelPlacement } from './chart-data-label-anchor';
import {
	buildDataLabelText,
	dataLabelFontOverride,
	resolveDataLabelTextStyle,
} from './chart-data-label-text';
import { resolveDataPointFill, resolveVaryColorFill } from './chart-datapoint-style';
import { DEFAULT_CHART_DATA_LABEL_PX } from './chart-font';
import type { PlotLayout, SvgPrimitive, SvgRect, SvgText, ValueRange } from './chart-view-model';
import {
	buildMarkTooltip,
	computeStackedBarRects,
	paletteColor,
	seriesColor,
	valueToY,
} from './chart-view-model';

/**
 * Blend a `#RRGGBB` colour halfway toward white. Returns the input unchanged
 * when it is not a parseable 6-digit hex (e.g. a named colour or gradient ref).
 */
function blendToWhite(color: string): string {
	const match = /^#?([0-9a-f]{6})$/iu.exec(color.trim());
	if (!match) {
		return color;
	}
	// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
	const value = Number.parseInt(match[1], 16),
		mix = (channel: number): number => Math.round(channel + (255 - channel) * 0.5),
		r = mix((value >> 16) & 0xff),
		g = mix((value >> 8) & 0xff),
		b = mix(value & 0xff);
	return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0').toUpperCase()}`;
}

/**
 * Apply PowerPoint's `c:invertIfNegative` treatment to a bar fill: when the
 * point value is negative and invert-if-negative is set (a per-point `c:dPt`
 * override wins over the series-level flag), the bar is drawn in a lightened
 * fill. Convention: a 50% blend of the base fill toward white. PowerPoint has no
 * single canonical inverted colour; a lightened same-hue fill echoes its default
 * "hollow" appearance and is deterministic across bindings.
 */
function invertNegativeFill(
	series: PptxChartSeries,
	pointIndex: number,
	value: number,
	baseFill: string,
): string {
	if (value >= 0) {
		return baseFill;
	}
	const point = series.dataPoints?.find((p) => p.idx === pointIndex),
		invert = point?.invertIfNegative ?? series.invertIfNegative ?? false;
	return invert ? blendToWhite(baseFill) : baseFill;
}

/**
 * Bar primitives for clustered / stacked / percentStacked, honouring a secondary
 * value range for secondary-mapped series (clustered only). Returns rects + data
 * labels. Mirrors React's `renderDefaultBarChart` / `renderStackedBarChart`.
 */
export function buildBars(
	chartData: PptxChartData,
	catCount: number,
	layout: PlotLayout,
	primaryRange: ValueRange,
	secondaryRange: ValueRange | undefined,
	secondaryIdx: ReadonlySet<number>,
	grouping: 'clustered' | 'stacked' | 'percentStacked',
	sourceIndices: ReadonlyArray<number>,
): SeriesPlotResult {
	const primitives: SvgPrimitive[] = [],
		dataLabels: SvgText[] = [],
		series = chartData.series,
		palette = chartData.colorPalette,
		showLabels = chartData.style?.hasDataLabels,
		// Single-series bar/column with c:varyColors=1 gives every category a distinct
		// palette colour (a per-point c:dPt fill still wins). Multi-series charts keep
		// their per-series colours (varyColors has no cross-series meaning there).
		varyColorsSingle = chartData.varyColors === true && series.length === 1;

	if (grouping === 'clustered') {
		const seriesCount = Math.max(series.length, 1),
			barGroupWidth = layout.plotWidth / Math.max(catCount, 1),
			// Honour c:gapWidth (gap between clusters, % of a bar width) when parsed;
			// otherwise keep the legacy 0.7-of-group heuristic byte-for-byte.
			singleBarWidth =
				chartData.barGapWidth !== undefined
					? barGroupWidth / (seriesCount + Math.max(chartData.barGapWidth, 0) / 100)
					: (barGroupWidth * 0.7) / seriesCount,
			// Honour c:overlap (% overlap between adjacent series). overlap=0 reproduces
			// the original side-by-side layout exactly.
			overlap = chartData.barOverlap ?? 0,
			step = singleBarWidth * (1 - overlap / 100),
			clusterWidth = singleBarWidth + step * (seriesCount - 1),
			groupOffset = (barGroupWidth - clusterWidth) / 2;

		for (let displayIndex = 0; displayIndex < catCount; displayIndex++) {
			const sourceIndex = sourceIndices[displayIndex] ?? displayIndex;
			for (let si = 0; si < series.length; si++) {
				const val = series[si].values[sourceIndex] ?? 0,
					x = layout.plotLeft + barGroupWidth * displayIndex + groupOffset + step * si,
					activeRange = secondaryIdx.has(si) && secondaryRange ? secondaryRange : primaryRange,
					zeroY = valueToY(0, activeRange, layout.plotTop, layout.plotBottom),
					valY = valueToY(val, activeRange, layout.plotTop, layout.plotBottom),
					y = Math.min(zeroY, valY),
					h = Math.max(Math.abs(zeroY - valY), 1),
					baseFill = varyColorsSingle
						? resolveVaryColorFill(series[si], sourceIndex, paletteColor(sourceIndex, palette))
						: (resolveDataPointFill(series[si], sourceIndex, paletteColor(si, palette)) ??
							seriesColor(series[si], si, palette));
				primitives.push({
					kind: 'rect',
					x,
					y,
					w: singleBarWidth,
					h,
					fill: invertNegativeFill(series[si], sourceIndex, val, baseFill),
					rx: 1,
					part: { role: 'dataPoint', seriesIndex: si, pointIndex: sourceIndex },
					title: buildMarkTooltip(
						series[si].name,
						chartData.categories[sourceIndex],
						val,
						series[si].numberFormat,
					),
				} satisfies SvgRect);

				if (showLabels) {
					// c:showVal / c:showCatName / c:showPercent decide what the label
					// says; the historical raw value is what you get when nothing does.
					const label = buildDataLabelText({
						chartData,
						series: series[si],
						pointIndex: sourceIndex,
						value: val,
					});
					if (label !== undefined) {
						// c:dLblPos (ctr/inBase/inEnd/outEnd) decides where on the bar the
						// label sits; a per-point c:dLbl/c:layout drag shifts it further.
						const anchor = resolveBarLabelPlacement(
							chartData,
							series[si],
							sourceIndex,
							{ x, y, width: singleBarWidth, height: h },
							val,
							'vertical',
							{ width: layout.svgWidth, height: layout.svgHeight },
						);
						dataLabels.push({
							kind: 'text',
							x: anchor.x,
							y: anchor.y,
							text: label.text,
							fontSize: DEFAULT_CHART_DATA_LABEL_PX,
							fill: label.color ?? '#334155',
							textAnchor: anchor.textAnchor,
							...(anchor.dominantBaseline ? { dominantBaseline: anchor.dominantBaseline } : {}),
							...dataLabelFontOverride(
								resolveDataLabelTextStyle(chartData, series[si], sourceIndex),
							),
						});
					}
				}
			}
		}
		return { primitives, dataLabels };
	}

	// Non-percent stacked: preserve the original `computeStackedBarRects` geometry
	// byte-for-byte (bar width 0.7, running from the zero line), with the original
	// abs-value data labels. Only percentStacked uses the normalised running-sum
	// path below (matching React's `renderStackedBarChart`).
	if (grouping === 'stacked') {
		const displaySeries = series.map((entry) => ({
				...entry,
				values: sourceIndices.map((sourceIndex) => entry.values[sourceIndex] ?? 0),
			})),
			rects = computeStackedBarRects(displaySeries, catCount, layout, primaryRange, palette);
		for (const r of rects) {
			let fill = r.fill,
				part: SvgRect['part'],
				title: string | undefined;
			if (r.seriesIndex !== undefined && r.pointIndex !== undefined) {
				const sourcePointIndex = sourceIndices[r.pointIndex] ?? r.pointIndex;
				fill = resolveDataPointFill(series[r.seriesIndex], sourcePointIndex, r.fill) ?? r.fill;
				// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
				const value = series[r.seriesIndex].values[sourcePointIndex] ?? 0;
				fill = invertNegativeFill(series[r.seriesIndex], sourcePointIndex, value, fill);
				part = { role: 'dataPoint', seriesIndex: r.seriesIndex, pointIndex: sourcePointIndex };
				title = buildMarkTooltip(
					series[r.seriesIndex].name,
					chartData.categories[sourcePointIndex],
					value,
					series[r.seriesIndex].numberFormat,
				);
			}
			primitives.push({ kind: 'rect', x: r.x, y: r.y, w: r.w, h: r.h, fill, rx: 1, part, title });
		}
		if (showLabels) {
			pushClusteredStackedLabels(
				chartData,
				series,
				sourceIndices,
				catCount,
				layout,
				primaryRange,
				dataLabels,
			);
		}
		return { primitives, dataLabels };
	}

	// percentStacked: normalise each category to 100% with in-bar percent labels.
	// Split into its own module (`chart-cartesian-percent-stacked.ts`) to keep
	// this file within the repo's ~300-LOC limit; `invertNegativeFill` is
	// injected since it is this file's own helper.
	return buildPercentStackedBars(
		chartData,
		catCount,
		layout,
		primaryRange,
		sourceIndices,
		invertNegativeFill,
	);
}
