import type { PptxChartDateCategories, XmlObject } from '../types';

interface XmlLookupLike {
	getChildByLocalName(parent: XmlObject | undefined, name: string): XmlObject | undefined;
	getChildrenArrayByLocalName(parent: XmlObject | undefined, name: string): XmlObject[];
	getScalarChildByLocalName(
		parent: XmlObject | undefined,
		name: string,
	): string | number | boolean | undefined;
}

/** Extract a classic c:cat numeric cache without converting serials to labels. */
export function parseChartDateCategories(
	seriesNode: XmlObject | undefined,
	xmlLookup: XmlLookupLike,
): PptxChartDateCategories | undefined {
	const cat = xmlLookup.getChildByLocalName(seriesNode, 'cat');
	const numeric =
		xmlLookup.getChildByLocalName(cat, 'numRef') || xmlLookup.getChildByLocalName(cat, 'numLit');
	if (!numeric) {
		return undefined;
	}
	const cache = xmlLookup.getChildByLocalName(numeric, 'numCache') || numeric;
	const values = xmlLookup
		.getChildrenArrayByLocalName(cache, 'pt')
		.sort((left, right) => Number(left['@_idx'] ?? 0) - Number(right['@_idx'] ?? 0))
		.map((point) => Number(xmlLookup.getScalarChildByLocalName(point, 'v')))
		.filter(Number.isFinite);
	if (values.length === 0) {
		return undefined;
	}
	const formatCode = String(xmlLookup.getScalarChildByLocalName(cache, 'formatCode') ?? '').trim();
	return { values, ...(formatCode ? { formatCode } : {}) };
}
