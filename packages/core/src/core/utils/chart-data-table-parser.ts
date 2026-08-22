/**
 * Parser for a ChartML data table (`c:dTable`, `CT_DTable`): the four
 * visibility flags (`showHorzBorder`/`showVertBorder`/`showOutline`/
 * `showKeys`) plus its border/fill (`c:spPr`) and cell-text defaults
 * (`c:txPr`).
 *
 * Split out of `chart-advanced-parser.ts` (which was approaching the repo's
 * 300-line file guideline) so the data-table concern has its own home
 * alongside its dedicated test file.
 *
 * @module utils/chart-data-table-parser
 */
import type { PptxChartDataTable, XmlObject } from '../types';
import { parseDefRPrTextStyle, resolveTxPrDefRPr } from './chart-def-rpr-style';
import { parseShapeProps } from './chart-series-detail-parser';

interface XmlLookupLike {
	getChildByLocalName: (parent: XmlObject | undefined, name: string) => XmlObject | undefined;
	getChildrenArrayByLocalName: (parent: XmlObject | undefined, name: string) => XmlObject[];
}

interface ColorParserLike {
	parseColor: (fillNode: XmlObject | undefined, placeholderColor?: string) => string | undefined;
}

const FLAGS = ['showHorzBorder', 'showVertBorder', 'showOutline', 'showKeys'] as const;

/**
 * Parse `c:plotArea/c:dTable`. `colorParser` is optional so callers that only
 * need the boolean flags (e.g. layout-reservation checks) can omit it; when
 * provided, `spPr` (border/fill) and `txPr` (cell text defaults) are parsed
 * too.
 */
export function parseDataTable(
	plotArea: XmlObject,
	xmlLookup: XmlLookupLike,
	colorParser?: ColorParserLike,
): PptxChartDataTable | undefined {
	const dTable = xmlLookup.getChildByLocalName(plotArea, 'dTable');
	if (!dTable) {
		return undefined;
	}

	const result: PptxChartDataTable = {};
	for (const flag of FLAGS) {
		const node = xmlLookup.getChildByLocalName(dTable, flag);
		if (!node) {
			continue;
		}
		const value = node['@_val'];
		// CT_Boolean defaults val to true when the attribute is omitted.
		if (value === undefined || value === 'true' || value === '1') {
			result[flag] = true;
		} else if (value === 'false' || value === '0') {
			result[flag] = false;
		}
	}

	if (colorParser) {
		const spPr = parseShapeProps(
			xmlLookup.getChildByLocalName(dTable, 'spPr'),
			xmlLookup,
			colorParser,
		);
		if (spPr) {
			result.spPr = spPr;
		}

		const txPr = xmlLookup.getChildByLocalName(dTable, 'txPr');
		const textStyle = parseDefRPrTextStyle(
			resolveTxPrDefRPr(txPr, xmlLookup),
			xmlLookup,
			colorParser,
		);
		if (textStyle) {
			result.txPr = textStyle;
		}
	}

	return result;
}
