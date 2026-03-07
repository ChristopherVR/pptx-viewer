/**
 * Parser for Office 2016+ extended chart types (cx: namespace).
 *
 * cx: charts use `cx:plotArea > cx:plotAreaRegion > cx:series` with
 * `cx:data > cx:numDim / cx:strDim` instead of the classic
 * `c:barChart > c:ser > c:cat / c:val` structure.
 *
 * This module extracts basic series data so existing renderers can
 * display treemap, sunburst, waterfall, funnel, boxWhisker, and
 * histogram charts.
 */

import type { XmlObject, PptxChartData } from '../types';

/** Minimal xml-lookup interface needed by the cx: parser. */
export interface XmlLookupLike {
	getChildByLocalName(
		parent: XmlObject | undefined,
		localName: string,
	): XmlObject | undefined;
	getChildrenArrayByLocalName(
		parent: XmlObject | undefined,
		localName: string,
	): XmlObject[];
	getScalarChildByLocalName(
		parent: XmlObject | undefined,
		localName: string,
	): string | number | boolean | undefined;
}

/**
 * Parse series data from a cx: namespace plotArea.
 *
 * @returns categories and series arrays, or `undefined` if no series found.
 */
export function parseCxChartSeries(
	plotArea: XmlObject,
	xmlLookup: XmlLookupLike,
): { categories: string[]; series: PptxChartData['series'] } | undefined {
	const plotRegion = xmlLookup.getChildByLocalName(
		plotArea,
		'plotAreaRegion',
	);
	if (!plotRegion) return undefined;

	const cxSeriesList = xmlLookup.getChildrenArrayByLocalName(
		plotRegion,
		'series',
	);
	if (cxSeriesList.length === 0) return undefined;

	const categories: string[] = [];
	const series: PptxChartData['series'] = cxSeriesList.map(
		(ser, serIndex) => {
			const dataNode = xmlLookup.getChildByLocalName(ser, 'data');
			const strDim = xmlLookup.getChildByLocalName(dataNode, 'strDim');
			const numDim = xmlLookup.getChildByLocalName(dataNode, 'numDim');

			// Extract category labels from strDim (first series only)
			if (serIndex === 0 && strDim) {
				const strLvl = xmlLookup.getChildByLocalName(strDim, 'lvl');
				const strPts = xmlLookup.getChildrenArrayByLocalName(
					strLvl,
					'pt',
				);
				for (const pt of strPts) {
					const val = String(
						xmlLookup.getScalarChildByLocalName(pt, 'v') || '',
					).trim();
					if (val) categories.push(val);
				}
			}

			// Extract numeric values from numDim
			const values: number[] = [];
			if (numDim) {
				const numLvl = xmlLookup.getChildByLocalName(numDim, 'lvl');
				const numPts = xmlLookup.getChildrenArrayByLocalName(
					numLvl,
					'pt',
				);
				for (const pt of numPts) {
					const v = Number.parseFloat(
						String(
							xmlLookup.getScalarChildByLocalName(pt, 'v') || '',
						),
					);
					if (Number.isFinite(v)) values.push(v);
				}
			}

			// Series name from tx > txData > v
			const txNode = xmlLookup.getChildByLocalName(ser, 'tx');
			const txData = xmlLookup.getChildByLocalName(txNode, 'txData');
			const serName = String(
				xmlLookup.getScalarChildByLocalName(txData, 'v') || '',
			).trim();

			return {
				name: serName || `Series ${serIndex + 1}`,
				values: values.length > 0 ? values : [0],
			};
		},
	);

	return { categories, series };
}
