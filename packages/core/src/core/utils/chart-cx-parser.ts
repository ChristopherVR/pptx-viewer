/**
 * Parser for Office 2016+ extended chart types (cx: namespace).
 *
 * cx: charts use `cx:plotArea > cx:plotAreaRegion > cx:series` with
 * `cx:data > cx:numDim / cx:strDim` instead of the classic
 * `c:barChart > c:ser > c:cat / c:val` structure.
 *
 * This module extracts series data including colors, data labels,
 * and multi-level hierarchical data so existing renderers can
 * display treemap, sunburst, waterfall, funnel, boxWhisker, and
 * histogram charts.
 */

import type { XmlObject, PptxChartData, PptxChartSeries, PptxChartDataLabel } from '../types';
import { parseCxBoxWhiskerOptions } from './chart-cx-box-whisker';
import { parseCxHistogramOptions } from './chart-cx-histogram';
import { parseCxRegionMapOptions } from './chart-cx-region-map';
import { parseCxTreemapOptions } from './chart-cx-treemap';
import { parseCxWaterfallOptions } from './chart-cx-waterfall';

/** Minimal xml-lookup interface needed by the cx: parser. */
export interface XmlLookupLike {
	getChildByLocalName(parent: XmlObject | undefined, localName: string): XmlObject | undefined;
	getChildrenArrayByLocalName(parent: XmlObject | undefined, localName: string): XmlObject[];
	getScalarChildByLocalName(
		parent: XmlObject | undefined,
		localName: string,
	): string | number | boolean | undefined;
}

/** cx:dataLabels visibility flags extracted from cx:series. */
export interface CxDataLabelVisibility {
	showVal?: boolean;
	showCatName?: boolean;
	showSerName?: boolean;
}

/**
 * Extract a hex color from a cx:spPr > a:solidFill element.
 * Returns a "#RRGGBB" string or undefined.
 */
function extractCxSeriesColor(ser: XmlObject, xmlLookup: XmlLookupLike): string | undefined {
	const spPr = xmlLookup.getChildByLocalName(ser, 'spPr');
	if (!spPr) {
		return undefined;
	}
	const solidFill = xmlLookup.getChildByLocalName(spPr, 'solidFill');
	if (!solidFill) {
		return undefined;
	}
	// Try srgbClr
	const srgb = xmlLookup.getChildByLocalName(solidFill, 'srgbClr');
	if (srgb) {
		const val = String(srgb['@_val'] || '').trim();
		if (val.length === 6) {
			return `#${val}`;
		}
	}
	return undefined;
}

/**
 * Parse cx:dataLabels on a series element.
 */
function parseCxDataLabels(
	ser: XmlObject,
	xmlLookup: XmlLookupLike,
): { visibility: CxDataLabelVisibility; labels: PptxChartDataLabel[] } | undefined {
	const dlNode = xmlLookup.getChildByLocalName(ser, 'dataLabels');
	if (!dlNode) {
		return undefined;
	}

	const visibility: CxDataLabelVisibility = {};

	// cx:dataLabels may have cx:visibility with @seriesName, @categoryName, @value attributes
	const visNode = xmlLookup.getChildByLocalName(dlNode, 'visibility');
	if (visNode) {
		visibility.showVal = visNode['@_value'] === '1' || visNode['@_value'] === 'true';
		visibility.showCatName =
			visNode['@_categoryName'] === '1' || visNode['@_categoryName'] === 'true';
		visibility.showSerName = visNode['@_seriesName'] === '1' || visNode['@_seriesName'] === 'true';
	}

	// Parse individual data label overrides (cx:dataLabel)
	const labels: PptxChartDataLabel[] = [];
	const dlItems = xmlLookup.getChildrenArrayByLocalName(dlNode, 'dataLabel');
	for (const dlItem of dlItems) {
		const idx = Number.parseInt(String(dlItem['@_idx'] || '0'), 10);
		labels.push({
			idx,
			showVal: visibility.showVal,
			showCatName: visibility.showCatName,
			showSerName: visibility.showSerName,
		});
	}

	return { visibility, labels };
}

/**
 * Extract all numeric dimensions from a cx:data element.
 * cx:chart may have multiple numDim elements with different types
 * (e.g., type="val", type="size" for bubble-like data).
 */
function extractAllNumericDimensions(
	dataNode: XmlObject | undefined,
	xmlLookup: XmlLookupLike,
): Map<string, number[]> {
	const result = new Map<string, number[]>();
	if (!dataNode) {
		return result;
	}

	const numDims = xmlLookup.getChildrenArrayByLocalName(dataNode, 'numDim');
	for (const numDim of numDims) {
		const dimType = String(numDim['@_type'] || 'val').trim();
		const values: number[] = [];
		const numLvl = xmlLookup.getChildByLocalName(numDim, 'lvl');
		const numPts = xmlLookup.getChildrenArrayByLocalName(numLvl, 'pt');
		for (const pt of numPts) {
			const raw = xmlLookup.getScalarChildByLocalName(pt, 'v') ?? pt['#text'];
			const v = Number.parseFloat(String(raw ?? ''));
			if (Number.isFinite(v)) {
				values.push(v);
			}
		}
		result.set(dimType, values);
	}

	return result;
}

/**
 * Extract all string dimensions from a cx:data element.
 * cx:chart may have multiple strDim with different types (e.g., "cat", "colorStr").
 */
function extractAllStringDimensions(
	dataNode: XmlObject | undefined,
	xmlLookup: XmlLookupLike,
): Map<string, string[][]> {
	const result = new Map<string, string[][]>();
	if (!dataNode) {
		return result;
	}

	const strDims = xmlLookup.getChildrenArrayByLocalName(dataNode, 'strDim');
	for (const strDim of strDims) {
		const dimType = String(strDim['@_type'] || 'cat').trim();
		const levels = xmlLookup.getChildrenArrayByLocalName(strDim, 'lvl').map((strLvl) =>
			xmlLookup.getChildrenArrayByLocalName(strLvl, 'pt').map((pt) => {
				const raw = xmlLookup.getScalarChildByLocalName(pt, 'v') ?? pt['#text'];
				return String(raw ?? '').trim();
			}),
		);
		result.set(dimType, levels);
	}

	return result;
}

/**
 * Parse series data from a cx: namespace plotArea.
 *
 * @returns categories and series arrays, or `undefined` if no series found.
 */
export function parseCxChartSeries(
	plotArea: XmlObject,
	xmlLookup: XmlLookupLike,
	chartSpace?: XmlObject,
):
	| {
			categories: string[];
			categoryLevels?: string[][];
			series: PptxChartData['series'];
			hasDataLabels?: boolean;
	  }
	| undefined {
	const plotRegion = xmlLookup.getChildByLocalName(plotArea, 'plotAreaRegion');
	if (!plotRegion) {
		return undefined;
	}

	const cxSeriesList = xmlLookup.getChildrenArrayByLocalName(plotRegion, 'series');
	if (cxSeriesList.length === 0) {
		return undefined;
	}

	const categories: string[] = [];
	let categoryLevels: string[][] | undefined;
	let hasDataLabels = false;
	const referencedData = indexReferencedChartData(chartSpace, xmlLookup);

	const series: PptxChartData['series'] = cxSeriesList.map((ser, serIndex) => {
		const dataIdNode = xmlLookup.getChildByLocalName(ser, 'dataId');
		const dataId = String(dataIdNode?.['@_val'] ?? dataIdNode?.['#text'] ?? '').trim();
		const dataNode =
			xmlLookup.getChildByLocalName(ser, 'data') ||
			(dataId.length > 0 ? referencedData.get(dataId) : undefined);

		// Extract all dimensions
		const strDims = extractAllStringDimensions(dataNode, xmlLookup);
		const numDims = extractAllNumericDimensions(dataNode, xmlLookup);

		// Extract category labels from the first strDim (type="cat" or first available)
		if (serIndex === 0) {
			const catDimLevels = strDims.get('cat') ?? strDims.values().next().value;
			if (catDimLevels) {
				categoryLevels = catDimLevels.map((level) => [...level]);
				for (const val of catDimLevels[0] ?? []) {
					if (val) {
						categories.push(val);
					}
				}
			}
		}

		// Extract primary numeric values (type="val" or first available)
		const values = numDims.get('val') ?? numDims.values().next().value ?? [];

		// Series name from tx > txData > v
		const txNode = xmlLookup.getChildByLocalName(ser, 'tx');
		const txData = xmlLookup.getChildByLocalName(txNode, 'txData');
		const serName = String(xmlLookup.getScalarChildByLocalName(txData, 'v') || '').trim();

		// Extract series color
		const color = extractCxSeriesColor(ser, xmlLookup);

		// Parse data labels
		const dlResult = parseCxDataLabels(ser, xmlLookup);
		if (
			dlResult &&
			(dlResult.visibility.showVal ||
				dlResult.visibility.showCatName ||
				dlResult.visibility.showSerName)
		) {
			hasDataLabels = true;
		}

		const result: PptxChartSeries = {
			name: serName || `Series ${serIndex + 1}`,
			values: values.length > 0 ? values : [0],
		};
		const boxWhiskerOptions = parseCxBoxWhiskerOptions(ser, xmlLookup);
		if (boxWhiskerOptions) {
			result.boxWhiskerOptions = boxWhiskerOptions;
		}
		const histogramOptions = parseCxHistogramOptions(ser, xmlLookup);
		if (histogramOptions) {
			result.histogramOptions = histogramOptions;
		}
		const waterfallOptions = parseCxWaterfallOptions(ser, xmlLookup);
		if (waterfallOptions) {
			result.waterfallOptions = waterfallOptions;
		}
		const regionMapOptions = parseCxRegionMapOptions(ser, dataNode, xmlLookup);
		if (regionMapOptions) {
			result.regionMapOptions = regionMapOptions;
		}
		const treemapOptions = parseCxTreemapOptions(ser, xmlLookup);
		if (treemapOptions) {
			result.treemapOptions = treemapOptions;
		}
		if (color) {
			result.color = color;
		}
		if (dlResult && dlResult.labels.length > 0) {
			result.dataLabels = dlResult.labels;
		}

		return result;
	});

	return { categories, categoryLevels, series, hasDataLabels };
}

/** Index the schema-standard `cx:chartData/cx:data` table by `@id`. */
function indexReferencedChartData(
	chartSpace: XmlObject | undefined,
	xmlLookup: XmlLookupLike,
): Map<string, XmlObject> {
	const result = new Map<string, XmlObject>();
	const chartData = xmlLookup.getChildByLocalName(chartSpace, 'chartData');
	for (const data of xmlLookup.getChildrenArrayByLocalName(chartData, 'data')) {
		const id = String(data['@_id'] ?? '').trim();
		if (id.length > 0) {
			result.set(id, data);
		}
	}
	return result;
}
