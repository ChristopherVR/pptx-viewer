/** Generate Office 2016+ ChartEx XML for SDK-created extended charts. */

import type { PptxChartData, PptxChartSeries, XmlObject } from '../types';

const NS_CX = 'http://schemas.microsoft.com/office/drawing/2014/chartex';
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function points(values: Array<string | number>): XmlObject[] {
	return values.map((value, index) => ({ '@_idx': String(index), '#text': String(value) }));
}

function indexedPoints(values: Array<string | number>, indices: number[] | undefined): XmlObject[] {
	return values.map((value, index) => ({
		'@_idx': String(indices?.[index] ?? index),
		'#text': String(value),
	}));
}

function seriesColor(series: PptxChartSeries): XmlObject | undefined {
	const color = series.color?.replace(/^#/u, '').toUpperCase();
	return color ? { 'a:solidFill': { 'a:srgbClr': { '@_val': color } } } : undefined;
}

function buildHistogramBinning(series: PptxChartSeries): XmlObject {
	const options = series.histogramOptions;
	const binning: XmlObject = {};
	if (options?.intervalClosed) {
		binning['@_intervalClosed'] = options.intervalClosed;
	}
	if (options?.underflow !== undefined) {
		binning['@_underflow'] = String(options.underflow);
	}
	if (options?.overflow !== undefined) {
		binning['@_overflow'] = String(options.overflow);
	}
	if (options?.binSize !== undefined) {
		binning['cx:binSize'] = String(options.binSize);
	} else if (options?.binCount !== undefined) {
		binning['cx:binCount'] = String(options.binCount);
	}
	return binning;
}

function buildData(chartData: PptxChartData, series: PptxChartSeries, id: number): XmlObject {
	const regionOptions = chartData.chartType === 'regionMap' ? series.regionMapOptions : undefined;
	const categoryLevels =
		(chartData.chartType === 'sunburst' || chartData.chartType === 'treemap') &&
		chartData.categoryLevels?.length
			? chartData.categoryLevels
			: [chartData.categories];
	const stringDimensions: XmlObject[] = [
		{
			'@_type': 'cat',
			'cx:lvl': categoryLevels.map((level) => ({
				'@_ptCount': String(level.length),
				'cx:pt':
					chartData.chartType === 'regionMap' && level === categoryLevels[0]
						? indexedPoints(level, regionOptions?.categorySourceIndices)
						: points(level),
			})),
		},
	];
	if (chartData.chartType === 'regionMap' && series.regionMapOptions?.entityIds?.length) {
		stringDimensions.push({
			'@_type': 'entityId',
			'cx:lvl': {
				'@_ptCount': String(series.regionMapOptions.entityIds.length),
				'cx:pt': indexedPoints(
					series.regionMapOptions.entityIds,
					series.regionMapOptions.entityIdSourceIndices,
				),
			},
		});
	}
	return {
		'@_id': String(id),
		'cx:strDim': stringDimensions,
		'cx:numDim': {
			'@_type':
				chartData.chartType === 'treemap' || chartData.chartType === 'sunburst'
					? 'size'
					: chartData.chartType === 'regionMap'
						? 'colorVal'
						: 'val',
			'cx:lvl': {
				'@_ptCount': String(series.values.length),
				'@_formatCode': 'General',
				'cx:pt': indexedPoints(series.values, regionOptions?.valueSourceIndices),
			},
		},
	};
}

function buildSeries(chartData: PptxChartData, series: PptxChartSeries, id: number): XmlObject {
	const layoutId =
		chartData.chartType === 'waterfall'
			? 'waterfall'
			: chartData.chartType === 'treemap'
				? 'treemap'
				: chartData.chartType === 'sunburst'
					? 'sunburst'
					: chartData.chartType === 'boxWhisker'
						? 'boxWhisker'
						: chartData.chartType === 'histogram'
							? series.histogramOptions?.layout === 'pareto'
								? 'paretoLine'
								: 'clusteredColumn'
							: chartData.chartType === 'regionMap'
								? 'regionMap'
								: 'funnel';
	const result: XmlObject = {
		'@_layoutId': layoutId,
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
	if (chartData.chartType === 'boxWhisker' && series.boxWhiskerOptions) {
		const options = series.boxWhiskerOptions;
		const visibility: XmlObject = {};
		if (options.showMeanLine !== undefined) {
			visibility['@_meanLine'] = options.showMeanLine ? '1' : '0';
		}
		if (options.showMeanMarker !== undefined) {
			visibility['@_meanMarker'] = options.showMeanMarker ? '1' : '0';
		}
		if (options.showInnerPoints !== undefined) {
			visibility['@_nonoutliers'] = options.showInnerPoints ? '1' : '0';
		}
		if (options.showOutlierPoints !== undefined) {
			visibility['@_outliers'] = options.showOutlierPoints ? '1' : '0';
		}
		const layoutPr: XmlObject = {};
		if (Object.keys(visibility).length > 0) {
			layoutPr['cx:visibility'] = visibility;
		}
		if (options.quartileMethod) {
			layoutPr['cx:statistics'] = { '@_quartileMethod': options.quartileMethod };
		}
		if (Object.keys(layoutPr).length > 0) {
			result['cx:layoutPr'] = layoutPr;
		}
	}
	if (chartData.chartType === 'histogram') {
		const binning = buildHistogramBinning(series);
		if (series.histogramOptions?.layout !== 'pareto' || Object.keys(binning).length > 0) {
			result['cx:layoutPr'] = { 'cx:binning': binning };
		}
	}
	if (chartData.chartType === 'waterfall' && series.waterfallOptions) {
		const options = series.waterfallOptions;
		const layoutPr: XmlObject = {};
		if (options.connectorLines !== undefined) {
			layoutPr['cx:visibility'] = {
				'@_connectorLines': options.connectorLines ? '1' : '0',
			};
		}
		if (options.subtotalIndices !== undefined) {
			layoutPr['cx:subtotals'] = {
				'cx:idx': options.subtotalIndices
					.filter((index) => Number.isInteger(index) && index >= 0)
					.map((index) => ({ '@_val': String(index) })),
			};
		}
		if (Object.keys(layoutPr).length > 0) {
			result['cx:layoutPr'] = layoutPr;
		}
	}
	if (chartData.chartType === 'treemap' && series.treemapOptions?.parentLabelLayout) {
		result['cx:layoutPr'] = {
			'cx:parentLabelLayout': { '@_val': series.treemapOptions.parentLabelLayout },
		};
	}
	if (chartData.chartType === 'regionMap') {
		const options = series.regionMapOptions;
		const layoutPr: XmlObject = {};
		if (options?.regionLabelLayout) {
			layoutPr['cx:regionLabelLayout'] = { '@_val': options.regionLabelLayout };
		}
		layoutPr['cx:geography'] = {
			...(options?.projectionType ? { '@_projectionType': options.projectionType } : {}),
			...(options?.viewedRegionType ? { '@_viewedRegionType': options.viewedRegionType } : {}),
			'@_cultureLanguage': options?.cultureLanguage ?? 'en-US',
			'@_cultureRegion': options?.cultureRegion ?? 'US',
			'@_attribution': options?.attribution ?? 'Microsoft',
			...(options?.geographyCache ? { 'cx:geoCache': options.geographyCache } : {}),
		};
		result['cx:layoutPr'] = layoutPr;
	}
	return result;
}

/** Whether this writer can currently author the requested ChartEx type. */
export function canGenerateChartEx(chartData: PptxChartData): boolean {
	return (
		chartData.chartType === 'funnel' ||
		chartData.chartType === 'waterfall' ||
		chartData.chartType === 'treemap' ||
		chartData.chartType === 'sunburst' ||
		chartData.chartType === 'boxWhisker' ||
		chartData.chartType === 'histogram' ||
		chartData.chartType === 'regionMap'
	);
}

/** Build a schema-shaped `cx:chartSpace` tree for an SDK-created extended chart. */
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
