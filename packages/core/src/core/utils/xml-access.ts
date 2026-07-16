/**
 * Typed accessors for fast-xml-parser output.
 *
 * The parser (see `PptxRuntimeDependencyFactory.createParser`) is configured
 * with `attributeNamePrefix: '@_'`, `parseAttributeValue: false`, and
 * `parseTagValue: false`, so every leaf value is a string. Child elements
 * appear keyed by their (namespaced) tag name; when an element has a single
 * occurrence the value is an object, when it repeats the value is an array
 * of objects. Text content sits under the `#text` key.
 *
 * These helpers normalize that shape so callers do not need to remember the
 * prefix, the single-vs-array duality, or that every leaf is `unknown`.
 * Prefer these over indexing into {@link XmlObject} directly.
 *
 * @module xml-access
 */

import type { XmlObject } from '../types/common';

const ATTR_PREFIX = '@_';
const TEXT_KEY = '#text';

function isXmlObject(value: unknown): value is XmlObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Coerce an unknown leaf value into a string.
 *
 * fast-xml-parser is configured to leave values as strings, but defensive
 * coercion lets us tolerate alternative parser configs (e.g. integration
 * tests that enable value parsing).
 */
function coerceString(value: unknown): string | undefined {
	if (typeof value === 'string') {
		return value;
	}
	if (typeof value === 'number' || typeof value === 'boolean') {
		return String(value);
	}
	return undefined;
}

/**
 * Get a single child element by tag name. If the tag repeats, returns the
 * first occurrence. Returns `undefined` when the node is absent or not an
 * object.
 */
export function xmlChild(node: unknown, key: string): XmlObject | undefined {
	if (!isXmlObject(node)) {
		return undefined;
	}
	const value = node[key];
	if (Array.isArray(value)) {
		const first = value[0];
		return isXmlObject(first) ? first : undefined;
	}
	return isXmlObject(value) ? value : undefined;
}

/**
 * Get all children with the given tag name, normalized to an array. fast-xml-parser
 * emits a single object when an element appears once and an array when it
 * repeats; this helper collapses that distinction.
 */
export function xmlChildren(node: unknown, key: string): XmlObject[] {
	if (!isXmlObject(node)) {
		return [];
	}
	const value = node[key];
	if (value === undefined || value === null) {
		return [];
	}
	if (Array.isArray(value)) {
		return value.filter(isXmlObject);
	}
	return isXmlObject(value) ? [value] : [];
}

/**
 * Test whether an XML child element is present, including self-closing empty
 * elements that fast-xml-parser may represent as an empty string.
 */
export function xmlHasChild(node: unknown, key: string): boolean {
	return isXmlObject(node) && Object.hasOwn(node, key);
}

/**
 * Read an attribute value. Pass the unprefixed name (e.g. `"id"` or
 * `"r:embed"`); the `@_` prefix is added internally.
 */
export function xmlAttr(node: unknown, name: string): string | undefined {
	if (!isXmlObject(node)) {
		return undefined;
	}
	return coerceString(node[ATTR_PREFIX + name]);
}

/**
 * Read an attribute as a number, returning `undefined` when missing or
 * unparseable.
 */
export function xmlAttrNumber(node: unknown, name: string): number | undefined {
	const raw = xmlAttr(node, name);
	if (raw === undefined) {
		return undefined;
	}
	const parsed = Number(raw);
	return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Read an attribute as a boolean using OOXML's `"1" | "true"` truthy convention.
 * Returns `undefined` when the attribute is absent.
 */
export function xmlAttrBool(node: unknown, name: string): boolean | undefined {
	const raw = xmlAttr(node, name);
	if (raw === undefined) {
		return undefined;
	}
	const normalized = raw.trim().toLowerCase();
	if (normalized === '1' || normalized === 'true') {
		return true;
	}
	if (normalized === '0' || normalized === 'false') {
		return false;
	}
	return undefined;
}

/**
 * Read the text content of an element (`#text` key) or the element itself if
 * fast-xml-parser collapsed it to a bare string.
 */
export function xmlText(node: unknown): string | undefined {
	if (typeof node === 'string') {
		return node;
	}
	if (!isXmlObject(node)) {
		return undefined;
	}
	return coerceString(node[TEXT_KEY]);
}

/**
 * Walk a path of child element tag names. Equivalent to chained
 * {@link xmlChild} calls. Useful for the deep optional-chain accesses that
 * dominate OOXML parsing.
 *
 * @example
 * ```ts
 * const blip = xmlPath(slideXml, 'p:sld', 'p:cSld', 'p:bg', 'p:bgPr', 'a:blipFill', 'a:blip');
 * const rEmbed = xmlAttr(blip, 'r:embed');
 * ```
 */
export function xmlPath(node: unknown, ...keys: string[]): XmlObject | undefined {
	let current: XmlObject | undefined = isXmlObject(node) ? node : undefined;
	for (const key of keys) {
		if (!current) {
			return undefined;
		}
		current = xmlChild(current, key);
	}
	return current;
}

/**
 * `true` when `value` is an {@link XmlObject} — non-null, non-array object.
 * Exposed for the few call sites that need to narrow a raw `unknown` before
 * passing it through other helpers.
 */
export function isXmlNode(value: unknown): value is XmlObject {
	return isXmlObject(value);
}
