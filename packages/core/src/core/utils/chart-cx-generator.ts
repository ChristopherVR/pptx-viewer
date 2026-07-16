/** Generate Office 2016+ ChartEx XML for SDK-created extended charts. */

import type { PptxChartData, PptxChartSeries, XmlObject } from '../types';

const NS_CX = 'http://schemas.microsoft.com/office/drawing/2014/chartex';
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function points(values: Array<string | number>): XmlObject[] {
	return values.map((value, index) => ({ '@_idx': String(index), '#text': String(value) }));
}

function seriesColor(series: PptxChartSeries): XmlObject | undefined {
	const color = series.color?.replace(/^#/u, '').toUpperCase();
	return color ? { 'a:solidFill': { 'a:srgbClr': { '@_val': color } } } : undefined;
}

function buildData(chartData: PptxChartData, series: PptxChartSeries, id: number): XmlObject {
	return {
		'@_id': String(id),
		'cx:strDim': {
			'@_type': 'cat',
			'cx:lvl': {
				'@_ptCount': String(chartData.categories.length),
				'cx:pt': points(chartData.categories),
			},
		},
		'cx:numDim': {
			'@_type': 'val',
			'cx:lvl': {
				'@_ptCount': String(series.values.length),
				'@_formatCode': 'General',
				'cx:pt': points(series.values),
			},
		},
	};
}

function buildSeries(chartData: PptxChartData, series: PptxChartSeries, id: number): XmlObject {
	const result: XmlObject = {
		'@_layoutId': 'funnel',
		'cx:tx': { 'cx:txData': { 'cx:v': series.name } },
	};
	const spPr = seriesColor(series);
	if (spPr) {
		result['cx:spPr'] = spPr;
	}
	if (chartData.style?.hasDataLabels) {
		result['cx:dataLabels'] = {
			'cx:visibility': { '@_categoryName': '1', '@_value': '1', '@_seriesName': '0' },
		};
	}
	result['cx:dataId'] = { '@_val': String(id) };
	return result;
}

/** Whether this writer can currently author the requested ChartEx type. */
export function canGenerateChartEx(chartData: PptxChartData): boolean {
	return chartData.chartType === 'funnel';
}

/** Build a schema-shaped `cx:chartSpace` tree for an SDK-created funnel chart. */
export function buildChartExSpaceXml(chartData: PptxChartData): XmlObject {
	if (!canGenerateChartEx(chartData)) {
		throw new Error(`ChartEx generation is not implemented for ${chartData.chartType}`);
	}
	const chart: XmlObject = {};
	if (chartData.title) {
		chart['cx:title'] = {
			'cx:tx': { 'cx:rich': { 'a:p': { 'a:r': { 'a:t': chartData.title } } } },
		};
	}
	chart['cx:plotArea'] = {
		'cx:plotAreaRegion': {
			'cx:series': chartData.series.map((series, index) => buildSeries(chartData, series, index)),
		},
	};
	return {
		'cx:chartSpace': {
			'@_xmlns:cx': NS_CX,
			'@_xmlns:a': NS_A,
			'@_xmlns:r': NS_R,
			'cx:chartData': {
				'cx:data': chartData.series.map((series, index) => buildData(chartData, series, index)),
			},
			'cx:chart': chart,
		},
	};
}
