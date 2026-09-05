/**
 * Typed field parsing + save-time override resolution for one `c:pivotFmt`
 * entry's `spPr`/`txPr`/`marker` children.
 *
 * Split out of `chart-pivot-formats.ts` (which owns the `c:pivotFmts`
 * collection's parse/apply orchestration) to keep that file under the repo's
 * file-size guideline. See `PptxChartPivotFormat`'s doc for the typed-field /
 * raw-XML-fallback contract these functions implement.
 *
 * @module utils/chart-pivot-format-fields
 */
import type {
	PptxChartLegendTextStyle,
	PptxChartMarker,
	PptxChartMarkerSymbol,
	PptxChartPivotFormat,
	PptxChartShapeProps,
	XmlObject,
} from '../types';
import { buildDefRPrTextProperties } from './chart-def-rpr-style';
import { buildChartMarkerXml } from './chart-marker-serializer';
import { writeChartShapeProps } from './chart-shape-props-writer';

export type LocalName = (key: string) => string;

/**
 * Resolves a DrawingML colour-choice node (`a:srgbClr`, `a:schemeClr` with its
 * `lumMod`/`lumOff`/`tint`/`shade` transforms, ...) to the hex it currently
 * paints, the same resolver the rest of chart parsing threads through as
 * `parseColor` (see `chart-color-choice.ts` and `chart-def-rpr-style.ts`).
 * Optional throughout this module: a caller without one (an existing test, or
 * a from-scratch chart with no theme to resolve against) falls back to
 * literal `a:srgbClr`-only resolution, matching this module's original
 * behaviour.
 */
export interface ChartColorParser {
	parseColor: (colorNode: XmlObject | undefined, placeholderColor?: string) => string | undefined;
}

const MARKER_SYMBOLS: ReadonlySet<string> = new Set([
	'circle',
	'dash',
	'diamond',
	'dot',
	'none',
	'picture',
	'plus',
	'square',
	'star',
	'triangle',
	'x',
	'auto',
]);

export function keyOf(
	node: XmlObject | undefined,
	name: string,
	localName: LocalName,
): string | undefined {
	return node ? Object.keys(node).find((key) => localName(key) === name) : undefined;
}

export function nodesOf(node: XmlObject, name: string, localName: LocalName): XmlObject[] {
	const key = keyOf(node, name, localName);
	const value = key ? node[key] : undefined;
	const values = Array.isArray(value) ? value : value ? [value] : [];
	return values.filter(
		(item): item is XmlObject => typeof item === 'object' && !Array.isArray(item),
	);
}

export function unsigned(value: unknown): number | undefined {
	if (typeof value !== 'string' || !/^\d+$/u.test(value)) {
		return undefined;
	}
	const result = Number(value);
	return Number.isSafeInteger(result) && result <= 4_294_967_295 ? result : undefined;
}

/**
 * Read a colour off a resolved fill node. With `colorParser` supplied, any
 * DrawingML colour choice resolves, including an `a:schemeClr` theme
 * reference (with its `lumMod`/`lumOff`/`tint`/`shade` modifiers) run through
 * the theme + `c:clrMapOvr` chain. Without it, only a literal `a:srgbClr`
 * resolves (this module's original behaviour); a `schemeClr` then stays
 * reachable through the raw `*Xml` fallback instead.
 */
function literalColor(
	fillNode: XmlObject | undefined,
	localName: LocalName,
	colorParser?: ChartColorParser,
): string | undefined {
	if (!fillNode) {
		return undefined;
	}
	if (colorParser) {
		const resolved = colorParser.parseColor(fillNode);
		if (resolved) {
			return resolved;
		}
	}
	const srgbKey = keyOf(fillNode, 'srgbClr', localName);
	const srgb = srgbKey ? (fillNode[srgbKey] as XmlObject | undefined) : undefined;
	const val = srgb?.['@_val'];
	return typeof val === 'string' && /^[0-9A-Fa-f]{6}$/u.test(val)
		? `#${val.toUpperCase()}`
		: undefined;
}

/** Typed projection of a `spPr` node (fill/stroke colour, stroke width, dash style). */
export function parseTypedShapeProps(
	spPrNode: XmlObject | undefined,
	localName: LocalName,
	colorParser?: ChartColorParser,
): PptxChartShapeProps | undefined {
	if (!spPrNode) {
		return undefined;
	}
	const result: PptxChartShapeProps = {};
	const solidFillKey = keyOf(spPrNode, 'solidFill', localName);
	const fillColor = literalColor(
		solidFillKey ? (spPrNode[solidFillKey] as XmlObject) : undefined,
		localName,
		colorParser,
	);
	if (fillColor) {
		result.fillColor = fillColor;
	}
	const lnKey = keyOf(spPrNode, 'ln', localName);
	const ln = lnKey ? (spPrNode[lnKey] as XmlObject | undefined) : undefined;
	if (ln) {
		const lnFillKey = keyOf(ln, 'solidFill', localName);
		const strokeColor = literalColor(
			lnFillKey ? (ln[lnFillKey] as XmlObject) : undefined,
			localName,
			colorParser,
		);
		if (strokeColor) {
			result.strokeColor = strokeColor;
		}
		const w = unsigned(ln['@_w']);
		if (w !== undefined) {
			result.strokeWidth = w / 12700;
		}
		const dashKey = keyOf(ln, 'prstDash', localName);
		const dash = dashKey ? (ln[dashKey] as XmlObject)?.['@_val'] : undefined;
		if (dash !== undefined && dash !== null && String(dash).length > 0) {
			result.strokeDashStyle = String(dash);
		}
	}
	return Object.keys(result).length > 0 ? result : undefined;
}

/** Typed projection of a `marker` node (symbol/size/spPr). */
export function parseTypedMarker(
	markerNode: XmlObject | undefined,
	localName: LocalName,
	colorParser?: ChartColorParser,
): PptxChartMarker | undefined {
	if (!markerNode) {
		return undefined;
	}
	const symbolKey = keyOf(markerNode, 'symbol', localName);
	const symbolNode = symbolKey ? (markerNode[symbolKey] as XmlObject | undefined) : undefined;
	const rawSymbol = String(symbolNode?.['@_val'] ?? '').trim();
	if (!MARKER_SYMBOLS.has(rawSymbol)) {
		return undefined;
	}
	const marker: PptxChartMarker = { symbol: rawSymbol as PptxChartMarkerSymbol };
	const sizeKey = keyOf(markerNode, 'size', localName);
	const sizeNode = sizeKey ? (markerNode[sizeKey] as XmlObject | undefined) : undefined;
	const size = Number(sizeNode?.['@_val']);
	if (Number.isInteger(size) && size >= 2 && size <= 72) {
		marker.size = size;
	}
	const spPrKey = keyOf(markerNode, 'spPr', localName);
	const spPr = parseTypedShapeProps(
		spPrKey ? (markerNode[spPrKey] as XmlObject | undefined) : undefined,
		localName,
		colorParser,
	);
	if (spPr) {
		marker.spPr = spPr;
	}
	return marker;
}

/** Resolve `txPr`'s `a:p/a:pPr/a:defRPr` node, the same CT_TextBody shape a legend entry / data-table text override uses. */
export function resolveDefRPr(
	txPrNode: XmlObject | undefined,
	localName: LocalName,
): XmlObject | undefined {
	const paragraph = nodesOf(txPrNode ?? {}, 'p', localName)[0];
	const pPr = paragraph ? nodesOf(paragraph, 'pPr', localName)[0] : undefined;
	return pPr ? nodesOf(pPr, 'defRPr', localName)[0] : undefined;
}

/** Typed projection of a `txPr` node's paragraph default run properties. */
export function parseTypedTextStyle(
	txPrNode: XmlObject | undefined,
	localName: LocalName,
	colorParser?: ChartColorParser,
): PptxChartLegendTextStyle | undefined {
	const defRPr = txPrNode ? resolveDefRPr(txPrNode, localName) : undefined;
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
	const latin = nodesOf(defRPr, 'latin', localName)[0];
	const typeface = latin?.['@_typeface'];
	if (typeface) {
		style.fontFamily = String(typeface);
	}
	const solidFill = nodesOf(defRPr, 'solidFill', localName)[0];
	const color = literalColor(solidFill, localName, colorParser);
	if (color) {
		style.color = color;
	}
	return Object.keys(style).length > 0 ? style : undefined;
}

/**
 * Resolve the `spPr` value to write.
 *
 * `shapeProperties` (when present) is compared against what would parse back
 * off the node's CURRENT `spPr` (the same "stale" check
 * `chart-title-serializer` uses for `titleRuns`): unchanged means no typed
 * edit happened, so the explicit `shapePropertiesXml` (`undefined` to leave
 * alone, `null` to remove, or a hand-authored node) is authoritative;
 * diverged means the typed field IS the edit, so it is merged onto the
 * existing `spPr` (via `writeChartShapeProps`, preserving unmodeled children)
 * regardless of a stale `shapePropertiesXml`.
 */
export function resolveSpPrOverride(
	node: XmlObject,
	value: PptxChartPivotFormat,
	localName: LocalName,
	colorParser?: ChartColorParser,
): XmlObject | null | undefined {
	const existingKey = keyOf(node, 'spPr', localName);
	const existing = existingKey ? (node[existingKey] as XmlObject | undefined) : undefined;
	if (
		value.shapeProperties &&
		JSON.stringify(parseTypedShapeProps(existing, localName, colorParser)) !==
			JSON.stringify(value.shapeProperties)
	) {
		return writeChartShapeProps(
			existing,
			value.shapeProperties,
			localName,
			colorParser ? (colorNode) => colorParser.parseColor(colorNode) : undefined,
		);
	}
	return value.shapePropertiesXml;
}

/** Same precedence as {@link resolveSpPrOverride}, for `txPr`'s default run properties. */
export function resolveTxPrOverride(
	node: XmlObject,
	value: PptxChartPivotFormat,
	localName: LocalName,
	colorParser?: ChartColorParser,
): XmlObject | null | undefined {
	const existingKey = keyOf(node, 'txPr', localName);
	const existing = existingKey ? (node[existingKey] as XmlObject | undefined) : undefined;
	if (
		value.textStyle &&
		JSON.stringify(parseTypedTextStyle(existing, localName, colorParser)) !==
			JSON.stringify(value.textStyle)
	) {
		const authoredDefRPr = existing ? resolveDefRPr(existing, localName) : undefined;
		return (
			buildDefRPrTextProperties(
				value.textStyle,
				authoredDefRPr,
				colorParser ? (colorNode) => colorParser.parseColor(colorNode) : undefined,
			) ?? null
		);
	}
	return value.txPrXml;
}

/** Same precedence as {@link resolveSpPrOverride}, for `marker`. */
export function resolveMarkerOverride(
	node: XmlObject,
	value: PptxChartPivotFormat,
	localName: LocalName,
	colorParser?: ChartColorParser,
): XmlObject | null | undefined {
	const existingKey = keyOf(node, 'marker', localName);
	const existing = existingKey ? (node[existingKey] as XmlObject | undefined) : undefined;
	if (
		value.marker &&
		JSON.stringify(parseTypedMarker(existing, localName, colorParser)) !==
			JSON.stringify(value.marker)
	) {
		return buildChartMarkerXml(
			existing,
			value.marker,
			localName,
			colorParser ? (colorNode) => colorParser.parseColor(colorNode) : undefined,
		);
	}
	return value.markerXml;
}
