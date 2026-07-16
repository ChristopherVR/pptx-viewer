import type { PptxChartBoxWhiskerOptions, XmlObject } from '../types';
import type { XmlLookupLike } from './chart-cx-parser';

function parseBooleanAttribute(node: XmlObject | undefined, name: string): boolean | undefined {
	const value = node?.[`@_${name}`];
	if (value === undefined) {
		return undefined;
	}
	return value === '1' || value === 'true';
}

/** Parse schema-defined ChartEx box-and-whisker series layout properties. */
export function parseCxBoxWhiskerOptions(
	series: XmlObject,
	xmlLookup: XmlLookupLike,
): PptxChartBoxWhiskerOptions | undefined {
	if (series['@_layoutId'] !== 'boxWhisker') {
		return undefined;
	}
	const layoutPr = xmlLookup.getChildByLocalName(series, 'layoutPr');
	const visibility = xmlLookup.getChildByLocalName(layoutPr, 'visibility');
	const statistics = xmlLookup.getChildByLocalName(layoutPr, 'statistics');
	const rawQuartileMethod = statistics?.['@_quartileMethod'];
	const quartileMethod =
		rawQuartileMethod === 'inclusive' || rawQuartileMethod === 'exclusive'
			? rawQuartileMethod
			: undefined;
	const options: PptxChartBoxWhiskerOptions = {
		quartileMethod,
		showMeanLine: parseBooleanAttribute(visibility, 'meanLine'),
		showMeanMarker: parseBooleanAttribute(visibility, 'meanMarker'),
		showInnerPoints: parseBooleanAttribute(visibility, 'nonoutliers'),
		showOutlierPoints: parseBooleanAttribute(visibility, 'outliers'),
	};
	return Object.values(options).some((value) => value !== undefined) ? options : undefined;
}
