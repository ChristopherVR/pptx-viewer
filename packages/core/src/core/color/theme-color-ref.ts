/**
 * `PptxThemeColorRef` <-> `<a:schemeClr>` conversion and resolution.
 *
 * The typed ref is what an editor stores when a user picks a theme swatch; these
 * helpers turn it into the XML the save pipeline writes, read it back from a
 * parsed node, and resolve it to sRGB against a theme colour map.
 *
 * @module color/theme-color-ref
 */
import type { PptxThemeColorRef, PptxThemeColorSchemeName, XmlObject } from '../types';
import { normalizeHexColor } from './color-primitives';
import { applyDrawingColorTransforms } from './color-transforms';

const SCHEME_NAMES: ReadonlySet<string> = new Set<PptxThemeColorSchemeName>([
	'dk1',
	'lt1',
	'dk2',
	'lt2',
	'accent1',
	'accent2',
	'accent3',
	'accent4',
	'accent5',
	'accent6',
	'hlink',
	'folHlink',
	'bg1',
	'tx1',
	'bg2',
	'tx2',
	'phClr',
]);

/** Narrow an arbitrary string to a scheme slot name. */
export function isThemeColorSchemeName(value: unknown): value is PptxThemeColorSchemeName {
	return typeof value === 'string' && SCHEME_NAMES.has(value);
}

/** The `p:clrMap` aliases resolved through the theme when the map itself is absent. */
const DEFAULT_ALIASES: Readonly<Record<string, PptxThemeColorSchemeName>> = {
	bg1: 'lt1',
	tx1: 'dk1',
	bg2: 'lt2',
	tx2: 'dk2',
};

/** Write a fraction as the OOXML thousandths-of-a-percent `@val`. */
function percentVal(fraction: number): string {
	return String(Math.round(fraction * 100000));
}

/**
 * Build the `<a:schemeClr>` node for a ref, children in schema order
 * (`tint`, `shade`, `lumMod`, `lumOff`, `alpha`), ready to sit under
 * `a:solidFill` / `a:ln/a:solidFill` / `a:rPr/a:solidFill`.
 */
export function themeColorRefToXml(ref: PptxThemeColorRef): XmlObject {
	const node: XmlObject = { '@_val': ref.scheme };
	if (ref.tint !== undefined) {
		node['a:tint'] = { '@_val': percentVal(ref.tint) };
	}
	if (ref.shade !== undefined) {
		node['a:shade'] = { '@_val': percentVal(ref.shade) };
	}
	if (ref.lumMod !== undefined) {
		node['a:lumMod'] = { '@_val': percentVal(ref.lumMod) };
	}
	if (ref.lumOff !== undefined) {
		node['a:lumOff'] = { '@_val': percentVal(ref.lumOff) };
	}
	if (ref.alpha !== undefined) {
		node['a:alpha'] = { '@_val': percentVal(ref.alpha) };
	}
	return node;
}

/** Wrap a ref as a full `a:solidFill` object: `{ 'a:schemeClr': {...} }`. */
export function themeColorRefToSolidFill(ref: PptxThemeColorRef): XmlObject {
	return { 'a:schemeClr': themeColorRefToXml(ref) };
}

/**
 * Wrap a ref as a full `a:solidFill` object, folding in an opacity fraction
 * (0..1, 1 = opaque) from the surrounding style's own opacity field when the
 * ref does not already carry an explicit `a:alpha`.
 *
 * Fill/line/text colour is stored as a separate `*Opacity` number alongside
 * the ref rather than always on `ref.alpha` (the ref is set once at parse
 * time from the plain `a:schemeClr`, while opacity can be edited afterwards
 * through the existing opacity fields), so save has to combine the two.
 */
export function themeColorRefToSolidFillWithOpacity(
	ref: PptxThemeColorRef,
	opacity?: number,
): XmlObject {
	if (
		ref.alpha === undefined &&
		typeof opacity === 'number' &&
		Number.isFinite(opacity) &&
		opacity >= 0 &&
		opacity < 1
	) {
		return themeColorRefToSolidFill({ ...ref, alpha: Math.max(0, Math.min(1, opacity)) });
	}
	return themeColorRefToSolidFill(ref);
}

function fractionOf(node: XmlObject, key: string): number | undefined {
	const raw = (node[key] as XmlObject | undefined)?.['@_val'];
	if (raw === undefined || raw === null || raw === '') {
		return undefined;
	}
	const text = String(raw).trim();
	const value = Number.parseFloat(text);
	if (!Number.isFinite(value)) {
		return undefined;
	}
	return text.endsWith('%') ? value / 100 : value / 100000;
}

const TYPED_CHILDREN = new Set(['@_val', 'a:tint', 'a:shade', 'a:lumMod', 'a:lumOff', 'a:alpha']);

/**
 * Read a typed ref back from a parsed `a:schemeClr` node (the object stored
 * under the `'a:schemeClr'` key). Returns `undefined` when the node is not a
 * scheme colour or carries a transform this typed model does not express
 * (e.g. `a:satMod`), so the caller keeps the raw XML instead of lossy typing.
 */
export function themeColorRefFromSchemeClr(
	node: XmlObject | undefined,
): PptxThemeColorRef | undefined {
	if (!node) {
		return undefined;
	}
	const scheme = node['@_val'];
	if (!isThemeColorSchemeName(scheme)) {
		return undefined;
	}
	if (Object.keys(node).some((key) => !TYPED_CHILDREN.has(key))) {
		return undefined;
	}
	const ref: PptxThemeColorRef = { scheme };
	const tint = fractionOf(node, 'a:tint');
	const shade = fractionOf(node, 'a:shade');
	const lumMod = fractionOf(node, 'a:lumMod');
	const lumOff = fractionOf(node, 'a:lumOff');
	const alpha = fractionOf(node, 'a:alpha');
	if (tint !== undefined) {
		ref.tint = tint;
	}
	if (shade !== undefined) {
		ref.shade = shade;
	}
	if (lumMod !== undefined) {
		ref.lumMod = lumMod;
	}
	if (lumOff !== undefined) {
		ref.lumOff = lumOff;
	}
	if (alpha !== undefined) {
		ref.alpha = alpha;
	}
	return ref;
}

/**
 * Read a typed ref from a colour-choice container (a parsed `a:solidFill`),
 * i.e. `{ 'a:schemeClr': {...} }`.
 */
export function themeColorRefFromColorChoice(
	choice: XmlObject | undefined,
): PptxThemeColorRef | undefined {
	return themeColorRefFromSchemeClr(choice?.['a:schemeClr'] as XmlObject | undefined);
}

/**
 * Resolve a ref to a `#rrggbb` hex against a theme colour map (the loaded
 * deck's `themeColorMap`, which already carries `bg1`/`tx1`/`bg2`/`tx2`
 * aliases when a `p:clrMap` was applied). Returns `undefined` when the scheme
 * slot is unknown to the map.
 */
export function resolveThemeColorRef(
	ref: PptxThemeColorRef,
	themeColorMap: Readonly<Record<string, string>> | undefined,
): string | undefined {
	if (!themeColorMap) {
		return undefined;
	}
	const base = themeColorMap[ref.scheme] ?? themeColorMap[DEFAULT_ALIASES[ref.scheme] ?? ''];
	if (!base) {
		return undefined;
	}
	const node = themeColorRefToXml(ref);
	delete node['a:alpha'];
	return normalizeHexColor(
		applyDrawingColorTransforms(normalizeHexColor(base), node),
	).toLowerCase();
}
