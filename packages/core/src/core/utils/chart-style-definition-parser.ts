/**
 * Pure parser for an Office 2013+ chart-style part (`ppt/charts/style#.xml`,
 * root `cs:chartStyle`). See `types/chart-style-definition.ts` for why this
 * matters: it is the part that spells out per-element font/line/fill
 * defaults for whichever built-in "Chart Styles" gallery entry is active.
 *
 * Dependency-light (an `XmlLookupLike` plus two colour resolvers) so it can
 * be unit-tested without a full chart part / theme.
 *
 * @module utils/chart-style-definition-parser
 */
import type { PptxChartStyleDefinition, PptxChartStylePartEntry, XmlObject } from '../types';

interface XmlLookupLike {
	getChildByLocalName: (parent: XmlObject | undefined, name: string) => XmlObject | undefined;
}

/** Resolves a `cs:*Ref/a:schemeClr` (or `a:srgbClr`) child to a hex colour. */
type ResolveSchemeColor = (schemeClrNode: unknown) => string | undefined;
/** Resolves a `a:solidFill` node to a hex colour, matching the classic-chart colour parser. */
type ParseColor = (fillNode: XmlObject | undefined) => string | undefined;

/** The `cs:*` part names this viewer renders distinct defaults for. */
const PART_NAMES: ReadonlyArray<keyof PptxChartStyleDefinition> = [
	'title',
	'axisTitle',
	'categoryAxis',
	'valueAxis',
	'legend',
	'dataLabel',
	'dataPoint',
	'dataPointLine',
	'gridlineMajor',
	'gridlineMinor',
	'chartArea',
	'plotArea',
];

/** Resolve a `cs:*Ref`'s scheme-colour child, if any. */
function refColor(
	part: XmlObject,
	refName: string,
	xmlLookup: XmlLookupLike,
	resolveSchemeColor: ResolveSchemeColor,
): string | undefined {
	const ref = xmlLookup.getChildByLocalName(part, refName);
	const schemeClr = ref ? xmlLookup.getChildByLocalName(ref, 'schemeClr') : undefined;
	return schemeClr ? resolveSchemeColor(schemeClr) : undefined;
}

function parsePart(
	part: XmlObject,
	xmlLookup: XmlLookupLike,
	resolveSchemeColor: ResolveSchemeColor,
	parseColor: ParseColor,
): PptxChartStylePartEntry | undefined {
	const entry: PptxChartStylePartEntry = {};

	const defRPr = xmlLookup.getChildByLocalName(part, 'defRPr');
	if (defRPr) {
		const size = Number.parseInt(String(defRPr['@_sz'] ?? ''), 10);
		if (Number.isFinite(size)) {
			entry.fontSize = size / 100;
		}
		if (defRPr['@_b'] !== undefined) {
			entry.bold = defRPr['@_b'] === '1' || defRPr['@_b'] === 'true';
		}
		if (defRPr['@_i'] !== undefined) {
			entry.italic = defRPr['@_i'] === '1' || defRPr['@_i'] === 'true';
		}
		const ownColor = parseColor(xmlLookup.getChildByLocalName(defRPr, 'solidFill'));
		if (ownColor) {
			entry.color = ownColor;
		}
	}
	// `cs:fontRef`'s scheme colour is the text-colour fallback a style entry
	// carries when `cs:defRPr` itself has no explicit `a:solidFill`.
	if (entry.color === undefined) {
		const fontColor = refColor(part, 'fontRef', xmlLookup, resolveSchemeColor);
		if (fontColor) {
			entry.color = fontColor;
		}
	}
	const lineColor = refColor(part, 'lnRef', xmlLookup, resolveSchemeColor);
	if (lineColor) {
		entry.lineColor = lineColor;
	}
	const fillColor = refColor(part, 'fillRef', xmlLookup, resolveSchemeColor);
	if (fillColor) {
		entry.fillColor = fillColor;
	}

	return Object.keys(entry).length > 0 ? entry : undefined;
}

/**
 * Parse a `cs:chartStyle` root into the subset of per-element style defaults
 * this viewer renders. Returns `undefined` when none of the known parts
 * carried a recognised style entry.
 */
export function parseChartStyleDefinition(
	styleRoot: XmlObject,
	xmlLookup: XmlLookupLike,
	resolveSchemeColor: ResolveSchemeColor,
	parseColor: ParseColor,
): PptxChartStyleDefinition | undefined {
	const result: PptxChartStyleDefinition = {};
	for (const name of PART_NAMES) {
		const node = xmlLookup.getChildByLocalName(styleRoot, name);
		if (!node) {
			continue;
		}
		const parsed = parsePart(node, xmlLookup, resolveSchemeColor, parseColor);
		if (parsed) {
			result[name] = parsed;
		}
	}
	return Object.keys(result).length > 0 ? result : undefined;
}
