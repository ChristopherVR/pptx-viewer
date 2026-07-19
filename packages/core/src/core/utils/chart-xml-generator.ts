/** Generate self-contained ChartML for SDK-created charts. */

import type {
	PptxChartAxisFormatting,
	PptxChartData,
	PptxChartSeries,
	PptxChartType,
	XmlObject,
} from '../types';
import { applyBubbleChartOptions } from './chart-bubble-options';
import { applyChartDataLabelsToXml } from './chart-data-labels-serializer';
import { applyChartDataTable } from './chart-data-table';
import { applySeriesDataPointsToXml } from './chart-datapoint-serializer';
import { applySeriesErrBarsToXml } from './chart-errbars-serializer';
import { applyChartLayouts } from './chart-layout';
import { applySeriesMarkerToXml } from './chart-marker-serializer';
import { applySeriesDataLabelsToXml } from './chart-series-datalabel-serializer';
import { applyGeneratedChartSpaceMetadata } from './chart-space-metadata';
import { applySeriesTrendlinesToXml } from './chart-trendline-serializer';
import { applyChartUpDownBars } from './chart-up-down-bars';
import { buildGeneratedChartAxis } from './chart-xml-axis-generator';
import { resolveChartContainerType } from './chart-xml-container-map';

const NS_C = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

const CAT_AX_ID = 111111111;
const VAL_AX_ID = 222222222;

const SCATTER_LIKE = new Set<PptxChartType>(['scatter', 'bubble']);

function hex(color: string | undefined): string | undefined {
	return color ? color.replace(/^#/u, '').toUpperCase() : undefined;
}

function points(values: string[]): XmlObject[] {
	return values.map((v, i) => ({ '@_idx': String(i), 'c:v': v }));
}

function numLit(values: number[], formatCode = 'General'): XmlObject {
	return {
		'c:numLit': {
			'c:formatCode': formatCode,
			'c:ptCount': { '@_val': String(values.length) },
			'c:pt': points(values.map(String)),
		},
	};
}

function strLit(values: string[]): XmlObject {
	return {
		'c:strLit': {
			'c:ptCount': { '@_val': String(values.length) },
			'c:pt': points(values),
		},
	};
}

function fillSpPr(color: string | undefined, asLine: boolean): XmlObject | undefined {
	const h = hex(color);
	if (!h) {
		return undefined;
	}
	const fill = { 'a:solidFill': { 'a:srgbClr': { '@_val': h } } };
	return asLine ? { 'a:ln': fill } : fill;
}

function buildSeries(
	family: string,
	s: PptxChartSeries,
	index: number,
	categories: string[],
	dateCategories?: PptxChartData['dateCategories'],
): XmlObject {
	const ser: XmlObject = {
		'c:idx': { '@_val': String(index) },
		'c:order': { '@_val': String(index) },
		'c:tx': { 'c:v': s.name },
	};

	const spPr = fillSpPr(s.color, family === 'line' || family === 'radar' || family === 'scatter');
	if (spPr) {
		ser['c:spPr'] = spPr;
	}
	if (s.marker !== undefined) {
		applySeriesMarkerToXml(ser, s.marker, (key) => key.replace(/^.*:/u, ''));
	}
	if (s.dataPoints !== undefined) {
		applySeriesDataPointsToXml(ser, s.dataPoints, (key) => key.replace(/^.*:/u, ''));
	}

	if (family === 'scatter' || family === 'bubble') {
		const xs = categories.map((c, i) => {
			const n = Number.parseFloat(c);
			return Number.isFinite(n) ? n : i + 1;
		});
		ser['c:xVal'] = numLit(xs);
		ser['c:yVal'] = numLit(s.values);
		if (family === 'bubble') {
			ser['c:bubbleSize'] = numLit(s.values.map(() => 1));
		}
	} else {
		ser['c:cat'] = dateCategories
			? numLit(dateCategories.values, dateCategories.formatCode)
			: strLit(categories);
		ser['c:val'] = numLit(s.values);
	}
	if (s.dataLabels !== undefined) {
		applySeriesDataLabelsToXml(ser, s.dataLabels, (key) => key.replace(/^.*:/u, ''));
	}
	if (s.trendlines !== undefined) {
		applySeriesTrendlinesToXml(ser, s.trendlines, (key) => key.replace(/^.*:/u, ''));
	}
	if (s.errBars !== undefined) {
		applySeriesErrBarsToXml(ser, s.errBars, (key) => key.replace(/^.*:/u, ''));
	}
	return ser;
}

function axisFormatting(
	chartData: PptxChartData,
	type: PptxChartAxisFormatting['axisType'],
	id: number,
	index = 0,
): PptxChartAxisFormatting | undefined {
	return (
		chartData.axes?.find((axis) => axis.axisId === id) ??
		chartData.axes?.filter((axis) => axis.axisType === type)[index]
	);
}

function buildChartTypeContainer(chartData: PptxChartData, family: string): XmlObject {
	const container: XmlObject = {};
	if (family === 'bar') {
		container['c:barDir'] = { '@_val': 'col' };
		container['c:grouping'] = { '@_val': chartData.grouping ?? 'clustered' };
		container['c:varyColors'] = { '@_val': '0' };
	} else if (family === 'line' || family === 'area') {
		container['c:grouping'] = { '@_val': chartData.grouping ?? 'standard' };
		container['c:varyColors'] = { '@_val': '0' };
	} else if (family === 'radar') {
		container['c:radarStyle'] = { '@_val': 'marker' };
		container['c:varyColors'] = { '@_val': '0' };
	} else if (family === 'scatter') {
		container['c:scatterStyle'] = { '@_val': 'lineMarker' };
		container['c:varyColors'] = { '@_val': '0' };
	} else if (family === 'ofPie') {
		// A pie-of-pie / bar-of-pie needs its split type before the series.
		container['c:ofPieType'] = { '@_val': 'pie' };
		container['c:varyColors'] = { '@_val': '1' };
	} else if (family === 'stock' || family === 'surface') {
		// Stock and surface containers carry neither c:grouping nor c:varyColors;
		// hi/low lines (stock) and axes are added in the trailing block below.
	} else {
		container['c:varyColors'] = { '@_val': family === 'bubble' ? '0' : '1' };
	}

	container['c:ser'] = chartData.series.map((s, i) =>
		buildSeries(family, s, i, chartData.categories, chartData.dateCategories),
	);
	if (family === 'bubble' && chartData.bubbleOptions) {
		applyBubbleChartOptions(container, chartData.bubbleOptions, (key) => key.replace(/^.*:/u, ''));
	}
	if (family === 'line' && chartData.upDownBars !== undefined) {
		applyChartUpDownBars(container, chartData.upDownBars, (key) => key.replace(/^.*:/u, ''));
	}

	if (family === 'bar' || family === 'ofPie') {
		container['c:gapWidth'] = { '@_val': '150' };
	}
	if (family === 'stock') {
		// Stock charts join the high/low points across categories.
		container['c:hiLowLines'] = {};
	}
	if (
		family === 'bar' ||
		family === 'line' ||
		family === 'area' ||
		family === 'radar' ||
		family === 'scatter' ||
		family === 'bubble' ||
		family === 'stock' ||
		family === 'surface'
	) {
		container['c:axId'] = [{ '@_val': String(CAT_AX_ID) }, { '@_val': String(VAL_AX_ID) }];
	} else if (family === 'doughnut') {
		container['c:holeSize'] = { '@_val': '50' };
	}
	return container;
}

function buildPlotArea(chartData: PptxChartData, tag: string, family: string): XmlObject {
	const plotArea: XmlObject = { 'c:layout': {} };
	plotArea[tag] = buildChartTypeContainer(chartData, family);
	if (chartData.style) {
		applyChartDataLabelsToXml(plotArea, chartData.style, (key) => key.replace(/^.*:/u, ''));
	}

	// Pie-family containers (pie, doughnut, ofPie) have no cartesian axes.
	const hasAxes = family !== 'pie' && family !== 'doughnut' && family !== 'ofPie';
	if (hasAxes && SCATTER_LIKE.has(chartData.chartType)) {
		plotArea['c:valAx'] = [
			buildGeneratedChartAxis(
				CAT_AX_ID,
				VAL_AX_ID,
				'b',
				axisFormatting(chartData, 'valAx', CAT_AX_ID, 0),
			),
			buildGeneratedChartAxis(
				VAL_AX_ID,
				CAT_AX_ID,
				'l',
				axisFormatting(chartData, 'valAx', VAL_AX_ID, 1),
			),
		];
	} else if (hasAxes) {
		const dateAxis = chartData.dateCategories
			? axisFormatting(chartData, 'dateAx', CAT_AX_ID)
			: undefined;
		plotArea[dateAxis ? 'c:dateAx' : 'c:catAx'] = buildGeneratedChartAxis(
			CAT_AX_ID,
			VAL_AX_ID,
			'b',
			dateAxis ?? axisFormatting(chartData, 'catAx', CAT_AX_ID),
		);
		plotArea['c:valAx'] = buildGeneratedChartAxis(
			VAL_AX_ID,
			CAT_AX_ID,
			'l',
			axisFormatting(chartData, 'valAx', VAL_AX_ID),
		);
	}
	applyChartDataTable(plotArea, chartData.dataTable, (key) => key.replace(/^.*:/u, ''));
	return plotArea;
}

/**
 * Build a complete `c:chartSpace` object tree for the given chart model.
 * The result is ready to hand to the XML builder and write as a chart part.
 */
export function buildChartSpaceXml(chartData: PptxChartData): XmlObject {
	const { tag, family } = resolveChartContainerType(chartData.chartType);

	const chart: XmlObject = {};
	if (chartData.title) {
		chart['c:title'] = {
			'c:tx': {
				'c:rich': {
					'a:bodyPr': {},
					'a:lstStyle': {},
					'a:p': { 'a:r': { 'a:t': chartData.title } },
				},
			},
			'c:overlay': { '@_val': '0' },
		};
		chart['c:autoTitleDeleted'] = { '@_val': '0' };
	} else {
		chart['c:autoTitleDeleted'] = { '@_val': '1' };
	}

	chart['c:plotArea'] = buildPlotArea(chartData, tag, family);

	if (chartData.style?.hasLegend) {
		chart['c:legend'] = {
			'c:legendPos': { '@_val': chartData.style.legendPosition ?? 'r' },
			'c:overlay': { '@_val': '0' },
		};
	}
	chart['c:plotVisOnly'] = { '@_val': '1' };
	chart['c:dispBlanksAs'] = { '@_val': 'gap' };
	if (chartData.layouts) {
		applyChartLayouts(chart, chartData.layouts, (key) => key.replace(/^.*:/u, ''));
	}

	const result: XmlObject = {
		'c:chartSpace': {
			'@_xmlns:c': NS_C,
			'@_xmlns:a': NS_A,
			'@_xmlns:r': NS_R,
			'c:chart': chart,
		},
	};
	applyGeneratedChartSpaceMetadata(result, chartData);
	return result;
}
