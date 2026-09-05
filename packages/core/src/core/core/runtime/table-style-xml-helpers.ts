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
