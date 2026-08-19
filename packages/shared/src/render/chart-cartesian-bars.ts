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

import type { SeriesPlotResult } from './chart-cartesian-plots';
import { buildDataLabelText } from './chart-data-label-text';
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

/** Per-category absolute totals (for percentStacked normalisation). */
function categoryTotals(series: ReadonlyArray<PptxChartSeries>, catCount: number): number[] {
	return Array.from({ length: catCount }, (_, ci) =>
		series.reduce((sum, s) => sum + Math.abs(s.values[ci] ?? 0), 0),
	);
}

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
					const text = buildDataLabelText({
						chartData,
						series: series[si],
						pointIndex: sourceIndex,
						value: val,
					});
					if (text !== undefined) {
						dataLabels.push({
							kind: 'text',
							x: x + singleBarWidth / 2,
							y: val >= 0 ? y - 4 : y + h + 10,
							text,
							fontSize: DEFAULT_CHART_DATA_LABEL_PX,
							fill: '#334155',
							textAnchor: 'middle',
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
	// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
	const barGroupWidth = layout.plotWidth / Math.max(catCount, 1),
		barW = barGroupWidth * 0.6,
		barOffset = (barGroupWidth - barW) / 2,
		displaySeries = series.map((entry) => ({
			...entry,
			values: sourceIndices.map((sourceIndex) => entry.values[sourceIndex] ?? 0),
		})),
		totals = categoryTotals(displaySeries, catCount);

	for (let ci = 0; ci < catCount; ci++) {
		let posRunning = 0,
			negRunning = 0;
		const catTotal = totals[ci] || 1;

		for (let si = 0; si < series.length; si++) {
			const sourceIndex = sourceIndices[ci] ?? ci,
				rawVal = series[si].values[sourceIndex] ?? 0,
				val = catTotal > 0 ? (rawVal / catTotal) * 100 : 0,
				isNeg = val < 0,
				base = isNeg ? negRunning : posRunning,
				top = base + val,
				x = layout.plotLeft + barGroupWidth * ci + barOffset,
				baseY = valueToY(base, primaryRange, layout.plotTop, layout.plotBottom),
				topY = valueToY(top, primaryRange, layout.plotTop, layout.plotBottom),
				y = Math.min(baseY, topY),
				h = Math.max(Math.abs(baseY - topY), 0.5),
				pctBaseFill =
					resolveDataPointFill(series[si], sourceIndex, paletteColor(si, palette)) ??
					seriesColor(series[si], si, palette);
			primitives.push({
				kind: 'rect',
				x,
				y,
				w: barW,
				h,
				fill: invertNegativeFill(series[si], sourceIndex, rawVal, pctBaseFill),
				part: { role: 'dataPoint', seriesIndex: si, pointIndex: sourceIndex },
				title: buildMarkTooltip(
					series[si].name,
					chartData.categories[sourceIndex],
					rawVal,
					series[si].numberFormat,
				),
			} satisfies SvgRect);

			if (showLabels && Math.abs(val) > 0) {
				dataLabels.push({
					kind: 'text',
					x: x + barW / 2,
					y: y + h / 2 + 3,
					text: `${Math.round(val)}%`,
					fontSize: DEFAULT_CHART_DATA_LABEL_PX,
					fill: '#ffffff',
					textAnchor: 'middle',
					fontWeight: 'bold',
				});
			}

			if (isNeg) {
				negRunning += val;
			} else {
				posRunning += val;
			}
		}
	}
	return { primitives, dataLabels };
}

/**
 * Push the abs-value stacked data labels matching the original cartesian builder:
 * one label per (category x series) at the bar mid, only when data labels are on.
 * The original builder emitted clustered-style labels for stacked too, so this
 * reproduces that exact output for byte-identity.
 */
function pushClusteredStackedLabels(
	chartData: PptxChartData,
	series: ReadonlyArray<PptxChartSeries>,
	sourceIndices: ReadonlyArray<number>,
	catCount: number,
	layout: PlotLayout,
	range: ValueRange,
	dataLabels: SvgText[],
): void {
	const barGroupWidth = layout.plotWidth / catCount,
		seriesCount = Math.max(series.length, 1),
		singleBarWidth = (barGroupWidth * 0.7) / seriesCount,
		groupOffset = (barGroupWidth - singleBarWidth * seriesCount) / 2;

	for (let ci = 0; ci < catCount; ci++) {
		const sourceIndex = sourceIndices[ci] ?? ci;
		for (let si = 0; si < series.length; si++) {
			const val = series[si].values[sourceIndex] ?? 0,
				x =
					layout.plotLeft +
					barGroupWidth * ci +
					groupOffset +
					singleBarWidth * si +
					singleBarWidth / 2,
				zeroY = valueToY(0, range, layout.plotTop, layout.plotBottom),
				valY = valueToY(val, range, layout.plotTop, layout.plotBottom),
				labelY = val >= 0 ? Math.min(zeroY, valY) - 4 : Math.max(zeroY, valY) + 10,
				text = buildDataLabelText({
					chartData,
					series: series[si],
					pointIndex: sourceIndex,
					value: val,
				});
			if (text === undefined) {
				continue;
			}
			dataLabels.push({
				kind: 'text',
				x,
				y: labelY,
				text,
				fontSize: DEFAULT_CHART_DATA_LABEL_PX,
				fill: '#334155',
				textAnchor: 'middle',
			});
		}
	}
}
