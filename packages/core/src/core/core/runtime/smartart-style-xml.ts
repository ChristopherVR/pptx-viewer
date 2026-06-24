/**
 * SmartArt per-node style serialisation helpers.
 *
 * Given a parsed data point (`dgm:pt`) and a node's
 * {@link PptxSmartArtNodeStyle}, write the override into the point's `spPr`
 * (solid fill + line colour) and the first run's `rPr` (`@_b` / `@_i` + solid
 * fill) so it survives a load -> edit -> save round-trip. All other point XML
 * (prSet / spPr extras / extLst / run text) is preserved: only the specific
 * keys an override touches are added or replaced.
 *
 * Split out of `smartart-xml-builders.ts` to keep each file within the
 * per-file line budget. Pure XmlObject manipulation; no DOM, no IO.
 *
 * @module smartart-style-xml
 */

import type { XmlObject } from '../../types';
import type { PptxSmartArtNodeStyle } from '../../types/smart-art';

/** Strip a namespace prefix from an XML key (e.g. `dgm:t` -> `t`). */
function localName(key: string): string {
	const idx = key.indexOf(':');
	return idx >= 0 ? key.slice(idx + 1) : key;
}

/** Find the existing key (any prefix) whose local name matches, else undefined. */
function findKey(obj: XmlObject, local: string): string | undefined {
	return Object.keys(obj).find((k) => localName(k) === local);
}

/** Read or create a child object under `obj` for local name `local`. */
function ensureChild(obj: XmlObject, local: string, prefixedFallback: string): XmlObject {
	const key = findKey(obj, local) ?? prefixedFallback;
	const existing = obj[key];
	if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
		return existing as XmlObject;
	}
	const created: XmlObject = {};
	obj[key] = created;
	return created;
}

/** Normalise a hex colour to the 6-digit upper-case form expected by `srgbClr`. */
function hexValue(color: string): string {
	return color.replace(/^#/u, '').toUpperCase();
}

/** Build an `a:solidFill` body for a hex colour. */
function solidFill(color: string): XmlObject {
	return { 'a:srgbClr': { '@_val': hexValue(color) } };
}

/** Set a solid fill (replacing any existing) directly on a parent object. */
function setSolidFill(parent: XmlObject, color: string): void {
	const key = findKey(parent, 'solidFill') ?? 'a:solidFill';
	parent[key] = solidFill(color);
}

/** Apply fill + line colour onto a point's `spPr`, creating it when absent. */
function applyShapeStyle(pt: XmlObject, style: PptxSmartArtNodeStyle): void {
	if (style.fillColor === undefined && style.lineColor === undefined) {
		return;
	}
	const spPr = ensureChild(pt, 'spPr', 'dgm:spPr');
	if (style.fillColor !== undefined) {
		setSolidFill(spPr, style.fillColor);
	}
	if (style.lineColor !== undefined) {
		const ln = ensureChild(spPr, 'ln', 'a:ln');
		setSolidFill(ln, style.lineColor);
	}
}

/** Get the first run's `rPr` object of a point's first paragraph, creating path. */
function ensureFirstRunRPr(pt: XmlObject): XmlObject | undefined {
	const tKey = findKey(pt, 't');
	if (!tKey) {
		return undefined;
	}
	const body = pt[tKey];
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		return undefined;
	}
	const pKey = findKey(body as XmlObject, 'p');
	if (!pKey) {
		return undefined;
	}
	const paragraph = (body as XmlObject)[pKey];
	const firstP = Array.isArray(paragraph)
		? (paragraph[0] as XmlObject | undefined)
		: (paragraph as XmlObject);
	if (!firstP || typeof firstP !== 'object') {
		return undefined;
	}
	const rKey = findKey(firstP, 'r');
	if (!rKey) {
		return undefined;
	}
	const run = firstP[rKey];
	const firstR = Array.isArray(run) ? (run[0] as XmlObject | undefined) : (run as XmlObject);
	if (!firstR || typeof firstR !== 'object') {
		return undefined;
	}
	return ensureChild(firstR, 'rPr', 'a:rPr');
}

/** Apply bold / italic / font colour onto the first run's `rPr`. */
function applyRunStyle(pt: XmlObject, style: PptxSmartArtNodeStyle): void {
	if (style.bold === undefined && style.italic === undefined && style.fontColor === undefined) {
		return;
	}
	const rPr = ensureFirstRunRPr(pt);
	if (!rPr) {
		return;
	}
	if (style.bold !== undefined) {
		rPr['@_b'] = style.bold ? '1' : '0';
	}
	if (style.italic !== undefined) {
		rPr['@_i'] = style.italic ? '1' : '0';
	}
	if (style.fontColor !== undefined) {
		setSolidFill(rPr, style.fontColor);
	}
}

/**
 * Write a node's per-node visual override into the parsed point XML in place.
 *
 * No-op when `style` is undefined or empty. Touches only the keys the override
 * concerns; everything else on the point is left verbatim.
 */
export function applySmartArtNodeStyleToPoint(
	pt: XmlObject,
	style: PptxSmartArtNodeStyle | undefined,
): void {
	if (!style || Object.keys(style).length === 0) {
		return;
	}
	applyShapeStyle(pt, style);
	applyRunStyle(pt, style);
}
