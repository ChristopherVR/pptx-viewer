import type { ChartPptxElement, PptxChartErrBars, PptxChartMarkerSymbol } from 'pptx-viewer-core';
import {
	setChartColorMapOverride,
	setChartDataPointExplosion,
	setChartDataPointLabel,
	setChartDataPointMarker,
	setChartDataPointStyle,
	setChartHelperLine,
	setChartSeriesErrorBars,
	setChartSeriesMarker,
	setChartSeriesTrendline,
} from 'pptx-viewer-core';

import type { ToolContext, ToolResult } from '../types.js';
import { validateSlideIndex } from './helpers.js';

/**
 * MCP tools for the chart formatting constructs W3-D1 moved from
 * "typed on the model but partially or never serialized" to native: per-point
 * shape formatting (`c:dPt/c:spPr`, full fill/stroke/width/dash), series
 * markers/trendlines/error bars, per-point label overrides (`c:dLbl`,
 * including its own `c:spPr`/`c:txPr`), the chart-level helper lines
 * (`c:dropLines`/`c:hiLowLines`), and the chart colour-map override
 * (`c:clrMapOvr`). None of these had an MCP surface before this change; the
 * core SDK already exposed most of them (`setChartSeriesMarker`,
 * `setChartSeriesTrendline`, `setChartSeriesErrorBars`,
 * `setChartDataPointExplosion`, `setChartDataPointLabel`), the rest are new
 * in `chart-formatting-operations.ts`.
 */

function findChartElement(
	ctx: ToolContext,
	slideIndex: number,
	elementId: string,
): ChartPptxElement {
	const err = validateSlideIndex(slideIndex, ctx.pptxData.slides.length);
	if (err) {
		throw new Error(err);
	}
	const slide = ctx.pptxData.slides[slideIndex];
	const el = slide.elements.find((e) => e.id === elementId);
	if (!el) {
		throw new Error(`Element '${elementId}' not found on slide ${slideIndex}.`);
	}
	if (el.type !== 'chart') {
		throw new Error(`Element '${elementId}' is not a chart.`);
	}
	return el as ChartPptxElement;
}

// ── formatChartDataPoint ─────────────────────────────────────────────────────

export interface FormatChartDataPointParams {
	slideIndex: number;
	elementId: string;
	seriesIndex: number;
	pointIndex: number;
	/** Fill colour; `null` clears just the style entirely (see `clearStyle`). */
	fillColor?: string;
	strokeColor?: string;
	strokeWidth?: number;
	strokeDashStyle?: string;
	/** Remove all `c:dPt/c:spPr` formatting for this point. */
	clearStyle?: boolean;
	/** Pie/doughnut slice pull-out distance (0-100). `null` clears it. */
	explosion?: number | null;
	marker?: { symbol?: PptxChartMarkerSymbol; size?: number; fillColor?: string } | null;
}

export function formatChartDataPoint(
	ctx: ToolContext,
	params: FormatChartDataPointParams,
): ToolResult<{ elementId: string }> {
	const chart = findChartElement(ctx, params.slideIndex, params.elementId);
	if (params.clearStyle) {
		setChartDataPointStyle(chart, params.seriesIndex, params.pointIndex, null);
	} else if (
		params.fillColor !== undefined ||
		params.strokeColor !== undefined ||
		params.strokeWidth !== undefined ||
		params.strokeDashStyle !== undefined
	) {
		setChartDataPointStyle(chart, params.seriesIndex, params.pointIndex, {
			...(params.fillColor !== undefined ? { fillColor: params.fillColor } : {}),
			...(params.strokeColor !== undefined ? { strokeColor: params.strokeColor } : {}),
			...(params.strokeWidth !== undefined ? { strokeWidth: params.strokeWidth } : {}),
			...(params.strokeDashStyle !== undefined ? { strokeDashStyle: params.strokeDashStyle } : {}),
		});
	}
	if (params.explosion !== undefined) {
		setChartDataPointExplosion(chart, params.seriesIndex, params.pointIndex, params.explosion);
	}
	if (params.marker !== undefined) {
		setChartDataPointMarker(chart, params.seriesIndex, params.pointIndex, params.marker);
	}
	return { pptxData: ctx.pptxData, dirty: true, result: { elementId: params.elementId } };
}

// ── formatChartDataLabel ─────────────────────────────────────────────────────

export interface FormatChartDataLabelParams {
	slideIndex: number;
	elementId: string;
	seriesIndex: number;
	pointIndex: number;
	/** Pass with no other field, and `remove: true`, to drop the override entirely. */
	remove?: boolean;
	showValue?: boolean;
	showCategory?: boolean;
	showSeriesName?: boolean;
	showPercent?: boolean;
	showLegendKey?: boolean;
	position?: 'bestFit' | 'b' | 'ctr' | 'inBase' | 'inEnd' | 'l' | 'outEnd' | 'r' | 't';
	/** Custom label text. Pass `''` to clear it. */
	text?: string;
	/** This label's own fill/line formatting; `null` removes it. */
	spPr?: {
		fillColor?: string;
		strokeColor?: string;
		strokeWidth?: number;
		strokeDashStyle?: string;
	} | null;
	/** This label's own font; `null` removes it. */
	txPr?: {
		fontFamily?: string;
		fontSize?: number;
		bold?: boolean;
		italic?: boolean;
		color?: string;
	} | null;
}

export function formatChartDataLabel(
	ctx: ToolContext,
	params: FormatChartDataLabelParams,
): ToolResult<{ elementId: string }> {
	const chart = findChartElement(ctx, params.slideIndex, params.elementId);
	if (params.remove) {
		setChartDataPointLabel(chart, params.seriesIndex, params.pointIndex, null);
		return { pptxData: ctx.pptxData, dirty: true, result: { elementId: params.elementId } };
	}
	setChartDataPointLabel(chart, params.seriesIndex, params.pointIndex, {
		...(params.showValue !== undefined ? { showValue: params.showValue } : {}),
		...(params.showCategory !== undefined ? { showCategory: params.showCategory } : {}),
		...(params.showSeriesName !== undefined ? { showSeriesName: params.showSeriesName } : {}),
		...(params.showPercent !== undefined ? { showPercent: params.showPercent } : {}),
		...(params.showLegendKey !== undefined ? { showLegendKey: params.showLegendKey } : {}),
		...(params.position !== undefined ? { position: params.position } : {}),
		...(params.text !== undefined ? { text: params.text } : {}),
		...(params.spPr !== undefined ? { spPr: params.spPr } : {}),
		...(params.txPr !== undefined ? { txPr: params.txPr } : {}),
	});
	return { pptxData: ctx.pptxData, dirty: true, result: { elementId: params.elementId } };
}

// ── formatChartSeries (marker / trendline / error bars) ─────────────────────

export interface FormatChartSeriesParams {
	slideIndex: number;
	elementId: string;
	seriesIndex: number;
	marker?: {
		symbol?: PptxChartMarkerSymbol;
		size?: number;
		fillColor?: string;
		strokeColor?: string;
		strokeWidth?: number;
		strokeDashStyle?: string;
	} | null;
	trendline?: {
		trendlineType: 'linear' | 'exponential' | 'logarithmic' | 'polynomial' | 'power' | 'movingAvg';
		color?: string;
		lineWidth?: number;
		lineDashStyle?: string;
		order?: number;
		period?: number;
		displayEq?: boolean;
		displayRSq?: boolean;
	} | null;
	errorBars?: (PptxChartErrBars & { width?: number; dashStyle?: string }) | null;
}

export function formatChartSeries(
	ctx: ToolContext,
	params: FormatChartSeriesParams,
): ToolResult<{ elementId: string }> {
	const chart = findChartElement(ctx, params.slideIndex, params.elementId);
	if (params.marker !== undefined) {
		if (params.marker === null) {
			setChartSeriesMarker(chart, params.seriesIndex, null);
		} else if (
			params.marker.strokeColor !== undefined ||
			params.marker.strokeWidth !== undefined ||
			params.marker.strokeDashStyle !== undefined
		) {
			// A full marker patch is needed to reach spPr fields beyond fillColor.
			setChartSeriesMarker(chart, params.seriesIndex, {
				symbol: params.marker.symbol ?? 'circle',
				...(params.marker.size !== undefined ? { size: params.marker.size } : {}),
				spPr: {
					...(params.marker.fillColor !== undefined ? { fillColor: params.marker.fillColor } : {}),
					...(params.marker.strokeColor !== undefined
						? { strokeColor: params.marker.strokeColor }
						: {}),
					...(params.marker.strokeWidth !== undefined
						? { strokeWidth: params.marker.strokeWidth }
						: {}),
					...(params.marker.strokeDashStyle !== undefined
						? { strokeDashStyle: params.marker.strokeDashStyle }
						: {}),
				},
			});
		} else {
			setChartSeriesMarker(chart, params.seriesIndex, params.marker);
		}
	}
	if (params.trendline !== undefined) {
		setChartSeriesTrendline(chart, params.seriesIndex, params.trendline);
	}
	if (params.errorBars !== undefined) {
		setChartSeriesErrorBars(chart, params.seriesIndex, params.errorBars);
	}
	return { pptxData: ctx.pptxData, dirty: true, result: { elementId: params.elementId } };
}

// ── setChartHelperLineT ──────────────────────────────────────────────────────

export interface SetChartHelperLineParams {
	slideIndex: number;
	elementId: string;
	line: 'dropLines' | 'hiLowLines';
	/** `null` removes the line entirely. */
	style: { color?: string; width?: number; dashStyle?: string } | null;
}

export function setChartHelperLineT(
	ctx: ToolContext,
	params: SetChartHelperLineParams,
): ToolResult<{ elementId: string }> {
	const chart = findChartElement(ctx, params.slideIndex, params.elementId);
	setChartHelperLine(chart, params.line, params.style);
	return { pptxData: ctx.pptxData, dirty: true, result: { elementId: params.elementId } };
}

// ── setChartColorMapOverrideT ────────────────────────────────────────────────

export interface SetChartColorMapOverrideParams {
	slideIndex: number;
	elementId: string;
	/** `null` removes the override entirely. */
	overrides: Record<string, string> | null;
}

export function setChartColorMapOverrideT(
	ctx: ToolContext,
	params: SetChartColorMapOverrideParams,
): ToolResult<{ elementId: string }> {
	const chart = findChartElement(ctx, params.slideIndex, params.elementId);
	setChartColorMapOverride(chart, params.overrides);
	return { pptxData: ctx.pptxData, dirty: true, result: { elementId: params.elementId } };
}
