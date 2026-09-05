/**
 * table-style-xml-helpers.ts - tiny XML-object helpers shared by every
 * table-style write-side module (`table-style-fill-write.ts`,
 * `table-style-text-write.ts`, `table-style-border-write.ts`,
 * `table-style-save.ts`).
 *
 * @module table-style-xml-helpers
 */
import type { ParsedTableStyleFill, XmlObject } from '../../types';

/**
 * Get (or lazily create) a single-valued XML child. Unwraps a repeated-
 * element array to its first entry, since every table-style child this
 * writer touches only ever appears once in a valid document.
 */
export function ensureChild(parent: XmlObject, key: string): XmlObject {
	const existing = parent[key];
	if (Array.isArray(existing) && existing.length > 0) {
		return existing[0] as XmlObject;
	}
	if (existing && typeof existing === 'object') {
		return existing as XmlObject;
	}
	const created: XmlObject = {};
	parent[key] = created;
	return created;
}

/**
 * Structural equality of two parsed table-style facets (a fill, a text style,
 * one border side, a cell3D), insensitive to key order and to `undefined`
 * members. The writers use it to leave an XML node alone when the typed value
 * the caller hands back still describes that node: a typed edit to ONE facet
 * of ONE section must not re-emit every other facet lossily (the parse side
 * rounds `a:ln/@w` to whole pixels and drops `cmpd`/`cap`/`algn`, so a
 * rebuilt border would silently change an untouched 1pt line to 9525 EMU).
 */
export function facetEquals(a: unknown, b: unknown): boolean {
	return canonicalJson(a) === canonicalJson(b);
}

function canonicalJson(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
	}
	if (value && typeof value === 'object') {
		const record = value as Record<string, unknown>;
		const keys = Object.keys(record)
			.filter((key) => record[key] !== undefined)
			.sort();
		return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
	}
	return JSON.stringify(value) ?? 'undefined';
}

/**
 * The `EG_ColorChoice` element names (§20.1.2.3) a colour-bearing DrawingML
 * node may carry, used to clear a node's colour before writing a new one.
 */
export const COLOR_CHOICE_KEYS: readonly string[] = [
	'a:scrgbClr',
	'a:srgbClr',
	'a:hslClr',
	'a:sysClr',
	'a:schemeClr',
	'a:prstClr',
];

/** Build an `a:schemeClr`/`a:srgbClr` colour-choice XML node for a resolved fill. */
export function colorChoiceXml(fill: ParsedTableStyleFill): XmlObject {
	if (fill.schemeColor) {
		const node: XmlObject = { '@_val': fill.schemeColor };
		if (fill.tint !== undefined) {
			node['a:tint'] = { '@_val': String(fill.tint) };
		}
		if (fill.shade !== undefined) {
			node['a:shade'] = { '@_val': String(fill.shade) };
		}
		return { 'a:schemeClr': node };
	}
	if (fill.color) {
		const node: XmlObject = { '@_val': fill.color.replace('#', '') };
		if (fill.tint !== undefined) {
			node['a:tint'] = { '@_val': String(fill.tint) };
		}
		if (fill.shade !== undefined) {
			node['a:shade'] = { '@_val': String(fill.shade) };
		}
		return { 'a:srgbClr': node };
	}
	return {};
}
