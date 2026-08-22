/**
 * Shared parser for a paragraph-level default run-property text style
 * (`.../a:p/a:pPr/a:defRPr`): font size, bold, italic, typeface, and colour.
 *
 * ChartML repeats this exact shape in two unrelated places: a legend entry's
 * per-series text override (`c:legendEntry/c:txPr`) and a data table's cell
 * text defaults (`c:dTable/c:txPr`). Both walk the same
 * `c:txPr/a:p/a:pPr/a:defRPr` path and read the same five attributes, so the
 * resolution lives here once instead of being hand-rolled at each call site.
 *
 * @module utils/chart-def-rpr-style
 */
import type { PptxChartLegendTextStyle, XmlObject } from '../types';

interface XmlLookupLike {
	getChildByLocalName: (parent: XmlObject | undefined, name: string) => XmlObject | undefined;
}

interface ColorParserLike {
	parseColor: (fillNode: XmlObject | undefined, placeholderColor?: string) => string | undefined;
}

/** Resolve `<c:txPr>/a:p/a:pPr/a:defRPr` beneath a ChartML text-properties node. */
export function resolveTxPrDefRPr(
	txPr: XmlObject | undefined,
	xmlLookup: XmlLookupLike,
): XmlObject | undefined {
	const paragraph = xmlLookup.getChildByLocalName(txPr, 'p');
	const pPr = xmlLookup.getChildByLocalName(paragraph, 'pPr');
	return xmlLookup.getChildByLocalName(pPr, 'defRPr');
}

/**
 * Parse an already-resolved `a:defRPr` node's size/bold/italic/font/colour
 * into a flat text style. Returns `undefined` when the node is absent or
 * carries none of the five recognised attributes.
 */
export function parseDefRPrTextStyle(
	defRPr: XmlObject | undefined,
	xmlLookup: XmlLookupLike,
	colorParser: ColorParserLike,
): PptxChartLegendTextStyle | undefined {
	if (!defRPr) {
		return undefined;
	}
	const style: PptxChartLegendTextStyle = {};

	const size = Number.parseInt(String(defRPr['@_sz'] ?? ''), 10);
	if (Number.isFinite(size)) {
		style.fontSize = size / 100;
	}
	if (defRPr['@_b'] !== undefined) {
		style.bold = defRPr['@_b'] === '1' || defRPr['@_b'] === 'true';
	}
	if (defRPr['@_i'] !== undefined) {
		style.italic = defRPr['@_i'] === '1' || defRPr['@_i'] === 'true';
	}
	const latin = xmlLookup.getChildByLocalName(defRPr, 'latin');
	if (latin?.['@_typeface']) {
		style.fontFamily = String(latin['@_typeface']);
	}
	const color = colorParser.parseColor(xmlLookup.getChildByLocalName(defRPr, 'solidFill'));
	if (color) {
		style.color = color;
	}

	return Object.keys(style).length > 0 ? style : undefined;
}
