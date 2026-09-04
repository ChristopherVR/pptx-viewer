/**
 * Parse side of a chart's own title FORMATTING (`c:title/c:spPr`,
 * `c:title/c:txPr`, or the first run defaults of a rich `c:title/c:tx/c:rich`
 * paragraph), the counterpart of `chart-title-style-serializer.ts`.
 *
 * PowerPoint keeps a title's font in two places depending on how it was
 * authored: an automatic/linked title carries `c:txPr`, while a typed one is
 * a rich text body whose `a:pPr/a:defRPr` holds the same attributes. The rich
 * body wins when both exist because that is what PowerPoint renders.
 *
 * @module utils/chart-title-style-parser
 */
import type { PptxChartStyle, XmlObject } from '../types';
import { parseDefRPrTextStyle, resolveTxPrDefRPr } from './chart-def-rpr-style';
import { parseShapeProps } from './chart-series-detail-parser';

interface XmlLookupLike {
	getChildByLocalName: (parent: XmlObject | undefined, name: string) => XmlObject | undefined;
	getChildrenArrayByLocalName: (parent: XmlObject | undefined, name: string) => XmlObject[];
}

interface ColorParserLike {
	parseColor: (fillNode: XmlObject | undefined, placeholderColor?: string) => string | undefined;
}

type ChartTitleStyleFields = Pick<
	PptxChartStyle,
	'titleFontFamily' | 'titleFontSize' | 'titleFontBold' | 'titleFontColor' | 'titleSpPr'
>;

/**
 * Read the chart title's font and text-box formatting into the `title*`
 * fields of `PptxChartStyle`. Returns only the fields that are authored, so
 * the caller can `Object.assign` the result without clobbering defaults.
 */
export function parseChartTitleStyle(
	titleNode: XmlObject,
	xmlLookup: XmlLookupLike,
	colorParser: ColorParserLike,
	resolveTypeface?: (raw: string) => string,
): ChartTitleStyleFields {
	const fields: ChartTitleStyleFields = {};

	const spPr = parseShapeProps(
		xmlLookup.getChildByLocalName(titleNode, 'spPr'),
		xmlLookup,
		colorParser,
	);
	if (spPr) {
		fields.titleSpPr = spPr;
	}

	const rich = xmlLookup.getChildByLocalName(
		xmlLookup.getChildByLocalName(titleNode, 'tx'),
		'rich',
	);
	const defRPr =
		resolveTxPrDefRPr(rich, xmlLookup) ??
		resolveTxPrDefRPr(xmlLookup.getChildByLocalName(titleNode, 'txPr'), xmlLookup);
	const text = parseDefRPrTextStyle(defRPr, xmlLookup, colorParser, resolveTypeface);
	if (text?.fontFamily !== undefined) {
		fields.titleFontFamily = text.fontFamily;
	}
	if (text?.fontSize !== undefined) {
		fields.titleFontSize = text.fontSize;
	}
	if (text?.bold !== undefined) {
		fields.titleFontBold = text.bold;
	}
	if (text?.color !== undefined) {
		fields.titleFontColor = text.color;
	}
	return fields;
}
