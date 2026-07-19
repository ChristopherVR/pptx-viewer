/**
 * Element-creation tools for richer element types the plain {@link addElement}
 * tool cannot build: charts and SmartArt diagrams. Each executor routes a slides
 * mutation through {@link routeWrite} (staged by default, one undoable entry) and
 * constructs the element via the same shared/core builders the toolbar Insert
 * actions use, so the result renders and saves like any hand-inserted element.
 */

import { createChartElement } from 'pptx-viewer-core';
import type {
	ChartPptxElement,
	PptxChartType,
	SmartArtLayout,
	SmartArtPptxElement,
} from 'pptx-viewer-core';

import {
	buildSmartArtPresetData,
	createDefaultChartElement,
	DEFAULT_INSERT_CHART_TYPE,
	INSERT_CHART_TYPES,
	PRESETS,
} from '../../render';
import type { AiToolContext, AiToolExecutor } from './executor-base';
import { newElementId, requireSlide, routeWrite } from './executor-base';

/** Chart families the assistant can insert (mirrors the Insert toolbar). */
export const CREATE_CHART_TYPES: readonly PptxChartType[] = INSERT_CHART_TYPES.map((o) => o.type);

/** SmartArt preset layout names the assistant can insert. */
export const CREATE_SMARTART_LAYOUTS: readonly SmartArtLayout[] = PRESETS.map((p) => p.layout);

interface CreateChartInput {
	slideIndex: number;
	chartType?: string;
	title?: string;
	categories?: string[];
	series?: Array<{ name: string; values: number[]; color?: string }>;
	legend?: boolean;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
}

interface AddSmartArtInput {
	slideIndex: number;
	layout?: string;
	nodes?: string[];
	x?: number;
	y?: number;
	width?: number;
	height?: number;
}

/** Resolve + validate a chart type, falling back to the default when omitted. */
function resolveChartType(value: string | undefined): PptxChartType {
	if (value === undefined) {
		return DEFAULT_INSERT_CHART_TYPE;
	}
	if (!CREATE_CHART_TYPES.includes(value as PptxChartType)) {
		throw new Error(
			`Unknown chart type '${value}'. Valid types: ${CREATE_CHART_TYPES.join(', ')}.`,
		);
	}
	return value as PptxChartType;
}

/** Categories to use when a caller supplies series but no explicit labels. */
function deriveCategories(series: CreateChartInput['series']): string[] {
	const count = Math.max(1, series?.[0]?.values.length ?? 0);
	return Array.from({ length: count }, (_v, i) => `Category ${i + 1}`);
}

function buildChartElement(
	id: string,
	chartType: PptxChartType,
	p: CreateChartInput,
): ChartPptxElement {
	const position = { x: p.x, y: p.y, width: p.width, height: p.height };
	const hasData = (p.series?.length ?? 0) > 0 || (p.categories?.length ?? 0) > 0;
	let el: ChartPptxElement;
	if (hasData) {
		const categories = p.categories ?? deriveCategories(p.series);
		const series = p.series ?? [{ name: 'Series 1', values: categories.map(() => 0) }];
		el = createChartElement(
			chartType,
			{ categories, series, title: p.title ?? 'Chart Title', hasLegend: p.legend ?? true },
			position,
		);
	} else {
		el = createDefaultChartElement(chartType, position);
		if (el.chartData) {
			if (p.title !== undefined) {
				el.chartData.title = p.title;
			}
			if (p.legend !== undefined) {
				el.chartData.style = { ...el.chartData.style, hasLegend: p.legend };
			}
		}
	}
	el.id = id;
	return el;
}

const createChart: AiToolExecutor = (ctx: AiToolContext, input: unknown) => {
	const p = input as CreateChartInput;
	const chartType = resolveChartType(p.chartType);
	const id = newElementId();
	const result = routeWrite(
		ctx,
		`Add ${chartType} chart to slide ${p.slideIndex + 1}`,
		(slides) => {
			const slide = requireSlide(slides, p.slideIndex);
			slide.elements.push(buildChartElement(id, chartType, p));
			return slides;
		},
	);
	return { ...result, elementId: id };
};

/** Resolve + validate a SmartArt layout, falling back to the default when omitted. */
function resolveLayout(value: string | undefined): SmartArtLayout {
	if (value === undefined) {
		return 'basicBlockList';
	}
	if (!CREATE_SMARTART_LAYOUTS.includes(value as SmartArtLayout)) {
		throw new Error(
			`Unknown SmartArt layout '${value}'. Valid layouts: ${CREATE_SMARTART_LAYOUTS.join(', ')}.`,
		);
	}
	return value as SmartArtLayout;
}

function buildSmartArtElement(
	id: string,
	layout: SmartArtLayout,
	items: string[],
	p: AddSmartArtInput,
): SmartArtPptxElement {
	return {
		type: 'smartArt',
		id,
		name: 'SmartArt',
		x: p.x ?? 100,
		y: p.y ?? 120,
		width: p.width ?? 600,
		height: p.height ?? 300,
		smartArtData: buildSmartArtPresetData(layout, items),
	};
}

const addSmartArt: AiToolExecutor = (ctx: AiToolContext, input: unknown) => {
	const p = input as AddSmartArtInput;
	const layout = resolveLayout(p.layout);
	const preset = PRESETS.find((pr) => pr.layout === layout);
	const items = p.nodes && p.nodes.length > 0 ? p.nodes : (preset?.defaultItems ?? ['Item 1']);
	const id = newElementId();
	const result = routeWrite(
		ctx,
		`Add ${layout} SmartArt to slide ${p.slideIndex + 1}`,
		(slides) => {
			const slide = requireSlide(slides, p.slideIndex);
			slide.elements.push(buildSmartArtElement(id, layout, items, p));
			return slides;
		},
	);
	return { ...result, elementId: id };
};

/** Element-creation executors keyed by tool name. */
export const createExecutors = {
	create_chart: createChart,
	add_smartart: addSmartArt,
} satisfies Record<string, AiToolExecutor>;
