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

import type { XmlObject, PptxChartData, PptxChartSeries } from '../types';
import { parseCxAxes, resolveCxTitleText } from './chart-cx-axis-parser';
import { parseCxBoxWhiskerOptions } from './chart-cx-box-whisker';
import { parseCxDataLabels } from './chart-cx-data-labels';
import { parseCxHistogramOptions } from './chart-cx-histogram';
import { parseCxRegionMapOptions } from './chart-cx-region-map';
import { extractCxSeriesColor } from './chart-cx-series-color';
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

/**
 * Minimal colour-resolver interface, matching the `ColorParserLike` pattern
 * classic chart parsers (`chart-axis-parser.ts`, `chart-series-detail-parser.ts`)
 * thread through: resolves a colour-choice wrapper node (`a:solidFill`, a
 * gradient stop, a pattern's `fgClr`, ...) against the deck's theme.
 * Optional throughout the cx: parser so callers that only have raw XML (no
 * theme) keep the original srgbClr-only behaviour.
 */
export interface ColorParserLike {
	parseColor(fillNode: XmlObject | undefined, placeholderColor?: string): string | undefined;
}

/**
 * Parse series data from a cx: namespace plotArea.
 *
 * @param chartRoot - The `cx:chart` element (parent of `plotArea`), needed to
 * resolve the chart-level `cx:title`. Omit when the caller doesn't need
 * `chartData.title`/`chartData.axes` populated (they simply won't be).
 * @param colorParser - Resolves theme colours (`a:schemeClr` etc.) for series
 * fills, axis chrome, and region-map value-color scales; omit to fall back to
 * literal `a:srgbClr` only.
 * @param resolveTypeface - Resolves a theme-font placeholder token
 * (`+mn-lt`, `+mj-lt`, ...) on axis/data-label `cx:txPr` fonts to the deck's
 * concrete theme face (C2-G1 data-label/axis half); omit to keep a literal
 * placeholder token as-is.
 * @returns categories and series arrays, or `undefined` if no series found.
 */
export function parseCxChartSeries(
	plotArea: XmlObject,
	xmlLookup: XmlLookupLike,
	chartSpace?: XmlObject,
	chartRoot?: XmlObject,
	colorParser?: ColorParserLike,
	resolveTypeface?: (raw: string) => string,
):
	| {
			categories: string[];
			categoryLevels?: string[][];
			series: PptxChartData['series'];
			hasDataLabels?: boolean;
			/**
			 * Chart-level fields this module can also resolve for a cx: chart
			 * (axes, title): spread onto the caller's `PptxChartData` result.
			 */
			chartData?: Partial<PptxChartData>;
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

		// Extract series color (schemeClr/gradFill/pattFill when colorParser is given)
		const color = extractCxSeriesColor(ser, xmlLookup, colorParser);

		// Parse data labels (visibility, per-point overrides, position/numFmt/txPr)
		const dlResult = parseCxDataLabels(ser, xmlLookup, colorParser, resolveTypeface);
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
		const regionMapOptions = parseCxRegionMapOptions(ser, dataNode, xmlLookup, colorParser);
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
		if (dlResult?.options && Object.keys(dlResult.options).length > 0) {
			result.dataLabelOptions = dlResult.options;
		}

		return result;
	});

	const chartData = buildCxChartData(plotArea, chartRoot, xmlLookup, colorParser, resolveTypeface);

	return {
		categories,
		categoryLevels,
		series,
		hasDataLabels,
		...(chartData ? { chartData } : {}),
	};
}

/** Chart-level fields (axes, title) this module can resolve for a cx: chart. */
function buildCxChartData(
	plotArea: XmlObject,
	chartRoot: XmlObject | undefined,
	xmlLookup: XmlLookupLike,
	colorParser: ColorParserLike | undefined,
	resolveTypeface?: (raw: string) => string,
): Partial<PptxChartData> | undefined {
	const result: Partial<PptxChartData> = {};

	const axes = parseCxAxes(plotArea, xmlLookup, colorParser, resolveTypeface);
	if (axes) {
		result.axes = axes;
	}

	const titleText = resolveCxTitleText(
		xmlLookup.getChildByLocalName(chartRoot, 'title'),
		xmlLookup,
	);
	if (titleText) {
		result.title = titleText;
	}

	return Object.keys(result).length > 0 ? result : undefined;
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
