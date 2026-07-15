/**
 * Generate a complete `c:chartSpace` XML tree from a {@link PptxChartData}
 * model, for SDK-created charts that have no original chart part to patch.
 *
 * Uses literal data caches (`c:numLit` / `c:strLit`, and `c:tx > c:v`) so the
 * generated chart is fully self-contained and needs no embedded workbook. The
 * output object feeds the fast-xml-parser builder. Covers the common chart
 * families (bar/line/area/radar with category + value axes, pie/doughnut with
 * none, scatter/bubble with two value axes); unknown types fall back to a bar
 * chart so a valid chart is always produced.
 *
 * @module utils/chart-xml-generator
 */

import type {
	PptxChartAxisFormatting,
	PptxChartData,
	PptxChartSeries,
	PptxChartType,
	XmlObject,
} from '../types';
import { applyChartAxisDisplayUnitsToXml } from './chart-axis-dispunits-serializer';
import { applyChartAxisLabelFormatting } from './chart-axis-label-formatting';
import { applyBubbleChartOptions } from './chart-bubble-options';
import { applyChartDataLabelsToXml } from './chart-data-labels-serializer';
import { applyChartDataTable } from './chart-data-table';
import { applySeriesErrBarsToXml } from './chart-errbars-serializer';
import { applyChartLayouts } from './chart-layout';
import { applySeriesDataLabelsToXml } from './chart-series-datalabel-serializer';
import { applySeriesTrendlinesToXml } from './chart-trendline-serializer';
import { applyChartUpDownBars } from './chart-up-down-bars';

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

function numLit(values: number[]): XmlObject {
	return {
		'c:numLit': {
			'c:formatCode': 'General',
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

/** Map the model chart type to its OOXML container tag and structural family. */
function resolveType(type: PptxChartType): {
	tag: string;
	family: 'pie' | 'doughnut' | 'scatter' | 'bubble' | 'line' | 'area' | 'radar' | 'bar';
} {
	switch (type) {
		case 'pie':
		case 'pie3D':
			return { tag: 'c:pieChart', family: 'pie' };
		case 'doughnut':
			return { tag: 'c:doughnutChart', family: 'doughnut' };
		case 'scatter':
			return { tag: 'c:scatterChart', family: 'scatter' };
		case 'bubble':
			return { tag: 'c:bubbleChart', family: 'bubble' };
		case 'line':
		case 'line3D':
			return { tag: 'c:lineChart', family: 'line' };
		case 'area':
		case 'area3D':
			return { tag: 'c:areaChart', family: 'area' };
		case 'radar':
			return { tag: 'c:radarChart', family: 'radar' };
		default:
			return { tag: 'c:barChart', family: 'bar' };
	}
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

	if (family === 'scatter' || family === 'bubble') {
		// Scatter/bubble use the category list as X values when numeric, else 1..n.
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
		ser['c:cat'] = strLit(categories);
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

function buildAxis(
	axId: number,
	crossId: number,
	pos: string,
	formatting?: PptxChartAxisFormatting,
): XmlObject {
	const axis: XmlObject = {
		'c:axId': { '@_val': String(axId) },
		'c:scaling': { 'c:orientation': { '@_val': 'minMax' } },
		'c:delete': { '@_val': '0' },
		'c:axPos': { '@_val': pos },
		'c:crossAx': { '@_val': String(crossId) },
	};
	if (formatting) {
		applyChartAxisLabelFormatting(axis, formatting, (key) => key.replace(/^.*:/u, ''));
	}
	if (formatting?.displayUnits) {
		applyChartAxisDisplayUnitsToXml(axis, formatting, (key) => key.replace(/^.*:/u, ''));
	}
	return axis;
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

/** Build the chart-type container (e.g. `c:barChart`) with its series. */
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
	} else {
		// pie / doughnut / bubble
		container['c:varyColors'] = { '@_val': family === 'bubble' ? '0' : '1' };
	}

	container['c:ser'] = chartData.series.map((s, i) =>
		buildSeries(family, s, i, chartData.categories),
	);
	if (family === 'bubble' && chartData.bubbleOptions) {
		applyBubbleChartOptions(container, chartData.bubbleOptions, (key) => key.replace(/^.*:/u, ''));
	}
	if (family === 'line' && chartData.upDownBars !== undefined) {
		applyChartUpDownBars(container, chartData.upDownBars, (key) => key.replace(/^.*:/u, ''));
	}

	if (family === 'bar') {
		container['c:gapWidth'] = { '@_val': '150' };
		container['c:axId'] = [{ '@_val': String(CAT_AX_ID) }, { '@_val': String(VAL_AX_ID) }];
	} else if (family === 'line' || family === 'area' || family === 'radar') {
		container['c:axId'] = [{ '@_val': String(CAT_AX_ID) }, { '@_val': String(VAL_AX_ID) }];
	} else if (family === 'scatter' || family === 'bubble') {
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

	if (family !== 'pie' && family !== 'doughnut' && SCATTER_LIKE.has(chartData.chartType)) {
		// Scatter/bubble use two value axes (emitted as a `c:valAx` array).
		plotArea['c:valAx'] = [
			buildAxis(CAT_AX_ID, VAL_AX_ID, 'b', axisFormatting(chartData, 'valAx', CAT_AX_ID, 0)),
			buildAxis(VAL_AX_ID, CAT_AX_ID, 'l', axisFormatting(chartData, 'valAx', VAL_AX_ID, 1)),
		];
	} else if (family !== 'pie' && family !== 'doughnut') {
		// Cartesian charts use a category axis crossed by a value axis.
		plotArea['c:catAx'] = buildAxis(
			CAT_AX_ID,
			VAL_AX_ID,
			'b',
			axisFormatting(chartData, 'catAx', CAT_AX_ID),
		);
		plotArea['c:valAx'] = buildAxis(
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
	const { tag, family } = resolveType(chartData.chartType);

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

	return {
		'c:chartSpace': {
			'@_xmlns:c': NS_C,
			'@_xmlns:a': NS_A,
			'@_xmlns:r': NS_R,
			'c:chart': chart,
		},
	};
}
