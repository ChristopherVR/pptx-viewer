/**
 * Parser for Office 2016+ ChartEx (`cx:`) axis formatting (C2-G7).
 *
 * Mirrors `chart-axis-parser.ts`'s title/numFmt/gridlines/tick-label
 * extraction for the classic `c:catAx`/`c:valAx`, but for `cx:axis`
 * (CT_Axis, chartex schema): a sibling of `cx:plotAreaRegion` under
 * `cx:plotArea`, referenced from each series via `cx:series/cx:axisId/@val`
 * matching `cx:axis/@id`. Axis scaling/tick generation math (min/max,
 * orientation) is out of scope here (owned by a different agent for this
 * wave); this module owns the chrome: title text, number format, gridline
 * presence, and tick-label visibility, producing the SAME
 * `PptxChartAxisFormatting` shape classic charts populate, so the shared
 * render layer needs no cx-specific branch.
 *
 * @module utils/chart-cx-axis-parser
 */

import type { PptxChartAxisFormatting, PptxChartDisplayUnitsLabel, XmlObject } from '../types';
import type { ColorParserLike, XmlLookupLike } from './chart-cx-parser';
import { parseShapeProps } from './chart-series-detail-parser';

/** The subset of font fields a `cx:txPr`/`cx:unitsLabel` run reads onto. */
interface CxFontTarget {
	fontFamily?: string;
	fontSize?: number;
	fontBold?: boolean;
	fontColor?: string;
}

const NO_COLOR: ColorParserLike = { parseColor: () => undefined };

function safeInt(val: unknown): number | undefined {
	const n = Number.parseInt(String(val), 10);
	return Number.isFinite(n) ? n : undefined;
}

/** Recursively collect `a:t` run text (mirrors the walker other cx: text readers use). */
function collectRunText(node: XmlObject, out: string[]): void {
	for (const [key, child] of Object.entries(node)) {
		if (key.startsWith('@_')) {
			continue;
		}
		if (key === 'a:t' || key.endsWith(':t')) {
			out.push(String(child));
			continue;
		}
		const items = Array.isArray(child) ? child : [child];
		for (const item of items) {
			if (item && typeof item === 'object') {
				collectRunText(item as XmlObject, out);
			}
		}
	}
}

/**
 * Resolve `cx:title` text: rich run text (`cx:tx/cx:rich`, `a:t` runs) when
 * present, otherwise the linked-cell cached string (`cx:tx/cx:txData/cx:v`),
 * matching how `cx:series/cx:tx` resolves a series name.
 */
export function resolveCxTitleText(
	titleNode: XmlObject | undefined,
	xmlLookup: XmlLookupLike,
): string | undefined {
	if (!titleNode) {
		return undefined;
	}
	const texts: string[] = [];
	collectRunText(titleNode, texts);
	if (texts.length > 0) {
		return texts.join('');
	}
	const tx = xmlLookup.getChildByLocalName(titleNode, 'tx');
	const txData = xmlLookup.getChildByLocalName(tx, 'txData');
	const cached = String(xmlLookup.getScalarChildByLocalName(txData, 'v') ?? '').trim();
	return cached.length > 0 ? cached : undefined;
}

/**
 * Parse a `cx:txPr`'s default run font onto any target carrying the same
 * fontFamily/fontSize/fontBold/fontColor shape: `cx:axis/cx:txPr` (onto the
 * axis formatting result) and `cx:unitsLabel/cx:txPr` (onto the display-units
 * label, C1 `cx:units` gap) both read through this one helper.
 */
function parseTxPrFont(
	txPrNode: XmlObject | undefined,
	xmlLookup: XmlLookupLike,
	colorParser: ColorParserLike,
	target: CxFontTarget,
	resolveTypeface?: (raw: string) => string,
): void {
	const pNode = xmlLookup.getChildByLocalName(txPrNode, 'p');
	const pPr = xmlLookup.getChildByLocalName(pNode, 'pPr');
	const defRPr = xmlLookup.getChildByLocalName(pPr, 'defRPr');
	if (!defRPr) {
		return;
	}
	const sz = safeInt(defRPr['@_sz']);
	if (sz !== undefined) {
		target.fontSize = sz / 100;
	}
	if (defRPr['@_b'] === '1') {
		target.fontBold = true;
	}
	const latin = xmlLookup.getChildByLocalName(defRPr, 'latin');
	if (latin?.['@_typeface']) {
		const raw = String(latin['@_typeface']);
		target.fontFamily = resolveTypeface ? resolveTypeface(raw) : raw;
	}
	const fontColor = colorParser.parseColor(xmlLookup.getChildByLocalName(defRPr, 'solidFill'));
	if (fontColor) {
		target.fontColor = fontColor;
	}
}

/**
 * Parse `cx:axis/cx:units` (C1 gap: ChartEx axis display units, the `cx:`
 * counterpart of classic `c:dispUnits`). Unlike classic charts' enumerated
 * `c:builtInUnit` (hundreds/thousands/.../trillions) plus an optional
 * `c:custUnit` override, `cx:units/@unit` is always a raw divisor, so it maps
 * onto the existing `displayUnits: 'custom'` bucket that already carries an
 * explicit {@link PptxChartAxisFormatting.displayUnitsValue}; this lets every
 * render call site that already honours classic `c:dispUnits` (see
 * `chart-axis-render.ts`) render a ChartEx axis's units identically with no
 * cx-specific branch. `cx:unitsLabel` mirrors `cx:title`'s `cx:tx` text shape,
 * so {@link resolveCxTitleText} resolves it unchanged.
 */
function parseCxUnits(
	axisNode: XmlObject,
	xmlLookup: XmlLookupLike,
	colorParser: ColorParserLike,
	target: PptxChartAxisFormatting,
	resolveTypeface?: (raw: string) => string,
): void {
	const unitsNode = xmlLookup.getChildByLocalName(axisNode, 'units');
	if (!unitsNode) {
		return;
	}
	const unit = Number.parseFloat(String(unitsNode['@_unit'] ?? ''));
	if (!Number.isFinite(unit) || unit <= 0) {
		return;
	}
	target.displayUnits = 'custom';
	target.displayUnitsValue = unit;

	const labelNode = xmlLookup.getChildByLocalName(unitsNode, 'unitsLabel');
	if (!labelNode) {
		return;
	}
	const label: PptxChartDisplayUnitsLabel = {};
	const text = resolveCxTitleText(labelNode, xmlLookup);
	if (text) {
		label.text = text;
	}
	parseTxPrFont(
		xmlLookup.getChildByLocalName(labelNode, 'txPr'),
		xmlLookup,
		colorParser,
		label,
		resolveTypeface,
	);
	if (Object.keys(label).length > 0) {
		target.displayUnitsLabel = label;
	}
}

/** Parse one `cx:axis` element (title, numFmt, gridlines, tick labels, spPr/txPr). */
function parseSingleCxAxis(
	axisNode: XmlObject,
	xmlLookup: XmlLookupLike,
	colorParser: ColorParserLike,
	resolveTypeface?: (raw: string) => string,
): PptxChartAxisFormatting {
	// cx:axis distinguishes category vs. value scaling by which child is
	// present, unlike classic charts' distinct catAx/valAx elements.
	const isCategory = xmlLookup.getChildByLocalName(axisNode, 'catScaling') !== undefined;
	const axisType: PptxChartAxisFormatting['axisType'] = isCategory ? 'catAx' : 'valAx';
	const result: PptxChartAxisFormatting = { axisType };

	const id = safeInt(axisNode['@_id']);
	if (id !== undefined) {
		result.axisId = id;
	}
	if (axisNode['@_hidden'] === '1' || axisNode['@_hidden'] === 'true') {
		result.deleted = true;
	}

	const titleText = resolveCxTitleText(xmlLookup.getChildByLocalName(axisNode, 'title'), xmlLookup);
	if (titleText) {
		result.titleText = titleText;
	}
	parseCxUnits(axisNode, xmlLookup, colorParser, result, resolveTypeface);

	const numFmtNode = xmlLookup.getChildByLocalName(axisNode, 'numFmt');
	const formatCode = String(numFmtNode?.['@_formatCode'] || '').trim();
	if (formatCode) {
		result.numFmt = { formatCode, sourceLinked: numFmtNode?.['@_sourceLinked'] === '1' };
	}

	const majorGrid = xmlLookup.getChildByLocalName(axisNode, 'majorGridlines');
	if (majorGrid) {
		result.majorGridlines = true;
		result.majorGridlinesSpPr = parseShapeProps(
			xmlLookup.getChildByLocalName(majorGrid, 'spPr'),
			xmlLookup,
			colorParser,
		);
	}
	const minorGrid = xmlLookup.getChildByLocalName(axisNode, 'minorGridlines');
	if (minorGrid) {
		result.minorGridlines = true;
		result.minorGridlinesSpPr = parseShapeProps(
			xmlLookup.getChildByLocalName(minorGrid, 'spPr'),
			xmlLookup,
			colorParser,
		);
	}

	// cx:tickLabels' presence toggles label visibility; PowerPoint omits the
	// element entirely to hide axis tick labels. There is no attribute to
	// mirror classic ST_TickLblPos's high/low/nextTo, so absence maps onto
	// the existing 'none' (the enum's only other value this cx feature needs).
	if (xmlLookup.getChildByLocalName(axisNode, 'tickLabels') === undefined) {
		result.tickLblPos = 'none';
	}

	const spPr = parseShapeProps(
		xmlLookup.getChildByLocalName(axisNode, 'spPr'),
		xmlLookup,
		colorParser,
	);
	if (spPr) {
		result.spPr = spPr;
	}
	parseTxPrFont(
		xmlLookup.getChildByLocalName(axisNode, 'txPr'),
		xmlLookup,
		colorParser,
		result,
		resolveTypeface,
	);

	return result;
}

/** Parse all `cx:axis` elements (siblings of `cx:plotAreaRegion`) under `cx:plotArea`. */
export function parseCxAxes(
	plotArea: XmlObject,
	xmlLookup: XmlLookupLike,
	colorParser?: ColorParserLike,
	resolveTypeface?: (raw: string) => string,
): PptxChartAxisFormatting[] | undefined {
	const axisNodes = xmlLookup.getChildrenArrayByLocalName(plotArea, 'axis');
	if (axisNodes.length === 0) {
		return undefined;
	}
	const resolvedColorParser = colorParser ?? NO_COLOR;
	const result = axisNodes.map((node) =>
		parseSingleCxAxis(node, xmlLookup, resolvedColorParser, resolveTypeface),
	);
	return result.length > 0 ? result : undefined;
}
