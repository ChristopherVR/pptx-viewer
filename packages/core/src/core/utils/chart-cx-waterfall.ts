import type { PptxChartWaterfallOptions, XmlObject } from '../types';
import type { XmlLookupLike } from './chart-cx-parser';

function parseBoolean(value: unknown): boolean | undefined {
	const normalized = String(value ?? '')
		.trim()
		.toLowerCase();
	if (normalized === '1' || normalized === 'true') {
		return true;
	}
	if (normalized === '0' || normalized === 'false') {
		return false;
	}
	return undefined;
}

/** Parse waterfall subtotal indexes and connector visibility from ChartEx layout properties. */
export function parseCxWaterfallOptions(
	series: XmlObject,
	xmlLookup: XmlLookupLike,
): PptxChartWaterfallOptions | undefined {
	if (series['@_layoutId'] !== 'waterfall') {
		return undefined;
	}
	const layoutPr = xmlLookup.getChildByLocalName(series, 'layoutPr');
	if (!layoutPr) {
		return undefined;
	}
	const visibility = xmlLookup.getChildByLocalName(layoutPr, 'visibility');
	const connectorLines = parseBoolean(visibility?.['@_connectorLines']);
	const subtotals = xmlLookup.getChildByLocalName(layoutPr, 'subtotals');
	const subtotalIndices = subtotals
		? xmlLookup
				.getChildrenArrayByLocalName(subtotals, 'idx')
				.map((node) => Number.parseInt(String(node['@_val'] ?? ''), 10))
				.filter((index) => Number.isInteger(index) && index >= 0)
		: undefined;
	if (connectorLines === undefined && subtotalIndices === undefined) {
		return undefined;
	}
	return {
		...(connectorLines === undefined ? {} : { connectorLines }),
		...(subtotalIndices === undefined ? {} : { subtotalIndices }),
	};
}
