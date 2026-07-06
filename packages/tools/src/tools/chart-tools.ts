import type { ChartPptxElement } from 'pptx-viewer-core';
import {
	setChartType,
	addChartSeries,
	removeChartSeries,
	setChartCategories,
	updateChartSeriesValues,
	setChartTitle,
	setChartGrouping,
	setChartLegend,
	setChartDataLabels,
	setChartAxis,
	ChartBuilder,
} from 'pptx-viewer-core';
import type { PptxChartLegendPosition, PptxChartAxisType, ChartAxisEdit } from 'pptx-viewer-core';

import type { ToolContext, ToolResult } from '../types.js';
import { validateSlideIndex } from './helpers.js';

// ── updateChart ──────────────────────────────────────────────────────────────

export interface UpdateChartParams {
	slideIndex: number;
	elementId: string;
	chartType?: string;
	title?: string;
	grouping?: 'clustered' | 'stacked' | 'percentStacked';
	legend?: { show?: boolean; position?: string };
	dataLabels?: {
		show?: boolean;
		showValue?: boolean;
		showCategory?: boolean;
		showSeriesName?: boolean;
		showPercent?: boolean;
	};
	axis?: { type: string; edit: ChartAxisEdit };
	categories?: string[];
}

export function updateChart(
	ctx: ToolContext,
	params: UpdateChartParams,
): ToolResult<{ elementId: string }> {
	const err = validateSlideIndex(params.slideIndex, ctx.pptxData.slides.length);
	if (err) {
		throw new Error(err);
	}

	const slide = ctx.pptxData.slides[params.slideIndex];
	const el = slide.elements.find((e) => e.id === params.elementId);
	if (!el) {
		throw new Error(`Element '${params.elementId}' not found on slide ${params.slideIndex}.`);
	}
	if (el.type !== 'chart') {
		throw new Error(`Element '${params.elementId}' is not a chart.`);
	}

	const chart = el as ChartPptxElement;
	if (params.chartType) {
		setChartType(chart, params.chartType as Parameters<typeof setChartType>[1]);
	}
	if (params.title !== undefined) {
		setChartTitle(chart, params.title);
	}
	if (params.grouping) {
		setChartGrouping(chart, params.grouping);
	}
	if (params.legend) {
		setChartLegend(chart, {
			show: params.legend.show,
			position: params.legend.position as PptxChartLegendPosition,
		});
	}
	if (params.dataLabels) {
		setChartDataLabels(chart, params.dataLabels);
	}
	if (params.axis) {
		setChartAxis(chart, params.axis.type as PptxChartAxisType, params.axis.edit);
	}
	if (params.categories) {
		setChartCategories(chart, params.categories);
	}

	return { pptxData: ctx.pptxData, dirty: true, result: { elementId: params.elementId } };
}

// ── addChartSeriesT ──────────────────────────────────────────────────────────

export interface AddChartSeriesParams {
	slideIndex: number;
	elementId: string;
	name: string;
	values: number[];
	color?: string;
}

export function addChartSeriesT(
	ctx: ToolContext,
	params: AddChartSeriesParams,
): ToolResult<{ elementId: string; seriesCount: number }> {
	const err = validateSlideIndex(params.slideIndex, ctx.pptxData.slides.length);
	if (err) {
		throw new Error(err);
	}

	const slide = ctx.pptxData.slides[params.slideIndex];
	const el = slide.elements.find((e) => e.id === params.elementId);
	if (!el) {
		throw new Error(`Element '${params.elementId}' not found on slide ${params.slideIndex}.`);
	}
	if (el.type !== 'chart') {
		throw new Error(`Element '${params.elementId}' is not a chart.`);
	}

	const chart = el as ChartPptxElement;
	addChartSeries(chart, { name: params.name, values: params.values, color: params.color });
	const seriesCount = chart.chartData?.series?.length ?? 0;

	return {
		pptxData: ctx.pptxData,
		dirty: true,
		result: { elementId: params.elementId, seriesCount },
	};
}

// ── removeChartSeriesT ───────────────────────────────────────────────────────

export interface RemoveChartSeriesParams {
	slideIndex: number;
	elementId: string;
	seriesIndex: number;
}

export function removeChartSeriesT(
	ctx: ToolContext,
	params: RemoveChartSeriesParams,
): ToolResult<{ elementId: string; seriesCount: number }> {
	const err = validateSlideIndex(params.slideIndex, ctx.pptxData.slides.length);
	if (err) {
		throw new Error(err);
	}

	const slide = ctx.pptxData.slides[params.slideIndex];
	const el = slide.elements.find((e) => e.id === params.elementId);
	if (!el) {
		throw new Error(`Element '${params.elementId}' not found on slide ${params.slideIndex}.`);
	}
	if (el.type !== 'chart') {
		throw new Error(`Element '${params.elementId}' is not a chart.`);
	}

	const chart = el as ChartPptxElement;
	removeChartSeries(chart, params.seriesIndex);
	const seriesCount = chart.chartData?.series?.length ?? 0;

	return {
		pptxData: ctx.pptxData,
		dirty: true,
		result: { elementId: params.elementId, seriesCount },
	};
}

// ── updateChartSeriesData ────────────────────────────────────────────────────

export interface UpdateChartSeriesDataParams {
	slideIndex: number;
	elementId: string;
	seriesIndex: number;
	values: number[];
}

export function updateChartSeriesData(
	ctx: ToolContext,
	params: UpdateChartSeriesDataParams,
): ToolResult<{ elementId: string }> {
	const err = validateSlideIndex(params.slideIndex, ctx.pptxData.slides.length);
	if (err) {
		throw new Error(err);
	}

	const slide = ctx.pptxData.slides[params.slideIndex];
	const el = slide.elements.find((e) => e.id === params.elementId);
	if (!el) {
		throw new Error(`Element '${params.elementId}' not found on slide ${params.slideIndex}.`);
	}
	if (el.type !== 'chart') {
		throw new Error(`Element '${params.elementId}' is not a chart.`);
	}

	const chart = el as ChartPptxElement;
	updateChartSeriesValues(chart, params.seriesIndex, params.values);

	return { pptxData: ctx.pptxData, dirty: true, result: { elementId: params.elementId } };
}

// ── createChart ──────────────────────────────────────────────────────────────

export interface CreateChartParams {
	slideIndex: number;
	chartType: string;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	title?: string;
	categories?: string[];
	series?: Array<{ name: string; values: number[]; color?: string }>;
	legend?: { show: boolean; position?: string };
}

export interface CreateChartResult {
	elementId: string;
	slideIndex: number;
}

export function createChart(
	ctx: ToolContext,
	params: CreateChartParams,
): ToolResult<CreateChartResult> {
	const err = validateSlideIndex(params.slideIndex, ctx.pptxData.slides.length);
	if (err) {
		throw new Error(err);
	}

	const builder = ChartBuilder.create(
		params.chartType as Parameters<typeof ChartBuilder.create>[0],
	);
	builder.position(params.x ?? 100, params.y ?? 100);
	builder.size(params.width ?? 500, params.height ?? 350);
	if (params.title) {
		builder.title(params.title);
	}
	if (params.categories) {
		builder.categories(params.categories);
	}
	if (params.series) {
		for (const s of params.series) {
			builder.addSeries(s.name, s.values, s.color);
		}
	}
	if (params.legend) {
		builder.legend(
			params.legend.show,
			params.legend.position as 't' | 'b' | 'l' | 'r' | 'tr' | undefined,
		);
	}

	const chart = builder.build();
	const slide = ctx.pptxData.slides[params.slideIndex];
	slide.elements.push(chart);

	return {
		pptxData: ctx.pptxData,
		dirty: true,
		result: { elementId: chart.id, slideIndex: params.slideIndex },
	};
}
