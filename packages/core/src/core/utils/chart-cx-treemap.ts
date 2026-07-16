import type { PptxChartTreemapOptions, XmlObject } from '../types';
import type { XmlLookupLike } from './chart-cx-parser';

const PARENT_LABEL_LAYOUTS = new Set(['none', 'banner', 'overlapping']);

/** Parse ChartEx treemap layout properties from a series. */
export function parseCxTreemapOptions(
	series: XmlObject,
	xmlLookup: XmlLookupLike,
): PptxChartTreemapOptions | undefined {
	const layoutPr = xmlLookup.getChildByLocalName(series, 'layoutPr');
	const parentLabelLayout = xmlLookup.getChildByLocalName(layoutPr, 'parentLabelLayout');
	const value = String(parentLabelLayout?.['@_val'] ?? '').trim();
	if (!PARENT_LABEL_LAYOUTS.has(value)) {
		return undefined;
	}
	return { parentLabelLayout: value as PptxChartTreemapOptions['parentLabelLayout'] };
}
